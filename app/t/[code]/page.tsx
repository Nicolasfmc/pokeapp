import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSession } from "@/server/auth";
import {
  getHostedTournamentName,
  getHostedTournamentView,
  HostedTournamentError,
} from "@/modules/hosted-tournaments";
import { HostedTournamentView } from "@/modules/hosted-tournaments/ui/HostedTournamentView";
import { getTranslator } from "@/lib/i18n/server";

type PageProps = { params: Promise<{ code: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { code } = await params;
  const { t } = await getTranslator();
  // Unlisted: only people with the link should find it.
  const robots = { index: false, follow: false };
  const name = await getHostedTournamentName(code);
  return { title: name ?? t("tournaments.tournament"), robots };
}

export default async function HostedTournamentPage({ params }: PageProps) {
  const { code } = await params;
  const session = await getSession();
  let view;
  try {
    view = await getHostedTournamentView(code, session?.id ?? null);
  } catch (error) {
    if (error instanceof HostedTournamentError && error.status === 404) notFound();
    throw error;
  }

  return (
    <section className="mx-auto w-full max-w-5xl px-3 py-6 sm:px-6">
      <HostedTournamentView initialView={view} />
    </section>
  );
}
