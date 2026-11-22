CREATE TABLE "question_feedback" (
	"question_id" uuid PRIMARY KEY NOT NULL,
	"rating" integer NOT NULL,
	"comment" text DEFAULT '' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "question_feedback_rating_check" CHECK ("question_feedback"."rating" between 1 and 5),
	CONSTRAINT "question_feedback_comment_length_check" CHECK (char_length("question_feedback"."comment") <= 1000)
);
--> statement-breakpoint
ALTER TABLE "question_feedback" ADD CONSTRAINT "question_feedback_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE cascade ON UPDATE no action;