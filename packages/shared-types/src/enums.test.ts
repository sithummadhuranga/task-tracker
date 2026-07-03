import { describe, expect, it } from "vitest";
import { PERMISSION_KEYS, TASK_STATUSES, PERMISSION_EFFECTS } from "./enums.js";

// This catalog is locked for v1 — any accidental addition, removal, or typo here silently
// changes the RBAC surface every other module builds on.
describe("permission catalog", () => {
  it("matches the exact, locked v1 catalog", () => {
    expect(PERMISSION_KEYS).toEqual([
      "task:create",
      "task:read:own",
      "task:read:any",
      "task:update:own",
      "task:update:any",
      "task:delete:own",
      "task:delete:any",
      "role:manage",
      "user:manage",
      "permission:assign",
    ]);
  });

  it("has no duplicate keys", () => {
    expect(new Set(PERMISSION_KEYS).size).toBe(PERMISSION_KEYS.length);
  });
});

describe("task status enum", () => {
  it("matches the locked set of statuses", () => {
    expect(TASK_STATUSES).toEqual(["TODO", "IN_PROGRESS", "DONE"]);
  });
});

describe("permission effect enum", () => {
  it("only allows GRANT or DENY, in that order for fail-closed clarity", () => {
    expect(PERMISSION_EFFECTS).toEqual(["GRANT", "DENY"]);
  });
});
