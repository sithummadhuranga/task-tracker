import { randomUUID } from "node:crypto";
import { pinoHttp } from "pino-http";
import { logger } from "./logger.js";

// pino-http's own types already augment http.IncomingMessage (and therefore Express's Request)
// with a required `log: pino.Logger` — no separate declaration needed here.

// Always server-generated, never trusts an inbound x-request-id — a client-supplied value would
// land verbatim in structured logs, which is a log-injection vector for anything an attacker
// controls end to end.
export const requestLogger = pinoHttp({
  logger,
  genReqId: (_req, res) => {
    const id = randomUUID();
    res.setHeader("x-request-id", id);
    return id;
  },
});
