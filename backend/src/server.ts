import { createApp } from "./http/app.js";
import { env } from "./config/env.js";

const app = createApp();

app.listen(env.PORT, () => {
  console.log(`NearFIX backend listening on http://localhost:${env.PORT}`);
});
