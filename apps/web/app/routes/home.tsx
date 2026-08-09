import { getAuth } from "@clerk/react-router/ssr.server";
import React from "react";
import type { LinksFunction, LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";
import { BoardsAndDetails } from "../landing/components/BoardsAndDetails";
import { Footer } from "../landing/components/Footer";
import { Hero } from "../landing/components/Hero";
import { HowItWorks } from "../landing/components/HowItWorks";
import { Insights } from "../landing/components/Insights";
import { Nav } from "../landing/components/Nav";
import { PricePanel } from "../landing/components/PricePanel";
import { SessionBreakdown } from "../landing/components/SessionBreakdown";
import { StravaSection } from "../landing/components/StravaSection";
import landingStyles from "../landing/landing.css?url";

export const links: LinksFunction = () => [{ rel: "stylesheet", href: landingStyles }];

export function meta(): Array<Record<string, string>> {
  return [
    { title: "sendtally - see what your board sessions add up to" },
    {
      name: "description",
      content:
        "sendtally reads your climbing logbook out of your Aurora board account (Tension, Kilter, and more) and turns it into volume, grade pyramids, flash rate and progression - session by session, week by week. It posts each session to Strava too.",
    },
  ];
}

export async function loader(args: LoaderFunctionArgs): Promise<null> {
  const auth = await getAuth(args);
  if (auth.isAuthenticated) throw redirect("/app");
  return null;
}

export default function Home(): React.ReactElement {
  return (
    <div>
      <Nav />
      <Hero />
      <Insights />
      <SessionBreakdown />
      <StravaSection />
      <HowItWorks />
      <BoardsAndDetails />
      <PricePanel />
      <Footer />
    </div>
  );
}
