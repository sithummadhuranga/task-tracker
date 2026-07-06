import { AppError } from "./app-error.js";

export class TooManyRequestsError extends AppError {
  readonly statusCode = 429;
  readonly error = "Too Many Requests";
}
