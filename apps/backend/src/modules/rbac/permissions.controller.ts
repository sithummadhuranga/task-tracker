import type { Request, Response } from "express";
import { permissionsService } from "./permissions.service.js";

export async function listCatalog(_req: Request, res: Response): Promise<void> {
  const catalog = await permissionsService.listCatalog();
  res.status(200).json(catalog);
}
