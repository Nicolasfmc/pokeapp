import type { Metadata } from "next";
import { DeckCreatePanel } from "@/modules/decks/DeckCreatePanel";

export const metadata: Metadata = {
  title: "Novo deck",
};

export default function NewDeckPage() {
  return <DeckCreatePanel />;
}
