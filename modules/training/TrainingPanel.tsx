"use client";

import { FormEvent, useMemo, useState, startTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ActionIcon,
  Badge,
  Button,
  Group,
  Select,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title,
} from "@mantine/core";
import type {
  ArchetypeDto,
  DeckOption,
  MatchDto,
  MatchResultValue,
  TurnOrderValue,
} from "./types";

const RESULT_LABELS: Record<MatchResultValue, string> = {
  WIN: "Vitória",
  LOSS: "Derrota",
  DRAW: "Empate",
  UNKNOWN: "Desconhecido",
};

const TURN_LABELS: Record<TurnOrderValue, string> = {
  FIRST: "1º",
  SECOND: "2º",
};

const RESULT_OPTIONS = [
  { value: "WIN", label: "Vitória" },
  { value: "LOSS", label: "Derrota" },
  { value: "DRAW", label: "Empate" },
  { value: "UNKNOWN", label: "Desconhecido" },
];

const TURN_OPTIONS = [
  { value: "FIRST", label: "Primeiro" },
  { value: "SECOND", label: "Segundo" },
];

async function readError(response: Response) {
  const data = (await response.json().catch(() => ({}))) as {
    error?: string;
  };
  return data.error ?? "Falha na operação de training.";
}

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("pt-BR");
}

