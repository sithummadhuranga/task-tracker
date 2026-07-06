import { describe, expect, it } from "vitest";
import { hasPermission } from "../../src/lib/permissions";

describe("hasPermission", () => {
  it("returns true when the granted list contains the required key", () => {
    expect(hasPermission(["task:create", "task:read:own"], "task:read:own")).toBe(true);
  });

  it("returns true when any of several required keys is granted (OR semantics)", () => {
    expect(hasPermission(["task:read:any"], "task:read:own", "task:read:any")).toBe(true);
  });

  it("returns false when none of the required keys are granted", () => {
    expect(hasPermission(["task:create"], "task:delete:any")).toBe(false);
  });

  it("returns false for an empty granted list", () => {
    expect(hasPermission([], "task:create")).toBe(false);
  });
});
