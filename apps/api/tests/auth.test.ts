// Exercise HTTP account flows with a deterministic in-memory repository.
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { loadEnv } from "../src/config/env.js";
import { createContainer } from "../src/container.js";
import { AppError } from "../src/core/errors.js";
import type {
  IUserRepository,
  User,
  ProfileUpdate,
} from "../src/modules/users/user-repository.js";

class MemoryUsers implements IUserRepository {
  private readonly entries = new Map<string, User>();
  async findByEmail(email: string) {
    return [...this.entries.values()].find((user) => user.email === email);
  }
  async findById(id: string) {
    return this.entries.get(id);
  }
  async create(input: { email: string; name: string; passwordHash: string }) {
    if (await this.findByEmail(input.email))
      throw new AppError(
        409,
        "EMAIL_TAKEN",
        "An account with that email already exists",
      );
    const user: User = {
      ...input,
      id: randomUUID(),
      sessionVersion: 0,
      targetRole: null,
      experienceLevel: null,
      skills: [],
      createdAt: new Date(),
    };
    this.entries.set(user.id, user);
    return user;
  }
  async revokeSessions(id: string, expectedVersion: number) {
    const user = this.entries.get(id);
    if (user?.sessionVersion === expectedVersion)
      this.entries.set(id, { ...user, sessionVersion: expectedVersion + 1 });
  }
  async deleteWithPasswordHash(id: string, passwordHash: string) {
    const user = this.entries.get(id);
    if (!user || user.passwordHash !== passwordHash) return false;
    return this.entries.delete(id);
  }
  async update(id: string, input: ProfileUpdate) {
    const user = this.entries.get(id);
    if (!user) return undefined;
    const updated = { ...user, ...input };
    this.entries.set(id, updated);
    return updated;
  }
}
function setup() {
  const users = new MemoryUsers();
  const env = loadEnv({
    NODE_ENV: "test",
    JWT_SECRET: "test-secret-which-is-at-least-32-characters",
  });
  return {
    users,
    app: createApp(createContainer(env, { userRepository: users })),
  };
}
const account = {
  name: "Ada",
  email: "ADA@example.com",
  password: "strong-password",
};

describe("authentication and profiles", () => {
  it("registers, sets an httpOnly cookie, and updates the authenticated profile", async () => {
    const { app, users } = setup();
    const agent = request.agent(app);
    const registered = await agent.post("/api/auth/register").send(account);
    expect(registered.status).toBe(201);
    expect(registered.body.data.email).toBe("ada@example.com");
    expect(registered.body.data.passwordHash).toBeUndefined();
    expect(String(registered.headers["set-cookie"])).toContain("HttpOnly");
    const stored = await users.findByEmail("ada@example.com");
    expect(stored?.passwordHash).not.toBe(account.password);
    expect(stored?.passwordHash).toMatch(/^\$2/);
    const updated = await agent
      .patch("/api/users/me")
      .send({ targetRole: "Developer", skills: ["TypeScript"] });
    expect(updated.status).toBe(200);
    expect(updated.body.data.skills).toEqual(["TypeScript"]);
    expect((await agent.get("/api/users/me")).body.data.targetRole).toBe(
      "Developer",
    );
    expect((await agent.post("/api/auth/logout")).status).toBe(200);
    expect((await agent.get("/api/users/me")).status).toBe(401);
  });
  it("rejects invalid input, duplicate emails, invalid credentials, and forged cookies", async () => {
    const { app } = setup();
    expect(
      (
        await request(app)
          .post("/api/auth/register")
          .send({ ...account, password: "short" })
      ).status,
    ).toBe(400);
    expect(
      (await request(app).post("/api/auth/register").send(account)).status,
    ).toBe(201);
    expect(
      (await request(app).post("/api/auth/register").send(account)).status,
    ).toBe(409);
    expect(
      (
        await request(app)
          .post("/api/auth/login")
          .send({ email: account.email, password: "wrong-password" })
      ).status,
    ).toBe(401);
    expect(
      (
        await request(app)
          .post("/api/auth/login")
          .send({ email: "nobody@example.com", password: "wrong-password" })
      ).status,
    ).toBe(401);
    expect(
      (
        await request(app)
          .get("/api/users/me")
          .set("Cookie", "skillzen_session=forged")
      ).status,
    ).toBe(401);
    expect(
      (
        await request(app)
          .post("/api/auth/login")
          .send({ email: account.email, password: account.password })
      ).status,
    ).toBe(200);
  });
  it("rejects cross-origin writes and non-editable profile fields", async () => {
    const { app } = setup();
    const agent = request.agent(app);
    expect(
      (
        await request(app)
          .post("/api/auth/register")
          .set("Origin", "https://evil.example")
          .send(account)
      ).status,
    ).toBe(403);
    await agent.post("/api/auth/register").send(account);
    expect(
      (await agent.patch("/api/users/me").send({ email: "other@example.com" }))
        .status,
    ).toBe(400);
  });
  it("returns 503 when auth is not configured", async () => {
    const app = createApp(createContainer(loadEnv({ NODE_ENV: "test" })));
    expect(
      (await request(app).post("/api/auth/login").send(account)).status,
    ).toBe(503);
  });
});
