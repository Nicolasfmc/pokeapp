"use client";

import { useState } from "react";
import { Alert, Button, Group, Modal, NumberInput, SegmentedControl, Stack, Text, Title } from "@mantine/core";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { isValidGameScore, outcomeFromGames } from "@/server/services/hosted-tournament/swiss";
import type { HostedPairingDto } from "../types";
import { PlayerName, scoreLabel } from "./shared";
import { PairingStatusBadge } from "./PairingsList";

type Props = {
  pairing: HostedPairingDto;
  viewerEntryId: string;
  bestOf: number;
  onAction: (pairingId: string, body: Record<string, unknown>) => Promise<boolean>;
};

type MyOutcome = "WIN" | "LOSS" | "DRAW";

// outcomeFromGames(myGames, opponentGames) treats the viewer as player 1.
const OUTCOME_FOR_ME = {
  PLAYER1_WIN: "WIN",
  PLAYER2_WIN: "LOSS",
  DRAW: "DRAW",
} as const satisfies Record<ReturnType<typeof outcomeFromGames>, MyOutcome>;

const OUTCOME_COLOR: Record<MyOutcome, string> = { WIN: "green", LOSS: "red", DRAW: "gray" };

/** "Your opponent reported that **you lost** (0-2 · your games – opponent's)." */
function ReportedOutcome({ outcome, score }: { outcome: MyOutcome; score: string | null }) {
  const { t } = useI18n();
  return (
    <Text size="sm">
      {outcome === "DRAW" ? t("hosted.opponentReportedPlain") : t("hosted.opponentReportedThat")}{" "}
      <Text span fw={700} c={OUTCOME_COLOR[outcome]}>
        {t(`hosted.reported.${outcome}`)}
      </Text>
      {score ? (
        <>
          {" "}
          (<span className="font-[family-name:var(--font-ibm-plex-mono)] font-semibold">{score}</span>
          <Text span size="xs" c="dimmed">
            {" · "}
            {t("hosted.scoreLegend")}
          </Text>
          )
        </>
      ) : null}
      .
    </Text>
  );
}

/** The viewer's own match in the current round: report, confirm or dispute. */
export function MyMatchPanel({ pairing, viewerEntryId, bestOf, onAction }: Props) {
  const { t } = useI18n();
  const [reporting, setReporting] = useState(false);
  const [busy, setBusy] = useState<"confirm" | "dispute" | null>(null);

  if (!pairing.player2) {
    return (
      <Alert color="gray" variant="light" title={t("hosted.yourMatch")}>
        {t("hosted.youHaveBye")}
      </Alert>
    );
  }

  const iAmPlayer1 = pairing.player1.entryId === viewerEntryId;
  const me = iAmPlayer1 ? pairing.player1 : pairing.player2;
  const opponent = iAmPlayer1 ? pairing.player2 : pairing.player1;
  const reportedByMe = pairing.reportedByEntryId === viewerEntryId;
  // Score from the viewer's side.
  const myScore = iAmPlayer1
    ? scoreLabel(pairing)
    : scoreLabel({
        player1Games: pairing.player2Games,
        player2Games: pairing.player1Games,
        drawGames: pairing.drawGames,
      });
  const myGames = iAmPlayer1 ? pairing.player1Games : pairing.player2Games;
  const opponentGames = iAmPlayer1 ? pairing.player2Games : pairing.player1Games;
  const myOutcome = OUTCOME_FOR_ME[outcomeFromGames(myGames, opponentGames)];

  async function respond(action: "confirm" | "dispute") {
    setBusy(action);
    await onAction(pairing.id, { action });
    setBusy(null);
  }

  return (
    <div className="rounded-xl border border-[var(--sb-accent)] bg-[color-mix(in_srgb,var(--sb-accent)_6%,var(--sb-panel))] px-4 py-3">
      <Stack gap="sm">
        <Group justify="space-between" wrap="nowrap">
          <Title order={4}>
            {t("hosted.yourMatch")} · {t("hosted.table", { n: pairing.tableNumber ?? 0 })}
          </Title>
          <PairingStatusBadge pairing={pairing} />
        </Group>
        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3">
          <PlayerName player={me} record={me.record} highlight />
          <Text fw={700} className="font-[family-name:var(--font-ibm-plex-mono)]">
            {pairing.status === "PENDING" ? t("hosted.vs") : myScore}
          </Text>
          <PlayerName player={opponent} record={opponent.record} align="right" />
        </div>

        {pairing.status === "AWAITING_CONFIRMATION" && reportedByMe ? (
          <Text size="sm" c="dimmed">
            {t("hosted.waitingOpponent")}
          </Text>
        ) : null}
        {pairing.canConfirm ? (
          <Alert color="yellow" variant="light">
            <Stack gap="xs">
              <ReportedOutcome
                outcome={myOutcome}
                score={bestOf > 1 ? myScore : null}
              />
              <Group gap="xs">
                <Button size="xs" color="teal" loading={busy === "confirm"} disabled={busy !== null} onClick={() => void respond("confirm")}>
                  {t("hosted.confirm")}
                </Button>
                <Button size="xs" variant="light" color="red" loading={busy === "dispute"} disabled={busy !== null} onClick={() => void respond("dispute")}>
                  {t("hosted.dispute")}
                </Button>
              </Group>
            </Stack>
          </Alert>
        ) : null}
        {pairing.status === "DISPUTED" ? (
          <Text size="sm" c="red">
            {t("hosted.disputedHint")}
          </Text>
        ) : null}
        {pairing.status === "CONFIRMED" && pairing.source === "TIMER" ? (
          <Text size="sm" c="orange">
            {t("hosted.timerDrawHint")}
          </Text>
        ) : null}

        {pairing.canReport ? (
          <Group>
            <Button size="sm" onClick={() => setReporting(true)}>
              {reportedByMe && pairing.status === "AWAITING_CONFIRMATION"
                ? t("hosted.reportAgain")
                : t("hosted.report")}
            </Button>
          </Group>
        ) : null}
      </Stack>

      {reporting ? (
        <ReportModal
          tableNumber={pairing.tableNumber ?? 0}
          bestOf={bestOf}
          onClose={() => setReporting(false)}
          onSubmit={async (score) => {
            const ok = await onAction(pairing.id, { action: "report", ...score });
            if (ok) setReporting(false);
            return ok;
          }}
        />
      ) : null}
    </div>
  );
}

