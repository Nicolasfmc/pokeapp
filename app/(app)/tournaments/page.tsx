import type { Metadata } from "next";
import { requireUser } from "@/server/auth";
import { listTournaments } from "@/modules/tournaments";
import { TournamentListPanel } from "@/modules/tournaments/TournamentListPanel";

export const metadata: Metadata = {
  title: "Tournaments",
};

export default async function TournamentsPage() {
  const user = await requireUser();
  const tournaments = await listTournaments(user.id);

  return (
    <section className="mx-auto w-full max-w-6xl px-2 py-6 sm:px-4">
      <TournamentListPanel initialTournaments={tournaments} />
    </section>
  );
}
