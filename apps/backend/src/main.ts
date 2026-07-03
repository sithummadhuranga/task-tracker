import { createApp } from "./app.js";
import { env } from "./common/config/env.js";

const app = createApp();

app.listen(env.PORT, () => {
  console.log(`Backend listening on port ${env.PORT} (${env.NODE_ENV})`);
});
