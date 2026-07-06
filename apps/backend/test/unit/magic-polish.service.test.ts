import { jest } from "@jest/globals";
import { MagicPolishService, type MagicPolishAiClient } from "../../src/modules/tasks/magic-polish.service.js";

function buildAiClient(
  polishTask: MagicPolishAiClient["polishTask"] = jest.fn<MagicPolishAiClient["polishTask"]>(() =>
    Promise.resolve({ title: "Write the report", description: "- Draft\n- Review" }),
  ),
): MagicPolishAiClient {
  return { polishTask };
}

describe("MagicPolishService", () => {
  it("delegates to the injected AI client and returns its result unchanged", async () => {
    const aiClient = buildAiClient();
    const service = new MagicPolishService(aiClient);

    const result = await service.polish({ title: "write report", description: "draft it" });

    expect(aiClient.polishTask).toHaveBeenCalledWith({ title: "write report", description: "draft it" });
    expect(result).toEqual({ title: "Write the report", description: "- Draft\n- Review" });
  });

  it("propagates errors raised by the AI client (e.g. ServiceUnavailableError) unchanged", async () => {
    const failure = new Error("upstream failed");
    const aiClient = buildAiClient(jest.fn<MagicPolishAiClient["polishTask"]>(() => Promise.reject(failure)));
    const service = new MagicPolishService(aiClient);

    await expect(service.polish({ title: "write report" })).rejects.toBe(failure);
  });
});
