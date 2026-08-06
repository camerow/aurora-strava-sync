import React from "react";
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

export default function Home(): React.ReactElement {
  return (
    <div>
      <Nav />
      <Hero />
      <HowItWorks />
      <BoardsAndDetails />
      <PricePanel />
      <Footer />
    </div>
  );
}
