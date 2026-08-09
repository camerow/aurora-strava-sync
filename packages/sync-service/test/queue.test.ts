import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import worker from "../src/index";
import type { Env, SyncJob } from "../src/bindings";

type Msg = { body: unknown; acked: boolean; retried: boolean; retry: () => void; ack: () => void };

function message(body: unknown): Msg {
  const m: Msg = {
    body,
    acked: false,
    retried: false,
    retry: () => {
      m.retried = true;
    },
    ack: () => {
      m.acked = true;
    },
  };
  return m;
}

function envWithQueue(sent: SyncJob[]): Env {
  return {
    ...env,
    SYNC_QUEUE: { send: async (b: SyncJob) => void sent.push(b) },
  } as unknown as Env;
}

describe("queue consumer routing", () => {
  it("treats a message with no kind as a user job", async () => {
    const sent: SyncJob[] = [];
    const msg = message({ userId: "queue_user_legacy" });
    await worker.queue({ messages: [msg] } as never, envWithQueue(sent));
    expect(msg.acked).toBe(true);
  });

  it("routes a catalogue message to the catalogue path", async () => {
    const sent: SyncJob[] = [];
    const msg = message({ kind: "catalogue", board: "soill" });
    await worker.queue({ messages: [msg] } as never, envWithQueue(sent));
    expect(msg.acked).toBe(true);
    expect(sent).toHaveLength(0);
  });

  it("acks a malformed message instead of retrying it forever", async () => {
    const sent: SyncJob[] = [];
    const msg = message({ nonsense: true });
    await worker.queue({ messages: [msg] } as never, envWithQueue(sent));
    expect(msg.acked).toBe(true);
    expect(msg.retried).toBe(false);
    expect(sent).toHaveLength(0);
  });
});
