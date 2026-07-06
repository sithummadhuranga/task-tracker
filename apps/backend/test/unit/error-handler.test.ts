import type { Request, Response } from "express";
import { jest } from "@jest/globals";
import { ValidationError, NotFoundError } from "../../src/common/errors/index.js";
import { errorHandler } from "../../src/common/middleware/error-handler.js";

// pino-http (wired ahead of every route in app.ts) guarantees a real req.log in production; the
// AppError/exposable-error branches below never touch it, but any test that reaches the generic
// 500 fallback needs this stand-in since it constructs a bare request object.
function withLogStub(): Request & { log: { error: jest.Mock } } {
  return { log: { error: jest.fn() } } as unknown as Request & { log: { error: jest.Mock } };
}

function createMockResponse() {
  const res = {
    statusCode: 0,
    body: undefined as unknown,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(payload: unknown) {
      res.body = payload;
      return res;
    },
  };
  return res as unknown as Response & { statusCode: number; body: unknown };
}

describe("errorHandler", () => {
  const req = {} as Request;
  const next = jest.fn();

  it("shapes an AppError into { statusCode, error, message }", () => {
    const res = createMockResponse();

    errorHandler(new NotFoundError("task not found"), req, res, next);

    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({
      statusCode: 404,
      error: "Not Found",
      message: "task not found",
    });
  });

  it("prefers ValidationError.details over the plain message when present", () => {
    const res = createMockResponse();

    errorHandler(new ValidationError("invalid body", ["title is required"]), req, res, next);

    expect(res.body).toEqual({
      statusCode: 400,
      error: "Bad Request",
      message: ["title is required"],
    });
  });

  it("surfaces an http-errors-style exposable error under its own statusCode, e.g. body-parser's 413", () => {
    const res = createMockResponse();
    const payloadTooLarge = Object.assign(new Error("request entity too large"), {
      statusCode: 413,
      expose: true,
    });

    errorHandler(payloadTooLarge, req, res, next);

    expect(res.statusCode).toBe(413);
    expect(res.body).toEqual({
      statusCode: 413,
      error: "Payload Too Large",
      message: "request entity too large",
    });
  });

  it("falls back to the raw message as 'error' for an exposable status code with no known reason phrase", () => {
    const res = createMockResponse();
    const teapot = Object.assign(new Error("short and stout"), {
      statusCode: 418,
      expose: true,
    });

    errorHandler(teapot, req, res, next);

    expect(res.statusCode).toBe(418);
    expect(res.body).toEqual({
      statusCode: 418,
      error: "short and stout",
      message: "short and stout",
    });
  });

  it("masks unexpected errors behind a generic 500, never leaking internals, and logs via req.log", () => {
    const res = createMockResponse();
    const reqWithLog = withLogStub();
    const error = new Error("leaked db connection string");

    errorHandler(error, reqWithLog, res, next);

    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({
      statusCode: 500,
      error: "Internal Server Error",
      message: "Something went wrong",
    });
    expect(reqWithLog.log.error).toHaveBeenCalledWith({ err: error }, "unhandled error");
  });
});
