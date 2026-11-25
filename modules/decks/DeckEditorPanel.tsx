"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState, startTransition } from "react";
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Checkbox,
  Group,
  Select,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title,
} from "@mantine/core";
import type { DeckCardDto, DeckDto } from "./types";
import { DeckSleevePanel } from "./DeckSleevePanel";
import { DeckInventoryCheckPanel } from "./DeckInventoryCheckPanel";
import { DeckCardSearch, type DeckSearchPick } from "./DeckCardSearch";
import { DeckCoverPicker } from "./DeckCoverPicker";
import { CardArt, CardImage } from "@/modules/cards/ui/CardImage";
import { useI18n } from "@/lib/i18n/I18nProvider";

type FormatOption = {
  id: string;
  code: string;
  name: string;
};

type ValidationPayload = {
  valid: boolean;
  errors: Array<{ code: string; message: string; logicalCardId?: string }>;
  warnings: Array<{ code: string; message: string }>;
  summary: {
    totalCards: number;
    byCategory: { POKEMON: number; TRAINER: number; ENERGY: number };
  };
};

const TAG_VALUES = ["FAVORITE", "TESTING", "ARCHIVED"] as const;

const CATEGORY_ORDER = ["POKEMON", "TRAINER", "ENERGY"] as const;

type EditableCard = DeckCardDto;

