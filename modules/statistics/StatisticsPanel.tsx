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
import { useI18n } from "@/lib/i18n/I18nProvider";

function formatWinRate(winRate: number | null) {
  if (winRate === null) return "—";
  return `${(winRate * 100).toFixed(1)}%`;
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

export function StatisticsPanel({
  initialSummary,
  filterOptions,
}: {
  initialSummary: StatisticsSummary;
  filterOptions: StatisticsFilterOptions;
}) {
  const { t, te, tEnum } = useI18n();
  const formatRecord = (stats: RecordStats) =>
    t("stats.recordShort", { w: stats.wins, l: stats.losses, d: stats.draws });
  const turnLabel = (value: string) =>
    value === "FIRST" || value === "SECOND" ? tEnum("turnOrder", value) : t("stats.undefinedTurn");
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
        setError(te(data.error) ?? t("stats.loadFailed"));
        return;
      }
      startTransition(() => {
        setSummary(data);
      });
    } catch (err) {
      console.error(err);
      setError(t("stats.loadFailed"));
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
        <Title order={2}>{t("nav.statistics")}</Title>
        <Text c="dimmed" size="sm">
          {t("stats.subtitle")}
        </Text>
      </div>

      {error ? (
        <Alert color="red" title={t("common.error")} onClose={() => setError(null)} withCloseButton>
          {error}
        </Alert>
      ) : null}

      <Stack gap="sm">
        <Title order={4}>{t("stats.filters")}</Title>
        <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="sm">
          <Select
            label={t("stats.deck")}
            placeholder={t("common.all")}
            clearable
            data={deckOptions}
            value={deckId}
            onChange={setDeckId}
          />
          <Select
            label={t("stats.opponentArchetype")}
            placeholder={t("common.all")}
            clearable
            searchable
            data={archetypeOptions}
            value={opponentArchetypeId}
            onChange={setOpponentArchetypeId}
          />
          <Select
            label={t("stats.formatCode")}
            placeholder={t("common.all")}
            clearable
            searchable
            data={formatOptions}
            value={gameFormatCode}
            onChange={setGameFormatCode}
          />
          <Select
            label={t("stats.tournament")}
            placeholder={t("common.all")}
            clearable
            data={tournamentOptions}
            value={tournamentId}
            onChange={setTournamentId}
            disabled={tournamentOptions.length === 0}
          />
          <TextInput
            label={t("stats.from")}
            type="date"
            value={from}
            onChange={(event) => setFrom(event.currentTarget.value)}
          />
          <TextInput
            label={t("stats.to")}
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
            {t("stats.apply")}
          </Button>
          <Button variant="default" disabled={pending} onClick={clearFilters}>
            {t("cards.clear")}
          </Button>
        </Group>
      </Stack>

      <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="md">
        <Stack gap={4}>
          <Text size="sm" c="dimmed">
            {t("stats.matches")}
          </Text>
          <Text fw={700} size="xl">
            {overall.matches}
          </Text>
        </Stack>
        <Stack gap={4}>
          <Text size="sm" c="dimmed">
            {t("stats.record")}
          </Text>
          <Group gap="xs">
            <Badge color="green">{t("stats.w", { n: overall.wins })}</Badge>
            <Badge color="red">{t("stats.l", { n: overall.losses })}</Badge>
            <Badge color="gray">{t("stats.d", { n: overall.draws })}</Badge>
            {overall.unknowns > 0 ? (
              <Badge color="yellow">{overall.unknowns}?</Badge>
            ) : null}
          </Group>
        </Stack>
        <Stack gap={4}>
          <Text size="sm" c="dimmed">
            {t("stats.winRate")}
          </Text>
          <Text fw={700} size="xl">
            {formatWinRate(overall.winRate)}
          </Text>
        </Stack>
        <Stack gap={4}>
          <Text size="sm" c="dimmed">
            {t("stats.decided")}
          </Text>
          <Text fw={700} size="xl">
            {overall.wins + overall.losses}
          </Text>
        </Stack>
      </SimpleGrid>

      <Stack gap="xs">
        <Title order={4}>{t("stats.byDeck")}</Title>
        {summary.byDeck.length === 0 ? (
          <Text c="dimmed" size="sm">
            {t("stats.noMatches")}
          </Text>
        ) : (
          <Table striped highlightOnHover withTableBorder>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{t("stats.deck")}</Table.Th>
                <Table.Th>{t("stats.matches")}</Table.Th>
                <Table.Th>{t("stats.record")}</Table.Th>
                <Table.Th>{t("stats.winRate")}</Table.Th>
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
        <Title order={4}>{t("stats.byMatchup")}</Title>
        {summary.byMatchup.length === 0 ? (
          <Text c="dimmed" size="sm">
            {t("stats.noMatches")}
          </Text>
        ) : (
          <Table striped highlightOnHover withTableBorder>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{t("stats.opponent")}</Table.Th>
                <Table.Th>{t("stats.matches")}</Table.Th>
                <Table.Th>{t("stats.record")}</Table.Th>
                <Table.Th>{t("stats.winRate")}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {summary.byMatchup.map((row) => (
                <Table.Tr key={row.opponentArchetypeId ?? "__none__"}>
                  <Table.Td>
                    {row.opponentArchetypeName ?? t("stats.undefinedArchetype")}
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
        <Title order={4}>{t("stats.byTurn")}</Title>
        {summary.byTurnOrder.length === 0 ? (
          <Text c="dimmed" size="sm">
            {t("stats.noMatches")}
          </Text>
        ) : (
          <Table striped highlightOnHover withTableBorder>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{t("stats.turn")}</Table.Th>
                <Table.Th>{t("stats.matches")}</Table.Th>
                <Table.Th>{t("stats.record")}</Table.Th>
                <Table.Th>{t("stats.winRate")}</Table.Th>
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