export function TrainingPanel({
  initialMatches,
  decks,
  initialArchetypes,
  defaultViewerName,
}: {
  initialMatches: MatchDto[];
  decks: DeckOption[];
  initialArchetypes: ArchetypeDto[];
  defaultViewerName: string;
}) {
  const router = useRouter();
  const [matches, setMatches] = useState(initialMatches);
  const [archetypes, setArchetypes] = useState(initialArchetypes);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const [rawLog, setRawLog] = useState("");
  const [viewerName, setViewerName] = useState(defaultViewerName);
  const [deckId, setDeckId] = useState<string | null>(
    decks[0]?.id ?? null,
  );
  const [opponentArchetypeId, setOpponentArchetypeId] = useState<string | null>(
    null,
  );
  const [newArchetypeName, setNewArchetypeName] = useState("");
  const [notes, setNotes] = useState("");
  const [playedAt, setPlayedAt] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDeckId, setEditDeckId] = useState<string | null>(null);
  const [editArchetypeId, setEditArchetypeId] = useState<string | null>(null);
  const [editResult, setEditResult] = useState<string | null>(null);
  const [editTurnOrder, setEditTurnOrder] = useState<string | null>(null);
  const [editNotes, setEditNotes] = useState("");

  const deckOptions = useMemo(
    () =>
      decks.map((deck) => ({
        value: deck.id,
        label: `${deck.name} (${deck.formatName})`,
      })),
    [decks],
  );

  const archetypeOptions = useMemo(
    () =>
      archetypes.map((item) => ({
        value: item.id,
        label: item.name,
      })),
    [archetypes],
  );

  async function ensureArchetype(): Promise<string | null> {
    if (opponentArchetypeId) return opponentArchetypeId;
    const name = newArchetypeName.trim();
    if (!name) return null;

    const existing = archetypes.find(
      (item) => item.name.toLowerCase() === name.toLowerCase(),
    );
    if (existing) return existing.id;

    const response = await fetch("/api/training/archetypes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!response.ok) {
      throw new Error(await readError(response));
    }
    const data = (await response.json()) as { archetype: ArchetypeDto };
    setArchetypes((prev) =>
      [...prev, data.archetype].sort((a, b) => a.name.localeCompare(b.name)),
    );
    setOpponentArchetypeId(data.archetype.id);
    setNewArchetypeName("");
    return data.archetype.id;
  }

  async function onImport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    if (!deckId) {
      setError("Selecione um deck.");
      return;
    }
    if (!rawLog.trim()) {
      setError("Cole o battle log do TCG Live.");
      return;
    }
    if (!viewerName.trim()) {
      setError("Informe o viewerName (nome no log).");
      return;
    }

    setPending(true);
    try {
      const archetypeId = await ensureArchetype();
      const response = await fetch("/api/training/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rawLog,
          deckId,
          viewerName: viewerName.trim(),
          opponentArchetypeId: archetypeId,
          notes: notes.trim() || null,
          playedAt: playedAt.trim() || null,
        }),
      });
      const data = (await response.json()) as {
        match?: MatchDto;
        parseOk?: boolean;
        error?: string;
      };
      if (!response.ok || !data.match) {
        setError(data.error ?? "Falha ao importar log.");
        setPending(false);
        return;
      }

      setMatches((prev) => [data.match!, ...prev]);
      setRawLog("");
      setNotes("");
      setPlayedAt("");
      setMessage(
        data.parseOk === false
          ? "Match criado com avisos no parse."
          : "Match importado.",
      );
      setPending(false);
      startTransition(() => router.refresh());
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Não foi possível importar o log.",
      );
      setPending(false);
    }
  }

  function startEdit(match: MatchDto) {
    setEditingId(match.id);
    setEditDeckId(match.deckId);
    setEditArchetypeId(match.opponentArchetypeId);
    setEditResult(match.result);
    setEditTurnOrder(match.turnOrder);
    setEditNotes(match.notes ?? "");
    setError(null);
    setMessage(null);
  }

  async function onSaveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingId) return;
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/matches/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deckId: editDeckId,
          opponentArchetypeId: editArchetypeId,
          result: editResult,
          turnOrder: editTurnOrder,
          notes: editNotes.trim() || null,
        }),
      });
      const data = (await response.json()) as {
        match?: MatchDto;
        error?: string;
      };
      if (!response.ok || !data.match) {
        setError(data.error ?? "Falha ao atualizar match.");
        setPending(false);
        return;
      }
      setMatches((prev) =>
        prev.map((item) => (item.id === data.match!.id ? data.match! : item)),
      );
      setEditingId(null);
      setMessage("Match atualizado.");
      setPending(false);
      startTransition(() => router.refresh());
    } catch {
      setError("Não foi possível atualizar o match.");
      setPending(false);
    }
  }

  async function onDelete(matchId: string) {
    setError(null);
    setMessage(null);
    setPending(true);
    try {
      const response = await fetch(`/api/matches/${matchId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        setError(await readError(response));
        setPending(false);
        return;
      }
      setMatches((prev) => prev.filter((item) => item.id !== matchId));
      if (editingId === matchId) setEditingId(null);
      setPending(false);
      startTransition(() => router.refresh());
    } catch {
      setError("Não foi possível excluir o match.");
      setPending(false);
    }
  }

  return (
    <Stack gap="xl" className="max-w-5xl animate-[poke-rise_0.45s_ease-out]">
      <div>
        <Title order={2}>Training</Title>
        <Text c="dimmed" size="sm" mt={4}>
          Importe battle logs do TCG Live. O raw_log fica imutável; result e
          turn_order usam viewerName.
        </Text>
      </div>

      {error ? (
        <Text c="red" size="sm">
          {error}
        </Text>
      ) : null}
      {message ? (
        <Text c="teal" size="sm">
          {message}
        </Text>
      ) : null}

      <form onSubmit={onImport}>
        <Stack
          gap="md"
          className="rounded-xl border border-[var(--poke-line)] bg-[var(--poke-panel)]/85 px-4 py-5"
        >
          <Title order={4}>Importar battle log</Title>
          <Textarea
            label="Battle log (TCG Live)"
            minRows={8}
            value={rawLog}
            onChange={(event) => setRawLog(event.currentTarget.value)}
            required
            styles={{ input: { fontFamily: "var(--font-ibm-plex-mono)" } }}
          />
          <Group grow align="flex-start">
            <TextInput
              label="viewerName (nome no log)"
              description="Necessário para WIN/LOSS e FIRST/SECOND"
              value={viewerName}
              onChange={(event) => setViewerName(event.currentTarget.value)}
              required
            />
            <Select
              label="Meu deck"
              data={deckOptions}
              value={deckId}
              onChange={setDeckId}
              searchable
              nothingFoundMessage="Nenhum deck"
              required
            />
          </Group>
          <Group grow align="flex-start">
            <Select
              label="Arquétipo do oponente"
              data={archetypeOptions}
              value={opponentArchetypeId}
              onChange={setOpponentArchetypeId}
              searchable
              clearable
              nothingFoundMessage="Nenhum arquétipo"
            />
            <TextInput
              label="Ou criar arquétipo"
              placeholder="Ex.: Dragapult"
              value={newArchetypeName}
              onChange={(event) =>
                setNewArchetypeName(event.currentTarget.value)
              }
            />
          </Group>
          <Group grow align="flex-start">
            <TextInput
              label="Jogada em (ISO opcional)"
              placeholder="2026-09-09T15:00:00.000Z"
              value={playedAt}
              onChange={(event) => setPlayedAt(event.currentTarget.value)}
            />
            <TextInput
              label="Notas"
              value={notes}
              onChange={(event) => setNotes(event.currentTarget.value)}
            />
          </Group>
          <Text size="xs" c="dimmed">
            gameFormatCode do log (ex.: TEF-PBL) é preservado e não é o Format
            interno do deck.
          </Text>
          <Group>
            <Button type="submit" loading={pending} disabled={decks.length === 0}>
              Importar e criar Match
            </Button>
            {decks.length === 0 ? (
              <Text size="sm" c="dimmed">
                Crie um deck antes de importar.
              </Text>
            ) : null}
          </Group>
        </Stack>
      </form>

      <Stack gap="sm">
        <Title order={4}>Histórico de matches</Title>
        {matches.length === 0 ? (
          <Stack
            gap="sm"
            className="rounded-xl border border-[var(--poke-line)] bg-[var(--poke-panel)]/80 px-6 py-10"
          >
            <Text fw={600}>Nenhuma partida ainda</Text>
            <Text c="dimmed" size="sm">
              Cole um log do TCG Live acima para registrar a primeira partida.
            </Text>
          </Stack>
        ) : (
          matches.map((match) => (
            <Stack
              key={match.id}
              gap="sm"
              className="rounded-xl border border-[var(--poke-line)] bg-[var(--poke-panel)]/85 px-4 py-3"
            >
              <Group justify="space-between" align="flex-start" wrap="wrap">
                <Stack gap={4} style={{ minWidth: 0, flex: 1 }}>
                  <Group gap="sm" wrap="wrap">
                    <Text fw={700}>{match.deck.name}</Text>
                    <Badge
                      variant="light"
                      color={
                        match.result === "WIN"
                          ? "teal"
                          : match.result === "LOSS"
                            ? "red"
                            : "gray"
                      }
                    >
                      {RESULT_LABELS[match.result]}
                    </Badge>
                    {match.turnOrder ? (
                      <Badge variant="outline" color="ink">
                        {TURN_LABELS[match.turnOrder]}
                      </Badge>
                    ) : null}
                    {match.gameFormatCode ? (
                      <Badge variant="dot" color="ember">
                        {match.gameFormatCode}
                      </Badge>
                    ) : null}
                  </Group>
                  <Text size="sm" c="dimmed">
                    vs{" "}
                    {match.opponentArchetype?.name ?? "arquétipo não definido"}
                    {" · "}
                    {formatDate(match.playedAt ?? match.createdAt)}
                    {match.battleLog
                      ? ` · parser ${match.battleLog.parserVersion}`
                      : ""}
                  </Text>
                  {match.notes ? (
                    <Text size="sm">{match.notes}</Text>
                  ) : null}
                </Stack>
                <Group gap="xs" wrap="nowrap">
                  <Button
                    variant="subtle"
                    size="compact-sm"
                    onClick={() => startEdit(match)}
                  >
                    Editar
                  </Button>
                  <ActionIcon
                    variant="subtle"
                    color="red"
                    aria-label="Excluir match"
                    onClick={() => onDelete(match.id)}
                    disabled={pending}
                  >
                    ×
                  </ActionIcon>
                </Group>
              </Group>

              {editingId === match.id ? (
                <form onSubmit={onSaveEdit}>
                  <Stack
                    gap="sm"
                    className="rounded-lg border border-[var(--poke-line)] bg-[var(--poke-bg)]/40 px-3 py-3"
                  >
                    <Group grow>
                      <Select
                        label="Deck"
                        data={deckOptions}
                        value={editDeckId}
                        onChange={setEditDeckId}
                        searchable
                      />
                      <Select
                        label="Arquétipo oponente"
                        data={archetypeOptions}
                        value={editArchetypeId}
                        onChange={setEditArchetypeId}
                        searchable
                        clearable
                      />
                    </Group>
                    <Group grow>
                      <Select
                        label="Resultado"
                        data={RESULT_OPTIONS}
                        value={editResult}
                        onChange={setEditResult}
                      />
                      <Select
                        label="Ordem"
                        data={TURN_OPTIONS}
                        value={editTurnOrder}
                        onChange={setEditTurnOrder}
                        clearable
                      />
                    </Group>
                    <TextInput
                      label="Notas"
                      value={editNotes}
                      onChange={(event) =>
                        setEditNotes(event.currentTarget.value)
                      }
                    />
                    <Group>
                      <Button type="submit" size="compact-sm" loading={pending}>
                        Salvar
                      </Button>
                      <Button
                        type="button"
                        size="compact-sm"
                        variant="subtle"
                        onClick={() => setEditingId(null)}
                      >
                        Cancelar
                      </Button>
                    </Group>
                  </Stack>
                </form>
              ) : null}
            </Stack>
          ))
        )}
      </Stack>
    </Stack>
  );
}
