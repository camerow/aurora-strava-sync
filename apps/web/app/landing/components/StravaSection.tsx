import React from "react";
import { Button, Label } from "@sendtally/design";
import { SessionPreviewCard } from "./SessionPreviewCard";

export function StravaSection(): React.ReactElement {
  return (
    <div id="strava" className="l-strava">
      <div className="l-strava-inner">
        <div
          style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 20 }}
        >
          <Label on="dark" style={{ letterSpacing: "0.1em" }}>
            ALSO: STRAVA · FREE
          </Label>
          <h2
            className="l-section-title"
            style={{ color: "var(--text-on-dark)", textWrap: "balance" }}
          >
            And it gives you credit for the training, too.
          </h2>
          <p
            style={{
              margin: 0,
              fontSize: 17,
              lineHeight: 1.55,
              color: "var(--text-on-dark-secondary)",
              maxWidth: 470,
              textWrap: "pretty",
            }}
          >
            Each logged session becomes one Rock Climbing activity, with duration, sends, attempts
            and grades already filled in. It is free for everyone and always will be - we do not
            charge for Strava syncing. Turn it off and sendtally is still yours for the numbers
            alone.
          </p>
          <Button variant="azure" href="/app">
            Create your account →
          </Button>
        </div>
        <SessionPreviewCard />
      </div>
    </div>
  );
}
