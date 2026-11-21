// Transactional PostgreSQL persistence for interview state transitions.
import { and, asc, desc, eq } from "drizzle-orm";
import type { createDatabase } from "../../db/client.js";
import {
  interviews,
  questions,
  answers,
  evaluations,
} from "../../db/schema.js";
import { AppError } from "../../core/errors.js";
import type {
  CreateInterview,
  IInterviewRepository,
  QuestionCandidate,
} from "./interview-repository.js";
import type {
  Evaluation,
  SpeechMetrics,
} from "../../domain/evaluation/evaluator.js";
/** PostgreSQL repository; a row lock serializes writes for each interview. */
export class DrizzleInterviewRepository implements IInterviewRepository {
  /** Inject the shared database client. */
  constructor(private readonly db: ReturnType<typeof createDatabase>["db"]) {}
  /** Create an interview owned by the supplied user. */
  async create(userId: string, input: CreateInterview) {
    const [row] = await this.db
      .insert(interviews)
      .values({ userId, ...input })
      .returning();
    if (!row) throw new Error("Insert failed");
    return row;
  }
  /** Find an owned interview without revealing other users' data. */
  async get(userId: string, id: string) {
    return (
      await this.db
        .select()
        .from(interviews)
        .where(and(eq(interviews.id, id), eq(interviews.userId, userId)))
        .limit(1)
    )[0];
  }
  /** List the latest 100 interviews for a user. */
  async list(userId: string) {
    return this.db
      .select()
      .from(interviews)
      .where(eq(interviews.userId, userId))
      .orderBy(desc(interviews.startedAt))
      .limit(100);
  }
  /** Read interview turns; the service first verifies ownership. */
  async turns(interviewId: string) {
    return this.db
      .select({ question: questions, answer: answers, evaluation: evaluations })
      .from(questions)
      .leftJoin(answers, eq(answers.questionId, questions.id))
      .leftJoin(evaluations, eq(evaluations.answerId, answers.id))
      .where(eq(questions.interviewId, interviewId))
      .orderBy(asc(questions.orderNo));
  }
  /** Atomically reuse an unanswered question or insert the next one. */
  async addQuestion(userId: string, id: string, candidate: QuestionCandidate) {
    return this.db.transaction(async (tx) => {
      const [interview] = await tx
        .select()
        .from(interviews)
        .where(and(eq(interviews.id, id), eq(interviews.userId, userId)))
        .for("update");
      if (!interview)
        throw new AppError(404, "NOT_FOUND", "Interview not found");
      if (interview.status !== "in_progress")
        throw new AppError(
          409,
          "INTERVIEW_CLOSED",
          "Interview is not in progress",
        );
      const turns = await tx
        .select({
          question: questions,
          answer: answers,
          evaluation: evaluations,
        })
        .from(questions)
        .leftJoin(answers, eq(answers.questionId, questions.id))
        .leftJoin(evaluations, eq(evaluations.answerId, answers.id))
        .where(eq(questions.interviewId, id))
        .orderBy(asc(questions.orderNo));
      const pending = turns.find((turn) => !turn.answer);
      if (pending) return pending;
      if (turns.length >= interview.totalQuestions)
        throw new AppError(
          409,
          "QUESTIONS_FINISHED",
          "All questions have been answered",
        );
      const parent = candidate.isFollowup
        ? turns.at(-1)?.question.id
        : undefined;
      const [question] = await tx
        .insert(questions)
        .values({
          interviewId: id,
          orderNo: turns.length + 1,
          text: candidate.question,
          category: candidate.category,
          isFollowup: Boolean(parent),
          parentQuestionId: parent,
          generatedBy: "ai",
        })
        .returning();
      if (!question) throw new Error("Insert failed");
      return { question, answer: null, evaluation: null };
    });
  }
  /** Atomically save one answer and its evaluation after locking the interview. */
  async saveAnswer(
    userId: string,
    id: string,
    questionId: string,
    answerText: string,
    evaluation: Evaluation,
    speech?: SpeechMetrics,
  ) {
    await this.db.transaction(async (tx) => {
      const [interview] = await tx
        .select()
        .from(interviews)
        .where(and(eq(interviews.id, id), eq(interviews.userId, userId)))
        .for("update");
      if (!interview)
        throw new AppError(404, "NOT_FOUND", "Interview not found");
      if (interview.status !== "in_progress")
        throw new AppError(
          409,
          "INTERVIEW_CLOSED",
          "Interview is not in progress",
        );
      const [question] = await tx
        .select()
        .from(questions)
        .where(
          and(eq(questions.id, questionId), eq(questions.interviewId, id)),
        );
      if (!question) throw new AppError(404, "NOT_FOUND", "Question not found");
      const [existing] = await tx
        .select()
        .from(answers)
        .where(eq(answers.questionId, questionId));
      if (existing)
        throw new AppError(
          409,
          "ALREADY_ANSWERED",
          "Question already answered",
        );
      const { correctness, clarity, depth, relevance, overall } =
        evaluation.metrics;
      if (
        [correctness, clarity, depth, relevance, overall].some(
          (value) => value === undefined,
        ) ||
        !evaluation.idealAnswer
      )
        throw new Error("Incomplete evaluation");
      const [answer] = await tx
        .insert(answers)
        .values({
          questionId,
          answerText,
          audioDurationSec: speech ? Math.round(speech.durationSeconds) : null,
          speechMetrics: speech ?? null,
        })
        .returning();
      if (!answer) throw new Error("Insert failed");
      await tx
        .insert(evaluations)
        .values({
          answerId: answer.id,
          correctness: correctness!,
          clarity: clarity!,
          depth: depth!,
          relevance: relevance!,
          overall: overall!,
          feedback: evaluation.feedback.join("\n"),
          idealAnswer: evaluation.idealAnswer,
          raw: evaluation,
        });
    });
  }
  /** Mark a fully answered interview complete exactly once. */
  async complete(userId: string, id: string) {
    return this.db.transaction(async (tx) => {
      const [interview] = await tx
        .select()
        .from(interviews)
        .where(and(eq(interviews.id, id), eq(interviews.userId, userId)))
        .for("update");
      if (!interview)
        throw new AppError(404, "NOT_FOUND", "Interview not found");
      if (interview.status === "completed")
        return { interview, changed: false };
      if (interview.status !== "in_progress")
        throw new AppError(
          409,
          "INTERVIEW_CLOSED",
          "Interview is not in progress",
        );
      const turns = await tx
        .select({ question: questions.id, answer: answers.id })
        .from(questions)
        .leftJoin(answers, eq(answers.questionId, questions.id))
        .where(eq(questions.interviewId, id));
      if (
        turns.length !== interview.totalQuestions ||
        turns.some((turn) => !turn.answer)
      )
        throw new AppError(
          409,
          "INTERVIEW_INCOMPLETE",
          "Answer every question before completing the interview",
        );
      const [updated] = await tx
        .update(interviews)
        .set({ status: "completed", completedAt: new Date() })
        .where(eq(interviews.id, id))
        .returning();
      if (!updated) throw new Error("Update failed");
      return { interview: updated, changed: true };
    });
  }
}
