import { AppError } from "./app-error.js";

export class ServiceUnavailableError extends AppError {
  readonly statusCode = 503;
  readonly error = "Service Unavailable";
}
