import { useClerk, useUser } from "@clerk/react-router";
import React from "react";
import type { LinksFunction, LoaderFunctionArgs } from "react-router";
import { NavLink, Outlet, useNavigate } from "react-router";
import { Logo } from "@sendtally/design";
import { requireApi } from "../lib/api.server";
import appShellStyles from "../styles/app-shell.css?url";

export const links: LinksFunction = () => [{ rel: "stylesheet", href: appShellStyles }];

export async function loader(args: LoaderFunctionArgs): Promise<null> {
  await requireApi(args);
  return null;
}

const NAV_ITEMS: Array<[string, string]> = [
  ["Sessions", "/app"],
  ["Trends", "/app/trends"],
  ["Settings", "/app/settings"],
  ["Membership", "/app/membership"],
];

export default function AppLayout(): React.ReactElement {
  const clerk = useClerk();
  const { user } = useUser();
  const navigate = useNavigate();
  const email = user?.primaryEmailAddress?.emailAddress ?? "";

  return (
    <div className="app-shell">
      <div className="app-sidebar">
        <a href="/" className="app-logo-link">
          <Logo tone="on-light" size={24} />
        </a>
        {NAV_ITEMS.map(([label, to]) => (
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
              whiteSpace: "nowrap",
              flex: "none",
            })}
          >
            {label}
          </NavLink>
        ))}
        <div className="app-sidebar-spacer" />
        <div className="app-sidebar-footer">
          <span
            className="app-sidebar-email"
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
              whiteSpace: "nowrap",
            }}
          >
            Sign out
          </button>
        </div>
      </div>
      <div className="app-content">
        <Outlet />
      </div>
    </div>
  );
}
