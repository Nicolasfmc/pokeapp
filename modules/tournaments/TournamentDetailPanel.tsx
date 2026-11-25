"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState, startTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Badge,
  Button,
  Group,
  NumberInput,
  Select,
  Stack,
  Text,
  TextInput,
  Title,
  SimpleGrid,
} from "@mantine/core";
import type {
  AttachableMatchDto,
  FormatOption,
  TournamentDetailDto,
  TournamentMatchSummaryDto,
} from "./types";
import { useI18n } from "@/lib/i18n/I18nProvider";

async function readError(response: Response) {
  const data = (await response.json().catch(() => ({}))) as {
    error?: string;
  };
  return data.error;
}

function toDateInput(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}


export function TournamentDetailPanel({
  initialTournament,
  initialAttachableMatches,
}: {
  initialTournament: TournamentDetailDto;
  initialAttachableMatches: AttachableMatchDto[];
}) {
  const router = useRouter();
  const { t, te, tEnum, formatDateTime: fmtDateTime } = useI18n();
  const failMessage = async (response: Response) =>
    te(await readError(response)) ?? t("tournaments.opFailed");
  const formatDateTime = (value: string | null) =>
    !value || Number.isNaN(new Date(value).getTime()) ? "—" : fmtDateTime(value);
  const [tournament, setTournament] = useState(initialTournament);
  const [attachable, setAttachable] = useState(initialAttachableMatches);
  const [formats, setFormats] = useState<FormatOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const [name, setName] = useState(initialTournament.name);
  const [date, setDate] = useState(toDateInput(initialTournament.date));
  const [location, setLocation] = useState(initialTournament.location ?? "");
  const [formatId, setFormatId] = useState<string | null>(
    initialTournament.formatId,
  );
  const [placement, setPlacement] = useState<number | "">(
    initialTournament.placement ?? "",
  );
  const [participantCount, setParticipantCount] = useState<number | "">(
    initialTournament.participantCount ?? "",
  );

  const [matchId, setMatchId] = useState<string | null>(null);
  const [round, setRound] = useState<number | "">("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/decks/formats");
        if (!response.ok) return;
        const data = (await response.json()) as {
          formats?: FormatOption[];
        };
        if (!cancelled) {
          setFormats(data.formats ?? []);
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const matchOptions = useMemo(
    () =>
      attachable.map((m) => ({
        value: m.id,
        label: `${m.deck.name} vs ${m.opponentArchetype?.name ?? "?"} · ${tEnum("matchResult", m.result)} · ${m.playedAt ? fmtDateTime(m.playedAt) : "—"}`,
      })),
    [attachable, tEnum, fmtDateTime],
  );

  async function onSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setPending(true);
    try {
      const response = await fetch(`/api/tournaments/${tournament.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          date: date || null,
          location: location || null,
          formatId: formatId || null,
          placement: placement === "" ? null : placement,
          participantCount: participantCount === "" ? null : participantCount,
        }),
      });
      if (!response.ok) {
        setError(await failMessage(response));
        setPending(false);
        return;
      }
      const data = (await response.json()) as {
        tournament: TournamentDetailDto;
      };
      setTournament(data.tournament);
      setMessage(t("tournaments.updated"));
      setPending(false);
      startTransition(() => router.refresh());
    } catch {
      setError(t("tournaments.saveError"));
      setPending(false);
    }
  }

  async function onAttach(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    if (!matchId) {
      setError(t("tournaments.pickMatch"));
      return;
    }
    setPending(true);
    try {
      const response = await fetch(
        `/api/tournaments/${tournament.id}/matches`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            matchId,
            round: round === "" ? null : round,
          }),
        },
      );
      if (!response.ok) {
        setError(await failMessage(response));
        setPending(false);
        return;
      }
      const data = (await response.json()) as {
        tournamentMatch: TournamentMatchSummaryDto;
      };
      setTournament((prev) => ({
        ...prev,
        tournamentMatches: [...prev.tournamentMatches, data.tournamentMatch].sort(
          (a, b) => {
            const ra = a.round ?? Number.POSITIVE_INFINITY;
            const rb = b.round ?? Number.POSITIVE_INFINITY;
            if (ra !== rb) return ra - rb;
            return a.id.localeCompare(b.id);
          },
        ),
      }));
      setAttachable((prev) => prev.filter((m) => m.id !== matchId));
      setMatchId(null);
      setRound("");
      setMessage(t("tournaments.linked"));
      setPending(false);
      startTransition(() => router.refresh());
    } catch {
      setError(t("tournaments.linkError"));
      setPending(false);
    }
  }

  async function onUpdateRound(
    linked: TournamentMatchSummaryDto,
    nextRound: number | null,
  ) {
    setError(null);
    setMessage(null);
    setPending(true);
    try {
      const response = await fetch(
        `/api/tournaments/${tournament.id}/matches/${linked.matchId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ round: nextRound }),
        },
      );
      if (!response.ok) {
        setError(await failMessage(response));
        setPending(false);
        return;
      }
      const data = (await response.json()) as {
        tournamentMatch: TournamentMatchSummaryDto;
      };
      setTournament((prev) => ({
        ...prev,
        tournamentMatches: prev.tournamentMatches
          .map((item) =>
            item.matchId === linked.matchId ? data.tournamentMatch : item,
          )
          .sort((a, b) => {
            const ra = a.round ?? Number.POSITIVE_INFINITY;
            const rb = b.round ?? Number.POSITIVE_INFINITY;
            if (ra !== rb) return ra - rb;
            return a.id.localeCompare(b.id);
          }),
      }));
      setPending(false);
      startTransition(() => router.refresh());
    } catch {
      setError(t("tournaments.roundError"));
      setPending(false);
    }
  }

  async function onDetach(linked: TournamentMatchSummaryDto) {
    setError(null);
    setMessage(null);
    setPending(true);
    try {
      const response = await fetch(
        `/api/tournaments/${tournament.id}/matches/${linked.matchId}`,
        { method: "DELETE" },
      );
      if (!response.ok) {
        setError(await failMessage(response));
        setPending(false);
        return;
      }
      setTournament((prev) => ({
        ...prev,
        tournamentMatches: prev.tournamentMatches.filter(
          (item) => item.matchId !== linked.matchId,
        ),
      }));
      setAttachable((prev) =>
        [
          ...prev,
          {
            id: linked.match.id,
            result: linked.match.result,
            turnOrder: linked.match.turnOrder,
            playedAt: linked.match.playedAt,
            notes: linked.match.notes,
            deck: linked.match.deck,
            opponentArchetype: linked.match.opponentArchetype,
          },
        ].sort((a, b) => {
          const ta = a.playedAt ? new Date(a.playedAt).getTime() : 0;
          const tb = b.playedAt ? new Date(b.playedAt).getTime() : 0;
          return tb - ta;
        }),
      );
      setMessage(t("tournaments.unlinked"));
      setPending(false);
      startTransition(() => router.refresh());
    } catch {
      setError(t("tournaments.unlinkError"));
      setPending(false);
    }
  }

  async function onDelete() {
    setError(null);
    setPending(true);
    try {
      const response = await fetch(`/api/tournaments/${tournament.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        setError(await failMessage(response));
        setPending(false);
        return;
      }
      router.push("/tournaments");
      startTransition(() => router.refresh());
    } catch {
      setError(t("tournaments.deleteError"));
      setPending(false);
    }
  }

  return (
    <Stack gap="lg" className="max-w-5xl animate-[sb-rise_0.45s_ease-out]">
      <Group justify="space-between" align="flex-end">
        <div>
          <Text
            component={Link}
            href="/tournaments"
            size="sm"
            c="dimmed"
            className="no-underline hover:underline"
          >
            {t("tournaments.back")}
          </Text>
          <Title order={2} mt={4}>
            {tournament.name}
          </Title>
        </div>
        <Button color="red" variant="light" loading={pending} onClick={() => void onDelete()}>
          {t("common.delete")}
        </Button>
      </Group>

      {error ? (
        <Text c="red" size="sm">
          {error}
        </Text>
      ) : null}
      {message ? (
        <Text c="green" size="sm">
          {message}
        </Text>
      ) : null}

      <form onSubmit={onSave}>
        <Stack
          gap="sm"
          className="rounded-xl border border-[var(--sb-line)] bg-[var(--sb-panel)]/80 px-4 py-4"
        >
          <Text fw={600}>{t("tournaments.details")}</Text>
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            <TextInput
              label={t("common.name")}
              required
              value={name}
              onChange={(e) => setName(e.currentTarget.value)}
            />
            <TextInput
              label={t("common.date")}
              type="date"
              value={date}
              onChange={(e) => setDate(e.currentTarget.value)}
            />
          </SimpleGrid>
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            <TextInput
              label={t("tournaments.location")}
              value={location}
              onChange={(e) => setLocation(e.currentTarget.value)}
            />
            <Select
              label={t("common.format")}
              clearable
              data={formats.map((f) => ({ value: f.id, label: tEnum("format", f.name) }))}
              value={formatId}
              onChange={setFormatId}
            />
          </SimpleGrid>
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            <NumberInput
              label={t("tournaments.placement")}
              min={1}
              value={placement}
              onChange={(value) =>
                setPlacement(typeof value === "number" ? value : "")
              }
            />
            <NumberInput
              label={t("tournaments.participants")}
              min={1}
              value={participantCount}
              onChange={(value) =>
                setParticipantCount(typeof value === "number" ? value : "")
              }
            />
          </SimpleGrid>
          <Group justify="flex-end">
            <Button type="submit" loading={pending}>
              {t("common.save")}
            </Button>
          </Group>
        </Stack>
      </form>

      <form onSubmit={onAttach}>
        <Stack
          gap="sm"
          className="rounded-xl border border-[var(--sb-line)] bg-[var(--sb-panel)]/80 px-4 py-4"
        >
          <Text fw={600}>{t("tournaments.attach")}</Text>
          <Text size="sm" c="dimmed">
            {t("tournaments.attachHint")}
          </Text>
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md" className="items-end">
            <Select
              label={t("tournaments.match")}
              searchable
              clearable
              data={matchOptions}
              value={matchId}
              onChange={setMatchId}
              nothingFoundMessage={t("tournaments.noAttachable")}
            />
            <NumberInput
              label={t("tournaments.round")}
              min={0}
              value={round}
              onChange={(value) =>
                setRound(typeof value === "number" ? value : "")
              }
            />
            <Button type="submit" loading={pending} disabled={!matchId}>
              {t("tournaments.attachButton")}
            </Button>
          </SimpleGrid>
        </Stack>
      </form>

      <Stack gap="sm">
        <Text fw={600}>
          {t("tournaments.matchesCount", { count: tournament.tournamentMatches.length })}
        </Text>
        {tournament.tournamentMatches.length === 0 ? (
          <Text size="sm" c="dimmed">
            {t("tournaments.noLinked")}
          </Text>
        ) : (
          tournament.tournamentMatches.map((linked) => (
            <Group
              key={linked.id}
              justify="space-between"
              align="center"
              wrap="wrap"
              className="rounded-xl border border-[var(--sb-line)] bg-[var(--sb-panel)]/85 px-4 py-3"
            >
              <Stack gap={4} style={{ minWidth: 0, flex: 1 }}>
                <Group gap="sm" wrap="wrap">
                  <Text fw={600}>
                    {linked.match.deck.name}
                    {" vs "}
                    {linked.match.opponentArchetype?.name ?? "—"}
                  </Text>
                  <Badge variant="light">
                    {tEnum("matchResult", linked.match.result)}
                  </Badge>
                  {linked.round != null ? (
                    <Badge variant="outline">R{linked.round}</Badge>
                  ) : (
                    <Badge variant="outline" color="gray">
                      {t("tournaments.noRound")}
                    </Badge>
                  )}
                </Group>
                <Text size="sm" c="dimmed">
                  {formatDateTime(linked.match.playedAt)}
                </Text>
              </Stack>
              <Group gap="xs" wrap="nowrap" align="flex-end">
                <NumberInput
                  size="xs"
                  w={90}
                  min={0}
                  label={t("tournaments.round")}
                  defaultValue={linked.round ?? undefined}
                  key={`${linked.id}-${linked.round ?? "none"}`}
                  onBlur={(event) => {
                    const raw = event.currentTarget.value.trim();
                    const next = raw === "" ? null : Number(raw);
                    if (raw !== "" && !Number.isInteger(next)) return;
                    if (next === linked.round) return;
                    void onUpdateRound(linked, next);
                  }}
                />
                <Button
                  variant="subtle"
                  color="red"
                  size="compact-sm"
                  aria-label={t("tournaments.unlinkAria")}
                  disabled={pending}
                  onClick={() => void onDetach(linked)}
                >
                  {t("common.remove")}
                </Button>
              </Group>
            </Group>
          ))
        )}
      </Stack>
    </Stack>
  );
}
