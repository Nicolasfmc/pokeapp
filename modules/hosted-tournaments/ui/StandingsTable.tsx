"use client";

import { Table, Text } from "@mantine/core";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { HostedStandingDto } from "../types";
import { PlayerName } from "./shared";

const percent = (value: number) => `${(value * 100).toFixed(1)}%`;

export function StandingsTable({
  standings,
  viewerEntryId,
}: {
  standings: HostedStandingDto[];
  viewerEntryId: string | null;
}) {
  const { t } = useI18n();
  if (standings.length === 0) {
    return (
      <Text c="dimmed" size="sm">
        {t("hosted.noPlayers")}
      </Text>
    );
  }
  return (
    <Table.ScrollContainer minWidth={520}>
      <Table striped highlightOnHover verticalSpacing="xs">
        <Table.Thead>
          <Table.Tr>
            <Table.Th w={48}>{t("hosted.rank")}</Table.Th>
            <Table.Th>{t("hosted.player")}</Table.Th>
            <Table.Th ta="right">{t("hosted.pts")}</Table.Th>
            <Table.Th ta="right">{t("hosted.record")}</Table.Th>
            <Table.Th ta="right">{t("hosted.omw")}</Table.Th>
            <Table.Th ta="right">{t("hosted.oomw")}</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {standings.map((row) => (
            <Table.Tr
              key={row.entryId}
              className={row.entryId === viewerEntryId ? "bg-[color-mix(in_srgb,var(--sb-accent)_10%,transparent)]" : undefined}
            >
              <Table.Td fw={700}>{row.rank}</Table.Td>
              <Table.Td style={{ maxWidth: 260 }}>
                <PlayerName player={row} highlight={row.entryId === viewerEntryId} />
              </Table.Td>
              <Table.Td ta="right" fw={700}>
                {row.points}
              </Table.Td>
              <Table.Td ta="right" className="font-[family-name:var(--font-ibm-plex-mono)]">
                {row.wins}/{row.losses}/{row.draws}
              </Table.Td>
              <Table.Td ta="right">{percent(row.omw)}</Table.Td>
              <Table.Td ta="right">{percent(row.oomw)}</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
}
