import { registerSchema } from "@task-tracker/shared-types";
import { describe, expect, it } from "vitest";
import { zodFieldErrors } from "../../src/lib/zodFieldErrors";

describe("zodFieldErrors", () => {
  it("maps every failing field to a message", () => {
    const result = registerSchema.safeParse({ email: "not-an-email", password: "short", name: "" });
    if (result.success) {
      throw new Error("expected validation failure");
    }

    const errors = zodFieldErrors(result.error);
    expect(Object.keys(errors).sort()).toEqual(["email", "name", "password"]);
  });

  it("keeps only the first issue for a field with multiple failing rules", () => {
    // "abc" is both shorter than 8 characters and has no digit — two issues, same field.
    const result = registerSchema.safeParse({
      email: "user@example.com",
      password: "abc",
      name: "Jane",
    });
    if (result.success) {
      throw new Error("expected validation failure");
    }

    const errors = zodFieldErrors(result.error);
    expect(Object.keys(errors)).toEqual(["password"]);
  });
});
