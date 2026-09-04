import React from "react";
import { Button, Logo } from "@sendtally/design";

export function Nav(): React.ReactElement {
  return (
    <div className="l-nav">
      <Logo tone="on-light" size={24} />
      <div className="l-nav-links">
        {[
          ["What members see", "#insights"],
          ["Sessions", "#session"],
          ["Strava", "#strava"],
          ["How it works", "#how"],
          ["Membership", "#price"],
        ].map(([label, href]) => (
          <a key={label} href={href} className="l-nav-anchor">
            {label}
          </a>
        ))}
        <Button variant="gold" size="sm" href="/app">
          Create account
        </Button>
      </div>
    </div>
  );
}
