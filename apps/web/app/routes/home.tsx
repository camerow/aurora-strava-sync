import React from "react";
import { ActivityCard, Badge, Button, Card, Input, Label, Logo, SpecRow } from "@sendtally/design";

export function meta(): Array<Record<string, string>> {
  return [
    { title: "sendtally - your board sessions, on Strava" },
    {
      name: "description",
      content:
        "sendtally reads your climbing sessions from your Aurora board account (Tension, Kilter, and more) and posts them to Strava as Rock Climbing activities - with an effort score, a session title, and a climb-by-climb log.",
    },
  ];
}

const GUTTER: React.CSSProperties = { padding: "0 56px", maxWidth: 1440, margin: "0 auto" };

function Nav(): React.ReactElement {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "20px 56px",
        borderBottom: "1px solid var(--line-on-dark)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
        <Logo size={24} />
        <Badge tone="gold">BETA</Badge>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
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
              color: "var(--text-on-dark-secondary)",
              textDecoration: "none",
            }}
          >
            {label}
          </a>
        ))}
        <Button variant="gold" size="sm" href="#price">
          Join the waitlist
        </Button>
      </div>
    </div>
  );
}

function Hero(): React.ReactElement {
  return (
    <div
      style={{
        ...GUTTER,
        display: "grid",
        gridTemplateColumns: "1.05fr .95fr",
        gap: 64,
        alignItems: "center",
        paddingTop: 78,
        paddingBottom: 84,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 26 }}>
        <Label on="dark">
          TENSION · KILTER · GRASSHOPPER · DECOY · TOUCHSTONE · SO ILL · AURORA
        </Label>
        <h1
          style={{
            margin: 0,
            fontFamily: "var(--font-display)",
            fontWeight: 800,
            fontSize: 66,
            lineHeight: 0.98,
            letterSpacing: "-0.035em",
            color: "#fff",
            textWrap: "balance",
          }}
        >
          Get credit for the hardest training you do.
        </h1>
        <p
          style={{
            margin: 0,
            fontSize: 18,
            lineHeight: 1.55,
            color: "var(--text-on-dark-secondary)",
            maxWidth: 470,
            textWrap: "pretty",
          }}
        >
          Your board sessions already have every number Strava wants - duration, sends, attempts,
          grades. sendtally reads them from your board account and posts the activity for you.
        </p>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 11,
            width: "100%",
            maxWidth: 470,
          }}
        >
          <div style={{ display: "flex", gap: 10 }}>
            <Input type="email" placeholder="you@email.com" style={{ flex: 1 }} />
            <Button variant="primary">Join the waitlist</Button>
          </div>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 13,
              color: "var(--text-on-dark-muted)",
            }}
          >
            Free to use · no card, no account yet
          </span>
        </div>
      </div>
      <ActivityCard
        athlete="Will Hendriks"
        initials="WH"
        meta="Today at 6:42 PM · Rock Climbing"
        title="Tension Board 2 - 18 climbs, top V7"
        stats={[
          { label: "TIME", value: "1:24" },
          { label: "SENDS", value: "14" },
          { label: "ATTEMPTS", value: "31" },
          { label: "GRADES", value: "V4–V7" },
        ]}
        bars={[
          { grade: "V4", count: 4 },
          { grade: "V5", count: 6 },
          { grade: "V6", count: 3 },
          { grade: "V7", count: 1, peak: true },
          { grade: "V8", count: 0 },
        ]}
      />
    </div>
  );
}

const STEPS: Array<[string, string, string]> = [
  [
    "01",
    "Sign in to your board account",
    "The same Aurora login you use in the Tension or Kilter app. We never store your password - only a token, encrypted.",
  ],
  [
    "02",
    "Authorise Strava",
    "Standard OAuth, activity-write scope only. Revoke it from Strava at any time.",
  ],
  [
    "03",
    "Climb",
    "Each logged session becomes one Rock Climbing activity, yours to edit afterwards.",
  ],
];

