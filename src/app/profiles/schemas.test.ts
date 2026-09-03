import { describe, it, expect } from "vitest";
import { CreateProfileSchema } from "./schemas";

describe("CreateProfileSchema", () => {
  it("accepts a name with no uid", () => {
    const result = CreateProfileSchema.safeParse({ name: "Main account" });
    expect(result.success).toBe(true);
  });

  it("trims whitespace from the name", () => {
    const result = CreateProfileSchema.safeParse({ name: "  Main account  " });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Main account");
    }
  });

  it("rejects an empty name", () => {
    const result = CreateProfileSchema.safeParse({ name: "" });
    expect(result.success).toBe(false);
  });

  it("rejects a name over 50 characters", () => {
    const result = CreateProfileSchema.safeParse({ name: "a".repeat(51) });
    expect(result.success).toBe(false);
  });

  it("accepts a 9-digit uid", () => {
    const result = CreateProfileSchema.safeParse({ name: "Main account", uid: "800000001" });
    expect(result.success).toBe(true);
  });

  it("accepts a 10-digit uid", () => {
    const result = CreateProfileSchema.safeParse({ name: "Main account", uid: "8000000001" });
    expect(result.success).toBe(true);
  });

  it("rejects a uid under 9 digits", () => {
    const result = CreateProfileSchema.safeParse({ name: "Main account", uid: "12345678" });
    expect(result.success).toBe(false);
  });

  it("rejects a uid over 10 digits", () => {
    const result = CreateProfileSchema.safeParse({ name: "Main account", uid: "12345678901" });
    expect(result.success).toBe(false);
  });

  it("rejects a non-numeric uid", () => {
    const result = CreateProfileSchema.safeParse({ name: "Main account", uid: "abc123456" });
    expect(result.success).toBe(false);
  });
});
