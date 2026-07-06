import type { Request, Response } from "express";
import type { MagicPolishRequest } from "./magic-polish.dto.js";
import { magicPolishService } from "./magic-polish.service.js";

export async function polishTask(
  req: Request<Record<string, never>, unknown, MagicPolishRequest>,
  res: Response,
): Promise<void> {
  const result = await magicPolishService.polish(req.body);
  res.status(200).json(result);
}
