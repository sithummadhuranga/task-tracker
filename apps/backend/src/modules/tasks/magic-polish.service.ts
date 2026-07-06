import type { MagicPolishRequest, MagicPolishResponse } from "@task-tracker/shared-types";
import { GeminiTextClient, type AiTextClient } from "./magic-polish.client.js";

export type MagicPolishAiClient = Pick<AiTextClient, "polishTask">;

// Deliberately its own service, not folded into TasksService — this never reads or writes a
// Task row (no repository, no ownership check, no WebSocket event), it only ever calls out to
// an external text-formatting client. A single responsibility, kept separate from task CRUD.
export class MagicPolishService {
  constructor(private readonly aiClient: MagicPolishAiClient = new GeminiTextClient()) {}

  async polish(input: MagicPolishRequest): Promise<MagicPolishResponse> {
    return this.aiClient.polishTask(input);
  }
}

export const magicPolishService = new MagicPolishService();