function How(): React.ReactElement {
  return (
    <div id="how" style={{ background: "var(--surface-accent-pink)", padding: "60px 56px" }}>
      <div
        style={{
          maxWidth: 1440,
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: 36,
        }}
      >
        <h2
          style={{
            margin: 0,
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: 36,
            letterSpacing: "-0.03em",
            color: "var(--text-on-light)",
          }}
        >
          Two connections, once.
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 20 }}>
          {STEPS.map(([n, t, b]) => (
            <Card key={n} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <Label on="accent" size={12}>
                {n}
              </Label>
              <span style={{ fontWeight: 600, fontSize: 19 }}>{t}</span>
              <span
                style={{ fontSize: 14, lineHeight: 1.55, color: "var(--text-on-white-secondary)" }}
              >
                {b}
              </span>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

const BOARDS = [
  "Tension Board 1 & 2",
  "Kilter Board",
  "Grasshopper Board",
  "Decoy Board",
  "Touchstone Board",
  "So iLL Board",
  "Aurora Board",
];

function Boards(): React.ReactElement {
  return (
    <div
      id="boards"
      style={{
        ...GUTTER,
        paddingTop: 64,
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 56,
        alignItems: "start",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
        <h2
          style={{
            margin: 0,
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: 36,
            letterSpacing: "-0.03em",
            color: "#fff",
          }}
        >
          Boards
        </h2>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 1,
            background: "rgba(239,188,213,0.16)",
            borderRadius: 12,
            overflow: "hidden",
          }}
        >
          {BOARDS.map((b) => (
            <div
              key={b}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                padding: "16px 18px",
                background: "var(--surface-panel)",
              }}
            >
              <span style={{ flex: 1, fontWeight: 500, fontSize: 15, color: "#fff" }}>{b}</span>
              <Label on="dark">SUPPORTED</Label>
            </div>
          ))}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
        <h2
          style={{
            margin: 0,
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: 36,
            letterSpacing: "-0.03em",
            color: "#fff",
          }}
        >
          Details
        </h2>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <SpecRow label="ACTIVITY TYPE">
            Rock Climbing, with elapsed time from your first to last logged climb
          </SpecRow>
          <SpecRow label="IN THE DESCRIPTION">
            A climb-by-climb log with grade, sends and attempts, plus your effort score
          </SpecRow>
          <SpecRow label="BACKFILL">
            Your whole board history on request, or leave the past alone
          </SpecRow>
          <SpecRow label="DUPLICATES">
            Every posted session is fingerprinted - re-syncs never double up
          </SpecRow>
          <SpecRow label="LEAVING" last>
            Disconnect once and your credentials are deleted the same day
          </SpecRow>
        </div>
      </div>
    </div>
  );
}

function Price(): React.ReactElement {
  return (
    <div id="price" style={{ ...GUTTER, paddingTop: 64, paddingBottom: 76 }}>
      <div
        style={{
          background: "var(--surface-accent-gold)",
          borderRadius: "var(--radius-panel)",
          padding: 52,
          display: "grid",
          gridTemplateColumns: "1.15fr .85fr",
          gap: 48,
          alignItems: "center",
        }}
      >
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
          <h2
            style={{
              margin: 0,
              fontFamily: "var(--font-display)",
              fontWeight: 800,
              fontSize: 52,
              lineHeight: 1,
              letterSpacing: "-0.035em",
              color: "var(--text-on-light)",
            }}
          >
            Free. No subscription.
          </h2>
          <p
            style={{
              margin: 0,
              fontSize: 17,
              lineHeight: 1.55,
              color: "var(--text-on-light-secondary)",
              maxWidth: 480,
            }}
          >
            It's one person's side project and the running costs are small. If it saves you the
            logging, chip in whatever it's worth to you.
          </p>
          <Button variant="primary" href="https://github.com/sponsors/camerow">
            ♥ Donate to support my work
          </Button>
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
          <Label on="dark">WAITLIST</Label>
          <span style={{ fontSize: 15, lineHeight: 1.55, color: "rgba(255,255,255,0.86)" }}>
            Closed beta while the sync is hardened. Leave an email and you'll get an invite in the
            next batch.
          </span>
          <Input type="email" placeholder="you@email.com" onDark />
          <Button variant="azure">Join the waitlist</Button>
        </div>
      </div>
    </div>
  );
}

function Footer(): React.ReactElement {
  return (
    <div
      style={{
        ...GUTTER,
        paddingTop: 28,
        paddingBottom: 36,
        borderTop: "1px solid var(--line-on-dark)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <Logo size={20} />
      <span
        style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-on-dark-muted)" }}
      >
        not affiliated with Strava or Aurora Climbing
      </span>
    </div>
  );
}

export default function Home(): React.ReactElement {
  return (
    <div>
      <Nav />
      <Hero />
      <How />
      <Boards />
      <Price />
      <Footer />
    </div>
  );
}
