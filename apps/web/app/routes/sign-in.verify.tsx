import { useClerk } from "@clerk/react-router";
import React from "react";
import { AuthShell, StepBody, StepCard, StepTitle } from "../auth/components/AuthShell";

export default function SignInVerify(): React.ReactElement {
  const clerk = useClerk();
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    clerk
      .handleEmailLinkVerification({
        redirectUrlComplete: "/app",
        redirectUrl: "/sign-in",
      })
      .catch(() => setFailed(true));
  }, [clerk]);

  return (
    <AuthShell>
      <StepCard step="STEP 1 OF 4 · ACCOUNT">
        <StepTitle>{failed ? "That link didn't work." : "Signing you in…"}</StepTitle>
        <StepBody>
          {failed
            ? "The link may have expired or already been used. Head back and request a fresh one."
            : "One moment - verifying your sign-in link."}
        </StepBody>
        {failed && (
          <a
            href="/sign-in"
            style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--text-link)" }}
          >
            Back to sign in
          </a>
        )}
      </StepCard>
    </AuthShell>
  );
}
