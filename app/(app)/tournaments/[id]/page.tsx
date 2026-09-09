import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/server/auth";
import {
  TournamentServiceError,
  getTournament,
  listAttachableMatches,
} from "@/modules/tournaments";
import { TournamentDetailPanel } from "@/modules/tournaments/TournamentDetailPanel";

export const metadata: Metadata = {
  title: "Torneio",
};

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function TournamentDetailPage({ params }: PageProps) {
  const user = await requireUser();
  const { id } = await params;

  let tournament;
  try {
    tournament = await getTournament(user.id, id);
  } catch (error) {
    if (error instanceof TournamentServiceError && error.status === 404) {
      notFound();
    }
    throw error;
  }

  const attachableMatches = await listAttachableMatches(user.id);

  return (
    <section className="mx-auto w-full max-w-6xl px-2 py-6 sm:px-4">
      <TournamentDetailPanel
        initialTournament={tournament}
        initialAttachableMatches={attachableMatches}
      />
    </section>
  );
}
