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
  SimpleGrid,
} from "@mantine/core";
import type { BattleLogPreview } from "@/server/services/match";
import type {
  ArchetypeDto,
  DeckOption,
  MatchDto,
  MatchResultValue,
  TurnOrderValue,
} from "./types";
import { useI18n } from "@/lib/i18n/I18nProvider";

const RESULTS: MatchResultValue[] = ["WIN", "LOSS", "DRAW", "UNKNOWN"];
const TURNS: TurnOrderValue[] = ["FIRST", "SECOND"];

async function readError(response: Response) {
  const data = (await response.json().catch(() => ({}))) as {
    error?: string;
  };
  return data.error;
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
  const { t, te, tEnum, formatDateTime } = useI18n();
  const failMessage = async (response: Response) =>
    te(await readError(response)) ?? t("training.opFailed");
  const formatDate = (value: string | null) => {
    if (!value || Number.isNaN(new Date(value).getTime())) return "—";
    return formatDateTime(value);
  };
  const RESULT_OPTIONS = RESULTS.map((value) => ({ value, label: tEnum("matchResult", value) }));
  const TURN_OPTIONS = TURNS.map((value) => ({ value, label: tEnum("turnOrder", value) }));
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
  const [preview, setPreview] = useState<BattleLogPreview | null>(null);
  const [reviewResult, setReviewResult] = useState<string | null>(null);
  const [reviewTurnOrder, setReviewTurnOrder] = useState<string | null>(null);

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
        label: `${deck.name} (${tEnum("format", deck.formatName)})`,
      })),
    [decks, tEnum],
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
      throw new Error(await failMessage(response));
    }
    const data = (await response.json()) as { archetype: ArchetypeDto };
    setArchetypes((prev) =>
      [...prev, data.archetype].sort((a, b) => a.name.localeCompare(b.name)),
    );
    setOpponentArchetypeId(data.archetype.id);
    setNewArchetypeName("");
    return data.archetype.id;
  }

  /** §68 — passo 1: analisa o log e sugere o arquétipo (nada é salvo). */
  async function onAnalyze() {
    setError(null);
    setMessage(null);
    if (!rawLog.trim()) {
      setError(t("training.pasteLog"));
      return;
    }
    setPending(true);
    try {
      const response = await fetch("/api/training/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawLog, viewerName: viewerName.trim() }),
      });
      const data = (await response.json()) as {
        preview?: BattleLogPreview;
        error?: string;
      };
      if (!response.ok || !data.preview) {
        setError(te(data.error) ?? t("training.analyzeFailed"));
        setPreview(null);
        return;
      }
      setPreview(data.preview);
      setReviewResult(data.preview.result);
      setReviewTurnOrder(data.preview.turnOrder);
      if (data.preview.suggestedArchetype) {
        setOpponentArchetypeId(data.preview.suggestedArchetype.archetypeId);
        setNewArchetypeName("");
      } else {
        setOpponentArchetypeId(null);
      }
    } catch {
      setError(t("training.analyzeError"));
    } finally {
      setPending(false);
    }
  }

  async function onImport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    if (!preview) {
      await onAnalyze();
      return;
    }

    if (!deckId) {
      setError(t("training.pickDeck"));
      return;
    }
    if (!rawLog.trim()) {
      setError(t("training.pasteLog"));
      return;
    }
    if (!viewerName.trim()) {
      setError(t("training.needViewer"));
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
          playedAt: playedAt ? new Date(playedAt).toISOString() : null,
          result: reviewResult ?? undefined,
          turnOrder: reviewTurnOrder,
        }),
      });
      const data = (await response.json()) as {
        match?: MatchDto;
        parseOk?: boolean;
        error?: string;
      };
      if (!response.ok || !data.match) {
        setError(te(data.error) ?? t("training.importFailed"));
        setPending(false);
        return;
      }

      setMatches((prev) => [data.match!, ...prev]);
      setRawLog("");
      setNotes("");
      setPlayedAt("");
      setPreview(null);
      setOpponentArchetypeId(null);
      setMessage(
        data.parseOk === false
          ? t("training.createdWithWarnings")
          : t("training.imported"),
      );
      setPending(false);
      startTransition(() => router.refresh());
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("training.importError"),
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
        setError(te(data.error) ?? t("training.updateFailed"));
        setPending(false);
        return;
      }
      setMatches((prev) =>
        prev.map((item) => (item.id === data.match!.id ? data.match! : item)),
      );
      setEditingId(null);
      setMessage(t("training.updated"));
      setPending(false);
      startTransition(() => router.refresh());
    } catch {
      setError(t("training.updateError"));
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
        setError(await failMessage(response));
        setPending(false);
        return;
      }
      setMatches((prev) => prev.filter((item) => item.id !== matchId));
      if (editingId === matchId) setEditingId(null);
      setPending(false);
      startTransition(() => router.refresh());
    } catch {
      setError(t("training.deleteError"));
      setPending(false);
    }
  }

  return (
    <Stack gap="xl" className="max-w-5xl animate-[sb-rise_0.45s_ease-out]">
      <div>
        <Title order={2}>{t("nav.training")}</Title>
        <Text c="dimmed" size="sm" mt={4}>
          {t("training.subtitle")}
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
          className="rounded-xl border border-[var(--sb-line)] bg-[var(--sb-panel)]/85 px-4 py-5"
        >
          <Title order={4}>{t("training.importLog")}</Title>
          <Textarea
            label={t("training.logLabel")}
            description={t("training.logHint")}
            minRows={8}
            value={rawLog}
            onChange={(event) => {
              setRawLog(event.currentTarget.value);
              setPreview(null);
            }}
            required
            styles={{ input: { fontFamily: "var(--font-ibm-plex-mono)" } }}
          />
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            <TextInput
              label={t("training.viewerName")}
              description={t("training.viewerHint")}
              value={viewerName}
              onChange={(event) => {
                setViewerName(event.currentTarget.value);
                setPreview(null);
              }}
              required
            />
            <Select
              label={t("training.myDeck")}
              data={deckOptions}
              value={deckId}
              onChange={setDeckId}
              searchable
              nothingFoundMessage={t("training.noDecks")}
              required
            />
          </SimpleGrid>
          {!preview ? (
            <Group>
              <Button onClick={onAnalyze} loading={pending} disabled={!rawLog.trim()}>
                {t("training.analyze")}
              </Button>
              <Text size="xs" c="dimmed">
                {t("training.analyzeHint")}
              </Text>
            </Group>
          ) : (
            <Stack
              gap="xs"
              className="rounded-lg border border-[var(--sb-line)] bg-[var(--sb-accent-soft)]/40 p-3"
            >
              <Text fw={600} size="sm">
                {preview.player1} vs {preview.player2}
                {preview.gameFormatCode ? ` · ${preview.gameFormatCode}` : ""} · parser{" "}
                {preview.parserVersion}
              </Text>
              {preview.warnings.map((warning) => (
                <Text key={warning} size="xs" c="orange">
                  {te(warning)}
                </Text>
              ))}
              <Text size="sm">
                {t("training.opponent")} <b>{preview.opponent ?? "?"}</b>
                {preview.opponentPokemon.length > 0
                  ? t("training.detected", { list: preview.opponentPokemon.join(", ") })
                  : t("training.noneDetected")}
              </Text>
              <Text size="sm">
                {preview.suggestedArchetype
                  ? t("training.suggested", { name: preview.suggestedArchetype.name })
                  : t("training.noSuggestion")}
              </Text>
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                <Select
                  label={t("training.result")}
                  data={RESULT_OPTIONS}
                  value={reviewResult}
                  onChange={setReviewResult}
                />
                <Select
                  label={t("training.turnOrder")}
                  data={TURN_OPTIONS}
                  value={reviewTurnOrder}
                  onChange={setReviewTurnOrder}
                  clearable
                />
              </SimpleGrid>
            </Stack>
          )}
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            <Select
              label={t("training.opponentArchetype")}
              data={archetypeOptions}
              value={opponentArchetypeId}
              onChange={setOpponentArchetypeId}
              searchable
              clearable
              nothingFoundMessage={t("training.noArchetypes")}
            />
            <TextInput
              label={t("training.orCreate")}
              placeholder={t("training.archetypePlaceholder")}
              value={newArchetypeName}
              onChange={(event) =>
                setNewArchetypeName(event.currentTarget.value)
              }
            />
          </SimpleGrid>
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            <TextInput
              type="datetime-local"
              label={t("training.playedAt")}
              value={playedAt}
              onChange={(event) => setPlayedAt(event.currentTarget.value)}
            />
            <TextInput
              label={t("common.notes")}
              value={notes}
              onChange={(event) => setNotes(event.currentTarget.value)}
            />
          </SimpleGrid>
          <Text size="xs" c="dimmed">
            {t("training.formatNote")}
          </Text>
          <Group>
            <Button
              type="submit"
              loading={pending}
              disabled={decks.length === 0 || !preview}
            >
              {t("training.saveMatch")}
            </Button>
            {decks.length === 0 ? (
              <Text size="sm" c="dimmed">
                {t("training.createDeckFirst")}
              </Text>
            ) : null}
          </Group>
        </Stack>
      </form>

      <Stack gap="sm">
        <Title order={4}>{t("training.history")}</Title>
        {matches.length === 0 ? (
          <Stack
            gap="sm"
            className="rounded-xl border border-[var(--sb-line)] bg-[var(--sb-panel)]/80 px-6 py-10"
          >
            <Text fw={600}>{t("training.noMatches")}</Text>
            <Text c="dimmed" size="sm">
              {t("training.noMatchesHint")}
            </Text>
          </Stack>
        ) : (
          matches.map((match) => (
            <Stack
              key={match.id}
              gap="sm"
              className="rounded-xl border border-[var(--sb-line)] bg-[var(--sb-panel)]/85 px-4 py-3"
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
                      {tEnum("matchResult", match.result)}
                    </Badge>
                    {match.turnOrder ? (
                      <Badge variant="outline" color="ink">
                        {tEnum("turnOrder", match.turnOrder)}
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
                    {match.opponentArchetype?.name ?? t("training.undefinedArchetype")}
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
                    {t("common.edit")}
                  </Button>
                  <ActionIcon
                    variant="subtle"
                    color="red"
                    aria-label={t("training.deleteMatch")}
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
                    className="rounded-lg border border-[var(--sb-line)] bg-[var(--sb-bg)]/40 px-3 py-3"
                  >
                    <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                      <Select
                        label="Deck"
                        data={deckOptions}
                        value={editDeckId}
                        onChange={setEditDeckId}
                        searchable
                      />
                      <Select
                        label={t("training.opponentArchetype")}
                        data={archetypeOptions}
                        value={editArchetypeId}
                        onChange={setEditArchetypeId}
                        searchable
                        clearable
                      />
                    </SimpleGrid>
                    <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                      <Select
                        label={t("training.result")}
                        data={RESULT_OPTIONS}
                        value={editResult}
                        onChange={setEditResult}
                      />
                      <Select
                        label={t("training.order")}
                        data={TURN_OPTIONS}
                        value={editTurnOrder}
                        onChange={setEditTurnOrder}
                        clearable
                      />
                    </SimpleGrid>
                    <TextInput
                      label={t("common.notes")}
                      value={editNotes}
                      onChange={(event) =>
                        setEditNotes(event.currentTarget.value)
                      }
                    />
                    <Group>
                      <Button type="submit" size="compact-sm" loading={pending}>
                        {t("common.save")}
                      </Button>
                      <Button
                        type="button"
                        size="compact-sm"
                        variant="subtle"
                        onClick={() => setEditingId(null)}
                      >
                        {t("common.cancel")}
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
