"use client";

import { useState } from "react";
import { Button, Group, NumberInput, Stack, Text, Title } from "@mantine/core";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { HostedTournamentViewDto } from "../types";
import { RoundTimer } from "./shared";

type Act = (path: string, method: string, body?: unknown) => Promise<boolean>;

export function OrganizerPanel({
  view,
  offsetMs,
  act,
  onDeleted,
  onTimerExpire,
}: {
  view: HostedTournamentViewDto;
  offsetMs: number;
  act: Act;
  onDeleted: () => void;
  onTimerExpire: () => void;
}) {
  const { t } = useI18n();
  const { tournament } = view;
  const [busy, setBusy] = useState<string | null>(null);
  const [rounds, setRounds] = useState<number | "">(tournament.plannedRounds ?? "");
  const [minutes, setMinutes] = useState<number | "">(tournament.roundMinutes);
  const [lastPlanned, setLastPlanned] = useState(tournament.plannedRounds);
  const [lastMinutes, setLastMinutes] = useState(tournament.roundMinutes);

  // Keep the inputs in sync when another poll brings new values.
  if (tournament.plannedRounds !== lastPlanned) {
    setLastPlanned(tournament.plannedRounds);
    setRounds(tournament.plannedRounds ?? "");
  }
  if (tournament.roundMinutes !== lastMinutes) {
    setLastMinutes(tournament.roundMinutes);
    setMinutes(tournament.roundMinutes);
  }

  async function run(key: string, path: string, method: string, body?: unknown, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return false;
    setBusy(key);
    const ok = await act(path, method, body);
    setBusy(null);
    return ok;
  }

  const current = view.rounds.find((r) => r.number === tournament.currentRound) ?? null;
  const openCount =
    current?.pairings.filter((p) => ["PENDING", "AWAITING_CONFIRMATION", "DISPUTED"].includes(p.status)).length ?? 0;
  const lastRound = tournament.plannedRounds !== null && tournament.currentRound >= tournament.plannedRounds;
  const registration = tournament.status === "REGISTRATION";
  const inProgress = tournament.status === "IN_PROGRESS";
  const activePlayers = view.players.filter((p) => !p.dropped).length;

  const settingsChanged =
    (rounds === "" ? null : rounds) !== tournament.plannedRounds || minutes !== tournament.roundMinutes;

  return (
    <div className="rounded-xl border border-[color-mix(in_srgb,var(--mantine-color-grape-6)_45%,var(--sb-line))] bg-[var(--sb-panel)]/90 px-4 py-3">
      <Stack gap="md">
        <Title order={4}>{t("hosted.organizerPanel")}</Title>

        {inProgress && current ? (
          <Group justify="space-between" align="center" wrap="wrap" gap="md">
            <RoundTimer timer={current.timer} offsetMs={offsetMs} onExpire={onTimerExpire} />
            <Group gap="xs">
              {current.timer.paused ? (
                <Button size="xs" variant="light" loading={busy === "resume"} onClick={() => void run("resume", "timer", "POST", { action: "resume" })}>
                  {t("hosted.resume")}
                </Button>
              ) : (
                <Button size="xs" variant="light" color="yellow" loading={busy === "pause"} onClick={() => void run("pause", "timer", "POST", { action: "pause" })}>
                  {t("hosted.pause")}
                </Button>
              )}
              <Button size="xs" variant="default" loading={busy === "add1"} onClick={() => void run("add1", "timer", "POST", { action: "add", minutes: 1 })}>
                {t("hosted.addMinutes", { n: 1 })}
              </Button>
              <Button size="xs" variant="default" loading={busy === "add5"} onClick={() => void run("add5", "timer", "POST", { action: "add", minutes: 5 })}>
                {t("hosted.addMinutes", { n: 5 })}
              </Button>
              <Button size="xs" variant="default" loading={busy === "sub1"} onClick={() => void run("sub1", "timer", "POST", { action: "add", minutes: -1 })}>
                {t("hosted.removeMinutes", { n: 1 })}
              </Button>
            </Group>
          </Group>
        ) : null}

        {registration || inProgress ? (
          <Group align="flex-end" gap="sm" wrap="wrap">
            <NumberInput
              label={t("hosted.rounds")}
              placeholder={`${t("hosted.roundsAuto")} (${tournament.suggestedRounds})`}
              min={inProgress ? tournament.currentRound : 1}
              max={20}
              w={150}
              value={rounds}
              onChange={(v) => setRounds(typeof v === "number" ? v : "")}
            />
            <NumberInput
              label={t("hosted.roundMinutes")}
              min={5}
              max={180}
              w={190}
              value={minutes}
              onChange={(v) => setMinutes(typeof v === "number" ? v : "")}
            />
            <Button
              variant="light"
              disabled={!settingsChanged || minutes === "" || (inProgress && rounds === "")}
              loading={busy === "settings"}
              onClick={() =>
                void run("settings", "", "PATCH", {
                  plannedRounds: rounds === "" ? null : rounds,
                  roundMinutes: minutes,
                })
              }
            >
              {t("hosted.saveRounds")}
            </Button>
          </Group>
        ) : null}

        {registration ? (
          <Stack gap="xs">
            {activePlayers < 2 ? (
              <Text size="sm" c="dimmed">
                {t("hosted.needTwoPlayers")}
              </Text>
            ) : null}
            <Group gap="sm">
              <Button
                color="teal"
                disabled={activePlayers < 2}
                loading={busy === "start"}
                onClick={() => void run("start", "start", "POST", undefined, t("hosted.startConfirm"))}
              >
                {t("hosted.start")}
              </Button>
              <Button
                variant="subtle"
                color="red"
                loading={busy === "delete"}
                onClick={async () => {
                  const ok = await run("delete", "", "DELETE", undefined, t("hosted.deleteConfirm"));
                  if (ok) onDeleted();
                }}
              >
                {t("hosted.delete")}
              </Button>
            </Group>
          </Stack>
        ) : null}

        {inProgress ? (
          <Stack gap="xs">
            {openCount > 0 ? (
              <Text size="sm" c="orange">
                {t("hosted.openCount", { count: openCount })} · {t("hosted.nextRoundBlocked")}
              </Text>
            ) : null}
            <Group gap="sm">
              {!lastRound ? (
                <Button
                  color="teal"
                  disabled={openCount > 0}
                  loading={busy === "next"}
                  onClick={() => void run("next", "rounds", "POST")}
                >
                  {t("hosted.nextRound", { n: tournament.currentRound + 1 })}
                </Button>
              ) : null}
              <Button
                color={lastRound ? "teal" : "red"}
                variant={lastRound ? "filled" : "light"}
                disabled={openCount > 0}
                loading={busy === "finish"}
                onClick={() => void run("finish", "finish", "POST", undefined, t("hosted.finishConfirm"))}
              >
                {t("hosted.finish")}
              </Button>
            </Group>
          </Stack>
        ) : null}
      </Stack>
    </div>
  );
}
