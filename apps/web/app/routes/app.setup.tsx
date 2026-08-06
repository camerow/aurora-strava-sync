import React from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Form, redirect, useActionData, useLoaderData, useNavigation } from "react-router";
import { ApiError, type ConnectionStatus } from "@sendtally/api-client";
import { AuthShell, StepBody, StepCard, StepTitle } from "../auth/components/AuthShell";
import { requireApi } from "../lib/api.server";

export async function loader(args: LoaderFunctionArgs): Promise<{ status: ConnectionStatus }> {
  const api = await requireApi(args);
  const status = await api.status();
  if (status.strava?.status === "active" && status.board?.status === "active") {
    throw redirect("/app");
  }
  return { status };
}

export async function action(args: ActionFunctionArgs): Promise<Response | { error: string }> {
  const api = await requireApi(args);
  const form = await args.request.formData();
  const intent = form.get("intent");
  if (intent === "strava") {
    const { url } = await api.stravaAuthorizeUrl();
    return redirect(url);
  }
  if (intent === "board") {
    try {
      await api.connectBoard({
        board: String(form.get("board")),
        username: String(form.get("username")),
        password: String(form.get("password")),
        timezone: String(form.get("timezone") || "UTC"),
        backfill: form.get("backfill") === "all",
      });
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        return { error: "Aurora rejected that login. Check the username and password." };
      }
      if (err instanceof ApiError) {
        return { error: `Board connect failed (HTTP ${err.status}: ${err.message}).` };
      }
      return { error: `Board connect failed (${err instanceof Error ? err.message : "unknown"}).` };
    }
    return redirect("/app/setup");
  }
  return { error: "unknown action" };
}

const detailRow: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "96px 1fr",
  gap: 14,
  padding: "12px 0",
  borderTop: "1px solid var(--line-on-light)",
};

const detailLabel: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontWeight: 500,
  fontSize: 11,
  letterSpacing: "0.08em",
  color: "var(--text-label-accent)",
  paddingTop: 2,
};

const detailBody: React.CSSProperties = {
  fontSize: 14,
  lineHeight: 1.5,
  color: "var(--text-on-white-secondary)",
};

const primaryButton: React.CSSProperties = {
  fontFamily: "var(--font-sans)",
  fontWeight: 600,
  fontSize: 15,
  color: "var(--bs-white)",
  background: "var(--bs-watermelon-ink)",
  border: "none",
  borderRadius: "var(--radius-control)",
  padding: "14px 22px",
  cursor: "pointer",
  alignSelf: "flex-start",
};

const fieldStyle: React.CSSProperties = {
  fontFamily: "var(--font-sans)",
  fontSize: 14,
  color: "var(--bs-gunmetal)",
  background: "var(--bs-white)",
  border: "1px solid rgba(64,63,76,0.15)",
  borderRadius: "var(--radius-control)",
  padding: "11px 13px",
  outline: "none",
};

function StravaStep(): React.ReactElement {
  return (
    <StepCard step="STEP 3 OF 4 · STRAVA · OPTIONAL" width={520}>
      <StepTitle>Connect Strava.</StepTitle>
      <StepBody>
        Each board session becomes one Rock Climbing activity on your feed. You approve this on
        strava.com; we keep the token, and you can revoke it there any time. Skip it and your
        sessions still land in sendtally - connect whenever you want them on Strava.
      </StepBody>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={detailRow}>
          <span style={detailLabel}>WRITES</span>
          <span style={detailBody}>New Rock Climbing activities, one per logged session</span>
        </div>
        <div style={detailRow}>
          <span style={detailLabel}>READS</span>
          <span style={detailBody}>Your name and avatar, to confirm the right account</span>
        </div>
        <div style={{ ...detailRow, borderBottom: "1px solid var(--line-on-light)" }}>
          <span style={detailLabel}>NEVER</span>
          <span style={detailBody}>Your other activities, messages, or followers</span>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
        <Form method="post">
          <input type="hidden" name="intent" value="strava" />
          <button type="submit" style={primaryButton}>
            Continue to Strava →
          </button>
        </Form>
        <a
          href="/app"
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            color: "rgba(64,63,76,0.6)",
            textDecoration: "underline",
          }}
        >
          Skip for now
        </a>
      </div>
    </StepCard>
  );
}

const BOARD_OPTIONS: Array<[string, string]> = [
  ["tension", "Tension Board"],
  ["kilter", "Kilter Board"],
  ["grasshopper", "Grasshopper Board"],
  ["decoy", "Decoy Board"],
  ["touchstone", "Touchstone Board"],
  ["soill", "So iLL Board"],
  ["aurora", "Aurora Board"],
];

function BoardStep({ error, busy }: { error: string | null; busy: boolean }): React.ReactElement {
  const [timezone, setTimezone] = React.useState("UTC");
  React.useEffect(() => {
    setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  }, []);

  return (
    <StepCard step="STEP 2 OF 4 · BOARDS" width={560}>
      <StepTitle>Link your board.</StepTitle>
      <StepBody>
        Board apps run on Aurora Climbing accounts - one login per app. sendtally signs in once to
        mint a session token. The token is stored encrypted; the password is not stored.
      </StepBody>
      <Form method="post" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <input type="hidden" name="intent" value="board" />
        <input type="hidden" name="timezone" value={timezone} />
        <select name="board" defaultValue="tension" style={{ ...fieldStyle, cursor: "pointer" }}>
          {BOARD_OPTIONS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <input
          name="username"
          type="text"
          required
          placeholder="Aurora username or email"
          style={fieldStyle}
        />
        <input name="password" type="password" required placeholder="Password" style={fieldStyle} />
        <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "6px 0" }}>
          <label style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer" }}>
            <input
              type="radio"
              name="backfill"
              value="new"
              defaultChecked
              style={{ marginTop: 3 }}
            />
            <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={{ fontWeight: 600, fontSize: 14 }}>Just new sessions</span>
              <span style={{ fontSize: 13, color: "var(--text-on-white-secondary)" }}>
                Start from today. The past stays where it is.
              </span>
            </span>
          </label>
          <label style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer" }}>
            <input type="radio" name="backfill" value="all" style={{ marginTop: 3 }} />
            <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={{ fontWeight: 600, fontSize: 14 }}>Import full history</span>
              <span style={{ fontSize: 13, color: "var(--text-on-white-secondary)" }}>
                Every logged session becomes a back-dated Strava activity.
              </span>
            </span>
          </label>
        </div>
        {error !== null && (
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              color: "var(--text-label-accent)",
            }}
          >
            {error}
          </span>
        )}
        <button
          type="submit"
          disabled={busy}
          style={{ ...primaryButton, opacity: busy ? 0.45 : 1 }}
        >
          {busy ? "Minting token…" : "Link board →"}
        </button>
        <span
          style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "rgba(64,63,76,0.55)" }}
        >
          Sent once to Aurora to mint a token. Not stored.
        </span>
      </Form>
    </StepCard>
  );
}

export default function Setup(): React.ReactElement {
  const { status } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const busy = navigation.state === "submitting";
  const boardDone = status.board?.status === "active";
  const error = actionData !== undefined && "error" in actionData ? actionData.error : null;

  return (
    <AuthShell>{boardDone ? <StravaStep /> : <BoardStep error={error} busy={busy} />}</AuthShell>
  );
}
