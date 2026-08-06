import { useClerk, useUser } from "@clerk/react-router";
import React from "react";
import type { LoaderFunctionArgs } from "react-router";
import { NavLink, Outlet, useNavigate } from "react-router";
import { Logo } from "@sendtally/design";
import { requireApi } from "../lib/api.server";

export async function loader(args: LoaderFunctionArgs): Promise<null> {
  await requireApi(args);
  return null;
}

const NAV_ITEMS: Array<[string, string, boolean]> = [
  ["Sessions", "/app", true],
  ["Trends", "/app/trends", true],
  ["Sync & accounts", "/app/settings", true],
];

export default function AppLayout(): React.ReactElement {
  const clerk = useClerk();
  const { user } = useUser();
  const navigate = useNavigate();
  const email = user?.primaryEmailAddress?.emailAddress ?? "";

  return (
    <div style={{ display: "grid", gridTemplateColumns: "232px 1fr", minHeight: "100vh" }}>
      <div
        style={{
          background: "#F7F6F3",
          borderRight: "1px solid var(--line-on-light-soft)",
          display: "flex",
          flexDirection: "column",
          padding: "22px 14px",
          gap: 4,
        }}
      >
        <a
          href="/"
          style={{
            display: "inline-flex",
            alignItems: "center",
            textDecoration: "none",
            padding: "6px 10px",
            marginBottom: 16,
          }}
        >
          <Logo tone="on-light" size={24} />
        </a>
        {NAV_ITEMS.map(([label, to, enabled]) =>
          enabled ? (
            <NavLink
              key={label}
              to={to}
              end
              style={({ isActive }) => ({
                fontWeight: 500,
                fontSize: 14,
                textAlign: "left",
                background: isActive ? "rgba(64,63,76,0.08)" : "none",
                color: isActive ? "var(--bs-gunmetal)" : "rgba(64,63,76,0.65)",
                borderRadius: "var(--radius-control)",
                padding: "10px 12px",
                textDecoration: "none",
              })}
            >
              {label}
            </NavLink>
          ) : (
            <span
              key={label}
              style={{
                fontWeight: 500,
                fontSize: 14,
                color: "rgba(64,63,76,0.35)",
                padding: "10px 12px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              {label}
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 9,
                  letterSpacing: "0.08em",
                  color: "rgba(64,63,76,0.45)",
                }}
              >
                SOON
              </span>
            </span>
          )
        )}
        <div style={{ flex: 1 }} />
        <div
          style={{
            borderTop: "1px solid var(--line-on-light)",
            padding: "14px 10px 4px",
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              color: "rgba(64,63,76,0.55)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {email}
          </span>
          <button
            onClick={() => void clerk.signOut(() => navigate("/"))}
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              color: "rgba(64,63,76,0.6)",
              background: "none",
              border: "none",
              cursor: "pointer",
              textAlign: "left",
              textDecoration: "underline",
              padding: 0,
            }}
          >
            Sign out
          </button>
        </div>
      </div>
      <div
        style={{
          padding: "36px 44px 72px",
          maxWidth: 1120,
          width: "100%",
          boxSizing: "border-box",
        }}
      >
        <Outlet />
      </div>
    </div>
  );
}
