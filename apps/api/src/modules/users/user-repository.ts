// Persistence contracts for accounts and editable profiles.
import type { users } from "../../db/schema.js";
/** A user as stored in the database, including a private password hash. */
export type User = typeof users.$inferSelect;
/** Fields that a user is allowed to edit. */
export type ProfileUpdate = Partial<
  Pick<User, "name" | "targetRole" | "experienceLevel" | "skills">
>;
/** Data-access interface used by the account service. */
export interface IUserRepository {
  findByEmail(email: string): Promise<User | undefined>;
  findById(id: string): Promise<User | undefined>;
  create(input: {
    email: string;
    name: string;
    passwordHash: string;
  }): Promise<User>;
  update(id: string, input: ProfileUpdate): Promise<User | undefined>;
  deleteWithPasswordHash(id: string, passwordHash: string): Promise<boolean>;
  revokeSessions(id: string, expectedVersion: number): Promise<void>;
}
