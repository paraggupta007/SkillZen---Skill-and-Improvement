// Real database coverage for session generation and copied-token revocation.
import { describe, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import jwt from "jsonwebtoken";
import request from "supertest";
import * as schema from "../src/db/schema.js";
import type { createDatabase } from "../src/db/client.js";
import { createApp } from "../src/app.js";
import { createContainer } from "../src/container.js";
import { loadEnv } from "../src/config/env.js";
import { DrizzleUserRepository } from "../src/modules/users/drizzle-user-repository.js";
import { DrizzleInterviewRepository } from "../src/modules/interviews/drizzle-interview-repository.js";
const secret = "test-secret-at-least-32-characters-long";
const cookie = (response: request.Response) =>
  String(response.headers["set-cookie"]?.[0]).split(";")[0]!;
describe("session revocation", () => {
  it("revokes all current sessions without allowing stale cookies to revoke a later login", async () => {
    const pg = new PGlite();
    try {
      const testDb = drizzle(pg, { schema });
      await migrate(testDb, { migrationsFolder: "./src/db/migrations" });
      const db = testDb as unknown as ReturnType<typeof createDatabase>["db"];
      const users = new DrizzleUserRepository(db);
      const app = createApp(
        createContainer(loadEnv({ NODE_ENV: "test", JWT_SECRET: secret }), {
          userRepository: users,
          interviewRepository: new DrizzleInterviewRepository(db),
        }),
      );
      const owner = request.agent(app),
        second = request.agent(app),
        other = request.agent(app);
      const register = await owner.post("/api/auth/register").send({
        name: "Ada",
        email: "ada@example.com",
        password: "password123",
      });
      const old = cookie(register);
      expect(register.body.data.sessionVersion).toBeUndefined();
      const login = await second
        .post("/api/auth/login")
        .send({ email: "ada@example.com", password: "password123" });
      const otherRegistration = await other.post("/api/auth/register").send({
        name: "Bob",
        email: "bob@example.com",
        password: "password123",
      });
      expect(login.status).toBe(200);
      const otherCookie = cookie(otherRegistration);
      const legacy = jwt.sign({}, secret, {
        subject: register.body.data.id,
        algorithm: "HS256",
        issuer: "skillzen",
        audience: "skillzen-web",
        expiresIn: "1h",
      });
      expect(
        (
          await request(app)
            .get("/api/users/me")
            .set("Cookie", `skillzen_session=${legacy}`)
        ).status,
      ).toBe(401);
      expect(
        (
          await owner
            .post("/api/auth/logout")
            .set("Origin", "https://evil.example")
        ).status,
      ).toBe(403);
      expect((await second.get("/api/users/me")).status).toBe(200);
      const failure = vi
        .spyOn(users, "revokeSessions")
        .mockRejectedValueOnce(new Error("database unavailable"));
      const unsuccessful = await owner.post("/api/auth/logout");
      expect(unsuccessful.status).toBe(500);
      expect(unsuccessful.headers["set-cookie"]).toBeUndefined();
      expect((await second.get("/api/users/me")).status).toBe(200);
      failure.mockRestore();
      const logout = await owner.post("/api/auth/logout");
      expect(logout.status).toBe(200);
      expect(String(logout.headers["set-cookie"])).toContain(
        "skillzen_session=;",
      );
      expect((await second.get("/api/users/me")).status).toBe(401);
      expect(
        (await request(app).get("/api/interviews").set("Cookie", old)).status,
      ).toBe(401);
      expect(
        (
          await request(app)
            .patch("/api/users/me")
            .set("Cookie", old)
            .send({ name: "Not Ada" })
        ).status,
      ).toBe(401);
      expect(
        (await request(app).get("/api/users/me").set("Cookie", otherCookie))
          .status,
      ).toBe(200);
      const newLogin = await second
        .post("/api/auth/login")
        .send({ email: "ada@example.com", password: "password123" });
      expect(newLogin.status).toBe(200);
      expect(
        (await request(app).post("/api/auth/logout").set("Cookie", old)).status,
      ).toBe(200);
      expect((await second.get("/api/users/me")).status).toBe(200);
      expect(
        (
          await request(app)
            .post("/api/auth/logout")
            .set("Cookie", "skillzen_session=forged")
        ).status,
      ).toBe(200);
      const expired = jwt.sign({ version: 1 }, secret, {
        subject: register.body.data.id,
        algorithm: "HS256",
        issuer: "skillzen",
        audience: "skillzen-web",
        expiresIn: -1,
      });
      expect(
        (
          await request(app)
            .post("/api/auth/logout")
            .set("Cookie", `skillzen_session=${expired}`)
        ).status,
      ).toBe(200);
      expect((await second.get("/api/users/me")).status).toBe(200);
      expect((await request(app).post("/api/auth/logout")).status).toBe(200);
      const current = cookie(newLogin);
      const simultaneous = await Promise.all([
        request(app).post("/api/auth/logout").set("Cookie", current),
        request(app).post("/api/auth/logout").set("Cookie", current),
      ]);
      expect(simultaneous.map((r) => r.status)).toEqual([200, 200]);
      const afterRace = await second
        .post("/api/auth/login")
        .send({ email: "ada@example.com", password: "password123" });
      expect(afterRace.status).toBe(200);
      await request(app).post("/api/auth/logout").set("Cookie", current);
      expect((await second.get("/api/users/me")).status).toBe(200);
    } finally {
      await pg.close();
    }
  }, 30000);
});
