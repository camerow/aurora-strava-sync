import { getAuth } from "@clerk/react-router/ssr.server";
import React from "react";
import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { BoardsAndDetails } from "../landing/components/BoardsAndDetails";
import { Footer } from "../landing/components/Footer";
import { Hero } from "../landing/components/Hero";
import { HowItWorks } from "../landing/components/HowItWorks";
import { Nav } from "../landing/components/Nav";
import { PricePanel } from "../landing/components/PricePanel";

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

export async function loader(args: LoaderFunctionArgs): Promise<{ signedIn: boolean }> {
  const auth = await getAuth(args);
  return { signedIn: auth.isAuthenticated };
}

export default function Home(): React.ReactElement {
  const { signedIn } = useLoaderData<typeof loader>();
  return (
    <div>
      <Nav signedIn={signedIn} />
      <Hero signedIn={signedIn} />
      <HowItWorks />
      <BoardsAndDetails />
      <PricePanel />
      <Footer />
    </div>
  );
}