export function DeckEditorPanel({ initialDeck }: { initialDeck: DeckDto }) {
  const router = useRouter();
  const { t, te, tEnum } = useI18n();
  const [deck, setDeck] = useState(initialDeck);
  const [formats, setFormats] = useState<FormatOption[]>([]);
  const [name, setName] = useState(initialDeck.name);
  const [formatId, setFormatId] = useState(initialDeck.formatId);
  const [description, setDescription] = useState(initialDeck.description ?? "");
  const [tags, setTags] = useState<string[]>(initialDeck.tags);
  const [cards, setCards] = useState<EditableCard[]>(initialDeck.cards);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [validation, setValidation] = useState<ValidationPayload | null>(null);
  const [metaPending, setMetaPending] = useState(false);
  const [cardsPending, setCardsPending] = useState(false);
  const [validatePending, setValidatePending] = useState(false);
  const [coverOpen, setCoverOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/decks/formats");
        const data = (await response.json()) as { formats?: FormatOption[] };
        if (!cancelled && response.ok) {
          setFormats(data.formats ?? []);
        }
      } catch {
        /* silent */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const totals = useMemo(() => {
    const byCategory = { POKEMON: 0, TRAINER: 0, ENERGY: 0 };
    let total = 0;
    for (const card of cards) {
      total += card.quantity;
      byCategory[card.category] += card.quantity;
    }
    return { total, byCategory };
  }, [cards]);

  const grouped = useMemo(() => {
    return CATEGORY_ORDER.map((category) => ({
      category,
      cards: cards
        .filter((c) => c.category === category)
        .sort((a, b) => a.canonicalName.localeCompare(b.canonicalName)),
    })).filter((g) => g.cards.length > 0);
  }, [cards]);

  const quantities = useMemo(
    () => Object.fromEntries(cards.map((c) => [c.logicalCardId, c.quantity])),
    [cards],
  );

  function addCopies(card: DeckSearchPick, copies: number) {
    setCards((prev) => {
      const existing = prev.find((c) => c.logicalCardId === card.logicalCardId);
      if (existing) {
        return prev.map((c) =>
          c.logicalCardId === card.logicalCardId
            ? {
                ...c,
                quantity: c.quantity + copies,
                imageUrl: c.imageUrl ?? card.imageUrl,
                printingId: c.printingId ?? card.printingId,
              }
            : c,
        );
      }
      return [
        ...prev,
        {
          id: `tmp-${card.logicalCardId}`,
          logicalCardId: card.logicalCardId,
          quantity: copies,
          canonicalName: card.canonicalName,
          category: card.category,
          imageUrl: card.imageUrl,
          printingId: card.printingId,
        },
      ];
    });
  }

  function toggleTag(tag: string) {
    setTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  }

  function updateQuantity(logicalCardId: string, quantity: number) {
    setCards((prev) =>
      prev
        .map((card) =>
          card.logicalCardId === logicalCardId ? { ...card, quantity } : card,
        )
        .filter((card) => card.quantity > 0),
    );
  }

  async function onSaveMeta(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setMetaPending(true);
    try {
      const response = await fetch(`/api/decks/${deck.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          formatId,
          description: description || null,
          tags,
        }),
      });
      const data = (await response.json()) as { deck?: DeckDto; error?: string };
      if (!response.ok || !data.deck) {
        setError(te(data.error) ?? t("editor.saveMetaFailed"));
        setMetaPending(false);
        return;
      }
      setDeck(data.deck);
      setMessage(t("editor.metaSaved"));
      setMetaPending(false);
      startTransition(() => router.refresh());
    } catch {
      setError(t("editor.saveMetaError"));
      setMetaPending(false);
    }
  }

  async function onSaveCards() {
    setError(null);
    setMessage(null);
    setCardsPending(true);
    try {
      const response = await fetch(`/api/decks/${deck.id}/cards`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cards: cards.map((c) => ({
            logicalCardId: c.logicalCardId,
            quantity: c.quantity,
          })),
        }),
      });
      const data = (await response.json()) as {
        deck?: DeckDto;
        validation?: ValidationPayload;
        error?: string;
      };
      if (!response.ok || !data.deck) {
        setError(te(data.error) ?? t("editor.saveCardsFailed"));
        setCardsPending(false);
        return;
      }
      setDeck(data.deck);
      setCards(data.deck.cards);
      if (data.validation) setValidation(data.validation);
      setMessage(t("editor.cardsSaved"));
      setCardsPending(false);
      startTransition(() => router.refresh());
    } catch {
      setError(t("editor.saveCardsError"));
      setCardsPending(false);
    }
  }

  async function onValidate() {
    setError(null);
    setValidatePending(true);
    try {
      const response = await fetch(`/api/decks/${deck.id}/validate`, {
        method: "POST",
      });
      const data = (await response.json()) as {
        deck?: DeckDto;
        validation?: ValidationPayload;
        error?: string;
      };
      if (!response.ok || !data.validation) {
        setError(te(data.error) ?? t("editor.validateFailed"));
        setValidatePending(false);
        return;
      }
      if (data.deck) {
        setDeck(data.deck);
        setCards(data.deck.cards);
      }
      setValidation(data.validation);
      setValidatePending(false);
    } catch {
      setError(t("editor.validateError"));
      setValidatePending(false);
    }
  }

  return (
    <Stack gap="lg" className="max-w-6xl animate-[sb-rise_0.45s_ease-out]">
      <DeckCoverPicker
        deck={deck}
        opened={coverOpen}
        onClose={() => setCoverOpen(false)}
        onChange={(next) => {
          setDeck(next);
          startTransition(() => router.refresh());
        }}
      />
      <Group justify="space-between" align="flex-start">
        <div>
          <Group gap="sm" mb={4}>
            <Title order={2}>{deck.name}</Title>
            <Badge
              variant="light"
              color={deck.physicalStatus === "SLEEVED" ? "green" : "gray"}
            >
              {tEnum("physicalStatus", deck.physicalStatus)}
            </Badge>
            {deck.importStatus ? (
              <Badge variant="light" color="ember">
                {tEnum("importStatus", deck.importStatus)}
              </Badge>
            ) : null}
          </Group>
          <Text c="dimmed" size="sm">
            {t("editor.subtitle", { format: tEnum("format", deck.format.name), count: totals.total })}
          </Text>
        </div>
        <Button component={Link} href="/decks" variant="subtle">
          {t("common.back")}
        </Button>
      </Group>

      {error ? <Alert color="red">{error}</Alert> : null}
      {message ? <Alert color="green">{message}</Alert> : null}

      <Group align="flex-start" gap="lg" wrap="wrap" preventGrowOverflow={false}>
        <Stack gap="md" style={{ flex: "1 1 320px", minWidth: 280 }}>
          <form onSubmit={onSaveMeta}>
            <Stack
              gap="md"
              className="rounded-xl border border-[var(--sb-line)] bg-[var(--sb-panel)]/85 p-4"
            >
              <Text fw={700}>{t("editor.details")}</Text>
              <Stack gap={6}>
                <Text size="sm" fw={500}>
                  {t("editor.deckCover")}
                </Text>
                <button
                  type="button"
                  onClick={() => setCoverOpen(true)}
                  className="w-full max-w-[200px] cursor-pointer overflow-hidden rounded-lg border-0 p-0 ring-1 sm:max-w-none ring-[var(--sb-line)] hover:ring-[var(--sb-accent)]"
                  aria-label={t("editor.chooseCoverAria")}
                >
                  <CardArt src={deck.coverImageUrl} alt={t("decks.coverOf", { name: deck.name })} />
                </button>
                <Button
                  size="compact-sm"
                  variant="light"
                  onClick={() => setCoverOpen(true)}
                  w="fit-content"
                >
                  {t("editor.chooseCover")}
                </Button>
              </Stack>
              <TextInput
                label={t("common.name")}
                value={name}
                onChange={(e) => setName(e.currentTarget.value)}
                required
              />
              <Select
                label={t("common.format")}
                data={formats.map((f) => ({ value: f.id, label: tEnum("format", f.name) }))}
                value={formatId}
                onChange={(value) => value && setFormatId(value)}
                searchable
              />
              <Textarea
                label={t("common.description")}
                value={description}
                onChange={(e) => setDescription(e.currentTarget.value)}
                minRows={2}
              />
              <Stack gap="xs">
                <Text size="sm" fw={500}>
                  {t("common.tags")}
                </Text>
                {TAG_VALUES.map((tag) => (
                  <Checkbox
                    key={tag}
                    label={tEnum("deckTag", tag)}
                    checked={tags.includes(tag)}
                    onChange={() => toggleTag(tag)}
                  />
                ))}
              </Stack>
              <Button type="submit" loading={metaPending}>
                {t("editor.saveDetails")}
              </Button>
            </Stack>
          </form>

          <Stack
            gap="sm"
            className="rounded-xl border border-[var(--sb-line)] bg-[var(--sb-panel)]/85 p-4"
          >
            <Text fw={700}>{t("editor.summary")}</Text>
            <Text size="sm">
              {tEnum("category", "POKEMON")}: {totals.byCategory.POKEMON} ·{" "}
              {tEnum("category", "TRAINER")}: {totals.byCategory.TRAINER} ·{" "}
              {tEnum("category", "ENERGY")}: {totals.byCategory.ENERGY}
            </Text>
            <Text size="sm" fw={600}>
              {t("editor.total", { count: totals.total })}
            </Text>
            <Group gap="sm">
              <Button
                variant="light"
                loading={validatePending}
                onClick={onValidate}
              >
                {t("editor.validateFormat")}
              </Button>
              <Button loading={cardsPending} onClick={onSaveCards}>
                {t("editor.saveCards")}
              </Button>
            </Group>
            {validation ? (
              <Stack gap={6} mt="xs">
                <Badge color={validation.valid ? "green" : "red"} variant="light">
                  {validation.valid ? t("decks.valid") : t("decks.invalid")}
                </Badge>
                {validation.errors.map((issue) => (
                  <Text key={`${issue.code}-${issue.message}`} size="xs" c="red">
                    {te(issue.message)}
                  </Text>
                ))}
                {validation.warnings.map((issue) => (
                  <Text
                    key={`${issue.code}-${issue.message}`}
                    size="xs"
                    c="orange"
                  >
                    {te(issue.message)}
                  </Text>
                ))}
              </Stack>
            ) : null}
          </Stack>

          <DeckSleevePanel deck={deck} onDeckChange={setDeck} />
        </Stack>

        <Stack gap="md" style={{ flex: "2 1 480px", minWidth: 0 }}>
          <DeckCardSearch
            formatCode={deck.format.code}
            quantities={quantities}
            onAdd={(card) => {
              addCopies(card, 1);
              setMessage(t("editor.added", { name: card.canonicalName }));
            }}
          />

          {grouped.length === 0 ? (
            <Stack
              gap="xs"
              className="rounded-xl border border-dashed border-[var(--sb-line)] px-5 py-8"
            >
              <Text fw={600}>{t("editor.emptyList")}</Text>
              <Text size="sm" c="dimmed">
                {t("editor.emptyHint")}
              </Text>
              <Button
                component={Link}
                href="/decks/import"
                variant="light"
                w="fit-content"
              >
                {t("editor.goToImport")}
              </Button>
            </Stack>
          ) : (
            grouped.map((group) => (
              <Stack
                key={group.category}
                gap="xs"
                className="rounded-xl border border-[var(--sb-line)] bg-[var(--sb-panel)]/85 p-4"
              >
                <Group justify="space-between">
                  <Text fw={700}>
                    {tEnum("category", group.category)}
                  </Text>
                  <Text size="sm" c="dimmed">
                    {group.cards.reduce((s, c) => s + c.quantity, 0)}
                  </Text>
                </Group>
                <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-4 sm:gap-2 xl:grid-cols-6">
                  {group.cards.map((card) => (
                    <div key={card.logicalCardId} className="min-w-0">
                      <CardImage
                        src={card.imageUrl}
                        alt={card.canonicalName}
                        sizes="(max-width: 640px) 30vw, 130px"
                      >
                        <div className="absolute inset-x-0.5 bottom-1 flex items-center justify-between gap-0.5 sm:inset-x-1">
                          <ActionIcon
                            size="sm"
                            radius="xl"
                            variant="filled"
                            color="dark"
                            aria-label={t("editor.removeCopy", { name: card.canonicalName })}
                            onClick={() =>
                              updateQuantity(card.logicalCardId, card.quantity - 1)
                            }
                            className="shadow"
                          >
                            −
                          </ActionIcon>
                          <span className="min-w-6 rounded-full bg-black/75 px-1.5 py-0.5 text-center text-sm font-bold text-white shadow sm:min-w-8 sm:px-2 sm:text-base">
                            {card.quantity}
                          </span>
                          <ActionIcon
                            size="sm"
                            radius="xl"
                            variant="filled"
                            color="ember"
                            aria-label={t("editor.addCopy", { name: card.canonicalName })}
                            disabled={card.quantity >= 99}
                            onClick={() =>
                              updateQuantity(card.logicalCardId, card.quantity + 1)
                            }
                            className="shadow"
                          >
                            +
                          </ActionIcon>
                        </div>
                      </CardImage>
                      <Text size="xs" mt={4} lineClamp={1} title={card.canonicalName}>
                        {card.canonicalName}
                      </Text>
                    </div>
                  ))}
                </div>
              </Stack>
            ))
          )}

          <DeckInventoryCheckPanel deckId={deck.id} refreshKey={deck.updatedAt} />
        </Stack>
      </Group>
    </Stack>
  );
}
