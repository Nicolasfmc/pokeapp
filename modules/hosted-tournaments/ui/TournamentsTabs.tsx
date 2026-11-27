"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Tabs } from "@mantine/core";
import { useI18n } from "@/lib/i18n/I18nProvider";

export type TournamentsTab = "logs" | "hosted";

/** /tournaments: personal logs and organized tournaments, tab kept in the URL. */
export function TournamentsTabs({
  initialTab,
  logs,
  hosted,
}: {
  initialTab: TournamentsTab;
  logs: React.ReactNode;
  hosted: React.ReactNode;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const [tab, setTab] = useState<TournamentsTab>(initialTab);

  return (
    <Tabs
      value={tab}
      onChange={(value) => {
        const next: TournamentsTab = value === "hosted" ? "hosted" : "logs";
        setTab(next);
        router.replace(next === "hosted" ? `${pathname}?tab=hosted` : pathname, { scroll: false });
      }}
    >
      <Tabs.List mb="lg">
        <Tabs.Tab value="logs">{t("hosted.tabLogs")}</Tabs.Tab>
        <Tabs.Tab value="hosted">{t("hosted.tabHosted")}</Tabs.Tab>
      </Tabs.List>
      <Tabs.Panel value="logs">{logs}</Tabs.Panel>
      <Tabs.Panel value="hosted">{hosted}</Tabs.Panel>
    </Tabs>
  );
}
