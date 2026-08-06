import path from "node:path";
import { defineWorkersConfig, readD1Migrations } from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig(async () => {
  const migrations = await readD1Migrations(path.join(__dirname, "migrations"));
  return {
    test: {
      setupFiles: ["./test/apply-migrations.ts"],
      poolOptions: {
        workers: {
          singleWorker: true,
          wrangler: { configPath: "./wrangler.jsonc" },
          miniflare: {
            bindings: {
              TEST_MIGRATIONS: migrations,
              TOKEN_KEY: "VGhpcyBpcyBhIDMyLWJ5dGUgdGVzdCBrZXkhISEhISE=",
              CLERK_SECRET_KEY: "test-clerk-secret",
              STRAVA_CLIENT_ID: "12345",
              STRAVA_CLIENT_SECRET: "test-strava-secret",
              STRAVA_WEBHOOK_VERIFY_TOKEN: "test-verify-token",
              WEB_APP_URL: "https://sendtally.test",
            },
          },
        },
      },
    },
  };
});
