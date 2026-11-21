// Validate configuration once at the application boundary.
import { z } from "zod";

const optionalText = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().optional(),
);
const schema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    DATABASE_URL: optionalText,
    JWT_SECRET: optionalText,
    CLIENT_URL: z.string().url().default("http://localhost:5173"),
    GROQ_API_KEY: optionalText,
    GEMINI_API_KEY: optionalText,
    OPENROUTER_API_KEY: optionalText,
    LLM_PROVIDER_ORDER: z.string().default("groq,gemini,openrouter"),
  })
  .superRefine((value, ctx) => {
    if (value.NODE_ENV === "production" && !value.DATABASE_URL)
      ctx.addIssue({
        code: "custom",
        path: ["DATABASE_URL"],
        message: "Required in production",
      });
    if (
      value.NODE_ENV === "production" &&
      (!value.JWT_SECRET || value.JWT_SECRET.length < 32)
    )
      ctx.addIssue({
        code: "custom",
        path: ["JWT_SECRET"],
        message: "At least 32 characters required in production",
      });
    if (value.DATABASE_URL) {
      try {
        const url = new URL(value.DATABASE_URL);
        if (!["postgres:", "postgresql:"].includes(url.protocol))
          throw new Error("Invalid protocol");
        if (
          url.hostname.endsWith(".neon.tech") &&
          !url.hostname.includes("-pooler.")
        )
          ctx.addIssue({
            code: "custom",
            path: ["DATABASE_URL"],
            message: "Use the pooled Neon connection string",
          });
      } catch {
        ctx.addIssue({
          code: "custom",
          path: ["DATABASE_URL"],
          message: "Must be a PostgreSQL URL",
        });
      }
    }
  });

/** Parse and validate environment variables without logging secrets. */
export function loadEnv(input: NodeJS.ProcessEnv = process.env) {
  return schema.parse(input);
}
/** Validated application configuration. */
export type Env = z.infer<typeof schema>;
