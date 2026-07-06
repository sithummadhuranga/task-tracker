import type { ErrorRequestHandler } from "express";
import { AppError, ValidationError } from "../errors/index.js";

interface ErrorResponseBody {
  statusCode: number;
  error: string;
  message: string | string[];
}

interface ExposableHttpError {
  statusCode: number;
  expose: true;
  message: string;
}

// The only framework-level errors expected to reach here: body-parser's JSON size limit (413)
// and malformed JSON syntax (400). Falls back to the message itself for anything else so an
// unanticipated exposable error still reads sensibly rather than showing "undefined".
const HTTP_ERROR_REASON_PHRASES: Record<number, string> = {
  400: "Bad Request",
  413: "Payload Too Large",
};

// body-parser (e.g. the express.json() size-limit rejection) throws a plain http-errors
// instance, not one of our AppError subclasses — expose === true is that library's own signal
// that statusCode/message are safe to hand back to the client rather than internal detail.
function isExposableHttpError(err: unknown): err is ExposableHttpError {
  return (
    typeof err === "object" &&
    err !== null &&
    "expose" in err &&
    err.expose === true &&
    "statusCode" in err &&
    typeof err.statusCode === "number"
  );
}

// Express identifies error middleware by arity (4 params) — _next must stay in the signature
// even though unused.
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof AppError) {
    const body: ErrorResponseBody = {
      statusCode: err.statusCode,
      error: err.error,
      message: err instanceof ValidationError && err.details ? err.details : err.message,
    };
    res.status(err.statusCode).json(body);
    return;
  }

  if (isExposableHttpError(err)) {
    const body: ErrorResponseBody = {
      statusCode: err.statusCode,
      error: HTTP_ERROR_REASON_PHRASES[err.statusCode] ?? err.message,
      message: err.message,
    };
    res.status(err.statusCode).json(body);
    return;
  }

  // req.log (attached by pino-http, always wired ahead of every route in app.ts) already
  // carries this request's reqId/method/url bindings, so this line can be correlated with the
  // rest of that request's log output.
  req.log.error({ err }, "unhandled error");
  const body: ErrorResponseBody = {
    statusCode: 500,
    error: "Internal Server Error",
    message: "Something went wrong",
  };
  res.status(500).json(body);
};
