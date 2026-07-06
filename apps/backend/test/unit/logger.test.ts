import pino from "pino";
import { buildLoggerOptions } from "../../src/common/logging/logger.js";

describe("buildLoggerOptions", () => {
  it("redacts auth headers and cookies so tokens never reach a log sink", () => {
    const options = buildLoggerOptions("production", "info");

    expect(options.redact).toEqual({
      paths: ["req.headers.authorization", "req.headers.cookie", 'res.headers["set-cookie"]'],
      censor: "[Redacted]",
    });
  });

  it("uses pino's standard error serializer", () => {
    const options = buildLoggerOptions("production", "info");

    expect(options.serializers?.err).toBe(pino.stdSerializers.err);
  });

  it("passes the configured level straight through", () => {
    expect(buildLoggerOptions("production", "debug").level).toBe("debug");
    expect(buildLoggerOptions("test", "silent").level).toBe("silent");
  });

  it("only enables the pino-pretty transport in development", () => {
    expect(buildLoggerOptions("development", "info").transport).toEqual({
      target: "pino-pretty",
      options: { colorize: true, translateTime: "SYS:standard", ignore: "pid,hostname" },
    });
    expect(buildLoggerOptions("production", "info").transport).toBeUndefined();
    expect(buildLoggerOptions("test", "info").transport).toBeUndefined();
  });
});
