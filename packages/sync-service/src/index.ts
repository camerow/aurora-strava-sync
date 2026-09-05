import { createApp } from "./app";
import { verifyClerkUser } from "./auth";
import type { Env } from "./bindings";

const app = createApp({ verifyUser: verifyClerkUser });

export default {
  fetch: app.fetch,
} satisfies ExportedHandler<Env>;
