import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";
import app from "../app";
import { SEED_EMAIL, SEED_PASSWORD } from "./globalSetup";

function api(path: string, init?: RequestInit) {
  return app.fetch(new Request(`http://localhost/api/v1${path}`, init));
}

function generatePassword() {
  const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lower = "abcdefghijklmnopqrstuvwxyz";
  const digits = "0123456789";
  const special = "!@#$%^&*()";
  const all = upper + lower + digits + special;
  const pick = (s: string) => s[Math.floor(Math.random() * s.length)];
  const required = pick(upper) + pick(lower) + pick(digits) + pick(special);
  const rest = Array.from({ length: 16 }, () => pick(all)).join("");
  return required + rest;
}

async function registerUser() {
  const email = faker.internet.email();
  const password = generatePassword();
  const res = await api("/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const body = (await res.clone().json()) as {
    data: Record<string, unknown>;
    message?: string;
  };
  return {
    email,
    password,
    id: body.data.id as string,
    res,
    body,
  };
}

describe("POST /api/v1/auth/register", () => {
  it("should register a new user", async () => {
    const { res, body } = await registerUser();
    expect(res.status).toBe(201);
    expect(body.data).toHaveProperty("id");
    expect(body.data.status).toBe("ACTIVE");
    expect(body.message).toBe("User registered successfully");
  });

  it("should reject duplicate email", async () => {
    const res = await api("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: SEED_EMAIL,
        password: generatePassword(),
      }),
    });
    expect(res.status).toBe(409);
    const body = (await res.json()) as {
      error: { code: string; message: string };
    };
    expect(body.error.code).toBe("CONFLICT");
    expect(body.error.message).toBe("Email already registered");
  });
});

describe("POST /api/v1/auth/login", () => {
  it("should login with valid credentials", async () => {
    const res = await api("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: SEED_EMAIL,
        password: SEED_PASSWORD,
      }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { id: string; email: string } };
    expect(body.data.email).toBe(SEED_EMAIL);
    expect(body.data).toHaveProperty("id");
  });

  it("should reject invalid password", async () => {
    const res = await api("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: SEED_EMAIL,
        password: generatePassword(),
      }),
    });
    expect(res.status).toBe(401);
  });

  it("should reject unknown email", async () => {
    const res = await api("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "nonexistent@test.com",
        password: generatePassword(),
      }),
    });
    expect(res.status).toBe(401);
  });
});

describe("GET /api/v1/auth/me", () => {
  it("should return 401 without access token", async () => {
    const res = await api("/auth/me");
    expect(res.status).toBe(401);
  });

  it("should return user data with valid access token", async () => {
    const loginRes = await api("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: SEED_EMAIL,
        password: SEED_PASSWORD,
      }),
    });
    const setCookie = loginRes.headers.get("set-cookie");
    expect(setCookie).toBeTruthy();

    const res = await api("/auth/me", {
      headers: { Cookie: extractCookies(setCookie ?? "") },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { email: string } };
    expect(body.data.email).toBe(SEED_EMAIL);
  });
});

describe("POST /api/v1/auth/logout", () => {
  it("should clear cookies", async () => {
    const res = await api("/auth/logout", {
      method: "POST",
    });
    expect(res.status).toBe(200);
    const cookies = res.headers.get("set-cookie");
    expect(cookies).toContain("Max-Age=0");
  });
});

describe("POST /api/v1/auth/refresh", () => {
  it("should refresh tokens", async () => {
    const loginRes = await api("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: SEED_EMAIL,
        password: SEED_PASSWORD,
      }),
    });
    const cookies = loginRes.headers.get("set-cookie") || "";
    const refreshCookie = cookies
      .split(",")
      .find((c) => c.trim().startsWith("REFRESH_TOKEN="));
    expect(refreshCookie).toBeTruthy();

    const res = await api("/auth/refresh", {
      method: "POST",
      headers: { Cookie: (refreshCookie ?? "").split(";")[0] },
    });
    expect(res.status).toBe(200);
  });

  it("should reject missing refresh token", async () => {
    const res = await api("/auth/refresh", {
      method: "POST",
    });
    expect(res.status).toBe(401);
  });
});

describe("PUT /api/v1/profile", () => {
  it("should update profile with valid auth", async () => {
    const loginRes = await api("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: SEED_EMAIL,
        password: SEED_PASSWORD,
      }),
    });
    const cookies = extractCookies(loginRes.headers.get("set-cookie") ?? "");
    const csrfMatch = loginRes.headers
      .get("set-cookie")
      ?.match(/CSRF_TOKEN=([^;]+)/);
    const csrfToken = csrfMatch?.[1] ?? "";

    const res = await api("/profile", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookies,
        "X-CSRF-Token": csrfToken,
      },
      body: JSON.stringify({
        avatar_url: null,
      }),
    });
    expect(res.status).toBe(200);
  });

  it("should reject update without CSRF token", async () => {
    const loginRes = await api("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: SEED_EMAIL,
        password: SEED_PASSWORD,
      }),
    });
    const cookies = extractCookies(loginRes.headers.get("set-cookie") ?? "");

    const res = await api("/profile", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookies,
      },
      body: JSON.stringify({
        avatar_url: null,
      }),
    });
    expect(res.status).toBe(403);
  });
});

function extractCookies(setCookie: string): string {
  return setCookie
    .split(",")
    .map((c) => c.trim().split(";")[0])
    .join("; ");
}
