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
  NumberInput,
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

const TAG_OPTIONS = [
  { value: "FAVORITE", label: "Favorito" },
  { value: "TESTING", label: "Testando" },
  { value: "ARCHIVED", label: "Arquivado" },
] as const;

const CATEGORY_ORDER = ["POKEMON", "TRAINER", "ENERGY"] as const;
const CATEGORY_LABEL: Record<string, string> = {
  POKEMON: "Pokémon",
  TRAINER: "Trainer",
  ENERGY: "Energy",
};

const IMPORT_LABELS: Record<string, string> = {
  IMPORTED: "Importado",
  PARTIALLY_RESOLVED: "Parcialmente resolvido",
  READY: "Pronto",
  INVALID: "Inválido",
};

type EditableCard = DeckCardDto;

export function DeckEditorPanel({ initialDeck }: { initialDeck: DeckDto }) {
  const router = useRouter();
  const [deck, setDeck] = useState(initialDeck);
  const [formats, setFormats] = useState<FormatOption[]>([]);
  const [name, setName] = useState(initialDeck.name);
  const [formatId, setFormatId] = useState(initialDeck.formatId);
  const [description, setDescription] = useState(initialDeck.description ?? "");
  const [tags, setTags] = useState<string[]>(initialDeck.tags);
  const [cards, setCards] = useState<EditableCard[]>(initialDeck.cards);
  const [setCode, setSetCode] = useState("");
  const [collectorNumber, setCollectorNumber] = useState("");
  const [addQuantity, setAddQuantity] = useState<number | string>(1);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [validation, setValidation] = useState<ValidationPayload | null>(null);
  const [metaPending, setMetaPending] = useState(false);
  const [cardsPending, setCardsPending] = useState(false);
  const [resolvePending, setResolvePending] = useState(false);
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
        setError(data.error ?? "Falha ao salvar metadados.");
        setMetaPending(false);
        return;
      }
      setDeck(data.deck);
      setMessage("Metadados salvos.");
      setMetaPending(false);
      startTransition(() => router.refresh());
    } catch {
      setError("Não foi possível salvar metadados.");
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
        setError(data.error ?? "Falha ao salvar cartas.");
        setCardsPending(false);
        return;
      }
      setDeck(data.deck);
      setCards(data.deck.cards);
      if (data.validation) setValidation(data.validation);
      setMessage("Cartas salvas.");
      setCardsPending(false);
      startTransition(() => router.refresh());
    } catch {
      setError("Não foi possível salvar as cartas.");
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
        setError(data.error ?? "Falha na validação.");
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
      setError("Não foi possível validar o deck.");
      setValidatePending(false);
    }
  }

  async function onAddByPrinting(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setResolvePending(true);
    try {
      const quantity =
        typeof addQuantity === "number" ? addQuantity : Number(addQuantity);
      const response = await fetch("/api/decks/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          setCode,
          collectorNumber,
          quantity,
        }),
      });
      const data = (await response.json()) as {
        card?: {
          quantity: number;
          logicalCardId: string;
          canonicalName: string;
          category: EditableCard["category"];
          printingId: string;
          imageUrl: string | null;
        };
        error?: string;
      };
      if (!response.ok || !data.card) {
        setError(data.error ?? "Carta não encontrada.");
        setResolvePending(false);
        return;
      }

      addCopies(
        {
          logicalCardId: data.card.logicalCardId,
          canonicalName: data.card.canonicalName,
          category: data.card.category,
          printingId: data.card.printingId,
          imageUrl: data.card.imageUrl,
        },
        data.card.quantity,
      );
      setSetCode("");
      setCollectorNumber("");
      setAddQuantity(1);
      setMessage(`Adicionada: ${data.card.canonicalName}`);
      setResolvePending(false);
    } catch {
      setError("Não foi possível resolver a carta.");
      setResolvePending(false);
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
              {deck.physicalStatus === "SLEEVED" ? "SLEEVED" : "NOT_SLEEVED"}
            </Badge>
            {deck.importStatus ? (
              <Badge variant="light" color="ember">
                {IMPORT_LABELS[deck.importStatus] ?? deck.importStatus}
              </Badge>
            ) : null}
          </Group>
          <Text c="dimmed" size="sm">
            Deckbuilder lógico · {deck.format.name} ·{" "}
            {totals.total} cartas
          </Text>
        </div>
        <Button component={Link} href="/decks" variant="subtle">
          Voltar
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
              <Text fw={700}>Metadados</Text>
              <Stack gap={6}>
                <Text size="sm" fw={500}>
                  Capa do deck
                </Text>
                <button
                  type="button"
                  onClick={() => setCoverOpen(true)}
                  className="w-full max-w-[200px] cursor-pointer overflow-hidden rounded-lg border-0 p-0 ring-1 sm:max-w-none ring-[var(--sb-line)] hover:ring-[var(--sb-accent)]"
                  aria-label="Escolher capa do deck"
                >
                  <CardArt src={deck.coverImageUrl} alt={`Capa de ${deck.name}`} />
                </button>
                <Button
                  size="compact-sm"
                  variant="light"
                  onClick={() => setCoverOpen(true)}
                  w="fit-content"
                >
                  Escolher capa
                </Button>
              </Stack>
              <TextInput
                label="Nome"
                value={name}
                onChange={(e) => setName(e.currentTarget.value)}
                required
              />
              <Select
                label="Formato"
                data={formats.map((f) => ({ value: f.id, label: f.name }))}
                value={formatId}
                onChange={(value) => value && setFormatId(value)}
                searchable
              />
              <Textarea
                label="Descrição"
                value={description}
                onChange={(e) => setDescription(e.currentTarget.value)}
                minRows={2}
              />
              <Stack gap="xs">
                <Text size="sm" fw={500}>
                  Tags
                </Text>
                {TAG_OPTIONS.map((tag) => (
                  <Checkbox
                    key={tag.value}
                    label={tag.label}
                    checked={tags.includes(tag.value)}
                    onChange={() => toggleTag(tag.value)}
                  />
                ))}
              </Stack>
              <Button type="submit" loading={metaPending}>
                Salvar metadados
              </Button>
            </Stack>
          </form>

          <Stack
            gap="sm"
            className="rounded-xl border border-[var(--sb-line)] bg-[var(--sb-panel)]/85 p-4"
          >
            <Text fw={700}>Resumo</Text>
            <Text size="sm">
              Pokémon: {totals.byCategory.POKEMON} · Trainer:{" "}
              {totals.byCategory.TRAINER} · Energy: {totals.byCategory.ENERGY}
            </Text>
            <Text size="sm" fw={600}>
              Total: {totals.total}
            </Text>
            <Group gap="sm">
              <Button
                variant="light"
                loading={validatePending}
                onClick={onValidate}
              >
                Validar formato
              </Button>
              <Button loading={cardsPending} onClick={onSaveCards}>
                Salvar cartas
              </Button>
            </Group>
            {validation ? (
              <Stack gap={6} mt="xs">
                <Badge color={validation.valid ? "green" : "red"} variant="light">
                  {validation.valid ? "Válido" : "Inválido"}
                </Badge>
                {validation.errors.map((issue) => (
                  <Text key={`${issue.code}-${issue.message}`} size="xs" c="red">
                    {issue.message}
                  </Text>
                ))}
                {validation.warnings.map((issue) => (
                  <Text
                    key={`${issue.code}-${issue.message}`}
                    size="xs"
                    c="orange"
                  >
                    {issue.message}
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
              setMessage(`Adicionada: ${card.canonicalName} (lembre de salvar as cartas)`);
            }}
          />

          <form onSubmit={onAddByPrinting}>
            <Group
              align="flex-end"
              gap="sm"
              className="rounded-xl border border-[var(--sb-line)] bg-[var(--sb-panel)]/85 p-4"
              wrap="wrap"
            >
              <TextInput
                label="Set"
                placeholder="TWM"
                value={setCode}
                onChange={(e) => setSetCode(e.currentTarget.value)}
                style={{ width: 100 }}
                required
              />
              <TextInput
                label="Collector"
                placeholder="128"
                value={collectorNumber}
                onChange={(e) => setCollectorNumber(e.currentTarget.value)}
                style={{ width: 110 }}
                required
              />
              <NumberInput
                label="Qtd"
                min={1}
                max={99}
                value={addQuantity}
                onChange={setAddQuantity}
                style={{ width: 90 }}
              />
              <Button type="submit" loading={resolvePending}>
                Adicionar
              </Button>
              <Text size="xs" c="dimmed" w="100%">
                Adicionar pela impressão (set + número de coleção, como no
                Limitless).
              </Text>
            </Group>
          </form>

          {grouped.length === 0 ? (
            <Stack
              gap="xs"
              className="rounded-xl border border-dashed border-[var(--sb-line)] px-5 py-8"
            >
              <Text fw={600}>Lista vazia</Text>
              <Text size="sm" c="dimmed">
                Adicione cartas por set/collector ou importe uma lista Limitless.
              </Text>
              <Button
                component={Link}
                href="/decks/import"
                variant="light"
                w="fit-content"
              >
                Ir para importação
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
                    {CATEGORY_LABEL[group.category] ?? group.category}
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
                            aria-label={`Remover uma cópia de ${card.canonicalName}`}
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
                            aria-label={`Adicionar uma cópia de ${card.canonicalName}`}
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
