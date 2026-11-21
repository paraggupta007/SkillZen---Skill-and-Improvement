// Orchestrate interview questions, answer scoring, and completion via interfaces.
import { z } from "zod";
import { AppError } from "../../core/errors.js";
import type { EventBus } from "../../core/event-bus.js";
import type { JsonGenerator } from "../../ai/json-generator.js";
import type {
  IEvaluator,
  SpeechMetrics,
} from "../../domain/evaluation/evaluator.js";
import type { PromptBuilder } from "../../domain/prompts/prompt-builder.js";
import type { RoundFactory } from "../../domain/rounds/round-factory.js";
import type { RoundContext } from "../../domain/rounds/interview-round.js";
import type {
  CreateInterview,
  IInterviewRepository,
  Interview,
  InterviewTurn,
  QuestionCandidate,
} from "./interview-repository.js";
const questionSchema = z.object({
  question: z.string().trim().min(1).max(2000),
  category: z.string().trim().min(1).max(120),
  isFollowup: z.boolean(),
});
type StreamOptions = {
  onChunk?: (chunk: string) => void;
  signal?: AbortSignal;
};
/** Coordinate an authenticated interview without knowing its storage implementation. */
export class InterviewService {
  private readonly prefetched = new Map<
    string,
    { expected: number; candidate: QuestionCandidate; expires: number }
  >();
  /** Inject storage, generation, evaluation, round registry and event publisher. */
  constructor(
    private readonly repo: IInterviewRepository,
    private readonly rounds: RoundFactory,
    private readonly prompts: PromptBuilder,
    private readonly generator: Pick<JsonGenerator, "generate">,
    private readonly evaluator: IEvaluator,
    private readonly events: Pick<EventBus, "publish">,
  ) {}
  /** Create a session for the authenticated user. */
  async create(userId: string, input: CreateInterview) {
    try {
      this.rounds.create(input.roundType);
    } catch {
      throw new AppError(400, "INVALID_ROUND", "Unknown interview round");
    }
    return this.repo.create(userId, input);
  }
  /** Return an owned interview and its turns. */
  async get(userId: string, id: string) {
    const interview = await this.owned(userId, id);
    return { interview, turns: await this.repo.turns(id) };
  }
  /** List owned interview sessions. */
  async list(userId: string) {
    return this.repo.list(userId);
  }
  private async owned(userId: string, id: string) {
    const interview = await this.repo.get(userId, id);
    if (!interview) throw new AppError(404, "NOT_FOUND", "Interview not found");
    return interview;
  }
  private context(interview: Interview, turns: InterviewTurn[]): RoundContext {
    return {
      role: interview.role,
      difficulty: interview.difficulty,
      jobDescription: interview.jdText ?? undefined,
      history: turns
        .filter((turn) => turn.answer)
        .slice(-5)
        .map((turn) => ({
          question: turn.question.text,
          answer: turn.answer!.answerText,
        })),
    };
  }
  private async question(
    interview: Interview,
    context: RoundContext,
    options: StreamOptions = {},
  ) {
    const req = this.rounds
      .create(interview.roundType)
      .buildQuestionPrompt(context, this.prompts);
    req.signal = options.signal;
    return this.generator.generate(req, questionSchema, options.onChunk);
  }
  /** Return an existing pending question or generate and atomically add a new one. */
  async next(userId: string, id: string, options: StreamOptions = {}) {
    const interview = await this.owned(userId, id);
    if (interview.status !== "in_progress")
      throw new AppError(
        409,
        "INTERVIEW_CLOSED",
        "Interview is not in progress",
      );
    const turns = await this.repo.turns(id);
    const pending = turns.find((turn) => !turn.answer);
    if (pending) return pending.question;
    if (turns.length >= interview.totalQuestions)
      throw new AppError(
        409,
        "QUESTIONS_FINISHED",
        "All questions have been answered",
      );
    const key = `${userId}:${id}`;
    const cached = this.prefetched.get(key);
    this.prefetched.delete(key);
    const candidate =
      cached && cached.expected === turns.length && cached.expires > Date.now()
        ? cached.candidate
        : await this.question(
            interview,
            this.context(interview, turns),
            options,
          );
    return (await this.repo.addQuestion(userId, id, candidate)).question;
  }
  /** Evaluate an answer while preparing a candidate next question, then persist atomically. */
  async answer(
    userId: string,
    id: string,
    questionId: string,
    answerText: string,
    speech?: SpeechMetrics,
    options: StreamOptions = {},
  ) {
    const interview = await this.owned(userId, id);
    if (interview.status !== "in_progress")
      throw new AppError(
        409,
        "INTERVIEW_CLOSED",
        "Interview is not in progress",
      );
    const turns = await this.repo.turns(id);
    const current = turns.find((turn) => turn.question.id === questionId);
    if (!current) throw new AppError(404, "NOT_FOUND", "Question not found");
    if (current.answer)
      throw new AppError(409, "ALREADY_ANSWERED", "Question already answered");
    const context = this.context(interview, turns);
    const evalPromise = this.evaluator.evaluate({
      context: {
        ...context,
        question: current.question.text,
        answer: answerText,
      },
      round: this.rounds.create(interview.roundType),
      speech,
      ...options,
    });
    const nextContext: RoundContext = {
      ...context,
      history: [
        ...context.history,
        { question: current.question.text, answer: answerText },
      ].slice(-5),
    };
    const prefetchAbort = new AbortController();
    const prefetchSignal = options.signal
      ? AbortSignal.any([options.signal, prefetchAbort.signal])
      : prefetchAbort.signal;
    const candidatePromise =
      turns.length < interview.totalQuestions
        ? this.question(interview, nextContext, {
            signal: prefetchSignal,
          }).catch(() => undefined)
        : Promise.resolve(undefined);
    let evaluation;
    try {
      evaluation = await evalPromise;
      if (options.signal?.aborted)
        throw new Error("Interview request cancelled");
      await this.repo.saveAnswer(
        userId,
        id,
        questionId,
        answerText,
        evaluation,
        speech,
      );
    } catch (error) {
      prefetchAbort.abort();
      throw error;
    }
    // Prefetch never delays validated feedback. Ignore stale or failed candidates.
    void candidatePromise
      .then(async (candidate) => {
        if (!candidate || prefetchSignal.aborted) return;
        const latest = await this.repo.get(userId, id);
        const currentTurns = await this.repo.turns(id);
        if (
          !latest ||
          latest.status !== "in_progress" ||
          currentTurns.length !== turns.length ||
          currentTurns.some((turn) => !turn.answer)
        )
          return;
        const key = `${userId}:${id}`;
        this.prefetched.delete(key);
        this.prefetched.set(key, {
          expected: turns.length,
          candidate,
          expires: Date.now() + 60000,
        });
        while (this.prefetched.size > 100) {
          const first = this.prefetched.keys().next().value;
          if (!first) break;
          this.prefetched.delete(first);
        }
      })
      .catch(() => undefined);
    return evaluation;
  }
  /** Complete a fully answered interview and notify observers once. */
  async complete(userId: string, id: string) {
    const result = await this.repo.complete(userId, id);
    this.prefetched.delete(`${userId}:${id}`);
    if (result.changed)
      void this.events
        .publish("interview.completed", { interviewId: id, userId })
        .catch(() => undefined);
    return result.interview;
  }
}
