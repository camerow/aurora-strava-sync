import { z } from "zod";
import { createApp } from "./app";
import { deleteClerkUser, verifyClerkUser } from "./auth";
import type { Env, SyncJob } from "./bindings";
import { claimCatalogueEnqueue, syncBoardCatalogue, type CatalogueOutcome } from "./catalogue";
import {
  autoSyncBoardConnectionsForBoard,
  boardsWithActiveConnections,
  setBoardCursor,
  usersDueForSync,
} from "./lib/repo";
import { syncOneUser } from "./pipeline";

const SYNC_INTERVAL_MS = 23 * 60 * 60 * 1000;
const RATE_LIMIT_RETRY_SECONDS = 15 * 60;
const CATALOGUE_CRON = "0 4 * * *";
const QUEUE_SEND_BATCH_SIZE = 100;

export async function sendBatched(queue: Env["SYNC_QUEUE"], jobs: SyncJob[]): Promise<void> {
  for (let i = 0; i < jobs.length; i += QUEUE_SEND_BATCH_SIZE) {
    const chunk = jobs.slice(i, i + QUEUE_SEND_BATCH_SIZE);
    await queue.sendBatch(chunk.map((body) => ({ body })));
  }
}

const queuedJobSchema = z.union([
  z.object({ kind: z.literal("catalogue"), board: z.string() }),
  z.object({ kind: z.literal("user"), userId: z.string(), board: z.string().optional() }),
  z
    .object({ userId: z.string(), board: z.string().optional() })
    .transform((j) => ({ kind: "user" as const, ...j })),
]);

const app = createApp({ verifyUser: verifyClerkUser, deleteAuthUser: deleteClerkUser });

export default {
  fetch: app.fetch,

  async scheduled(controller: ScheduledController, env: Env): Promise<void> {
    await setBoardCursor(env.DB, "_meta", "cron_heartbeat", new Date().toISOString());

    if (controller.cron === CATALOGUE_CRON) {
      const boards = await boardsWithActiveConnections(env.DB);
      if (boards.length === 0) return;
      await env.SYNC_QUEUE.sendBatch(
        boards.map((board) => ({ body: { kind: "catalogue" as const, board } }))
      );
      return;
    }

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
        let outcome: CatalogueOutcome;
        try {
          outcome = await syncBoardCatalogue(env, job.board);
        } catch (err) {
          await setBoardCursor(
            env.DB,
            "_meta",
            "last_catalogue_error",
            `${new Date().toISOString()} ${job.board} ${err instanceof Error ? err.message : String(err)}`.slice(
              0,
              500
            )
          );
          throw err;
        }
        await setBoardCursor(
          env.DB,
          "_meta",
          "last_catalogue_outcome",
          `${new Date().toISOString()} ${job.board} ${outcome.status}`
        );
        if (outcome.status === "continuing") {
          await setBoardCursor(
            env.DB,
            job.board,
            "catalogue_enqueued_at",
            new Date().toISOString()
          );
          await env.SYNC_QUEUE.send(job);
        }
        if (outcome.status === "complete" && outcome.initialFill === true) {
          const waiting = await autoSyncBoardConnectionsForBoard(env.DB, job.board);
          await sendBatched(
            env.SYNC_QUEUE,
            waiting.map((conn) => ({
              kind: "user" as const,
              userId: conn.user_id,
              board: job.board,
            }))
          );
        }
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
        for (const board of outcome.pendingBoards ?? []) {
          await claimCatalogueEnqueue(env, board, () =>
            env.SYNC_QUEUE.send({ kind: "catalogue", board })
          );
        }
        msg.ack();
      } else {
        msg.ack();
      }
    }
  },
} satisfies ExportedHandler<Env, SyncJob>;
