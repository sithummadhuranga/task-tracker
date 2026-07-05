import { describe, expect, it } from "vitest";
import { loginSchema, registerSchema } from "./schemas.js";

describe("registerSchema", () => {
  const valid = { email: "user@example.com", password: "password1", name: "Jane Doe" };

  it("accepts a well-formed payload", () => {
    expect(registerSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects a malformed email", () => {
    const result = registerSchema.safeParse({ ...valid, email: "not-an-email" });
    expect(result.success).toBe(false);
  });

  it("rejects a password shorter than 8 characters", () => {
    const result = registerSchema.safeParse({ ...valid, password: "abc123" });
    expect(result.success).toBe(false);
  });

  it("rejects a password with no digit", () => {
    const result = registerSchema.safeParse({ ...valid, password: "onlyletters" });
    expect(result.success).toBe(false);
  });

  it("rejects an empty name", () => {
    const result = registerSchema.safeParse({ ...valid, name: "" });
    expect(result.success).toBe(false);
  });

  it("ignores a client-supplied role field rather than erroring", () => {
    const result = registerSchema.safeParse({ ...valid, role: "ADMIN" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty("role");
    }
  });
});

describe("loginSchema", () => {
  it("accepts a well-formed payload", () => {
    expect(loginSchema.safeParse({ email: "user@example.com", password: "anything" }).success).toBe(
      true,
    );
  });

  it("rejects a malformed email", () => {
    const result = loginSchema.safeParse({ email: "not-an-email", password: "anything" });
    expect(result.success).toBe(false);
  });

  it("rejects an empty password", () => {
    const result = loginSchema.safeParse({ email: "user@example.com", password: "" });
    expect(result.success).toBe(false);
  });
});
