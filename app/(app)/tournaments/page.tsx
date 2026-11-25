import type { Metadata } from "next";
import { requireUser } from "@/server/auth";
import { listTournaments } from "@/modules/tournaments";
import { TournamentListPanel } from "@/modules/tournaments/TournamentListPanel";
import { getTranslator } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslator();
  return { title: t("nav.tournaments") };
}

export default async function TournamentsPage() {
  const user = await requireUser();
  const tournaments = await listTournaments(user.id);

  return (
    <section className="mx-auto w-full max-w-6xl px-2 py-6 sm:px-4">
      <TournamentListPanel initialTournaments={tournaments} />
    </section>
  );
}
