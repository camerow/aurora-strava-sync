import { j as e, R as v, w as z } from "./jsx-runtime-Cf_Cl9cf.js";
const u = {
  gold: {
    color: "var(--bs-gold)",
    border: "1px solid rgba(249,220,92,0.45)",
    background: "transparent",
  },
  azure: { color: "var(--bs-azure-ink)", border: "none", background: "rgba(49,133,252,0.12)" },
  petal: { color: "var(--bs-gunmetal)", border: "none", background: "var(--bs-petal)" },
};
function b({ tone: n = "gold", pill: r = !0, children: o, style: t }) {
  const a = u[n] ?? u.gold;
  return e.jsx("span", {
    style: {
      fontFamily: "var(--font-mono)",
      fontWeight: 500,
      fontSize: 10,
      letterSpacing: "var(--type-label-track)",
      padding: "4px 8px",
      borderRadius: r ? "var(--radius-pill)" : "var(--radius-sm)",
      ...a,
      ...t,
    },
    children: o,
  });
}
function j({
  float: n = !1,
  pad: r = 26,
  radius: o = "var(--radius-card)",
  children: t,
  style: a,
}) {
  return e.jsx("div", {
    style: {
      background: "var(--surface-card)",
      borderRadius: o,
      padding: r,
      boxShadow: n ? "var(--shadow-float)" : "none",
      fontFamily: "var(--font-sans)",
      color: "var(--bs-gunmetal)",
      ...a,
    },
    children: t,
  });
}
function T({ bars: n = [], height: r = 64 }) {
  const o = Math.max(1, ...n.map((t) => t.count));
  return e.jsx("div", {
    style: { display: "flex", alignItems: "flex-end", gap: 6, height: r },
    children: n.map((t) => {
      const a = t.count === 0 ? 4 : Math.max(8, (t.count / o) * (r - 20)),
        i =
          t.count === 0
            ? "var(--data-bar-empty)"
            : t.peak
              ? "var(--data-bar-peak)"
              : "var(--data-bar)";
      return e.jsxs(
        "div",
        {
          style: {
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 6,
          },
          children: [
            e.jsx("div", {
              style: { width: "100%", height: a, background: i, borderRadius: "4px 4px 0 0" },
            }),
            e.jsx("span", {
              style: {
                fontFamily: "var(--font-mono)",
                fontWeight: 500,
                fontSize: 10,
                color: "var(--text-on-white-secondary)",
              },
              children: t.grade,
            }),
          ],
        },
        t.grade
      );
    }),
  });
}
function s({ on: n = "dark", size: r = 11, children: o, style: t }) {
  const a =
    n === "dark"
      ? "var(--text-on-dark-label)"
      : n === "accent"
        ? "var(--text-label-accent)"
        : "var(--text-on-white-secondary)";
  return e.jsx("span", {
    style: {
      fontFamily: "var(--font-mono)",
      fontWeight: 500,
      fontSize: r,
      letterSpacing: "var(--type-label-track)",
      color: a,
      ...t,
    },
    children: o,
  });
}
function I({ stats: n = [] }) {
  return e.jsx("div", {
    style: {
      display: "grid",
      gridTemplateColumns: `repeat(${n.length || 1}, 1fr)`,
      borderTop: "1px solid var(--line-on-light)",
      borderBottom: "1px solid var(--line-on-light)",
    },
    children: n.map((r, o) =>
      e.jsxs(
        "div",
        {
          style: {
            padding: "13px 18px",
            display: "flex",
            flexDirection: "column",
            gap: 3,
            borderRight: o < n.length - 1 ? "1px solid var(--line-on-light-soft)" : "none",
          },
          children: [
            e.jsx("span", {
              style: {
                fontFamily: "var(--font-mono)",
                fontWeight: 500,
                fontSize: 10,
                letterSpacing: "var(--type-label-track)",
                color: "var(--text-on-white-secondary)",
              },
              children: r.label,
            }),
            e.jsx("span", {
              style: {
                fontFamily: "var(--font-mono)",
                fontWeight: 600,
                fontSize: 17,
                color: "var(--bs-gunmetal)",
              },
              children: r.value,
            }),
          ],
        },
        r.label
      )
    ),
  });
}
function W({
  athlete: n,
  initials: r,
  meta: o,
  title: t,
  stats: a = [],
  bars: i = [],
  float: f = !0,
}) {
  return e.jsxs(j, {
    float: f,
    pad: 0,
    radius: "var(--radius-card-lg)",
    style: { overflow: "hidden" },
    children: [
      e.jsxs("div", {
        style: { display: "flex", alignItems: "center", gap: 11, padding: "16px 18px 12px" },
        children: [
          e.jsx("div", {
            style: {
              width: 40,
              height: 40,
              borderRadius: "50%",
              background: "var(--bs-petal)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "var(--font-mono)",
              fontWeight: 600,
              fontSize: 14,
              color: "var(--bs-gunmetal)",
            },
            children: r,
          }),
          e.jsxs("div", {
            style: { display: "flex", flexDirection: "column", gap: 2 },
            children: [
              e.jsx("span", { style: { fontWeight: 600, fontSize: 14 }, children: n }),
              e.jsx("span", {
                style: {
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                  color: "var(--text-on-white-secondary)",
                },
                children: o,
              }),
            ],
          }),
          e.jsx(b, {
            tone: "azure",
            pill: !1,
            style: { marginLeft: "auto" },
            children: "via sendtally",
          }),
        ],
      }),
      e.jsx("div", {
        style: { padding: "0 18px 14px", fontWeight: 600, fontSize: 19, letterSpacing: "-0.01em" },
        children: t,
      }),
      e.jsx(I, { stats: a }),
      e.jsxs("div", {
        style: { padding: "16px 18px 18px", display: "flex", flexDirection: "column", gap: 10 },
        children: [
          e.jsx(s, { on: "light", size: 10, children: "SENDS BY GRADE" }),
          e.jsx(T, { bars: i }),
        ],
      }),
    ],
  });
}
const h = {
    fontFamily: "var(--font-sans)",
    fontWeight: 600,
    border: "none",
    borderRadius: "var(--radius-control)",
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "var(--space-3)",
    whiteSpace: "nowrap",
    textDecoration: "none",
    transition: "background var(--motion-fast), color var(--motion-fast)",
  },
  R = { md: { fontSize: 15, padding: "14px 22px" }, sm: { fontSize: 13, padding: "9px 16px" } },
  y = {
    primary: {
      background: "var(--bs-watermelon-ink)",
      color: "var(--bs-white)",
      hover: "var(--bs-watermelon-ink-press)",
    },
    azure: {
      background: "var(--bs-azure-ink)",
      color: "var(--bs-white)",
      hover: "var(--bs-azure-ink-press)",
    },
    gold: {
      background: "var(--bs-gold)",
      color: "var(--bs-gunmetal)",
      hover: "var(--bs-gold-hover)",
    },
    ghostOnDark: {
      background: "transparent",
      color: "var(--text-on-dark-secondary)",
      hover: "transparent",
      border: "1px solid var(--line-on-dark)",
    },
  };
