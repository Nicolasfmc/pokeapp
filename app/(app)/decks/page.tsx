import type { Metadata } from "next";
import { DeckListPanel } from "@/modules/decks/DeckListPanel";
import { listDecks } from "@/modules/decks";
import { requireUser } from "@/server/auth";
import { getTranslator } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslator();
  return { title: t("nav.decks") };
}

export default async function DecksPage() {
  const user = await requireUser();
  const decks = await listDecks(user.id);
  return <DeckListPanel initialDecks={decks} />;
}
