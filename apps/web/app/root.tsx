import { ClerkProvider } from "@clerk/react-router";
import { clerkMiddleware } from "@clerk/react-router/server";
import { rootAuthLoader } from "@clerk/react-router/ssr.server";
import React from "react";
import type { LinksFunction, LoaderFunctionArgs, MiddlewareFunction } from "react-router";
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData,
  useRouteLoaderData,
} from "react-router";
import designStyles from "@sendtally/design/styles.css?url";
import { cloudflareContext } from "./lib/cloudflare-context";

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: designStyles },
  { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
];

export const middleware: MiddlewareFunction<Response>[] = [clerkMiddleware()];

export async function loader(
  args: LoaderFunctionArgs
): Promise<{ gaMeasurementId: string | null }> {
  const { env } = args.context.get(cloudflareContext);
  return rootAuthLoader(args, () => ({ gaMeasurementId: env.GA_MEASUREMENT_ID ?? null }));
}

function GoogleAnalytics({ measurementId }: { measurementId: string }): React.ReactElement {
  return (
    <>
      <script async src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`} />
      <script
        dangerouslySetInnerHTML={{
          __html: [
            "window.dataLayer=window.dataLayer||[];",
            "function gtag(){dataLayer.push(arguments);}",
            "gtag('js',new Date());",
            `gtag('config',${JSON.stringify(measurementId)});`,
          ].join(""),
        }}
      />
    </>
  );
}

export function Layout({ children }: { children: React.ReactNode }): React.ReactElement {
  const data = useRouteLoaderData<typeof loader>("root");
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        {data?.gaMeasurementId ? <GoogleAnalytics measurementId={data.gaMeasurementId} /> : null}
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
