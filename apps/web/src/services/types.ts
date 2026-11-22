// Browser-facing types for the SkillZen API contracts.
export interface User {
  id: string;
  name: string;
  email: string;
  targetRole: string | null;
  experienceLevel: string | null;
  skills: string[];
  createdAt: string;
}
export interface Interview {
  id: string;
  role: string;
  roundType: string;
  difficulty: string;
  totalQuestions: number;
  status: "in_progress" | "completed" | "abandoned";
  startedAt: string;
  completedAt: string | null;
}
export interface Question {
  id: string;
  text: string;
  category: string;
  orderNo: number;
  isFollowup: boolean;
}
export interface Answer {
  id: string;
  answerText: string;
}
export interface Evaluation {
  metrics: Record<string, number>;
  feedback: string[];
  idealAnswer?: string;
}
export interface Turn {
  question: Question;
  answer: Answer | null;
  evaluation: { overall: number; feedback: string; idealAnswer: string } | null;
}
export interface InterviewDetail {
  interview: Interview;
  turns: Turn[];
}
export interface Analytics {
  totalInterviews: number;
  completedInterviews: number;
  averageScore: number | null;
  scoreTrend: { interviewId: string; startedAt: string; score: number }[];
}
export interface Report {
  interviewId: string;
  overallScore: number;
  strengths: string[];
  weaknesses: string[];
  tips: string[];
  summary: string;
}
export type ReportState =
  | { status: "pending" }
  | { status: "failed"; error: string }
  | { status: "ready"; report: Report };
export interface CreateInterview {
  role: string;
  roundType: string;
  difficulty: string;
  totalQuestions: number;
  jdText?: string;
}
