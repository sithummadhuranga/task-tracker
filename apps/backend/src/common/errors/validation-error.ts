import { AppError } from "./app-error.js";

export class ValidationError extends AppError {
  readonly statusCode = 400;
  readonly error = "Bad Request";

  constructor(
    message: string,
    readonly details?: string[],
  ) {
    super(message);
  }
}
