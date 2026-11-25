import type { Metadata } from "next";
import { requireUser } from "@/server/auth";
import {
  getStatisticsFilterOptions,
  getStatisticsSummary,
} from "@/modules/statistics";
import { StatisticsPanel } from "@/modules/statistics/StatisticsPanel";
import { getTranslator } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslator();
  return { title: t("nav.statistics") };
}

export default async function StatisticsPage() {
  const user = await requireUser();
  const [summary, filterOptions] = await Promise.all([
    getStatisticsSummary(user.id),
    getStatisticsFilterOptions(user.id),
  ]);

  return (
    <section className="mx-auto w-full max-w-6xl px-2 py-6 sm:px-4">
      <StatisticsPanel
        initialSummary={summary}
        filterOptions={filterOptions}
      />
    </section>
  );
}
