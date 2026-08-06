import { ClerkProvider } from "@clerk/react-router";
import { clerkMiddleware } from "@clerk/react-router/server";
import { rootAuthLoader } from "@clerk/react-router/ssr.server";
import React from "react";
import type { LinksFunction, LoaderFunctionArgs, MiddlewareFunction } from "react-router";
import { Links, Meta, Outlet, Scripts, ScrollRestoration, useLoaderData } from "react-router";
import designStyles from "@sendtally/design/styles.css?url";

export const links: LinksFunction = () => [{ rel: "stylesheet", href: designStyles }];

export const middleware: MiddlewareFunction<Response>[] = [clerkMiddleware()];

export async function loader(
  args: LoaderFunctionArgs
): Promise<Awaited<ReturnType<typeof rootAuthLoader>>> {
  return rootAuthLoader(args);
}

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
          background: "var(--bs-white)",
          color: "var(--bs-gunmetal)",
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
  const loaderData = useLoaderData<typeof loader>();
  return (
    <ClerkProvider loaderData={loaderData}>
      <Outlet />
    </ClerkProvider>
  );
}
