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
  options: { userRepository?: IUserRepository } = {},
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
  const providers = names.map((name) => new CachedProvider(byName.get(name)!));
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
  return {
    rounds,
    evaluator,
    env,
    logger,
    events: new EventBus(),
    database,
    auth,
    llm,
    prompts,
    jsonGenerator,
  };
}
/** Dependency container type for constructor injection. */
export type Container = ReturnType<typeof createContainer>;
