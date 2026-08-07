import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "./auth";

describe("hashPassword", () => {
  it("produces a hash different from the plaintext password", async () => {
    const hash = await hashPassword("correct horse battery staple");
    expect(hash).not.toBe("correct horse battery staple");
  });

  it("produces a different hash each time, even for the same password", async () => {
    const [hashA, hashB] = await Promise.all([
      hashPassword("same password"),
      hashPassword("same password"),
    ]);
    expect(hashA).not.toBe(hashB);
  });
});

describe("verifyPassword", () => {
  it("resolves true for the correct password", async () => {
    const hash = await hashPassword("correct horse battery staple");
    await expect(verifyPassword("correct horse battery staple", hash)).resolves.toBe(true);
  });

  it("resolves false for an incorrect password", async () => {
    const hash = await hashPassword("correct horse battery staple");
    await expect(verifyPassword("wrong password", hash)).resolves.toBe(false);
  });
});
