DROP INDEX "answers_question_idx";--> statement-breakpoint
DROP INDEX "questions_interview_order_idx";--> statement-breakpoint
ALTER TABLE "interviews" ADD COLUMN "role" text DEFAULT 'General' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "evaluations_answer_idx" ON "evaluations" USING btree ("answer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "answers_question_idx" ON "answers" USING btree ("question_id");--> statement-breakpoint
CREATE UNIQUE INDEX "questions_interview_order_idx" ON "questions" USING btree ("interview_id","order_no");