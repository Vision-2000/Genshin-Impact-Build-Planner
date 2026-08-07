import { describe, it, expect } from "vitest";
import { SignupSchema, LoginSchema } from "./schemas";

describe("SignupSchema", () => {
  it("accepts a valid email and password", () => {
    const result = SignupSchema.safeParse({ email: "user@example.com", password: "password123" });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid email", () => {
    const result = SignupSchema.safeParse({ email: "not-an-email", password: "password123" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.email).toBeDefined();
    }
  });

  it("rejects a password shorter than 8 characters", () => {
    const result = SignupSchema.safeParse({ email: "user@example.com", password: "short1" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.password).toBeDefined();
    }
  });

  it("rejects a password longer than 72 characters", () => {
    const result = SignupSchema.safeParse({ email: "user@example.com", password: "a".repeat(73) });
    expect(result.success).toBe(false);
  });

  it("accepts a password exactly 72 characters long", () => {
    const result = SignupSchema.safeParse({ email: "user@example.com", password: "a".repeat(72) });
    expect(result.success).toBe(true);
  });
});

describe("LoginSchema", () => {
  it("accepts any non-empty password, unlike the signup complexity rules", () => {
    const result = LoginSchema.safeParse({ email: "user@example.com", password: "short" });
    expect(result.success).toBe(true);
  });

  it("rejects an empty password", () => {
    const result = LoginSchema.safeParse({ email: "user@example.com", password: "" });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid email", () => {
    const result = LoginSchema.safeParse({ email: "not-an-email", password: "whatever" });
    expect(result.success).toBe(false);
  });
});
