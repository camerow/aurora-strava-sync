import React from "react";
import { Label } from "@sendtally/design";
import { MembershipPricing } from "../../billing/components/MembershipPricing";
import { MEMBER_BENEFITS } from "../../billing/features";

export function PricePanel(): React.ReactElement {
  return (
    <div id="price" className="l-price">
      <div className="l-price-panel">
        <div
          style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 18 }}
        >
          <Label on="light" style={{ color: "var(--text-on-light)" }}>
            PRICE
          </Label>
          <h2 className="l-price-title">Logging is free. Membership is the history.</h2>
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
            Sign up, log sessions, keep your logbook - that costs nothing and always will. Five
            dollars a month is what turns the log into a training history, and it is what pays for
            the server.
          </p>
          <ul
            style={{
              margin: 0,
              paddingLeft: 18,
              display: "flex",
              flexDirection: "column",
              gap: 8,
              fontSize: 15,
              lineHeight: 1.5,
              color: "var(--text-on-light-secondary)",
              maxWidth: 480,
            }}
          >
            {MEMBER_BENEFITS.map((benefit) => (
              <li key={benefit.title}>
                {benefit.title}
                {benefit.soon === true && (
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 11,
                      letterSpacing: "0.08em",
                      color: "var(--text-label-accent)",
                      marginLeft: 8,
                    }}
                  >
                    COMING SOON
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
        <div
          style={{
            background: "var(--bs-white)",
            borderRadius: "var(--radius-card)",
            padding: 20,
          }}
        >
          <MembershipPricing />
        </div>
      </div>
    </div>
  );
}
