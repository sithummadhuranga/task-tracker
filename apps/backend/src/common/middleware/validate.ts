import type { NextFunction, Request, Response } from "express";
import type { ZodType } from "zod";
import { ValidationError } from "../errors/index.js";

type ValidationTarget = "body" | "query";

// req.query has no setter on some Express/Node combinations ("Cannot set property query of
// #<IncomingMessage> which has only a getter") — redefining the property sidesteps that
// entirely, for both targets, rather than relying on plain assignment.
export function validate(schema: ZodType, target: ValidationTarget = "body") {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[target]);

    if (!result.success) {
      const details = result.error.issues.map(
        (issue) => `${issue.path.join(".")}: ${issue.message}`,
      );
      throw new ValidationError("validation failed", details);
    }

    Object.defineProperty(req, target, { value: result.data, writable: true, configurable: true });
    next();
  };
}
