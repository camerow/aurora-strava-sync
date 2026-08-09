import { z } from "zod";
import { createApp } from "./app";
import { verifyClerkUser } from "./auth";
import type { Env, SyncJob } from "./bindings";
import { syncBoardCatalogue } from "./catalogue";
import { setBoardCursor, usersDueForSync } from "./lib/repo";
import { syncOneUser } from "./pipeline";

const SYNC_INTERVAL_MS = 23 * 60 * 60 * 1000;
const RATE_LIMIT_RETRY_SECONDS = 15 * 60;
const CATALOGUE_PENDING_RETRY_SECONDS = 60;

const queuedJobSchema = z.union([
  z.object({ kind: z.literal("catalogue"), board: z.string() }),
  z.object({ kind: z.literal("user"), userId: z.string(), board: z.string().optional() }),
  z
    .object({ userId: z.string(), board: z.string().optional() })
    .transform((j) => ({ kind: "user" as const, ...j })),
]);

const app = createApp({ verifyUser: verifyClerkUser });

export default {
  fetch: app.fetch,

  async scheduled(_controller: ScheduledController, env: Env): Promise<void> {
    await setBoardCursor(env.DB, "_meta", "cron_heartbeat", new Date().toISOString());
    const due = await usersDueForSync(env.DB, SYNC_INTERVAL_MS);
    if (due.length === 0) return;
    await env.SYNC_QUEUE.sendBatch(
      due.map((userId) => ({ body: { kind: "user" as const, userId } }))
    );
  },

  async queue(batch: MessageBatch<SyncJob>, env: Env): Promise<void> {
    for (const msg of batch.messages) {
      const parsed = queuedJobSchema.safeParse(msg.body);
      if (!parsed.success) {
        await setBoardCursor(
          env.DB,
          "_meta",
          "last_bad_queue_message",
          `${new Date().toISOString()} ${JSON.stringify(msg.body)}`.slice(0, 500)
        );
        msg.ack();
        continue;
      }
      const job = parsed.data;

      if (job.kind === "catalogue") {
        const outcome = await syncBoardCatalogue(env, job.board);
        await setBoardCursor(
          env.DB,
          "_meta",
          "last_catalogue_outcome",
          `${new Date().toISOString()} ${job.board} ${outcome.status}`
        );
        if (outcome.status === "continuing") await env.SYNC_QUEUE.send(job);
        msg.ack();
        continue;
      }

      let outcome;
      try {
        outcome = await syncOneUser(env, job.userId, undefined, job.board);
      } catch (err) {
        await setBoardCursor(
          env.DB,
          "_meta",
          "last_consumer_error",
          `${new Date().toISOString()} ${err instanceof Error ? err.message : String(err)}`.slice(
            0,
            500
          )
        );
        throw err;
      }
      await setBoardCursor(
        env.DB,
        "_meta",
        "last_consumer_outcome",
        `${new Date().toISOString()} ${outcome.status}`
      );
      if (outcome.status === "rate_limited") {
        msg.retry({ delaySeconds: RATE_LIMIT_RETRY_SECONDS });
      } else if (outcome.status === "catalogue_pending") {
        await env.SYNC_QUEUE.send(job, { delaySeconds: CATALOGUE_PENDING_RETRY_SECONDS });
        msg.ack();
      } else {
        msg.ack();
      }
    }
  },
} satisfies ExportedHandler<Env, SyncJob>;
