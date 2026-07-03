import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from "../../src/common/errors/index.js";

describe("AppError hierarchy", () => {
  it("gives ValidationError a 400 status and carries structured details", () => {
    const error = new ValidationError("invalid body", ["title is required"]);

    expect(error.statusCode).toBe(400);
    expect(error.error).toBe("Bad Request");
    expect(error.details).toEqual(["title is required"]);
    expect(error).toBeInstanceOf(Error);
  });

  it("gives UnauthorizedError a 401 status", () => {
    const error = new UnauthorizedError("invalid credentials");
    expect(error.statusCode).toBe(401);
    expect(error.error).toBe("Unauthorized");
  });

  it("gives ForbiddenError a 403 status", () => {
    const error = new ForbiddenError("no access to this endpoint");
    expect(error.statusCode).toBe(403);
    expect(error.error).toBe("Forbidden");
  });

  it("gives NotFoundError a 404 status", () => {
    const error = new NotFoundError("task not found");
    expect(error.statusCode).toBe(404);
    expect(error.error).toBe("Not Found");
  });

  it("gives ConflictError a 409 status", () => {
    const error = new ConflictError("email already registered");
    expect(error.statusCode).toBe(409);
    expect(error.error).toBe("Conflict");
  });

  it("preserves the concrete error name for logging, not the base class name", () => {
    const error = new NotFoundError("task not found");
    expect(error.name).toBe("NotFoundError");
  });
});
