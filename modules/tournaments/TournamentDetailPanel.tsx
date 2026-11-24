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
  MatchResultValue,
  TournamentDetailDto,
  TournamentMatchSummaryDto,
} from "./types";

const RESULT_LABELS: Record<MatchResultValue, string> = {
  WIN: "Vitória",
  LOSS: "Derrota",
  DRAW: "Empate",
  UNKNOWN: "Desconhecido",
};

async function readError(response: Response) {
  const data = (await response.json().catch(() => ({}))) as {
    error?: string;
  };
  return data.error ?? "Falha na operação de torneio.";
}

function toDateInput(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateTime(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("pt-BR");
}

export function TournamentDetailPanel({
  initialTournament,
  initialAttachableMatches,
}: {
  initialTournament: TournamentDetailDto;
  initialAttachableMatches: AttachableMatchDto[];
}) {
  const router = useRouter();
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
        label: `${m.deck.name} vs ${m.opponentArchetype?.name ?? "?"} · ${RESULT_LABELS[m.result]} · ${formatDateTime(m.playedAt)}`,
      })),
    [attachable],
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
        setError(await readError(response));
        setPending(false);
        return;
      }
      const data = (await response.json()) as {
        tournament: TournamentDetailDto;
      };
      setTournament(data.tournament);
      setMessage("Torneio atualizado.");
      setPending(false);
      startTransition(() => router.refresh());
    } catch {
      setError("Não foi possível salvar o torneio.");
      setPending(false);
    }
  }

  async function onAttach(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    if (!matchId) {
      setError("Selecione uma partida.");
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
        setError(await readError(response));
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
      setMessage("Partida vinculada.");
      setPending(false);
      startTransition(() => router.refresh());
    } catch {
      setError("Não foi possível vincular a partida.");
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
        setError(await readError(response));
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
      setError("Não foi possível atualizar a rodada.");
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
        setError(await readError(response));
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
      setMessage("Partida desvinculada.");
      setPending(false);
      startTransition(() => router.refresh());
    } catch {
      setError("Não foi possível desvincular a partida.");
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
        setError(await readError(response));
        setPending(false);
        return;
      }
      router.push("/tournaments");
      startTransition(() => router.refresh());
    } catch {
      setError("Não foi possível excluir o torneio.");
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
            ← Torneios
          </Text>
          <Title order={2} mt={4}>
            {tournament.name}
          </Title>
        </div>
        <Button color="red" variant="light" loading={pending} onClick={() => void onDelete()}>
          Excluir
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
          <Text fw={600}>Dados do torneio</Text>
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            <TextInput
              label="Nome"
              required
              value={name}
              onChange={(e) => setName(e.currentTarget.value)}
            />
            <TextInput
              label="Data"
              type="date"
              value={date}
              onChange={(e) => setDate(e.currentTarget.value)}
            />
          </SimpleGrid>
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            <TextInput
              label="Local"
              value={location}
              onChange={(e) => setLocation(e.currentTarget.value)}
            />
            <Select
              label="Formato"
              clearable
              data={formats.map((f) => ({ value: f.id, label: f.name }))}
              value={formatId}
              onChange={setFormatId}
            />
          </SimpleGrid>
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            <NumberInput
              label="Colocação"
              min={1}
              value={placement}
              onChange={(value) =>
                setPlacement(typeof value === "number" ? value : "")
              }
            />
            <NumberInput
              label="Participantes"
              min={1}
              value={participantCount}
              onChange={(value) =>
                setParticipantCount(typeof value === "number" ? value : "")
              }
            />
          </SimpleGrid>
          <Group justify="flex-end">
            <Button type="submit" loading={pending}>
              Salvar
            </Button>
          </Group>
        </Stack>
      </form>

      <form onSubmit={onAttach}>
        <Stack
          gap="sm"
          className="rounded-xl border border-[var(--sb-line)] bg-[var(--sb-panel)]/80 px-4 py-4"
        >
          <Text fw={600}>Anexar partida existente</Text>
          <Text size="sm" c="dimmed">
            Só partidas sem torneio. O battle log não é reimportado — apenas o vínculo TournamentMatch.
          </Text>
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md" className="items-end">
            <Select
              label="Partida"
              searchable
              clearable
              data={matchOptions}
              value={matchId}
              onChange={setMatchId}
              nothingFoundMessage="Nenhuma partida disponível"
            />
            <NumberInput
              label="Rodada"
              min={0}
              value={round}
              onChange={(value) =>
                setRound(typeof value === "number" ? value : "")
              }
            />
            <Button type="submit" loading={pending} disabled={!matchId}>
              Anexar
            </Button>
          </SimpleGrid>
        </Stack>
      </form>

      <Stack gap="sm">
        <Text fw={600}>
          Partidas ({tournament.tournamentMatches.length})
        </Text>
        {tournament.tournamentMatches.length === 0 ? (
          <Text size="sm" c="dimmed">
            Nenhuma partida vinculada ainda.
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
                    {RESULT_LABELS[linked.match.result]}
                  </Badge>
                  {linked.round != null ? (
                    <Badge variant="outline">R{linked.round}</Badge>
                  ) : (
                    <Badge variant="outline" color="gray">
                      Sem rodada
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
                  label="Rodada"
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
                  aria-label="Desvincular partida"
                  disabled={pending}
                  onClick={() => void onDetach(linked)}
                >
                  Remover
                </Button>
              </Group>
            </Group>
          ))
        )}
      </Stack>
    </Stack>
  );
}
