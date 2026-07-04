import type { Request, Response } from "express";
import { jest } from "@jest/globals";
import { requirePermission } from "../../src/common/middleware/requirePermission.js";
import { permissionsService } from "../../src/modules/rbac/permissions.service.js";
import { ForbiddenError, UnauthorizedError } from "../../src/common/errors/index.js";

describe("requirePermission", () => {
  const next = jest.fn();

  afterEach(() => {
    jest.restoreAllMocks();
    next.mockClear();
  });

  it("throws UnauthorizedError when the request has no authenticated user", async () => {
    const req = {} as Request;
    const middleware = requirePermission("task:create");

    await expect(middleware(req, {} as Response, next)).rejects.toThrow(UnauthorizedError);
    expect(next).not.toHaveBeenCalled();
  });

  it("throws ForbiddenError when the caller holds none of the required keys", async () => {
    jest.spyOn(permissionsService, "resolveEffectivePermissions").mockResolvedValue(["task:create"]);
    const req = { user: { id: "user-1" } } as Request;
    const middleware = requirePermission("role:manage", "user:manage");

    await expect(middleware(req, {} as Response, next)).rejects.toThrow(ForbiddenError);
    expect(next).not.toHaveBeenCalled();
  });

  it("calls next() when the caller holds at least one of the required keys (OR semantics)", async () => {
    jest
      .spyOn(permissionsService, "resolveEffectivePermissions")
      .mockResolvedValue(["task:read:own"]);
    const req = { user: { id: "user-1" } } as Request;
    const middleware = requirePermission("task:read:own", "task:read:any");

    await middleware(req, {} as Response, next);

    expect(next).toHaveBeenCalledTimes(1);
  });
});
