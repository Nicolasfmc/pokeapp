import type { Metadata } from "next";
import { DeckCreatePanel } from "@/modules/decks/DeckCreatePanel";
import { getTranslator } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslator();
  return { title: t("decks.newDeck") };
}

export default function NewDeckPage() {
  return <DeckCreatePanel />;
}
