import React from "react";
import type { LoaderFunctionArgs } from "react-router";
import { Link, useLoaderData } from "react-router";
import { cloudflareContext } from "../lib/cloudflare-context";
import { requireApi } from "../lib/api.server";
import { useClientApi } from "../lib/useClientApi";
import { LogSessionForm } from "../log-session/components/LogSessionForm";

export async function loader(args: LoaderFunctionArgs): Promise<{ apiUrl: string }> {
  await requireApi(args);
  return { apiUrl: args.context.get(cloudflareContext).env.API_URL };
}

export default function LogSessionRoute(): React.ReactElement {
  const { apiUrl } = useLoaderData<typeof loader>();
  const api = useClientApi(apiUrl);

  return (
    <div>
      <Link
        to="/app"
        style={{
          fontFamily: "var(--font-mono)",
          fontWeight: 500,
          fontSize: 12,
          letterSpacing: "0.04em",
          color: "var(--text-label-accent)",
          textDecoration: "none",
        }}
      >
        ← SESSIONS
      </Link>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, margin: "14px 0 26px" }}>
        <h1
          style={{
            margin: 0,
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: 36,
            lineHeight: 1.05,
            letterSpacing: "-0.03em",
          }}
        >
          Log a session
        </h1>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontWeight: 500,
            fontSize: 11,
            letterSpacing: "0.08em",
            color: "rgba(64,63,76,0.72)",
          }}
        >
          MANUAL ENTRY · EFFORT IS SCORED WHEN YOU SAVE
        </span>
      </div>
      <LogSessionForm api={api} />
    </div>
  );
}
