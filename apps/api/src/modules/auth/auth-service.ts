// Account business rules depend on a repository interface, not SQL.
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { AppError } from "../../core/errors.js";
import type {
  IUserRepository,
  ProfileUpdate,
  User,
} from "../users/user-repository.js";
/** Account details safe to send to a client. */
export type PublicUser = Omit<User, "passwordHash" | "sessionVersion">;
function publicUser(user: User): PublicUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    targetRole: user.targetRole,
    experienceLevel: user.experienceLevel,
    skills: user.skills,
    createdAt: user.createdAt,
  };
}
/** Authenticate users and maintain their profile. */
export class AuthService {
  /** Inject storage and a sufficiently long signing secret. */
  constructor(
    private readonly users: IUserRepository,
    private readonly secret: string,
  ) {}
  /** Register a new account and return its safe profile and session token. */
  async register(input: { email: string; password: string; name: string }) {
    if (await this.users.findByEmail(input.email))
      throw new AppError(
        409,
        "EMAIL_TAKEN",
        "An account with that email already exists",
      );
    const user = await this.users.create({
      email: input.email,
      name: input.name,
      passwordHash: await bcrypt.hash(input.password, 12),
    });
    return {
      user: publicUser(user),
      token: this.sign(user.id, user.sessionVersion),
    };
  }
  /** Verify credentials without disclosing whether an email is registered. */
  async login(input: { email: string; password: string }) {
    const user = await this.users.findByEmail(input.email);
    // A dummy hash ensures unknown accounts still perform bcrypt work.
    const valid = await bcrypt.compare(
      input.password,
      user?.passwordHash ??
        "$2b$12$C6UzMDM.H6dfI/f/IKcEe.5cLlkCF8kNQoQd8evO3N5yU3tD8F5Kq",
    );
    if (!user || !valid)
      throw new AppError(
        401,
        "INVALID_CREDENTIALS",
        "Invalid email or password",
      );
    return {
      user: publicUser(user),
      token: this.sign(user.id, user.sessionVersion),
    };
  }
  private claims(token: string): { userId: string; version: number } {
    try {
      const payload = jwt.verify(token, this.secret, {
        algorithms: ["HS256"],
        issuer: "skillzen",
        audience: "skillzen-web",
      });
      if (
        typeof payload === "string" ||
        typeof payload.sub !== "string" ||
        !/^[0-9a-f-]{36}$/i.test(payload.sub) ||
        !Number.isSafeInteger(payload.version) ||
        payload.version < 0
      )
        throw new Error("Invalid session claims");
      return { userId: payload.sub, version: payload.version as number };
    } catch {
      throw new AppError(401, "UNAUTHENTICATED", "Please log in");
    }
  }
  /** Verify both the signed token and its current database session generation. */
  async verify(token: string): Promise<string> {
    const { userId, version } = this.claims(token);
    const user = await this.users.findById(userId);
    if (!user || user.sessionVersion !== version)
      throw new AppError(401, "UNAUTHENTICATED", "Please log in");
    return userId;
  }
  /** Revoke all sessions from this token's generation; stale tokens cannot revoke newer sessions. */
  async logout(token: string) {
    let claims: { userId: string; version: number };
    try {
      claims = this.claims(token);
    } catch (error) {
      if (error instanceof AppError && error.code === "UNAUTHENTICATED") return;
      throw error;
    }
    await this.users.revokeSessions(claims.userId, claims.version);
  }
  /** Return the current user's profile. */
  async me(id: string) {
    const user = await this.users.findById(id);
    if (!user) throw new AppError(401, "UNAUTHENTICATED", "Please log in");
    return publicUser(user);
  }
  /** Change only the allowed fields of the current user's profile. */
  async update(id: string, input: ProfileUpdate) {
    const user = await this.users.update(id, input);
    if (!user) throw new AppError(401, "UNAUTHENTICATED", "Please log in");
    return publicUser(user);
  }
  /** Reauthenticate before permanently deleting an account and its owned data. */
  async deleteAccount(id: string, password: string) {
    const user = await this.users.findById(id);
    if (!user) throw new AppError(401, "UNAUTHENTICATED", "Please log in");
    if (!(await bcrypt.compare(password, user.passwordHash)))
      throw new AppError(401, "INVALID_CREDENTIALS", "Incorrect password");
    if (!(await this.users.deleteWithPasswordHash(id, user.passwordHash)))
      throw new AppError(
        409,
        "ACCOUNT_CHANGED",
        "Account changed. Please try again.",
      );
  }
  private sign(id: string, version: number) {
    return jwt.sign({ version }, this.secret, {
      algorithm: "HS256",
      subject: id,
      issuer: "skillzen",
      audience: "skillzen-web",
      expiresIn: "1h",
    });
  }
}
