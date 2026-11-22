ALTER TABLE "camera_observations" ADD COLUMN "pose_samples" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "camera_observations" ADD COLUMN "posture_known" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "camera_observations" ADD COLUMN "posture_aligned" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "camera_observations" ADD COLUMN "wrist_known" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "camera_observations" ADD COLUMN "wrist_movements" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "camera_observations" ADD COLUMN "hand_raised_known" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "camera_observations" ADD COLUMN "hand_raised" integer DEFAULT 0 NOT NULL;