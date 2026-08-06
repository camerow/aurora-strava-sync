import { useClerk } from "@clerk/react-router";
import { isClerkAPIResponseError } from "@clerk/react-router/errors";
import React from "react";
import { useNavigate } from "react-router";
import type { EmailCodeFactor } from "@clerk/types";
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
  letterSpacing: "0.08em",
  color: "var(--text-label-accent)",
};

const errorText: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 12,
  color: "var(--text-label-accent)",
};

function clerkErrorMessage(err: unknown): string {
  if (isClerkAPIResponseError(err)) {
    const first = err.errors[0];
    if (first !== undefined) return first.longMessage ?? first.message;
  }
  return "Something went wrong. Try again.";
}

type Phase = { name: "email" } | { name: "code"; mode: "sign-in" | "sign-up" };

export default function SignIn(): React.ReactElement {
  const clerk = useClerk();
  const navigate = useNavigate();
  const [email, setEmail] = React.useState("");
  const [code, setCode] = React.useState("");
  const [phase, setPhase] = React.useState<Phase>({ name: "email" });
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  async function sendCode(): Promise<void> {
    if (!clerk.loaded || clerk.client === undefined) return;
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      setError("That doesn't look like an email address.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const signIn = await clerk.client.signIn.create({ identifier: email });
      const factor = signIn.supportedFirstFactors?.find(
        (f): f is EmailCodeFactor => f.strategy === "email_code"
      );
      if (factor === undefined) {
        setError("Email code sign-in is not enabled for this account.");
        setBusy(false);
        return;
      }
      await signIn.prepareFirstFactor({
        strategy: "email_code",
        emailAddressId: factor.emailAddressId,
      });
      setPhase({ name: "code", mode: "sign-in" });
    } catch (signInErr) {
      const identifierNotFound =
        isClerkAPIResponseError(signInErr) &&
        signInErr.errors.some((e) => e.code === "form_identifier_not_found");
      if (!identifierNotFound) {
        setError(clerkErrorMessage(signInErr));
        setBusy(false);
        return;
      }
      try {
        const signUp = await clerk.client.signUp.create({ emailAddress: email });
        await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
        setPhase({ name: "code", mode: "sign-up" });
      } catch (signUpErr) {
        setError(clerkErrorMessage(signUpErr));
      }
    }
    setBusy(false);
  }

  async function verifyCode(): Promise<void> {
    if (!clerk.loaded || clerk.client === undefined || phase.name !== "code") return;
    if (!/^\d{6}$/.test(code.trim())) {
      setError("Enter the six-digit code from the email.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      if (phase.mode === "sign-in") {
        const result = await clerk.client.signIn.attemptFirstFactor({
          strategy: "email_code",
          code: code.trim(),
        });
        if (result.status === "complete" && result.createdSessionId !== null) {
          await clerk.setActive({ session: result.createdSessionId });
          await navigate("/app");
          return;
        }
        setError(`Sign-in incomplete (status: ${result.status ?? "unknown"}). Try resending.`);
      } else {
        let signUp = await clerk.client.signUp.attemptEmailAddressVerification({
          code: code.trim(),
        });
        if (signUp.status === "missing_requirements" && signUp.missingFields.length === 0) {
          signUp = await signUp.update({});
        }
        if (signUp.status === "complete" && signUp.createdSessionId !== null) {
          await clerk.setActive({ session: signUp.createdSessionId });
          await navigate("/app");
          return;
        }
        const missing = signUp.missingFields.join(", ");
        setError(
          `Account creation incomplete (status: ${signUp.status ?? "unknown"}${
            missing !== "" ? `, missing: ${missing}` : ""
          }). This is a setup gap on our side - tell us what this says.`
        );
      }
    } catch (err) {
      setError(clerkErrorMessage(err));
    }
    setBusy(false);
  }

  if (phase.name === "code") {
    return (
      <AuthShell>
        <StepCard step="STEP 1 OF 4 · ACCOUNT">
          <StepTitle>Check your inbox.</StepTitle>
          <StepBody>
            We sent a six-digit code to{" "}
            <span style={{ color: "var(--bs-gunmetal)", fontWeight: 600 }}>{email}</span>. Enter it
            here to {phase.mode === "sign-up" ? "create your account" : "sign in"}.
          </StepBody>
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            <label htmlFor="bs-code" style={stepLabel}>
              CODE
            </label>
            <input
              id="bs-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="123456"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void verifyCode();
              }}
              style={{ ...inputStyle, fontFamily: "var(--font-mono)", letterSpacing: "0.2em" }}
            />
            {error !== null && <span style={errorText}>{error}</span>}
            <button
              onClick={() => void verifyCode()}
              disabled={busy}
              style={{ ...azureButton, opacity: busy ? 0.45 : 1 }}
            >
              {phase.mode === "sign-up" ? "Create account" : "Sign in"}
            </button>
          </div>
          <div style={{ display: "flex", gap: 18, alignItems: "center" }}>
            <button
              onClick={() => {
                setPhase({ name: "email" });
                setCode("");
                setError(null);
              }}
              style={linkButton}
            >
              Use a different email
            </button>
            <button onClick={() => void sendCode()} style={linkButton}>
              Resend code
            </button>
          </div>
          <span
            style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "rgba(64,63,76,0.58)" }}
          >
            The code works once and expires quickly.
          </span>
        </StepCard>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <StepCard step="STEP 1 OF 4 · ACCOUNT">
        <StepTitle>Sign in or create an account.</StepTitle>
        <StepBody>
          No password. Enter your email and we send a one-time code. New email, new account - same
          thing.
        </StepBody>
        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
          <label htmlFor="bs-email" style={stepLabel}>
            EMAIL
          </label>
          <input
            id="bs-email"
            type="email"
            placeholder="you@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void sendCode();
            }}
            style={inputStyle}
          />
          {error !== null && <span style={errorText}>{error}</span>}
          <button
            onClick={() => void sendCode()}
            disabled={busy}
            style={{ ...azureButton, opacity: busy ? 0.45 : 1 }}
          >
            Email me a code
          </button>
          <div id="clerk-captcha" />
        </div>
        <span
          style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "rgba(64,63,76,0.58)" }}
        >
          The code works once and expires quickly.
        </span>
      </StepCard>
    </AuthShell>
  );
}
