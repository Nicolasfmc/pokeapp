"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState, startTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Group,
  NumberInput,
  Select,
  Stack,
  Text,
  TextInput,
  Title,
  Badge,
  SimpleGrid,
} from "@mantine/core";
import type { FormatOption, TournamentListItemDto } from "./types";

async function readError(response: Response) {
  const data = (await response.json().catch(() => ({}))) as {
    error?: string;
  };
  return data.error ?? "Falha na operação de torneio.";
}

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("pt-BR");
}

export function TournamentListPanel({
  initialTournaments,
}: {
  initialTournaments: TournamentListItemDto[];
}) {
  const router = useRouter();
  const [tournaments, setTournaments] = useState(initialTournaments);
  const [formats, setFormats] = useState<FormatOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [location, setLocation] = useState("");
  const [formatId, setFormatId] = useState<string | null>(null);
  const [placement, setPlacement] = useState<number | "">("");
  const [participantCount, setParticipantCount] = useState<number | "">("");

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

  async function onCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      const response = await fetch("/api/tournaments", {
        method: "POST",
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
        tournament: TournamentListItemDto & { tournamentMatches?: unknown[] };
      };
      const item: TournamentListItemDto = {
        id: data.tournament.id,
        userId: data.tournament.userId,
        name: data.tournament.name,
        date: data.tournament.date,
        location: data.tournament.location,
        formatId: data.tournament.formatId,
        format: data.tournament.format,
        placement: data.tournament.placement,
        participantCount: data.tournament.participantCount,
        matchCount: Array.isArray(data.tournament.tournamentMatches)
          ? data.tournament.tournamentMatches.length
          : 0,
        createdAt: data.tournament.createdAt,
        updatedAt: data.tournament.updatedAt,
      };
      setTournaments((prev) => [item, ...prev]);
      setName("");
      setDate("");
      setLocation("");
      setFormatId(null);
      setPlacement("");
      setParticipantCount("");
      setPending(false);
      startTransition(() => router.refresh());
      router.push(`/tournaments/${item.id}`);
    } catch {
      setError("Não foi possível criar o torneio.");
      setPending(false);
    }
  }

  async function onDelete(tournamentId: string) {
    setError(null);
    setPendingId(tournamentId);
    try {
      const response = await fetch(`/api/tournaments/${tournamentId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        setError(await readError(response));
        setPendingId(null);
        return;
      }
      setTournaments((prev) => prev.filter((t) => t.id !== tournamentId));
      setPendingId(null);
      startTransition(() => router.refresh());
    } catch {
      setError("Não foi possível excluir o torneio.");
      setPendingId(null);
    }
  }

  return (
    <Stack gap="lg" className="max-w-5xl animate-[poke-rise_0.45s_ease-out]">
      <div>
        <Title order={2}>Torneios</Title>
        <Text c="dimmed" size="sm" mt={4}>
          Registre eventos e vincule partidas já importadas por rodada.
        </Text>
      </div>

      {error ? (
        <Text c="red" size="sm">
          {error}
        </Text>
      ) : null}

      <form onSubmit={onCreate}>
        <Stack
          gap="sm"
          className="rounded-xl border border-[var(--poke-line)] bg-[var(--poke-panel)]/80 px-4 py-4"
        >
          <Text fw={600}>Novo torneio</Text>
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
              Criar torneio
            </Button>
          </Group>
        </Stack>
      </form>

      {tournaments.length === 0 ? (
        <Stack
          gap="sm"
          className="rounded-xl border border-[var(--poke-line)] bg-[var(--poke-panel)]/80 px-6 py-10"
        >
          <Text fw={600}>Nenhum torneio ainda</Text>
          <Text c="dimmed" size="sm">
            Crie um torneio acima e depois anexe partidas de training.
          </Text>
        </Stack>
      ) : (
        <Stack gap="sm">
          {tournaments.map((tournament) => (
            <Group
              key={tournament.id}
              justify="space-between"
              align="center"
              wrap="nowrap"
              className="rounded-xl border border-[var(--poke-line)] bg-[var(--poke-panel)]/85 px-4 py-3 transition-colors hover:border-[var(--poke-accent)]"
            >
              <Stack gap={4} style={{ minWidth: 0, flex: 1 }}>
                <Group gap="sm" wrap="wrap">
                  <Text
                    component={Link}
                    href={`/tournaments/${tournament.id}`}
                    fw={700}
                    className="text-[var(--poke-ink)] no-underline hover:underline"
                  >
                    {tournament.name}
                  </Text>
                  {tournament.format ? (
                    <Badge variant="light">{tournament.format.name}</Badge>
                  ) : null}
                  {tournament.placement != null ? (
                    <Badge variant="outline">#{tournament.placement}</Badge>
                  ) : null}
                </Group>
                <Text size="sm" c="dimmed">
                  {formatDate(tournament.date)}
                  {tournament.location ? ` · ${tournament.location}` : ""}
                  {tournament.participantCount != null
                    ? ` · ${tournament.participantCount} jogadores`
                    : ""}
                  {` · ${tournament.matchCount} partida${tournament.matchCount === 1 ? "" : "s"}`}
                </Text>
              </Stack>
              <Group gap="xs" wrap="nowrap">
                <Button
                  component={Link}
                  href={`/tournaments/${tournament.id}`}
                  variant="light"
                  size="compact-sm"
                >
                  Abrir
                </Button>
                <Button
                  variant="subtle"
                  color="red"
                  size="compact-sm"
                  aria-label={`Excluir ${tournament.name}`}
                  loading={pendingId === tournament.id}
                  onClick={() => void onDelete(tournament.id)}
                >
                  Excluir
                </Button>
              </Group>
            </Group>
          ))}
        </Stack>
      )}
    </Stack>
  );
}
