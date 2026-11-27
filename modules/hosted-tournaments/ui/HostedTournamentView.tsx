"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  Badge,
  Button,
  CopyButton,
  Group,
  Select,
  Stack,
  Tabs,
  Text,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { HostedTournamentViewDto } from "../types";
import { callApi, PlayerName, RoundTimer } from "./shared";
import { PairingsList } from "./PairingsList";
import { MyMatchPanel } from "./MyMatchPanel";
import { OrganizerPanel } from "./OrganizerPanel";
import { StandingsTable } from "./StandingsTable";

const POLL_MS = { REGISTRATION: 20_000, IN_PROGRESS: 10_000 } as const;

function defaultTab(view: HostedTournamentViewDto) {
  if (view.tournament.status === "IN_PROGRESS") return `r${view.tournament.currentRound}`;
  if (view.tournament.status === "FINISHED") return "standings";
  return "players";
}

export function HostedTournamentView({ initialView }: { initialView: HostedTournamentViewDto }) {
  const { t, te, tEnum, formatDateTime } = useI18n();
  const router = useRouter();
  const [view, setView] = useState(initialView);
  // server clock − client clock. Nothing renders it before mount (the timer
  // shows the server value until then), so hydration stays stable.
  const [offsetMs, setOffsetMs] = useState(() => Date.parse(initialView.serverNow) - Date.now());
  const [tab, setTab] = useState<string>(() => defaultTab(initialView));
  const [seen, setSeen] = useState({
    round: initialView.tournament.currentRound,
    status: initialView.tournament.status,
  });
  const code = view.tournament.code;
  const base = `/api/hosted-tournaments/${code}`;

  // Follow the tournament: a new round opens its tab; the end opens the standings.
  if (view.tournament.currentRound !== seen.round || view.tournament.status !== seen.status) {
    const { currentRound, status } = view.tournament;
    if (status === "IN_PROGRESS" && currentRound !== seen.round) setTab(`r${currentRound}`);
    if (status === "FINISHED" && seen.status !== "FINISHED") setTab("standings");
    setSeen({ round: currentRound, status });
  }

  const refresh = useCallback(async () => {
    try {
      const response = await fetch(base, { cache: "no-store" });
      if (!response.ok) return;
      const data = (await response.json()) as { view: HostedTournamentViewDto };
      setOffsetMs(Date.parse(data.view.serverNow) - Date.now());
      setView(data.view);
    } catch {
      /* keep the last view; the next poll retries */
    }
  }, [base]);

  useEffect(() => {
    const status = view.tournament.status;
    if (status === "FINISHED") return;
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, POLL_MS[status]);
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [view.tournament.status, refresh]);

  const act = useCallback(
    async (path: string, method: string, body?: unknown) => {
      const result = await callApi(path ? `${base}/${path}` : base, method, body);
      if (!result.ok) {
        notifications.show({ color: "red", message: te(result.error) ?? t("hosted.opFailed") });
        await refresh();
        return false;
      }
      await refresh();
      return true;
    },
    [base, refresh, t, te],
  );

  const onPairingAction = useCallback(
    (pairingId: string, body: Record<string, unknown>) => act(`pairings/${pairingId}`, "POST", body),
    [act],
  );

  const { tournament, viewer } = view;
  const currentRound = view.rounds.find((r) => r.number === tournament.currentRound) ?? null;
  const myPairing =
    tournament.status === "IN_PROGRESS" && viewer.entryId && viewer.entryStatus === "ACTIVE"
      ? (currentRound?.pairings.find(
          (p) => p.player1.entryId === viewer.entryId || p.player2?.entryId === viewer.entryId,
        ) ?? null)
      : null;

  const shareUrl = typeof window === "undefined" ? "" : `${window.location.origin}/t/${code}`;
  const location =
    tournament.locationType === "ONLINE" ? t("hosted.online") : (tournament.location ?? "—");

  return (
    <Stack gap="lg" className="animate-[sb-rise_0.45s_ease-out]">
      {viewer.signedIn ? (
        <Text component={Link} href="/tournaments?tab=hosted" size="sm" c="dimmed" className="no-underline hover:underline">
          {t("hosted.back")}
        </Text>
      ) : null}

      {/* Header */}
      <Stack gap="xs">
        <Group justify="space-between" align="flex-start" wrap="wrap" gap="sm">
          <Stack gap={4} style={{ minWidth: 0, flex: 1 }}>
            <Title order={2} style={{ overflowWrap: "anywhere" }}>
              {tournament.name}
            </Title>
            <Group gap={6} wrap="wrap">
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
              <Badge variant="outline">{t("hosted.bestOfShort", { n: tournament.bestOf })}</Badge>
              <Badge variant="outline" color="gray">
                {t("hosted.deckPolicy")}:{" "}
                {tournament.deckPolicy === "REQUIRED" ? t("hosted.deckRequired") : t("hosted.deckOptional")}
              </Badge>
              {tournament.status === "IN_PROGRESS" && tournament.plannedRounds ? (
                <Badge variant="light" color="teal">
                  {t("hosted.roundOf", { current: tournament.currentRound, total: tournament.plannedRounds })}
                </Badge>
              ) : null}
            </Group>
          </Stack>
          <CopyButton value={shareUrl} timeout={2000}>
            {({ copied, copy }) => (
              <Button variant={copied ? "filled" : "light"} color={copied ? "teal" : undefined} onClick={copy}>
                {copied ? t("hosted.linkCopied") : t("hosted.copyLink")}
              </Button>
            )}
          </CopyButton>
        </Group>
        <Text size="sm" c="dimmed">
          {tournament.date ? `${formatDateTime(tournament.date)} · ` : ""}
          {location} · {t("hosted.playerCount", { count: tournament.playerCount })}
          {tournament.maxPlayers ? `/${tournament.maxPlayers}` : ""}
        </Text>
        <Group gap={6}>
          <Text size="sm" c="dimmed">
            {t("hosted.organizedBy")}
          </Text>
          <Text size="sm" fw={600}>
            {tournament.organizer.displayName}
          </Text>
          <Text size="sm" c="dimmed">
            @{tournament.organizer.username}
          </Text>
          <Badge size="xs" color="grape" variant="filled">
            {t("hosted.judge")}
          </Badge>
        </Group>
        <Text size="xs" c="dimmed">
          {t("hosted.pointsSummary", {
            win: tournament.pointsWin,
            draw: tournament.pointsDraw,
            loss: tournament.pointsLoss,
          })}
          {tournament.status !== "FINISHED" ? ` · ${t("hosted.listsHidden")}` : ""}
        </Text>
      </Stack>

      {viewer.isOrganizer && tournament.status !== "FINISHED" ? (
        <OrganizerPanel
          view={view}
          offsetMs={offsetMs}
          act={act}
          onTimerExpire={() => void refresh()}
          onDeleted={() => {
            router.push("/tournaments?tab=hosted");
            router.refresh();
          }}
        />
      ) : null}

      {!viewer.isOrganizer && tournament.status === "IN_PROGRESS" && currentRound ? (
        <div className="flex justify-center rounded-xl border border-[var(--sb-line)] bg-[var(--sb-panel)]/85 py-2">
          <RoundTimer timer={currentRound.timer} offsetMs={offsetMs} onExpire={() => void refresh()} />
        </div>
      ) : null}

      <RegistrationPanel view={view} act={act} />

      {myPairing && viewer.entryId ? (
        <MyMatchPanel
          pairing={myPairing}
          viewerEntryId={viewer.entryId}
          bestOf={tournament.bestOf}
          onAction={onPairingAction}
        />
      ) : null}

      <Tabs value={tab} onChange={(value) => value && setTab(value)} keepMounted={false}>
        <Tabs.List className="flex-nowrap overflow-x-auto">
          <Tabs.Tab value="players">{t("hosted.tabPlayers", { count: view.players.length })}</Tabs.Tab>
          {view.rounds.map((round) => (
            <Tabs.Tab key={round.number} value={`r${round.number}`}>
              {t("hosted.roundTab", { n: round.number })}
            </Tabs.Tab>
          ))}
          {tournament.status !== "REGISTRATION" ? (
            <Tabs.Tab value="standings">{t("hosted.tabStandings")}</Tabs.Tab>
          ) : null}
        </Tabs.List>

        <Tabs.Panel value="players" pt="md">
          <PlayersList view={view} act={act} />
        </Tabs.Panel>
        {view.rounds.map((round) => (
          <Tabs.Panel key={round.number} value={`r${round.number}`} pt="md">
            <PairingsList
              pairings={round.pairings}
              bestOf={tournament.bestOf}
              viewerEntryId={viewer.entryId}
              isCurrentRound={round.number === tournament.currentRound && tournament.status === "IN_PROGRESS"}
              onJudge={onPairingAction}
            />
          </Tabs.Panel>
        ))}
        <Tabs.Panel value="standings" pt="md">
          <StandingsTable standings={view.standings} viewerEntryId={viewer.entryId} />
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}

type Act = (path: string, method: string, body?: unknown) => Promise<boolean>;

function RegistrationPanel({ view, act }: { view: HostedTournamentViewDto; act: Act }) {
  const { t, tEnum } = useI18n();
  const { tournament, viewer } = view;
  const [deckId, setDeckId] = useState<string | null>(viewer.deck?.id ?? null);
  const [busy, setBusy] = useState<string | null>(null);
  const [lastDeck, setLastDeck] = useState(viewer.deck?.id ?? null);
  if ((viewer.deck?.id ?? null) !== lastDeck) {
    setLastDeck(viewer.deck?.id ?? null);
    setDeckId(viewer.deck?.id ?? null);
  }

  async function run(key: string, method: string, body?: unknown, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(key);
    const ok = await act("registration", method, body);
    setBusy(null);
    if (ok && key === "save") notifications.show({ color: "teal", message: t("hosted.deckSaved") });
  }

  const box = "rounded-xl border border-[var(--sb-line)] bg-[var(--sb-panel)]/85 px-4 py-3";

  if (tournament.status === "FINISHED") return null;

  if (tournament.status === "IN_PROGRESS") {
    if (!viewer.entryId) return null;
    if (viewer.entryStatus === "DROPPED") {
      return (
        <Alert color="gray" variant="light">
          {t("hosted.youDropped")}
        </Alert>
      );
    }
    return (
      <Group justify="flex-end">
        <Button
          size="xs"
          variant="subtle"
          color="red"
          loading={busy === "drop"}
          onClick={() => void run("drop", "DELETE", undefined, t("hosted.dropConfirm"))}
        >
          {t("hosted.drop")}
        </Button>
      </Group>
    );
  }

  // Registration open
  if (!viewer.signedIn) {
    return (
      <div className={box}>
        <Button component={Link} href={`/login?next=${encodeURIComponent(`/t/${tournament.code}`)}`}>
          {t("hosted.signInToJoin")}
        </Button>
      </div>
    );
  }

  const required = tournament.deckPolicy === "REQUIRED";
  const deckOptions = [
    ...(required ? [] : [{ value: "", label: t("hosted.withoutDeck") }]),
    ...viewer.eligibleDecks.map((d) => ({ value: d.id, label: `${d.name} (${d.cardCount})` })),
  ];
  const noDecks = required && viewer.eligibleDecks.length === 0;
  const deckSelect = (
    <Select
      label={t("hosted.pickDeck")}
      data={deckOptions}
      value={deckId ?? ""}
      onChange={(value) => setDeckId(value ? value : null)}
      allowDeselect={false}
      w={{ base: "100%", sm: 320 }}
      disabled={noDecks}
    />
  );
  const noDecksHint = noDecks ? (
    <Text size="sm" c="orange">
      {t("hosted.noEligibleDecks", { format: tEnum("format", tournament.format.code) })}{" "}
      <Text component={Link} href="/decks/new" inherit c="var(--sb-accent)">
        {t("hosted.goToDecks")}
      </Text>
    </Text>
  ) : null;

  if (viewer.entryId) {
    return (
      <div className={box}>
        <Stack gap="sm">
          <Text fw={600} c="teal">
            {t("hosted.joined")}
          </Text>
          <Group align="flex-end" gap="sm" wrap="wrap">
            {deckSelect}
            <Button
              variant="light"
              loading={busy === "save"}
              disabled={(deckId ?? null) === (viewer.deck?.id ?? null) || (required && !deckId)}
              onClick={() => void run("save", "PATCH", { deckId })}
            >
              {t("hosted.saveDeck")}
            </Button>
          </Group>
          {noDecksHint}
          <Group>
            <Button size="xs" variant="subtle" color="red" loading={busy === "leave"} onClick={() => void run("leave", "DELETE")}>
              {t("hosted.leave")}
            </Button>
          </Group>
        </Stack>
      </div>
    );
  }

  if (!viewer.canJoin) {
    return (
      <Alert color="gray" variant="light">
        {t("hosted.full")}
      </Alert>
    );
  }

  return (
    <div className={box}>
      <Stack gap="sm">
        <Group align="flex-end" gap="sm" wrap="wrap">
          {deckSelect}
          <Button
            loading={busy === "join"}
            disabled={noDecks || (required && !deckId)}
            onClick={() => void run("join", "POST", { deckId })}
          >
            {t("hosted.join")}
          </Button>
        </Group>
        {noDecksHint}
      </Stack>
    </div>
  );
}

function PlayersList({ view, act }: { view: HostedTournamentViewDto; act: Act }) {
  const { t } = useI18n();
  const [busy, setBusy] = useState<string | null>(null);
  const { tournament, viewer } = view;

  if (view.players.length === 0) {
    return (
      <Text c="dimmed" size="sm">
        {t("hosted.noPlayers")}
      </Text>
    );
  }

  async function manage(entryId: string, action: string) {
    setBusy(`${entryId}:${action}`);
    await act(`entries/${entryId}`, "POST", { action });
    setBusy(null);
  }

  return (
    <Stack gap={6}>
      {view.players.map((player) => (
        <Group
          key={player.entryId}
          justify="space-between"
          wrap="nowrap"
          className={`rounded-lg border px-3 py-2 ${
            player.entryId === viewer.entryId
              ? "border-[var(--sb-accent)]"
              : "border-[var(--sb-line)]"
          } bg-[var(--sb-panel)]/85`}
        >
          <PlayerName player={player} highlight={player.entryId === viewer.entryId} />
          <Group gap="xs" wrap="nowrap">
            {tournament.status === "REGISTRATION" ? (
              <Badge size="sm" variant="light" color={player.hasDeck ? "teal" : "gray"}>
                {player.hasDeck ? t("hosted.hasList") : t("hosted.noList")}
              </Badge>
            ) : null}
            {viewer.isOrganizer && tournament.status === "REGISTRATION" ? (
              <Button
                size="compact-xs"
                variant="subtle"
                color="red"
                loading={busy === `${player.entryId}:remove`}
                onClick={() => void manage(player.entryId, "remove")}
              >
                {t("hosted.remove")}
              </Button>
            ) : null}
            {viewer.isOrganizer && tournament.status === "IN_PROGRESS" ? (
              player.dropped ? (
                <Button
                  size="compact-xs"
                  variant="subtle"
                  loading={busy === `${player.entryId}:reinstate`}
                  onClick={() => void manage(player.entryId, "reinstate")}
                >
                  {t("hosted.reinstate")}
                </Button>
              ) : (
                <Button
                  size="compact-xs"
                  variant="subtle"
                  color="red"
                  loading={busy === `${player.entryId}:drop`}
                  onClick={() => void manage(player.entryId, "drop")}
                >
                  {t("hosted.dropPlayer")}
                </Button>
              )
            ) : null}
          </Group>
        </Group>
      ))}
    </Stack>
  );
}
