import type { Metadata } from "next";
import { DeckImportPanel } from "@/modules/decks/DeckImportPanel";

export const metadata: Metadata = {
  title: "Importar deck",
};

export default function ImportDeckPage() {
  return <DeckImportPanel />;
}
