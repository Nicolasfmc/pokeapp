import type { Metadata } from "next";
import { requireUser } from "@/server/auth";
import { listDecks } from "@/modules/decks";
import { listArchetypes, listMatches } from "@/modules/training";
import { TrainingPanel } from "@/modules/training/TrainingPanel";
import { getTranslator } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslator();
  return { title: t("nav.training") };
}

export default async function TrainingPage() {
  const user = await requireUser();
  const [matches, decks, archetypes] = await Promise.all([
    listMatches(user.id),
    listDecks(user.id),
    listArchetypes(),
  ]);

  return (
    <section className="mx-auto w-full max-w-6xl px-2 py-6 sm:px-4">
      <TrainingPanel
        initialMatches={matches}
        decks={decks.map((deck) => ({
          id: deck.id,
          name: deck.name,
          formatName: deck.format.name,
        }))}
        initialArchetypes={archetypes}
        defaultViewerName={user.username}
      />
    </section>
  );
}
