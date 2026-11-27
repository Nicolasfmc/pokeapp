"use client";

import Link from "next/link";
import { Badge, Button, Group, Stack, Text, Title } from "@mantine/core";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { HostedTournamentSummaryDto } from "../types";

export function HostedListPanel({ tournaments }: { tournaments: HostedTournamentSummaryDto[] }) {
  const { t, tEnum, formatDateTime } = useI18n();

  return (
    <Stack gap="lg" className="max-w-5xl animate-[sb-rise_0.45s_ease-out]">
      <Group justify="space-between" align="flex-end" wrap="wrap" gap="sm">
        <div>
          <Title order={2}>{t("hosted.listTitle")}</Title>
          <Text c="dimmed" size="sm" mt={4}>
            {t("hosted.listSubtitle")}
          </Text>
        </div>
        <Button component={Link} href="/tournaments/host">
          {t("hosted.create")}
        </Button>
      </Group>

      {tournaments.length === 0 ? (
        <Stack gap="sm" className="rounded-xl border border-[var(--sb-line)] bg-[var(--sb-panel)]/80 px-6 py-10">
          <Text fw={600}>{t("hosted.empty")}</Text>
          <Text c="dimmed" size="sm">
            {t("hosted.emptyHint")}
          </Text>
        </Stack>
      ) : (
        <Stack gap="sm">
          {tournaments.map((tournament) => (
            <Group
              key={tournament.code}
              justify="space-between"
              align="center"
              wrap="nowrap"
              className="rounded-xl border border-[var(--sb-line)] bg-[var(--sb-panel)]/85 px-4 py-3 transition-colors hover:border-[var(--sb-accent)]"
            >
              <Stack gap={4} style={{ minWidth: 0, flex: 1 }}>
                <Group gap="sm" wrap="wrap">
                  <Text
                    component={Link}
                    href={`/t/${tournament.code}`}
                    fw={700}
                    className="text-[var(--sb-ink)] no-underline hover:underline"
                    style={{ overflowWrap: "anywhere" }}
                  >
                    {tournament.name}
                  </Text>
                  <Badge
                    color={
                      tournament.status === "IN_PROGRESS"
                        ? "teal"
                        : tournament.status === "FINISHED"
                          ? "gray"
                          : "blue"
                    }
                  >
                    {t(`hosted.status.${tournament.status}`)}
                  </Badge>
                  <Badge variant="light">{tEnum("format", tournament.format.code)}</Badge>
                  <Badge variant="outline" color={tournament.role === "PLAYER" ? "gray" : "grape"}>
                    {t(`hosted.role.${tournament.role}`)}
                  </Badge>
                </Group>
                <Text size="sm" c="dimmed">
                  {tournament.date ? `${formatDateTime(tournament.date)} · ` : ""}
                  {tournament.locationType === "ONLINE" ? t("hosted.online") : (tournament.location ?? "—")}
                  {" · "}
                  {t("hosted.playerCount", { count: tournament.playerCount })}
                  {tournament.status === "IN_PROGRESS" && tournament.plannedRounds
                    ? ` · ${t("hosted.roundOf", { current: tournament.currentRound, total: tournament.plannedRounds })}`
                    : ""}
                </Text>
              </Stack>
              <Button component={Link} href={`/t/${tournament.code}`} variant="light" size="compact-sm">
                {t("tournaments.open")}
              </Button>
            </Group>
          ))}
        </Stack>
      )}
    </Stack>
  );
}
