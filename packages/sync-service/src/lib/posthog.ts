import { PostHog } from "posthog-node";
import type { Env } from "../bindings";

let posthog: PostHog | null | undefined;

export function getPostHog(env: Env): PostHog | null {
  if (posthog !== undefined) return posthog;

  const token = env.POSTHOG_PROJECT_TOKEN;
  const host = env.POSTHOG_HOST;
  if (token === undefined || token === "" || host === undefined || host === "") {
    posthog = null;
    return posthog;
  }

  posthog = new PostHog(token, {
    host,
    enableExceptionAutocapture: true,
    flushAt: 1,
    flushInterval: 0,
  });
  return posthog;
}
