import React from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Form, redirect } from "react-router";
import { AuthShell, StepBody, StepCard, StepTitle } from "../auth/components/AuthShell";
import { requireApi } from "../lib/api.server";

export async function loader(args: LoaderFunctionArgs): Promise<null> {
  const api = await requireApi(args);
  const status = await api.status();
  if (status.strava?.status === "active") throw redirect("/app");
  return null;
}

export async function action(args: ActionFunctionArgs): Promise<Response> {
  const api = await requireApi(args);
  const { url } = await api.stravaAuthorizeUrl();
  return redirect(url);
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

export default function Setup(): React.ReactElement {
  return (
    <AuthShell>
      <StepCard step="STEP 2 OF 2 · STRAVA · OPTIONAL" width={520}>
        <StepTitle>Connect Strava.</StepTitle>
        <StepBody>
          Each logged session can become one Rock Climbing activity on your feed. You approve this
          on strava.com; we keep the token, and you can revoke it there any time. Skip it and your
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
    </AuthShell>
  );
}
