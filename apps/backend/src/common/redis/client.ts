import { Redis } from "ioredis";
import { env } from "../config/env.js";

// lazyConnect: importing this module (e.g. transitively, through a service that takes it as a
// default constructor parameter) must never open a real socket by itself — unit tests inject
// their own fake client and never call a method on this one, so an eager connection attempt
// would just hang retrying against a Redis that isn't there.
export const redisClient = new Redis(env.REDIS_URL, { lazyConnect: true });
