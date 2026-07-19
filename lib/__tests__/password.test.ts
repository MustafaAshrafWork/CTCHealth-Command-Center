import { describe, expect, it } from "vitest";

import {
  generatePassword,
  hashPassword,
  verifyPassword,
} from "../password";

describe("password hashing", () => {
  it("hashes and verifies a password", async () => {
    const stored = await hashPassword("correct horse battery staple");

    expect(stored).toMatch(/^scrypt\$16384\$[^$]+\$[^$]+$/);
    await expect(
      verifyPassword("correct horse battery staple", stored),
    ).resolves.toBe(true);
  });

  it("rejects a wrong password", async () => {
    const stored = await hashPassword("correct horse battery staple");

    await expect(verifyPassword("wrong password", stored)).resolves.toBe(false);
  });
});

describe("generatePassword", () => {
  it("generates 12 characters from the unambiguous alphabet", () => {
    for (let index = 0; index < 100; index += 1) {
      expect(generatePassword()).toMatch(
        /^[ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789]{12}$/,
      );
    }
  });
});
