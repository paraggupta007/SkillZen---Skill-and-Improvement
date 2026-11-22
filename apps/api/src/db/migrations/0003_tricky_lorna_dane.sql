CREATE TABLE "camera_observations" (
	"interview_id" uuid PRIMARY KEY NOT NULL,
	"samples" integer NOT NULL,
	"face_visible" integer NOT NULL,
	"centered" integer NOT NULL,
	"centered_known" integer NOT NULL,
	"gaze_near_camera" integer NOT NULL,
	"gaze_known" integer NOT NULL,
	"head_movements" integer NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "camera_observations" ADD CONSTRAINT "camera_observations_interview_id_interviews_id_fk" FOREIGN KEY ("interview_id") REFERENCES "public"."interviews"("id") ON DELETE cascade ON UPDATE no action;