import type { ErrorRequestHandler } from "express";
import { AppError, ValidationError } from "../errors/index.js";

interface ErrorResponseBody {
  statusCode: number;
  error: string;
  message: string | string[];
}

// Express identifies error middleware by arity (4 params) — _req/_next must stay in the
// signature even though unused.
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    const body: ErrorResponseBody = {
      statusCode: err.statusCode,
      error: err.error,
      message: err instanceof ValidationError && err.details ? err.details : err.message,
    };
    res.status(err.statusCode).json(body);
    return;
  }

  console.error(err);
  const body: ErrorResponseBody = {
    statusCode: 500,
    error: "Internal Server Error",
    message: "Something went wrong",
  };
  res.status(500).json(body);
};
