import React from "react";
import { Button } from "@sendtally/design";

export function PricePanel(): React.ReactElement {
  return (
    <div id="price" className="l-price">
      <div className="l-price-panel">
        <div
          style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 18 }}
        >
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontWeight: 500,
              fontSize: 11,
              letterSpacing: "0.1em",
              color: "var(--text-on-light)",
            }}
          >
            PRICE
          </span>
          <h2 className="l-price-title">Free. No subscription.</h2>
          <p
            style={{
              margin: 0,
              fontSize: 17,
              lineHeight: 1.55,
              color: "var(--text-on-light-secondary)",
              maxWidth: 480,
              textWrap: "pretty",
            }}
          >
            It's one person's side project and the running costs are small. If it saves you the
            logging, chip in whatever it's worth to you - that's what keeps the server on.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
            <Button variant="primary" href="https://github.com/sponsors/camerow">
              ♥ Donate to support my work
            </Button>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 13,
                color: "var(--text-on-light)",
              }}
            >
              GitHub Sponsors
            </span>
          </div>
        </div>
        <div
          style={{
            background: "var(--surface-panel)",
            borderRadius: "var(--radius-card)",
            padding: 28,
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontWeight: 500,
              fontSize: 11,
              letterSpacing: "0.1em",
              color: "var(--text-on-dark-label)",
            }}
          >
            GET STARTED
          </span>
          <span style={{ fontSize: 15, lineHeight: 1.55, color: "rgba(255,255,255,0.85)" }}>
            Open to everyone. Sign in with an email code, log your first session, and connect Strava
            whenever you want it on your feed.
          </span>
          <Button variant="azure" href="/app">
            Create account
          </Button>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              color: "rgba(238,211,248,0.85)",
            }}
          >
            No password. No card.
          </span>
        </div>
      </div>
    </div>
  );
}
