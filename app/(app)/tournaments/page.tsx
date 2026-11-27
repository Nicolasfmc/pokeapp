import type { Metadata } from "next";
import { requireUser } from "@/server/auth";
import { listTournaments } from "@/modules/tournaments";
import { listMyHostedTournaments } from "@/modules/hosted-tournaments";
import { TournamentListPanel } from "@/modules/tournaments/TournamentListPanel";
import { HostedListPanel } from "@/modules/hosted-tournaments/ui/HostedListPanel";
import { TournamentsTabs } from "@/modules/hosted-tournaments/ui/TournamentsTabs";
import { getTranslator } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslator();
  return { title: t("nav.tournaments") };
}

type PageProps = { searchParams: Promise<{ tab?: string | string[] }> };

export default async function TournamentsPage({ searchParams }: PageProps) {
  const user = await requireUser();
  const { tab } = await searchParams;
  const [tournaments, hosted] = await Promise.all([
    listTournaments(user.id),
    listMyHostedTournaments(user.id),
  ]);

  return (
    <section className="mx-auto w-full max-w-6xl px-2 py-6 sm:px-4">
      <TournamentsTabs
        initialTab={tab === "hosted" ? "hosted" : "logs"}
        logs={<TournamentListPanel initialTournaments={tournaments} />}
        hosted={<HostedListPanel tournaments={hosted} />}
      />
    </section>
  );
}
