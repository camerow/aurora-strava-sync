import React from "react";
import { Links, Meta, Outlet, Scripts, ScrollRestoration } from "react-router";
import type { LinksFunction } from "react-router";
import designStyles from "@sendtally/design/styles.css?url";

export const links: LinksFunction = () => [{ rel: "stylesheet", href: designStyles }];

export function Layout({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body
        style={{
          margin: 0,
          background: "var(--surface-page)",
          fontFamily: "var(--font-sans)",
          WebkitFontSmoothing: "antialiased",
        }}
      >
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App(): React.ReactElement {
  return <Outlet />;
}
