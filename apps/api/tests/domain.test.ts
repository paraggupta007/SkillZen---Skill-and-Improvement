// Test extensible round and evaluator strategies with a fake model.
import { describe, expect, it } from "vitest";
import { JsonGenerator } from "../src/ai/json-generator.js";
import { FakeLLMProvider } from "../src/ai/providers/fake-provider.js";
import { PromptBuilder } from "../src/domain/prompts/prompt-builder.js";
import {
  InterviewRound,
  type EvalContext,
} from "../src/domain/rounds/interview-round.js";
import { TechnicalRound } from "../src/domain/rounds/technical-round.js";
import { HRRound } from "../src/domain/rounds/hr-round.js";
import { BehavioralRound } from "../src/domain/rounds/behavioral-round.js";
import { RoundFactory } from "../src/domain/rounds/round-factory.js";
import { LLMAnswerEvaluator } from "../src/domain/evaluation/llm-answer-evaluator.js";
import { SpeechMetricsEvaluator } from "../src/domain/evaluation/speech-metrics-evaluator.js";
import { CompositeEvaluator } from "../src/domain/evaluation/composite-evaluator.js";
const context: EvalContext = {
  role: "developer",
  difficulty: "beginner",
  history: [],
  question: "What is caching?",
  answer: "Saving a result for later.",
};

describe("interview strategies", () => {
  it("creates built-in rounds and allows registration of a new round", () => {
    class DesignRound extends InterviewRound {
      readonly type = "design";
      get rubric() {
        return { description: "Assess trade-offs" };
      }
    }
    const factory = new RoundFactory();
    factory.register("technical", TechnicalRound);
    factory.register("hr", HRRound);
    factory.register("behavioral", BehavioralRound);
    factory.register("design", DesignRound);
    expect(factory.create("design").rubric.description).toBe(
      "Assess trade-offs",
    );
    expect(
      factory
        .create("technical")
        .buildQuestionPrompt(context, new PromptBuilder()).prompt,
    ).toContain("technical");
    expect(factory.create("hr").rubric.description).toContain(
      "protected traits",
    );
    expect(factory.create("behavioral").rubric.description).toContain("result");
    expect(() => factory.create("unknown")).toThrow();
    expect(() => factory.register("hr", HRRound)).toThrow();
  });
  it("validates answer scores and combines speech coaching without extra model calls", async () => {
    const prompts = new PromptBuilder();
    const fake = new FakeLLMProvider([
      '{"correctness":8,"clarity":7,"depth":6,"relevance":9,"overall":8,"feedback":"Good start","idealAnswer":"Explain the trade-offs"}',
    ]);
    const evaluator = new CompositeEvaluator([
      new LLMAnswerEvaluator(new JsonGenerator(fake, prompts), prompts),
      new SpeechMetricsEvaluator(),
    ]);
    const result = await evaluator.evaluate({
      context,
      round: new TechnicalRound(),
      speech: {
        durationSeconds: 30,
        wordCount: 100,
        fillerCount: 4,
        pauseCount: 2,
      },
    });
    expect(result.metrics.overall).toBe(8);
    expect(result.metrics.wordsPerMinute).toBe(200);
    expect(result.feedback).toContain("Good start");
    expect(result.feedback.length).toBeGreaterThan(1);
  });
  it("does not invent speech metrics and rejects duplicate metrics", async () => {
    const input = { context, round: new HRRound() };
    expect(await new SpeechMetricsEvaluator().evaluate(input)).toEqual({
      metrics: {},
      feedback: [],
    });
    const same = {
      async evaluate() {
        return { metrics: { score: 5 }, feedback: [] };
      },
    };
    await expect(
      new CompositeEvaluator([same, same]).evaluate(input),
    ).rejects.toThrow("Duplicate evaluator metric");
  });
});
