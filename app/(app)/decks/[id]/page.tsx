import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DeckEditorPanel } from "@/modules/decks/DeckEditorPanel";
import { DeckServiceError, getDeck } from "@/modules/decks";
import { requireUser } from "@/server/auth";

export const metadata: Metadata = {
  title: "Editar deck",
};

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function DeckDetailPage({ params }: PageProps) {
  const user = await requireUser();
  const { id } = await params;

  let deck;
  try {
    deck = await getDeck(user.id, id);
  } catch (error) {
    if (error instanceof DeckServiceError && error.status === 404) {
      notFound();
    }
    throw error;
  }

  return <DeckEditorPanel initialDeck={deck} />;
}
