// Drizzle implementation of the user repository; all account SQL stays here.
import { and, eq } from "drizzle-orm";
import type { createDatabase } from "../../db/client.js";
import { users } from "../../db/schema.js";
import { AppError } from "../../core/errors.js";
import type { IUserRepository, ProfileUpdate } from "./user-repository.js";
/** PostgreSQL-backed user repository. */
export class DrizzleUserRepository implements IUserRepository {
  /** Inject the shared Drizzle database. */
  constructor(private readonly db: ReturnType<typeof createDatabase>["db"]) {}
  /** Look up a normalized email. */
  async findByEmail(email: string) {
    return (
      await this.db.select().from(users).where(eq(users.email, email)).limit(1)
    )[0];
  }
  /** Look up a user by ID. */
  async findById(id: string) {
    return (
      await this.db.select().from(users).where(eq(users.id, id)).limit(1)
    )[0];
  }
  /** Insert an account, converting unique violations to a safe conflict. */
  async create(input: { email: string; name: string; passwordHash: string }) {
    try {
      const [user] = await this.db.insert(users).values(input).returning();
      if (!user) throw new Error("Insert returned no user");
      return user;
    } catch (error: unknown) {
      // Drizzle may wrap the underlying PostgreSQL error as its cause.
      const cause = error instanceof Error && error.cause ? error.cause : error;
      if (
        typeof cause === "object" &&
        cause !== null &&
        "code" in cause &&
        cause.code === "23505"
      )
        throw new AppError(
          409,
          "EMAIL_TAKEN",
          "An account with that email already exists",
        );
      throw error;
    }
  }
  /** Update editable profile fields for the authenticated user. */
  async update(id: string, input: ProfileUpdate) {
    return (
      await this.db.update(users).set(input).where(eq(users.id, id)).returning()
    )[0];
  }
  /** Delete only a specifically identified temporary smoke-test user and owned data. */
  async deleteSmokeUser(id: string, email: string) {
    if (!/^skillzen-smoke-[0-9a-f-]+@example\.invalid$/.test(email))
      throw new Error("Not a smoke-test email");
    await this.db
      .delete(users)
      .where(and(eq(users.id, id), eq(users.email, email)));
  }
}
