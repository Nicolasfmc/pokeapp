import type { Metadata } from "next";
import { DeckListPanel } from "@/modules/decks/DeckListPanel";
import { listDecks } from "@/modules/decks";
import { requireUser } from "@/server/auth";

export const metadata: Metadata = {
  title: "Decks",
};

export default async function DecksPage() {
  const user = await requireUser();
  const decks = await listDecks(user.id);
  return <DeckListPanel initialDecks={decks} />;
}
