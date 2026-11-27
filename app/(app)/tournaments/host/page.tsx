import type { Metadata } from "next";
import { requireUser } from "@/server/auth";
import { listFormats } from "@/modules/decks";
import { HostedCreateForm } from "@/modules/hosted-tournaments/ui/HostedCreateForm";
import { getTranslator } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslator();
  return { title: t("hosted.createTitle") };
}

export default async function HostTournamentPage() {
  await requireUser();
  const formats = await listFormats();

  return (
    <section className="mx-auto w-full max-w-6xl px-2 py-6 sm:px-4">
      <HostedCreateForm formats={formats.map(({ id, code, name }) => ({ id, code, name }))} />
    </section>
  );
}
