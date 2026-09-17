import type { Metadata } from "next";
import { ScoreScreen } from "@/components/score/score-screen";

export const metadata: Metadata = {
  title: "Scores · Rummikub Turn Timer",
};

export default function Page() {
  return <ScoreScreen />;
}
