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
  check,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

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

/** Optional user-shared camera observation counters; no images or landmarks. */
export const cameraObservations = pgTable("camera_observations", {
  interviewId: uuid("interview_id")
    .primaryKey()
    .references(() => interviews.id, { onDelete: "cascade" }),
  samples: integer("samples").notNull(),
  faceVisible: integer("face_visible").notNull(),
  centered: integer("centered").notNull(),
  centeredKnown: integer("centered_known").notNull(),
  gazeNearCamera: integer("gaze_near_camera").notNull(),
  gazeKnown: integer("gaze_known").notNull(),
  headMovements: integer("head_movements").notNull(),
  poseSamples: integer("pose_samples").notNull().default(0),
  postureKnown: integer("posture_known").notNull().default(0),
  postureAligned: integer("posture_aligned").notNull().default(0),
  wristKnown: integer("wrist_known").notNull().default(0),
  wristMovements: integer("wrist_movements").notNull().default(0),
  handRaisedKnown: integer("hand_raised_known").notNull().default(0),
  handRaised: integer("hand_raised").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** A practice test stores a question snapshot and final answers, scoped to its owner. */
export const mockTests = pgTable(
  "mock_tests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    topic: text("topic").notNull(),
    questions: jsonb("questions")
      .$type<
        import("../modules/mock-tests/question-bank.js").PracticeQuestion[]
      >()
      .notNull(),
    answers: jsonb("answers").$type<(number | null)[]>(),
    score: integer("score"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [
    index("mock_tests_user_created_idx").on(t.userId, t.createdAt.desc()),
  ],
);

/** Optional candidate opinion of an interview question; independent of AI evaluation. */
export const questionFeedback = pgTable(
  "question_feedback",
  {
    questionId: uuid("question_id")
      .primaryKey()
      .references(() => questions.id, { onDelete: "cascade" }),
    rating: integer("rating").notNull(),
    comment: text("comment").notNull().default(""),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    check("question_feedback_rating_check", sql`${t.rating} between 1 and 5`),
    check(
      "question_feedback_comment_length_check",
      sql`char_length(${t.comment}) <= 1000`,
    ),
  ],
);
