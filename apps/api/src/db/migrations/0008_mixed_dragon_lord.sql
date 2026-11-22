CREATE TABLE "mock_option_feedback" (
	"test_id" uuid NOT NULL,
	"question_index" integer NOT NULL,
	"option_index" integer NOT NULL,
	"rating" integer NOT NULL,
	"comment" text DEFAULT '' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mock_option_feedback_question_check" CHECK ("mock_option_feedback"."question_index" between 0 and 4),
	CONSTRAINT "mock_option_feedback_option_check" CHECK ("mock_option_feedback"."option_index" between 0 and 3),
	CONSTRAINT "mock_option_feedback_rating_check" CHECK ("mock_option_feedback"."rating" between 1 and 5),
	CONSTRAINT "mock_option_feedback_comment_check" CHECK (char_length("mock_option_feedback"."comment") <= 1000)
);
--> statement-breakpoint
ALTER TABLE "mock_option_feedback" ADD CONSTRAINT "mock_option_feedback_test_id_mock_tests_id_fk" FOREIGN KEY ("test_id") REFERENCES "public"."mock_tests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "mock_option_feedback_unique" ON "mock_option_feedback" USING btree ("test_id","question_index","option_index");