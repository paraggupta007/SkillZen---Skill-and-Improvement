// PostgreSQL tables and indexes for the core interview domain.
import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  text,
  timestamp,
  integer,
  boolean,
  jsonb,
  index,
  uniqueIndex,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

export const interviewStatus = pgEnum("interview_status", [
  "in_progress",
  "completed",
  "abandoned",
]);
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: varchar("name", { length: 120 }).notNull(),
  targetRole: text("target_role"),
  experienceLevel: text("experience_level"),
  skills: jsonb("skills").$type<string[]>().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
export const resumes = pgTable("resumes", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  fileName: text("file_name").notNull(),
  rawText: text("raw_text").notNull(),
  parsedSkills: jsonb("parsed_skills").$type<string[]>().notNull().default([]),
  atsScore: integer("ats_score"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
export const interviews = pgTable(
  "interviews",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    resumeId: uuid("resume_id").references(() => resumes.id, {
      onDelete: "set null",
    }),
    role: text("role").notNull().default("General"),
    roundType: text("round_type").notNull(),
    difficulty: text("difficulty").notNull(),
    totalQuestions: integer("total_questions").notNull(),
    status: interviewStatus("status").notNull().default("in_progress"),
    jdText: text("jd_text"),
    startedAt: timestamp("started_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [
    index("interviews_user_started_idx").on(t.userId, t.startedAt.desc()),
  ],
);
export const questions = pgTable(
  "questions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    interviewId: uuid("interview_id")
      .notNull()
      .references(() => interviews.id, { onDelete: "cascade" }),
    orderNo: integer("order_no").notNull(),
    text: text("text").notNull(),
    category: text("category").notNull(),
    isFollowup: boolean("is_followup").notNull().default(false),
    parentQuestionId: uuid("parent_question_id").references(
      (): AnyPgColumn => questions.id,
      { onDelete: "set null" },
    ),
    generatedBy: text("generated_by").notNull(),
  },
  (t) => [
    uniqueIndex("questions_interview_order_idx").on(t.interviewId, t.orderNo),
  ],
);
export const answers = pgTable(
  "answers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    questionId: uuid("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    answerText: text("answer_text").notNull(),
    audioDurationSec: integer("audio_duration_sec"),
    speechMetrics: jsonb("speech_metrics"),
    submittedAt: timestamp("submitted_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("answers_question_idx").on(t.questionId)],
);
export const evaluations = pgTable(
  "evaluations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    answerId: uuid("answer_id")
      .notNull()
      .references(() => answers.id, { onDelete: "cascade" }),
    correctness: integer("correctness").notNull(),
    clarity: integer("clarity").notNull(),
    depth: integer("depth").notNull(),
    relevance: integer("relevance").notNull(),
    overall: integer("overall").notNull(),
    feedback: text("feedback").notNull(),
    idealAnswer: text("ideal_answer").notNull(),
    raw: jsonb("raw").notNull(),
  },
  (t) => [uniqueIndex("evaluations_answer_idx").on(t.answerId)],
);
export const reports = pgTable(
  "reports",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    interviewId: uuid("interview_id")
      .notNull()
      .references(() => interviews.id, { onDelete: "cascade" }),
    overallScore: integer("overall_score").notNull(),
    strengths: jsonb("strengths").$type<string[]>().notNull(),
    weaknesses: jsonb("weaknesses").$type<string[]>().notNull(),
    tips: jsonb("tips").$type<string[]>().notNull(),
    summary: text("summary").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("reports_interview_unique").on(t.interviewId)],
);
export const aiUsageLogs = pgTable("ai_usage_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  provider: text("provider").notNull(),
  model: text("model").notNull(),
  latencyMs: integer("latency_ms").notNull(),
  tokensIn: integer("tokens_in"),
  tokensOut: integer("tokens_out"),
  success: boolean("success").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
