"use client";

import { useState } from "react";
import { Badge, Button, Group, Modal, NumberInput, Stack, Text } from "@mantine/core";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { isValidGameScore } from "@/server/services/hosted-tournament/swiss";
import type { HostedPairingDto } from "../types";
import { PlayerName, scoreLabel } from "./shared";

function statusColor(pairing: HostedPairingDto) {
  switch (pairing.status) {
    case "CONFIRMED":
      return pairing.source === "TIMER" ? "orange" : pairing.source === "JUDGE" ? "grape" : "teal";
    case "AWAITING_CONFIRMATION":
      return "yellow";
    case "DISPUTED":
      return "red";
    case "BYE":
      return "gray";
    default:
      return "blue";
  }
}

export function PairingStatusBadge({ pairing }: { pairing: HostedPairingDto }) {
  const { t } = useI18n();
  let label = t(`hosted.pairing.${pairing.status}` as "hosted.pairing.PENDING");
  if (pairing.status === "CONFIRMED" && pairing.source === "TIMER") label = t("hosted.source.TIMER");
  if (pairing.status === "CONFIRMED" && pairing.source === "JUDGE") label = t("hosted.source.JUDGE");
  return (
    <Badge size="sm" variant="light" color={statusColor(pairing)} style={{ flexShrink: 0 }}>
      {label}
    </Badge>
  );
}

export function PairingsList({
  pairings,
  bestOf,
  viewerEntryId,
  isCurrentRound,
  onJudge,
}: {
  pairings: HostedPairingDto[];
  bestOf: number;
  viewerEntryId: string | null;
  isCurrentRound: boolean;
  onJudge: (pairingId: string, body: Record<string, unknown>) => Promise<boolean>;
}) {
  const { t } = useI18n();
  const [judging, setJudging] = useState<HostedPairingDto | null>(null);

  return (
    <Stack gap="xs">
      <Text size="xs" c="dimmed">
        {t("hosted.recordHint")}
      </Text>
      {pairings.map((pairing) => {
        const mine =
          viewerEntryId !== null &&
          (pairing.player1.entryId === viewerEntryId || pairing.player2?.entryId === viewerEntryId);
        const decided = pairing.status === "CONFIRMED" || pairing.status === "AWAITING_CONFIRMATION";
        const p1Won = decided && pairing.result === "PLAYER1_WIN";
        const p2Won = decided && pairing.result === "PLAYER2_WIN";
        return (
          <div
            key={pairing.id}
            className={`rounded-xl border px-3 py-2 ${
              mine
                ? "border-[var(--sb-accent)] bg-[color-mix(in_srgb,var(--sb-accent)_8%,var(--sb-panel))]"
                : "border-[var(--sb-line)] bg-[var(--sb-panel)]/85"
            }`}
          >
            <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-2 sm:grid-cols-[auto_minmax(0,1fr)_auto_minmax(0,1fr)_auto]">
              <Text
                fw={700}
                size="sm"
                className="w-14 font-[family-name:var(--font-ibm-plex-mono)]"
                aria-label={pairing.tableNumber ? t("hosted.table", { n: pairing.tableNumber }) : t("hosted.bye")}
              >
                {pairing.tableNumber ? t("hosted.tableShort", { n: pairing.tableNumber }) : "—"}
              </Text>
              <PlayerName
                player={pairing.player1}
                record={pairing.player1.record}
                highlight={p1Won || pairing.player1.entryId === viewerEntryId}
              />
              <Text
                fw={700}
                size="sm"
                className="col-start-2 font-[family-name:var(--font-ibm-plex-mono)] sm:col-start-auto sm:min-w-16 sm:text-center"
              >
                {pairing.player2 === null
                  ? t("hosted.bye")
                  : decided
                    ? scoreLabel(pairing)
                    : t("hosted.vs")}
              </Text>
              {pairing.player2 ? (
                <div className="col-start-2 sm:col-start-auto">
                  <PlayerName
                    player={pairing.player2}
                    record={pairing.player2.record}
                    highlight={p2Won || pairing.player2.entryId === viewerEntryId}
                  />
                </div>
              ) : (
                <div className="hidden sm:block" />
              )}
              <Group gap="xs" justify="flex-end" wrap="nowrap" className="col-start-2 sm:col-start-auto">
                <PairingStatusBadge pairing={pairing} />
                {pairing.canJudge ? (
                  <Button size="compact-xs" variant="subtle" color="grape" onClick={() => setJudging(pairing)}>
                    {t("hosted.setResult")}
                  </Button>
                ) : null}
              </Group>
            </div>
          </div>
        );
      })}

      <JudgeModal
        pairing={judging}
        bestOf={bestOf}
        canReopen={isCurrentRound}
        onClose={() => setJudging(null)}
        onSubmit={onJudge}
      />
    </Stack>
  );
}

function JudgeModal({
  pairing,
  bestOf,
  canReopen,
  onClose,
  onSubmit,
}: {
  pairing: HostedPairingDto | null;
  bestOf: number;
  canReopen: boolean;
  onClose: () => void;
  onSubmit: (pairingId: string, body: Record<string, unknown>) => Promise<boolean>;
}) {
  const { t } = useI18n();
  const [p1, setP1] = useState<number>(0);
  const [p2, setP2] = useState<number>(0);
  const [draws, setDraws] = useState<number>(0);
  const [busy, setBusy] = useState(false);
  const [lastId, setLastId] = useState<string | null>(null);

  if (pairing && pairing.id !== lastId) {
    setLastId(pairing.id);
    setP1(pairing.player1Games);
    setP2(pairing.player2Games);
    setDraws(pairing.drawGames);
  }

  if (!pairing || !pairing.player2) {
    return <Modal opened={false} onClose={onClose} />;
  }
  const valid = isValidGameScore(bestOf, p1, p2, draws);

  async function submit(body: Record<string, unknown>) {
    if (!pairing) return;
    setBusy(true);
    const ok = await onSubmit(pairing.id, { action: "judge", ...body });
    setBusy(false);
    if (ok) onClose();
  }

  const asInt = (value: string | number) => (typeof value === "number" ? value : 0);

  return (
    <Modal
      opened
      onClose={onClose}
      title={t("hosted.judgeTitle", { n: pairing.tableNumber ?? 0 })}
      centered
    >
      <Stack gap="sm">
        <NumberInput
          label={t("hosted.player1Games", { name: pairing.player1.displayName })}
          min={0}
          max={Math.ceil(bestOf / 2)}
          value={p1}
          onChange={(v) => setP1(asInt(v))}
        />
        <NumberInput
          label={t("hosted.player1Games", { name: pairing.player2.displayName })}
          min={0}
          max={Math.ceil(bestOf / 2)}
          value={p2}
          onChange={(v) => setP2(asInt(v))}
        />
        <NumberInput
          label={t("hosted.drawGames")}
          min={0}
          max={bestOf}
          value={draws}
          onChange={(v) => setDraws(asInt(v))}
        />
        <Group justify="space-between">
          {canReopen ? (
            <Button variant="subtle" color="gray" disabled={busy} onClick={() => void submit({ reset: true })}>
              {t("hosted.reopen")}
            </Button>
          ) : (
            <span />
          )}
          <Group gap="xs">
            <Button variant="default" onClick={onClose} disabled={busy}>
              {t("hosted.cancel")}
            </Button>
            <Button
              color="grape"
              loading={busy}
              disabled={!valid}
              onClick={() => void submit({ player1Games: p1, player2Games: p2, drawGames: draws })}
            >
              {t("hosted.setResult")}
            </Button>
          </Group>
        </Group>
      </Stack>
    </Modal>
  );
}