function c({
  variant: n = "primary",
  size: r = "md",
  href: o,
  disabled: t = !1,
  children: a,
  style: i,
  ...f
}) {
  const d = y[n] ?? y.primary,
    [w, x] = v.useState(!1),
    g = {
      style: {
        ...h,
        ...R[r],
        background: w && !t ? d.hover : d.background,
        color: d.color,
        border: d.border ?? h.border,
        opacity: t ? 0.45 : 1,
        pointerEvents: t ? "none" : void 0,
        ...i,
      },
      onMouseEnter: () => x(!0),
      onMouseLeave: () => x(!1),
      ...f,
    };
  return o !== void 0
    ? e.jsx("a", { href: o, ...g, children: a })
    : e.jsx("button", { type: "button", ...g, children: a });
}
function S({ onDark: n = !1, style: r, ...o }) {
  const [t, a] = v.useState(!1);
  return e.jsx("input", {
    ...o,
    onFocus: (i) => {
      (a(!0), o.onFocus?.(i));
    },
    onBlur: (i) => {
      (a(!1), o.onBlur?.(i));
    },
    style: {
      fontFamily: "var(--font-sans)",
      fontSize: 15,
      color: "var(--bs-gunmetal)",
      background: "var(--bs-white)",
      border: n ? "none" : "1px solid rgba(64,63,76,0.15)",
      borderRadius: "var(--radius-control)",
      padding: n ? "13px 15px" : "14px 16px",
      outline: "none",
      boxShadow: t ? (n ? "var(--focus-ring-azure-strong)" : "var(--focus-ring-azure)") : "none",
      borderColor: t && !n ? "var(--bs-azure)" : void 0,
      ...r,
    },
  });
}
function m({ inverse: n = !1, size: r, style: o }) {
  const t = n ? "var(--bs-gunmetal)" : "var(--bs-gold)",
    a = n ? "var(--bs-gold)" : "var(--bs-gunmetal)";
  return e.jsxs("svg", {
    viewBox: "0 0 32 32",
    width: r,
    height: r,
    role: "img",
    "aria-label": "sendtally",
    style: { flex: "none", ...o },
    children: [
      e.jsx("rect", { width: "32", height: "32", rx: "8", fill: t }),
      e.jsx("path", {
        d: "M9.5 22.5 16 16l6.5-6.5",
        fill: "none",
        stroke: a,
        strokeWidth: "2.4",
        strokeLinecap: "round",
        strokeLinejoin: "round",
      }),
      e.jsx("circle", { cx: "9.5", cy: "22.5", r: "3.1", fill: a }),
      e.jsx("circle", { cx: "16", cy: "16", r: "3.1", fill: a }),
      e.jsx("circle", { cx: "22.5", cy: "9.5", r: "3.1", fill: a }),
    ],
  });
}
function k({ variant: n = "lockup", tone: r = "on-dark", size: o = 32, style: t }) {
  const a = r === "on-light";
  return n === "mark"
    ? e.jsx(m, { inverse: a, size: o, style: t })
    : e.jsxs("span", {
        style: { display: "inline-flex", alignItems: "center", gap: Math.round(o * 0.375), ...t },
        children: [
          e.jsx(m, { size: o }),
          e.jsx("span", {
            style: {
              fontFamily: "var(--font-mono)",
              fontWeight: 600,
              fontSize: Math.round(o * 0.59375),
              letterSpacing: "-0.02em",
              color: a ? "var(--bs-gunmetal)" : "var(--bs-petal)",
              lineHeight: 1,
            },
            children: "sendtally",
          }),
        ],
      });
}
function l({ label: n, children: r, last: o = !1, labelWidth: t = 150 }) {
  return e.jsxs("div", {
    style: {
      display: "flex",
      gap: 20,
      padding: "14px 0",
      borderTop: "1px solid var(--line-on-dark)",
      borderBottom: o ? "1px solid var(--line-on-dark)" : "none",
    },
    children: [
      e.jsx("span", {
        style: {
          width: t,
          flex: "none",
          paddingTop: 2,
          fontFamily: "var(--font-mono)",
          fontWeight: 500,
          fontSize: 11,
          letterSpacing: "var(--type-label-track)",
          color: "var(--text-on-dark-label)",
        },
        children: n,
      }),
      e.jsx("span", {
        style: {
          fontFamily: "var(--font-sans)",
          fontSize: 14,
          lineHeight: 1.5,
          color: "rgba(255,255,255,0.86)",
        },
        children: r,
      }),
    ],
  });
}
function M() {
  return [
    { title: "sendtally - your board sessions, on Strava" },
    {
      name: "description",
      content:
        "sendtally reads your climbing sessions from your Aurora board account (Tension, Kilter, and more) and posts them to Strava as Rock Climbing activities - with an effort score, a session title, and a climb-by-climb log.",
    },
  ];
}
const p = { padding: "0 56px", maxWidth: 1440, margin: "0 auto" };
function D() {
  return e.jsxs("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "20px 56px",
      borderBottom: "1px solid var(--line-on-dark)",
    },
    children: [
      e.jsxs("div", {
        style: { display: "flex", alignItems: "center", gap: 11 },
        children: [e.jsx(k, { size: 24 }), e.jsx(b, { tone: "gold", children: "BETA" })],
      }),
      e.jsxs("div", {
        style: { display: "flex", alignItems: "center", gap: 28 },
        children: [
          [
            ["How it works", "#how"],
            ["Boards", "#boards"],
            ["Price", "#price"],
          ].map(([n, r]) =>
            e.jsx(
              "a",
              {
                href: r,
                style: {
                  fontWeight: 500,
                  fontSize: 13,
                  color: "var(--text-on-dark-secondary)",
                  textDecoration: "none",
                },
                children: n,
              },
              n
            )
          ),
          e.jsx(c, { variant: "gold", size: "sm", href: "#price", children: "Join the waitlist" }),
        ],
      }),
    ],
  });
}
function F() {
  return e.jsxs("div", {
    style: {
      ...p,
      display: "grid",
      gridTemplateColumns: "1.05fr .95fr",
      gap: 64,
      alignItems: "center",
      paddingTop: 78,
      paddingBottom: 84,
    },
    children: [
      e.jsxs("div", {
        style: { display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 26 },
        children: [
          e.jsx(s, {
            on: "dark",
            children: "TENSION · KILTER · GRASSHOPPER · DECOY · TOUCHSTONE · SO ILL · AURORA",
          }),
          e.jsx("h1", {
            style: {
              margin: 0,
              fontFamily: "var(--font-display)",
              fontWeight: 800,
              fontSize: 66,
              lineHeight: 0.98,
              letterSpacing: "-0.035em",
              color: "#fff",
              textWrap: "balance",
            },
            children: "Get credit for the hardest training you do.",
          }),
          e.jsx("p", {
            style: {
              margin: 0,
              fontSize: 18,
              lineHeight: 1.55,
              color: "var(--text-on-dark-secondary)",
              maxWidth: 470,
              textWrap: "pretty",
            },
            children:
              "Your board sessions already have every number Strava wants - duration, sends, attempts, grades. sendtally reads them from your board account and posts the activity for you.",
          }),
          e.jsxs("div", {
            style: {
              display: "flex",
              flexDirection: "column",
              gap: 11,
              width: "100%",
              maxWidth: 470,
            },
            children: [
              e.jsxs("div", {
                style: { display: "flex", gap: 10 },
                children: [
                  e.jsx(S, { type: "email", placeholder: "you@email.com", style: { flex: 1 } }),
                  e.jsx(c, { variant: "primary", children: "Join the waitlist" }),
                ],
              }),
              e.jsx("span", {
                style: {
                  fontFamily: "var(--font-mono)",
                  fontSize: 13,
                  color: "var(--text-on-dark-muted)",
                },
                children: "Free to use · no card, no account yet",
              }),
            ],
          }),
        ],
      }),
      e.jsx(W, {
        athlete: "Will Hendriks",
        initials: "WH",
        meta: "Today at 6:42 PM · Rock Climbing",
        title: "Tension Board 2 - 18 climbs, top V7",
        stats: [
          { label: "TIME", value: "1:24" },
          { label: "SENDS", value: "14" },
          { label: "ATTEMPTS", value: "31" },
          { label: "GRADES", value: "V4–V7" },
        ],
        bars: [
          { grade: "V4", count: 4 },
          { grade: "V5", count: 6 },
          { grade: "V6", count: 3 },
          { grade: "V7", count: 1, peak: !0 },
          { grade: "V8", count: 0 },
        ],
      }),
    ],
  });
}
const B = [
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
function C() {
  return e.jsx("div", {
    id: "how",
    style: { background: "var(--surface-accent-pink)", padding: "60px 56px" },
    children: e.jsxs("div", {
      style: {
        maxWidth: 1440,
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        gap: 36,
      },
      children: [
        e.jsx("h2", {
          style: {
            margin: 0,
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: 36,
            letterSpacing: "-0.03em",
            color: "var(--text-on-light)",
          },
          children: "Two connections, once.",
        }),
        e.jsx("div", {
          style: { display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 20 },
          children: B.map(([n, r, o]) =>
            e.jsxs(
              j,
              {
                style: { display: "flex", flexDirection: "column", gap: 12 },
                children: [
                  e.jsx(s, { on: "accent", size: 12, children: n }),
                  e.jsx("span", { style: { fontWeight: 600, fontSize: 19 }, children: r }),
                  e.jsx("span", {
                    style: {
                      fontSize: 14,
                      lineHeight: 1.55,
                      color: "var(--text-on-white-secondary)",
                    },
                    children: o,
                  }),
                ],
              },
              n
            )
          ),
        }),
      ],
    }),
  });
}
const E = [
  "Tension Board 1 & 2",
  "Kilter Board",
  "Grasshopper Board",
  "Decoy Board",
  "Touchstone Board",
  "So iLL Board",
  "Aurora Board",
];
function A() {
  return e.jsxs("div", {
    id: "boards",
    style: {
      ...p,
      paddingTop: 64,
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 56,
      alignItems: "start",
    },
    children: [
      e.jsxs("div", {
        style: { display: "flex", flexDirection: "column", gap: 22 },
        children: [
          e.jsx("h2", {
            style: {
              margin: 0,
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              fontSize: 36,
              letterSpacing: "-0.03em",
              color: "#fff",
            },
            children: "Boards",
          }),
          e.jsx("div", {
            style: {
              display: "flex",
              flexDirection: "column",
              gap: 1,
              background: "rgba(239,188,213,0.16)",
              borderRadius: 12,
              overflow: "hidden",
            },
            children: E.map((n) =>
              e.jsxs(
                "div",
                {
                  style: {
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    padding: "16px 18px",
                    background: "var(--surface-panel)",
                  },
                  children: [
                    e.jsx("span", {
                      style: { flex: 1, fontWeight: 500, fontSize: 15, color: "#fff" },
                      children: n,
                    }),
                    e.jsx(s, { on: "dark", children: "SUPPORTED" }),
                  ],
                },
                n
              )
            ),
          }),
        ],
      }),
      e.jsxs("div", {
        style: { display: "flex", flexDirection: "column", gap: 22 },
        children: [
          e.jsx("h2", {
            style: {
              margin: 0,
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              fontSize: 36,
              letterSpacing: "-0.03em",
              color: "#fff",
            },
            children: "Details",
          }),
          e.jsxs("div", {
            style: { display: "flex", flexDirection: "column" },
            children: [
              e.jsx(l, {
                label: "ACTIVITY TYPE",
                children: "Rock Climbing, with elapsed time from your first to last logged climb",
              }),
              e.jsx(l, {
                label: "IN THE DESCRIPTION",
                children:
                  "A climb-by-climb log with grade, sends and attempts, plus your effort score",
              }),
              e.jsx(l, {
                label: "BACKFILL",
                children: "Your whole board history on request, or leave the past alone",
              }),
              e.jsx(l, {
                label: "DUPLICATES",
                children: "Every posted session is fingerprinted - re-syncs never double up",
              }),
              e.jsx(l, {
                label: "LEAVING",
                last: !0,
                children: "Disconnect once and your credentials are deleted the same day",
              }),
            ],
          }),
        ],
      }),
    ],
  });
}
function H() {
  return e.jsx("div", {
    id: "price",
    style: { ...p, paddingTop: 64, paddingBottom: 76 },
    children: e.jsxs("div", {
      style: {
        background: "var(--surface-accent-gold)",
        borderRadius: "var(--radius-panel)",
        padding: 52,
        display: "grid",
        gridTemplateColumns: "1.15fr .85fr",
        gap: 48,
        alignItems: "center",
      },
      children: [
        e.jsxs("div", {
          style: { display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 18 },
          children: [
            e.jsx("span", {
              style: {
                fontFamily: "var(--font-mono)",
                fontWeight: 500,
                fontSize: 11,
                letterSpacing: "0.1em",
                color: "var(--text-on-light)",
              },
              children: "PRICE",
            }),
            e.jsx("h2", {
              style: {
                margin: 0,
                fontFamily: "var(--font-display)",
                fontWeight: 800,
                fontSize: 52,
                lineHeight: 1,
                letterSpacing: "-0.035em",
                color: "var(--text-on-light)",
              },
              children: "Free. No subscription.",
            }),
            e.jsx("p", {
              style: {
                margin: 0,
                fontSize: 17,
                lineHeight: 1.55,
                color: "var(--text-on-light-secondary)",
                maxWidth: 480,
              },
              children:
                "It's one person's side project and the running costs are small. If it saves you the logging, chip in whatever it's worth to you.",
            }),
            e.jsx(c, {
              variant: "primary",
              href: "https://github.com/sponsors/camerow",
              children: "♥ Donate to support my work",
            }),
          ],
        }),
        e.jsxs("div", {
          style: {
            background: "var(--surface-panel)",
            borderRadius: "var(--radius-card)",
            padding: 28,
            display: "flex",
            flexDirection: "column",
            gap: 16,
          },
          children: [
            e.jsx(s, { on: "dark", children: "WAITLIST" }),
            e.jsx("span", {
              style: { fontSize: 15, lineHeight: 1.55, color: "rgba(255,255,255,0.86)" },
              children:
                "Closed beta while the sync is hardened. Leave an email and you'll get an invite in the next batch.",
            }),
            e.jsx(S, { type: "email", placeholder: "you@email.com", onDark: !0 }),
            e.jsx(c, { variant: "azure", children: "Join the waitlist" }),
          ],
        }),
      ],
    }),
  });
}
function L() {
  return e.jsxs("div", {
    style: {
      ...p,
      paddingTop: 28,
      paddingBottom: 36,
      borderTop: "1px solid var(--line-on-dark)",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
    },
    children: [
      e.jsx(k, { size: 20 }),
      e.jsx("span", {
        style: { fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-on-dark-muted)" },
        children: "not affiliated with Strava or Aurora Climbing",
      }),
    ],
  });
}
const N = z(function () {
  return e.jsxs("div", {
    children: [e.jsx(D, {}), e.jsx(F, {}), e.jsx(C, {}), e.jsx(A, {}), e.jsx(H, {}), e.jsx(L, {})],
  });
});
export { N as default, M as meta };
