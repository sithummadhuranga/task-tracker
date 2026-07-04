import { PERMISSION_KEYS } from "@task-tracker/shared-types";
import { USER_ROLE_PERMISSIONS } from "../../src/prisma/seed.js";

describe("USER_ROLE_PERMISSIONS", () => {
  it("only contains keys from the real permission catalog", () => {
    for (const key of USER_ROLE_PERMISSIONS) {
      expect(PERMISSION_KEYS).toContain(key);
    }
  });

  it("has no duplicates", () => {
    expect(new Set(USER_ROLE_PERMISSIONS).size).toBe(USER_ROLE_PERMISSIONS.length);
  });

  it("matches the locked default USER grant set exactly", () => {
    expect(USER_ROLE_PERMISSIONS).toEqual([
      "task:create",
      "task:read:own",
      "task:update:own",
      "task:delete:own",
    ]);
  });

  it("excludes every :any-scoped and admin-only permission", () => {
    for (const key of USER_ROLE_PERMISSIONS) {
      expect(key).not.toMatch(/:any$/);
    }
    expect(USER_ROLE_PERMISSIONS).not.toContain("role:manage");
    expect(USER_ROLE_PERMISSIONS).not.toContain("user:manage");
    expect(USER_ROLE_PERMISSIONS).not.toContain("permission:assign");
  });
});
