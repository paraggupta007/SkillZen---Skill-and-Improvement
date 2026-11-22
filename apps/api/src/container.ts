// Composition root: construct and share long-lived dependencies here.
import { GroqProvider } from "./ai/providers/groq-provider.js";
import { GeminiProvider } from "./ai/providers/gemini-provider.js";
import { OpenRouterProvider } from "./ai/providers/openrouter-provider.js";
import { LLMRouter } from "./ai/llm-router.js";
import { DrizzleUsageRepository } from "./ai/usage-repository.js";
import { CachedProvider } from "./ai/cache/cached-provider.js";
import { PromptBuilder } from "./domain/prompts/prompt-builder.js";
import { JsonGenerator } from "./ai/json-generator.js";
import { RoundFactory } from "./domain/rounds/round-factory.js";
import { TechnicalRound } from "./domain/rounds/technical-round.js";
import { HRRound } from "./domain/rounds/hr-round.js";
import { BehavioralRound } from "./domain/rounds/behavioral-round.js";
import { LLMAnswerEvaluator } from "./domain/evaluation/llm-answer-evaluator.js";
import { SpeechMetricsEvaluator } from "./domain/evaluation/speech-metrics-evaluator.js";
import { CompositeEvaluator } from "./domain/evaluation/composite-evaluator.js";
import { InterviewService } from "./modules/interviews/interview-service.js";
import { DrizzleInterviewRepository } from "./modules/interviews/drizzle-interview-repository.js";
import type { IInterviewRepository } from "./modules/interviews/interview-repository.js";
import type { ILLMProvider } from "./ai/types.js";
import {
  GroqTranscriber,
  type ITranscriber,
} from "./modules/speech/transcriber.js";
import { CameraService } from "./modules/camera/camera-service.js";
import { DrizzleCameraRepository } from "./modules/camera/drizzle-camera-repository.js";
import type { ICameraRepository } from "./modules/camera/camera-repository.js";
import { CameraEvaluator } from "./domain/evaluation/camera-evaluator.js";
import { ResumeService } from "./modules/resumes/resume-service.js";
import { DrizzleResumeRepository } from "./modules/resumes/drizzle-resume-repository.js";
import type { IResumeRepository } from "./modules/resumes/resume-repository.js";
import {
  PdfResumeTextExtractor,
  type IResumeTextExtractor,
} from "./modules/resumes/pdf-extractor.js";
import { ResumePrompt } from "./domain/prompts/resume-prompt.js";
import { ReportPdfRenderer } from "./modules/reports/pdf-renderer.js";
import { ReportService } from "./modules/reports/report-service.js";
import { DrizzleReportRepository } from "./modules/reports/drizzle-report-repository.js";
import type { IReportRepository } from "./modules/reports/report-repository.js";
import { ReportPrompt } from "./domain/prompts/report-prompt.js";
import { AnalyticsService } from "./modules/analytics/analytics-service.js";
import { DrizzleAnalyticsRepository } from "./modules/analytics/drizzle-analytics-repository.js";
import type { IAnalyticsRepository } from "./modules/analytics/analytics-repository.js";
import type { Env } from "./config/env.js";
import { EventBus } from "./core/event-bus.js";
import { logger } from "./core/logger.js";
import type { IUserRepository } from "./modules/users/user-repository.js";
import { DrizzleUserRepository } from "./modules/users/drizzle-user-repository.js";
import { AuthService } from "./modules/auth/auth-service.js";
import { createDatabase } from "./db/client.js";
/** Build the application's shared dependencies. */
export function createContainer(
  env: Env,
  options: {
    userRepository?: IUserRepository;
    interviewRepository?: IInterviewRepository;
    reportRepository?: IReportRepository;
    resumeRepository?: IResumeRepository;
    cameraRepository?: ICameraRepository;
    resumeExtractor?: IResumeTextExtractor;
    analyticsRepository?: IAnalyticsRepository;
    providers?: ILLMProvider[];
    transcriber?: ITranscriber;
    subscribeReports?: boolean;
  } = {},
) {
  const database = env.DATABASE_URL
    ? createDatabase(env.DATABASE_URL)
    : undefined;
  const repository =
    options.userRepository ??
    (database ? new DrizzleUserRepository(database.db) : undefined);
  const auth =
    repository && env.JWT_SECRET && env.JWT_SECRET.length >= 32
      ? new AuthService(repository, env.JWT_SECRET)
      : undefined;
  // Add a provider with one registration here; order remains environment-controlled.
  const registered = [
    new GroqProvider(env.GROQ_API_KEY),
    new GeminiProvider(env.GEMINI_API_KEY),
    new OpenRouterProvider(env.OPENROUTER_API_KEY),
  ];
  const byName = new Map(
    registered.map((provider) => [provider.name, provider]),
  );
  const names = env.LLM_PROVIDER_ORDER.split(",")
    .map((name) => name.trim())
    .filter(Boolean);
  if (
    new Set(names).size !== names.length ||
    names.some((name) => !byName.has(name))
  )
    throw new Error("Invalid LLM_PROVIDER_ORDER");
  const providers =
    options.providers ??
    names.map((name) => new CachedProvider(byName.get(name)!));
  const llm = new LLMRouter(
    providers,
    database ? new DrizzleUsageRepository(database.db) : undefined,
  );
  const prompts = new PromptBuilder();
  const jsonGenerator = new JsonGenerator(llm, prompts);
  const rounds = new RoundFactory();
  rounds.register("technical", TechnicalRound);
  rounds.register("hr", HRRound);
  rounds.register("behavioral", BehavioralRound);
  // Add each evaluator with one registration here.
  const evaluator = new CompositeEvaluator([
    new LLMAnswerEvaluator(jsonGenerator, prompts),
    new SpeechMetricsEvaluator(),
  ]);
  const events = new EventBus();
  const resumeRepo =
    options.resumeRepository ??
    (database ? new DrizzleResumeRepository(database.db) : undefined);
  const resumeService = resumeRepo
    ? new ResumeService(
        resumeRepo,
        options.resumeExtractor ?? new PdfResumeTextExtractor(),
        jsonGenerator,
        new ResumePrompt(prompts),
      )
    : undefined;
  const interviewRepo =
    options.interviewRepository ??
    (database ? new DrizzleInterviewRepository(database.db) : undefined);
  const interviewService = interviewRepo
    ? new InterviewService(
        interviewRepo,
        rounds,
        prompts,
        jsonGenerator,
        evaluator,
        events,
        resumeRepo,
      )
    : undefined;
  const cameraRepo =
    options.cameraRepository ??
    (database ? new DrizzleCameraRepository(database.db) : undefined);
  const cameraService =
    cameraRepo && interviewRepo
      ? new CameraService(interviewRepo, cameraRepo, new CameraEvaluator())
      : undefined;
  const reportRepo =
    options.reportRepository ??
    (database ? new DrizzleReportRepository(database.db) : undefined);
  const reportService =
    reportRepo && interviewRepo
      ? new ReportService(
          interviewRepo,
          reportRepo,
          jsonGenerator,
          new ReportPrompt(prompts),
          new ReportPdfRenderer(),
        )
      : undefined;
  if (reportService && options.subscribeReports !== false)
    events.subscribe("interview.completed", ({ userId, interviewId }) =>
      reportService.schedule(userId, interviewId),
    );
  const analyticsRepo =
    options.analyticsRepository ??
    (database ? new DrizzleAnalyticsRepository(database.db) : undefined);
  const analyticsService = analyticsRepo
    ? new AnalyticsService(analyticsRepo)
    : undefined;
  return {
    camera: cameraService,
    resumes: resumeService,
    transcriber:
      options.transcriber ??
      (env.GROQ_API_KEY ? new GroqTranscriber(env.GROQ_API_KEY) : undefined),
    reports: reportService,
    analytics: analyticsService,
    interviews: interviewService,
    rounds,
    evaluator,
    env,
    logger,
    events,
    database,
    auth,
    llm,
    prompts,
    jsonGenerator,
  };
}
/** Dependency container type for constructor injection. */
export type Container = ReturnType<typeof createContainer>;
