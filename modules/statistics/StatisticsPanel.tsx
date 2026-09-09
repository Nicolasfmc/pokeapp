"use client";

import { useState, startTransition } from "react";
import {
  Alert,
  Badge,
  Button,
  Group,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import type {
  RecordStats,
  StatisticsFilterOptions,
  StatisticsFilters,
  StatisticsSummary,
} from "./types";

function formatWinRate(winRate: number | null) {
  if (winRate === null) return "—";
  return `${(winRate * 100).toFixed(1)}%`;
}

function formatRecord(stats: RecordStats) {
  return `${stats.wins}W / ${stats.losses}L / ${stats.draws}D`;
}

function buildQuery(filters: StatisticsFilters) {
  const params = new URLSearchParams();
  if (filters.deckId) params.set("deckId", filters.deckId);
  if (filters.opponentArchetypeId) {
    params.set("opponentArchetypeId", filters.opponentArchetypeId);
  }
  if (filters.gameFormatCode) {
    params.set("gameFormatCode", filters.gameFormatCode);
  }
  if (filters.tournamentId) params.set("tournamentId", filters.tournamentId);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  const query = params.toString();
  return query ? `?${query}` : "";
}

function turnLabel(value: string) {
  if (value === "FIRST") return "Primeiro";
  if (value === "SECOND") return "Segundo";
  return "Indefinido";
}

export function StatisticsPanel({
  initialSummary,
  filterOptions,
}: {
  initialSummary: StatisticsSummary;
  filterOptions: StatisticsFilterOptions;
}) {
  const [summary, setSummary] = useState(initialSummary);
  const [deckId, setDeckId] = useState<string | null>(
    initialSummary.filters.deckId ?? null,
  );
  const [opponentArchetypeId, setOpponentArchetypeId] = useState<string | null>(
    initialSummary.filters.opponentArchetypeId ?? null,
  );
  const [gameFormatCode, setGameFormatCode] = useState<string | null>(
    initialSummary.filters.gameFormatCode ?? null,
  );
  const [tournamentId, setTournamentId] = useState<string | null>(
    initialSummary.filters.tournamentId ?? null,
  );
  const [from, setFrom] = useState(initialSummary.filters.from ?? "");
  const [to, setTo] = useState(initialSummary.filters.to ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const deckOptions = filterOptions.decks.map((deck) => ({
    value: deck.id,
    label: deck.name,
  }));
  const archetypeOptions = filterOptions.archetypes.map((item) => ({
    value: item.id,
    label: item.name,
  }));
  const formatOptions = filterOptions.gameFormatCodes.map((code) => ({
    value: code,
    label: code,
  }));
  const tournamentOptions = filterOptions.tournaments.map((item) => ({
    value: item.id,
    label: item.name,
  }));

  async function loadSummary(filters: StatisticsFilters) {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/statistics${buildQuery(filters)}`);
      const data = (await response.json().catch(() => ({}))) as StatisticsSummary & {
        error?: string;
      };
      if (!response.ok) {
        setError(data.error ?? "Falha ao carregar estatísticas.");
        return;
      }
      startTransition(() => {
        setSummary(data);
      });
    } catch (err) {
      console.error(err);
      setError("Falha ao carregar estatísticas.");
    } finally {
      setPending(false);
    }
  }

  function currentFilters(): StatisticsFilters {
    const filters: StatisticsFilters = {};
    if (deckId) filters.deckId = deckId;
    if (opponentArchetypeId) filters.opponentArchetypeId = opponentArchetypeId;
    if (gameFormatCode) filters.gameFormatCode = gameFormatCode;
    if (tournamentId) filters.tournamentId = tournamentId;
    if (from.trim()) filters.from = from.trim();
    if (to.trim()) filters.to = to.trim();
    return filters;
  }

  function clearFilters() {
    setDeckId(null);
    setOpponentArchetypeId(null);
    setGameFormatCode(null);
    setTournamentId(null);
    setFrom("");
    setTo("");
    void loadSummary({});
  }

  const overall = summary.overall;

  return (
    <Stack gap="lg">
      <div>
        <Title order={2}>Estatísticas</Title>
        <Text c="dimmed" size="sm">
          Agregações a partir dos Matches persistidos. Win rate = W / (W + L);
          empates e UNKNOWN ficam fora do denominador.
        </Text>
      </div>

      {error ? (
        <Alert color="red" title="Erro" onClose={() => setError(null)} withCloseButton>
          {error}
        </Alert>
      ) : null}

      <Stack gap="sm">
        <Title order={4}>Filtros</Title>
        <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="sm">
          <Select
            label="Deck"
            placeholder="Todos"
            clearable
            data={deckOptions}
            value={deckId}
            onChange={setDeckId}
          />
          <Select
            label="Arquétipo adversário"
            placeholder="Todos"
            clearable
            searchable
            data={archetypeOptions}
            value={opponentArchetypeId}
            onChange={setOpponentArchetypeId}
          />
          <Select
            label="Código de formato"
            placeholder="Todos"
            clearable
            searchable
            data={formatOptions}
            value={gameFormatCode}
            onChange={setGameFormatCode}
          />
          <Select
            label="Torneio"
            placeholder="Todos"
            clearable
            data={tournamentOptions}
            value={tournamentId}
            onChange={setTournamentId}
            disabled={tournamentOptions.length === 0}
          />
          <TextInput
            label="De"
            type="date"
            value={from}
            onChange={(event) => setFrom(event.currentTarget.value)}
          />
          <TextInput
            label="Até"
            type="date"
            value={to}
            onChange={(event) => setTo(event.currentTarget.value)}
          />
        </SimpleGrid>
        <Group>
          <Button
            loading={pending}
            onClick={() => void loadSummary(currentFilters())}
          >
            Aplicar
          </Button>
          <Button variant="default" disabled={pending} onClick={clearFilters}>
            Limpar
          </Button>
        </Group>
      </Stack>

      <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="md">
        <Stack gap={4}>
          <Text size="sm" c="dimmed">
            Partidas
          </Text>
          <Text fw={700} size="xl">
            {overall.matches}
          </Text>
        </Stack>
        <Stack gap={4}>
          <Text size="sm" c="dimmed">
            Placar
          </Text>
          <Group gap="xs">
            <Badge color="green">{overall.wins}W</Badge>
            <Badge color="red">{overall.losses}L</Badge>
            <Badge color="gray">{overall.draws}D</Badge>
            {overall.unknowns > 0 ? (
              <Badge color="yellow">{overall.unknowns}?</Badge>
            ) : null}
          </Group>
        </Stack>
        <Stack gap={4}>
          <Text size="sm" c="dimmed">
            Win rate
          </Text>
          <Text fw={700} size="xl">
            {formatWinRate(overall.winRate)}
          </Text>
        </Stack>
        <Stack gap={4}>
          <Text size="sm" c="dimmed">
            Decididas (W+L)
          </Text>
          <Text fw={700} size="xl">
            {overall.wins + overall.losses}
          </Text>
        </Stack>
      </SimpleGrid>

      <Stack gap="xs">
        <Title order={4}>Por deck</Title>
        {summary.byDeck.length === 0 ? (
          <Text c="dimmed" size="sm">
            Nenhuma partida no filtro atual.
          </Text>
        ) : (
          <Table striped highlightOnHover withTableBorder>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Deck</Table.Th>
                <Table.Th>Partidas</Table.Th>
                <Table.Th>Placar</Table.Th>
                <Table.Th>Win rate</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {summary.byDeck.map((row) => (
                <Table.Tr key={row.deckId}>
                  <Table.Td>{row.deckName}</Table.Td>
                  <Table.Td>{row.matches}</Table.Td>
                  <Table.Td>{formatRecord(row)}</Table.Td>
                  <Table.Td>{formatWinRate(row.winRate)}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Stack>

      <Stack gap="xs">
        <Title order={4}>Matchup por arquétipo</Title>
        {summary.byMatchup.length === 0 ? (
          <Text c="dimmed" size="sm">
            Nenhuma partida no filtro atual.
          </Text>
        ) : (
          <Table striped highlightOnHover withTableBorder>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Adversário</Table.Th>
                <Table.Th>Partidas</Table.Th>
                <Table.Th>Placar</Table.Th>
                <Table.Th>Win rate</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {summary.byMatchup.map((row) => (
                <Table.Tr key={row.opponentArchetypeId ?? "__none__"}>
                  <Table.Td>
                    {row.opponentArchetypeName ?? "Arquétipo não definido"}
                  </Table.Td>
                  <Table.Td>{row.matches}</Table.Td>
                  <Table.Td>{formatRecord(row)}</Table.Td>
                  <Table.Td>{formatWinRate(row.winRate)}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Stack>

      <Stack gap="xs">
        <Title order={4}>Por ordem de turno</Title>
        {summary.byTurnOrder.length === 0 ? (
          <Text c="dimmed" size="sm">
            Nenhuma partida no filtro atual.
          </Text>
        ) : (
          <Table striped highlightOnHover withTableBorder>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Turno</Table.Th>
                <Table.Th>Partidas</Table.Th>
                <Table.Th>Placar</Table.Th>
                <Table.Th>Win rate</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {summary.byTurnOrder.map((row) => (
                <Table.Tr key={row.turnOrder}>
                  <Table.Td>{turnLabel(row.turnOrder)}</Table.Td>
                  <Table.Td>{row.matches}</Table.Td>
                  <Table.Td>{formatRecord(row)}</Table.Td>
                  <Table.Td>{formatWinRate(row.winRate)}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Stack>
    </Stack>
  );
}
