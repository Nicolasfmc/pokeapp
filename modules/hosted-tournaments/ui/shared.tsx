"use client";

import { useEffect, useState } from "react";
import { Badge, Group, Stack, Text } from "@mantine/core";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type {
  HostedPairingDto,
  HostedPlayerRef,
  HostedRecord,
  HostedTimerDto,
} from "../types";

export type ActionResult = { ok: true } | { ok: false; error: string | undefined };

/** Calls a hosted-tournament API route; returns the server error (PT) on failure. */
export async function callApi(url: string, method: string, body?: unknown): Promise<ActionResult> {
  try {
    const response = await fetch(url, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (response.ok) return { ok: true };
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    return { ok: false, error: data.error };
  } catch {
    return { ok: false, error: undefined };
  }
}

export function formatRecord(record: HostedRecord) {
  return `${record.wins}/${record.losses}/${record.draws}`;
}

export function PlayerName({
  player,
  highlight = false,
  record,
  align = "left",
}: {
  player: HostedPlayerRef;
  highlight?: boolean;
  record?: HostedRecord;
  align?: "left" | "right";
}) {
  const { t } = useI18n();
  return (
    <Stack gap={0} align={align === "right" ? "flex-end" : "flex-start"} style={{ minWidth: 0 }}>
      <Group gap={6} wrap="nowrap" justify={align === "right" ? "flex-end" : "flex-start"} style={{ minWidth: 0 }}>
        <Text fw={highlight ? 700 : 500} truncate="end" size="sm">
          {player.displayName}
        </Text>
        {player.isJudge ? (
          <Badge size="xs" color="grape" variant="filled" style={{ flexShrink: 0 }}>
            {t("hosted.judge")}
          </Badge>
        ) : null}
        {player.dropped ? (
          <Badge size="xs" color="gray" variant="outline" style={{ flexShrink: 0 }}>
            {t("hosted.dropped")}
          </Badge>
        ) : null}
      </Group>
      <Text size="xs" c="dimmed" truncate="end">
        @{player.username}
        {record ? ` · ${formatRecord(record)}` : ""}
      </Text>
    </Stack>
  );
}

/** "2-1" from player 1's side ("1-1-1" with drawn games). */
export function scoreLabel(pairing: Pick<HostedPairingDto, "player1Games" | "player2Games" | "drawGames">) {
  const base = `${pairing.player1Games}-${pairing.player2Games}`;
  return pairing.drawGames > 0 ? `${base}-${pairing.drawGames}` : base;
}

function formatClock(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const mm = String(minutes).padStart(hours > 0 ? 2 : 1, "0");
  const ss = String(seconds).padStart(2, "0");
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

/**
 * Counts down locally between polls. `offsetMs` = server clock − client clock,
 * so a wrong device clock doesn't change the time shown.
 */
export function RoundTimer({
  timer,
  offsetMs,
  onExpire,
}: {
  timer: HostedTimerDto;
  offsetMs: number;
  onExpire?: () => void;
}) {
  const { t } = useI18n();
  // null until mounted: the first render matches the server HTML.
  const [now, setNow] = useState<number | null>(null);
  const running = !timer.paused && timer.endsAt !== null;

  useEffect(() => {
    if (!running) return;
    const tick = () => setNow(Date.now());
    const first = window.setTimeout(tick, 0);
    const id = window.setInterval(tick, 1000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(id);
    };
  }, [running, timer.endsAt]);

  const remaining =
    running && now !== null && timer.endsAt
      ? Math.max(0, Math.ceil((Date.parse(timer.endsAt) - (now + offsetMs)) / 1000))
      : timer.remainingSeconds;

  const expired = remaining === 0;
  useEffect(() => {
    if (expired && running && !timer.expired) onExpire?.();
  }, [expired, running, timer.expired, onExpire]);

  const color = expired ? "red" : timer.paused ? "yellow" : remaining <= 300 ? "orange" : undefined;
  return (
    <Stack gap={0} align="center">
      <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
        {expired ? t("hosted.timeUp") : timer.paused ? t("hosted.paused") : t("hosted.timeLeft")}
      </Text>
      <Text
        fw={700}
        c={color}
        className="font-[family-name:var(--font-ibm-plex-mono)] tabular-nums"
        style={{ fontSize: 34, lineHeight: 1.1 }}
        aria-live="off"
      >
        {formatClock(remaining)}
      </Text>
    </Stack>
  );
}
