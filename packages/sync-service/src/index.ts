import { createApp } from "./app";
import { verifyClerkUser } from "./auth";
import type { Env, SyncJob } from "./bindings";
import { usersDueForSync } from "./lib/repo";
import { syncOneUser } from "./pipeline";

const SYNC_INTERVAL_MS = 55 * 60 * 1000;
const RATE_LIMIT_RETRY_SECONDS = 15 * 60;

const app = createApp({ verifyUser: verifyClerkUser });

export default {
  fetch: app.fetch,

  async scheduled(_controller: ScheduledController, env: Env): Promise<void> {
    await env.DB.prepare(
      `INSERT OR REPLACE INTO board_cursors (board, table_name, value) VALUES ('_meta', 'cron_heartbeat', ?)`
    )
      .bind(new Date().toISOString())
      .run();
    const due = await usersDueForSync(env.DB, SYNC_INTERVAL_MS);
    if (due.length === 0) return;
    await env.SYNC_QUEUE.sendBatch(due.map((userId) => ({ body: { userId } })));
  },

  async queue(batch: MessageBatch<SyncJob>, env: Env): Promise<void> {
    for (const msg of batch.messages) {
      let outcome;
      try {
        outcome = await syncOneUser(env, msg.body.userId);
      } catch (err) {
        await env.DB.prepare(
          `INSERT OR REPLACE INTO board_cursors (board, table_name, value) VALUES ('_meta', 'last_consumer_error', ?)`
        )
          .bind(
            `${new Date().toISOString()} ${err instanceof Error ? err.message : String(err)}`.slice(
              0,
              500
            )
          )
          .run();
        throw err;
      }
      await env.DB.prepare(
        `INSERT OR REPLACE INTO board_cursors (board, table_name, value) VALUES ('_meta', 'last_consumer_outcome', ?)`
      )
        .bind(`${new Date().toISOString()} ${outcome.status}`)
        .run();
      if (outcome.status === "rate_limited") {
        msg.retry({ delaySeconds: RATE_LIMIT_RETRY_SECONDS });
      } else if (outcome.status === "cache_filling") {
        // Continue the fill in a fresh invocation with a fresh subrequest
        // budget; a new message avoids the max_retries cap.
        await env.SYNC_QUEUE.send({ userId: msg.body.userId });
        msg.ack();
      } else {
        msg.ack();
      }
    }
  },
} satisfies ExportedHandler<Env, SyncJob>;
