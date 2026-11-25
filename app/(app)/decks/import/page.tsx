import type { Metadata } from "next";
import { DeckImportPanel } from "@/modules/decks/DeckImportPanel";
import { getTranslator } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslator();
  return { title: t("decks.importDeck") };
}

export default function ImportDeckPage() {
  return <DeckImportPanel />;
}
