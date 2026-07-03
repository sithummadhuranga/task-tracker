import path from "node:path";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: path.join("src", "prisma", "schema.prisma"),
  migrations: {
    seed: "tsx src/prisma/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
