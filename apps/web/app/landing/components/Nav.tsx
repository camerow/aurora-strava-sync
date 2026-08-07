import React from "react";
import { Button, Logo } from "@sendtally/design";

export function Nav(): React.ReactElement {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "20px 56px",
        borderBottom: "1px solid var(--line-on-light)",
      }}
    >
      <Logo tone="on-light" size={24} />
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 28,
          flexWrap: "wrap",
          justifyContent: "flex-end",
        }}
      >
        {[
          ["How it works", "#how"],
          ["Boards", "#boards"],
          ["Price", "#price"],
        ].map(([label, href]) => (
          <a
            key={label}
            href={href}
            style={{
              fontWeight: 500,
              fontSize: 13,
              color: "var(--text-on-white-secondary)",
              textDecoration: "none",
            }}
          >
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
