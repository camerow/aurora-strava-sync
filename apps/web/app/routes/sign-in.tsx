import { useClerk } from "@clerk/react-router";
import React from "react";
import { useNavigate } from "react-router";
import { AuthShell, StepBody, StepCard, StepTitle } from "../auth/components/AuthShell";

export function meta(): Array<Record<string, string>> {
  return [{ title: "sign in - sendtally" }];
}

const inputStyle: React.CSSProperties = {
  fontFamily: "var(--font-sans)",
  fontSize: 15,
  color: "var(--bs-gunmetal)",
  background: "#F7F6F3",
  border: "1px solid rgba(64,63,76,0.12)",
  borderRadius: "var(--radius-control)",
  padding: "13px 15px",
  outline: "none",
};

const azureButton: React.CSSProperties = {
  fontFamily: "var(--font-sans)",
  fontWeight: 600,
  fontSize: 15,
  color: "var(--bs-white)",
  background: "var(--bs-azure-ink)",
  border: "none",
  borderRadius: "var(--radius-control)",
  padding: "13px 15px",
  cursor: "pointer",
};

const linkButton: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 12,
  color: "rgba(64,63,76,0.6)",
  background: "none",
  border: "none",
  cursor: "pointer",
  textDecoration: "underline",
};

const stepLabel: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontWeight: 500,
  fontSize: 11,
  letterSpacing: "0.1em",
  color: "var(--text-label-accent)",
};

export default function SignIn(): React.ReactElement {
  const clerk = useClerk();
  const navigate = useNavigate();
  const [email, setEmail] = React.useState("");
  const [sent, setSent] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  async function sendLink(): Promise<void> {
    if (!clerk.loaded || clerk.client === undefined) return;
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      setError("That doesn't look like an email address.");
      return;
    }
    setError(null);
    setBusy(true);
    const redirectUrl = `${window.location.origin}/sign-in/verify`;
    try {
      const signIn = await clerk.client.signIn.create({ identifier: email });
      const factor = signIn.supportedFirstFactors?.find((f) => f.strategy === "email_link");
      if (factor === undefined || !("emailAddressId" in factor)) {
        setError("Email link sign-in is not enabled for this account.");
        setBusy(false);
        return;
      }
      setSent(true);
      const { startEmailLinkFlow } = signIn.createEmailLinkFlow();
      const result = await startEmailLinkFlow({
        emailAddressId: factor.emailAddressId,
        redirectUrl,
      });
      if (result.status === "complete" && result.createdSessionId !== null) {
        await clerk.setActive({ session: result.createdSessionId });
        await navigate("/app");
      }
    } catch {
      try {
        const signUp = await clerk.client.signUp.create({ emailAddress: email });
        setSent(true);
        const { startEmailLinkFlow } = signUp.createEmailLinkFlow();
        const result = await startEmailLinkFlow({ redirectUrl });
        if (result.status === "complete" && result.createdSessionId !== null) {
          await clerk.setActive({ session: result.createdSessionId });
          await navigate("/app");
        }
      } catch {
        setSent(false);
        setError("Could not send the link. Check the address and try again.");
      }
    }
    setBusy(false);
  }

  if (sent) {
    return (
      <AuthShell>
        <div
          style={{ width: "min(480px, 100%)", display: "flex", flexDirection: "column", gap: 18 }}
        >
          <span style={stepLabel}>STEP 1 OF 4 · ACCOUNT</span>
          <StepTitle>Check your inbox.</StepTitle>
          <StepBody>
            We sent a sign-in link to{" "}
            <span style={{ color: "var(--bs-gunmetal)", fontWeight: 600 }}>{email}</span>. Open it
            on any device - this page signs in by itself once the link is clicked. It works once and
            expires quickly.
          </StepBody>
          <div style={{ display: "flex", gap: 18, alignItems: "center" }}>
            <button onClick={() => setSent(false)} style={linkButton}>
              Use a different email
            </button>
            <button onClick={() => void sendLink()} style={linkButton}>
              Resend
            </button>
          </div>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <StepCard step="STEP 1 OF 4 · ACCOUNT">
        <StepTitle>Sign in or create an account.</StepTitle>
        <StepBody>
          No password. Enter your email and we send a one-time sign-in link. New email, new account
          - same thing.
        </StepBody>
        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
          <label htmlFor="bs-email" style={{ ...stepLabel, letterSpacing: "0.08em" }}>
            EMAIL
          </label>
          <input
            id="bs-email"
            type="email"
            placeholder="you@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void sendLink();
            }}
            style={inputStyle}
          />
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
            onClick={() => void sendLink()}
            disabled={busy}
            style={{ ...azureButton, opacity: busy ? 0.45 : 1 }}
          >
            Email me a sign-in link
          </button>
        </div>
        <span
          style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "rgba(64,63,76,0.58)" }}
        >
          The link works once and expires quickly.
        </span>
      </StepCard>
    </AuthShell>
  );
}