type Score = { myGames: number; opponentGames: number; drawGames: number };

function ReportModal({
  tableNumber,
  bestOf,
  onClose,
  onSubmit,
}: {
  tableNumber: number;
  bestOf: number;
  onClose: () => void;
  onSubmit: (score: Score) => Promise<boolean>;
}) {
  const { t } = useI18n();
  const [quick, setQuick] = useState<"WIN" | "LOSS" | "DRAW">("WIN");
  const [score, setScore] = useState<Score>({ myGames: 2, opponentGames: 0, drawGames: 0 });
  const [busy, setBusy] = useState(false);

  const final: Score =
    bestOf === 1
      ? quick === "WIN"
        ? { myGames: 1, opponentGames: 0, drawGames: 0 }
        : quick === "LOSS"
          ? { myGames: 0, opponentGames: 1, drawGames: 0 }
          : { myGames: 0, opponentGames: 0, drawGames: 1 }
      : score;
  const valid = isValidGameScore(bestOf, final.myGames, final.opponentGames, final.drawGames);
  const outcome = outcomeFromGames(final.myGames, final.opponentGames);
  const outcomeLabel =
    outcome === "PLAYER1_WIN"
      ? t("hosted.outcome.WIN")
      : outcome === "PLAYER2_WIN"
        ? t("hosted.outcome.LOSS")
        : t("hosted.outcome.DRAW");

  const asInt = (value: string | number) => (typeof value === "number" ? value : 0);
  const needed = Math.ceil(bestOf / 2);

  return (
    <Modal opened onClose={onClose} title={t("hosted.reportTitle", { n: tableNumber })} centered>
      <Stack gap="sm">
        {bestOf === 1 ? (
          <SegmentedControl
            fullWidth
            value={quick}
            onChange={(value) => setQuick(value as typeof quick)}
            data={[
              { value: "WIN", label: t("hosted.iWon") },
              { value: "LOSS", label: t("hosted.iLost") },
              { value: "DRAW", label: t("hosted.weDrew") },
            ]}
          />
        ) : (
          <>
            <NumberInput
              label={t("hosted.myGames")}
              min={0}
              max={needed}
              value={score.myGames}
              onChange={(v) => setScore((s) => ({ ...s, myGames: asInt(v) }))}
            />
            <NumberInput
              label={t("hosted.opponentGames")}
              min={0}
              max={needed}
              value={score.opponentGames}
              onChange={(v) => setScore((s) => ({ ...s, opponentGames: asInt(v) }))}
            />
            <NumberInput
              label={t("hosted.drawGames")}
              min={0}
              max={bestOf}
              value={score.drawGames}
              onChange={(v) => setScore((s) => ({ ...s, drawGames: asInt(v) }))}
            />
          </>
        )}
        <Text fw={600}>
          {t("hosted.resultPreview", {
            result: `${outcomeLabel} (${final.myGames}-${final.opponentGames}${final.drawGames ? `-${final.drawGames}` : ""})`,
          })}
        </Text>
        <Group justify="flex-end" gap="xs">
          <Button variant="default" onClick={onClose} disabled={busy}>
            {t("hosted.cancel")}
          </Button>
          <Button
            loading={busy}
            disabled={!valid}
            onClick={async () => {
              setBusy(true);
              await onSubmit(final);
              setBusy(false);
            }}
          >
            {t("hosted.send")}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
