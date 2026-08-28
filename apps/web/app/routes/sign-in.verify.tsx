import { useClerk } from "@clerk/react-router";
import React from "react";
import { AuthShell, StepBody, StepCard, StepTitle } from "../auth/components/AuthShell";

type VerifyState = "verifying" | "verified-elsewhere" | "expired" | "failed";

const COPY: Record<VerifyState, { title: string; body: string }> = {
  verifying: {
    title: "Signing you in…",
    body: "One moment - verifying your sign-in link.",
  },
  "verified-elsewhere": {
    title: "You're signed in.",
    body: "This link was opened in a different browser than the one that requested it, so the tab where you entered your email is now signed in. Go back to it - or sign in again right here on this device.",
  },
  expired: {
    title: "That link expired.",
    body: "Sign-in links work once and expire quickly. Head back and request a fresh one.",
  },
  failed: {
    title: "That link didn't work.",
    body: "The link may have already been used. Head back and request a fresh one.",
  },
};

export default function SignInVerify(): React.ReactElement {
  const clerk = useClerk();
  const [state, setState] = React.useState<VerifyState>("verifying");

  React.useEffect(() => {
    let cancelled = false;
    clerk
      .handleEmailLinkVerification({ redirectUrlComplete: "/app" })
      .then(() => {
        if (!cancelled) setState("verified-elsewhere");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const code = (err as { code?: string }).code;
        setState(code === "expired" ? "expired" : "failed");
      });
    return () => {
      cancelled = true;
    };
  }, [clerk]);

  const { title, body } = COPY[state];
  return (
    <AuthShell>
      <StepCard step="STEP 1 OF 2 · ACCOUNT">
        <StepTitle>{title}</StepTitle>
        <StepBody>{body}</StepBody>
        {state !== "verifying" && (
          <a
            href="/sign-in"
            style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--text-link)" }}
          >
            {state === "verified-elsewhere" ? "Sign in on this device" : "Back to sign in"}
          </a>
        )}
      </StepCard>
    </AuthShell>
  );
}
