import { AppError } from "./app-error.js";

export class UnauthorizedError extends AppError {
  readonly statusCode = 401;
  readonly error = "Unauthorized";
}
