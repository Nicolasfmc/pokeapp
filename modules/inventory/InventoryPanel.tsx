"use client";

import { FormEvent, useEffect, useMemo, useState, startTransition } from "react";
import {
  ActionIcon,
  Alert,
  Button,
  Group,
  NumberInput,
  Modal,
  Select,
  Stack,
  Switch,
  Text,
  TextInput,
  Title,
  Badge,
  SegmentedControl,
  Paper,
} from "@mantine/core";
import { PrintingPicker } from "./PrintingPicker";
import { DEFAULT_CARD_LANGUAGE, LanguageFlag, LanguageSelect } from "./languages";
import { CardImage, CardThumb } from "@/modules/cards/ui/CardImage";

export type InventoryItemDto = {
  id: string;
  quantity: number;
  condition: string;
  language: string;
  collectionStatus: string;
  sleevedAllocatedQuantity: number;
  cardPrinting: {
    id: string;
    tcgdexId: string;
    name: string;
    localId: string;
    imageUrl: string | null;
    logicalCardId: string;
    set: {
      id: string;
      name: string;
      code: string | null;
    };
  };
  logicalAvailability: {
    ownedQuantity: number;
    sleevedAllocatedQuantity: number;
    competitiveReserve: number;
    protectedQuantity: number;
    availableForTrade: number;
  };
};

type InventoryGroup = {
  key: string;
  name: string;
  imageUrl: string | null;
  items: InventoryItemDto[];
  quantity: number;
  sleeved: number;
  availability: InventoryItemDto["logicalAvailability"];
};

type TransactionDto = {
  id: string;
  quantityDelta: number;
  reason: string;
  note: string | null;
  createdAt: string;
};

const CONDITIONS = ["NM", "LP", "MP", "HP", "DMG"];
const STATUSES = ["COMPETITIVE", "COLLECTION"];
const REASONS = [
  "PURCHASE",
  "SALE",
  "TRADE",
  "GIFT",
  "LOST",
  "DAMAGED",
  "CORRECTION",
  "OTHER",
];

async function readError(response: Response) {
  const data = (await response.json().catch(() => ({}))) as {
    error?: string;
  };
  return data.error ?? "Falha na operação de inventário.";
}

export function InventoryPanel({
  initialItems,
}: {
  initialItems: InventoryItemDto[];
}) {
  const [items, setItems] = useState(initialItems);
  const [filter, setFilter] = useState<"ALL" | "COMPETITIVE" | "COLLECTION">(
    "ALL",
  );
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [historyItemId, setHistoryItemId] = useState<string | null>(null);
  const [history, setHistory] = useState<TransactionDto[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [cardPrintingId, setCardPrintingId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState<number | string>(1);
  const [condition, setCondition] = useState<string | null>("NM");
  const [language, setLanguage] = useState(DEFAULT_CARD_LANGUAGE);
  const [unify, setUnify] = useState(true);
  const [openGroupKey, setOpenGroupKey] = useState<string | null>(null);
  const [collectionStatus, setCollectionStatus] = useState<string | null>(
    "COMPETITIVE",
  );
  const [reason, setReason] = useState<string | null>("PURCHASE");
  const [note, setNote] = useState("");
  const [adjustReason, setAdjustReason] = useState<string | null>("CORRECTION");

  const groups = useMemo(() => {
    const map = new Map<string, InventoryGroup>();
    for (const item of items) {
      // Unificado: uma entrada por carta lógica (mesma carta em várias coleções).
      const key = unify ? item.cardPrinting.logicalCardId : item.id;
      let group = map.get(key);
      if (!group) {
        group = {
          key,
          name: item.cardPrinting.name,
          imageUrl: null,
          items: [],
          quantity: 0,
          sleeved: 0,
          availability: item.logicalAvailability,
        };
        map.set(key, group);
      }
      group.items.push(item);
      group.quantity += item.quantity;
      group.sleeved += item.sleevedAllocatedQuantity;
    }
    for (const group of map.values()) {
      const withImage = [...group.items]
        .filter((i) => i.cardPrinting.imageUrl)
        .sort((a, b) => b.quantity - a.quantity);
      group.imageUrl = withImage[0]?.cardPrinting.imageUrl ?? null;
    }
    return [...map.values()];
  }, [items, unify]);

  const openGroup = groups.find((g) => g.key === openGroupKey) ?? null;

  async function reloadItems(
    nextFilter: typeof filter = filter,
    nextQuery: string = query,
  ) {
    const params = new URLSearchParams();
    if (nextFilter !== "ALL") {
      params.set("collectionStatus", nextFilter);
    }
    if (nextQuery.trim()) {
      params.set("q", nextQuery.trim());
    }
    const response = await fetch(`/api/inventory?${params.toString()}`);
    if (!response.ok) {
      throw new Error(await readError(response));
    }
    const data = (await response.json()) as { items: InventoryItemDto[] };
    setItems(data.items);
  }

  useEffect(() => {
    const handle = window.setTimeout(() => {
      startTransition(() => {
        void (async () => {
          try {
            const params = new URLSearchParams();
            if (filter !== "ALL") {
              params.set("collectionStatus", filter);
            }
            if (query.trim()) {
              params.set("q", query.trim());
            }
            const response = await fetch(`/api/inventory?${params.toString()}`);
            if (!response.ok) {
              throw new Error(await readError(response));
            }
            const data = (await response.json()) as {
              items: InventoryItemDto[];
            };
            setItems(data.items);
          } catch (err: unknown) {
            console.error(err);
            setError(
              err instanceof Error
                ? err.message
                : "Não foi possível carregar o inventário.",
            );
          }
        })();
      });
    }, 250);
    return () => window.clearTimeout(handle);
  }, [filter, query]);

  async function onAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    try {
      const response = await fetch("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cardPrintingId,
          quantity: Number(quantity),
          condition,
          language,
          collectionStatus,
          reason,
          note: note.trim() || undefined,
        }),
      });

      if (!response.ok) {
        setError(await readError(response));
        setPending(false);
        return;
      }

      setCardPrintingId(null);
      setQuantity(1);
      setNote("");
      await reloadItems(filter, query);
      setPending(false);
    } catch (err) {
      console.error(err);
      setError("Não foi possível adicionar a carta.");
      setPending(false);
    }
  }

  async function onAdjust(itemId: string, quantityDelta: number) {
    setError(null);
    setPending(true);
    try {
      const response = await fetch(`/api/inventory/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quantityDelta,
          reason: adjustReason ?? "CORRECTION",
        }),
      });
      if (!response.ok) {
        setError(await readError(response));
        setPending(false);
        return;
      }
      await reloadItems(filter, query);
      if (historyItemId === itemId) {
        await loadHistory(itemId);
      }
      setPending(false);
    } catch (err) {
      console.error(err);
      setError("Não foi possível ajustar a quantidade.");
      setPending(false);
    }
  }

  async function loadHistory(itemId: string) {
    setHistoryLoading(true);
    try {
      const response = await fetch(`/api/inventory/${itemId}/transactions`);
      if (!response.ok) {
        setError(await readError(response));
        setHistoryLoading(false);
        return;
      }
      const data = (await response.json()) as {
        transactions: TransactionDto[];
      };
      setHistory(data.transactions);
      setHistoryLoading(false);
    } catch (err) {
      console.error(err);
      setError("Não foi possível carregar o histórico.");
      setHistoryLoading(false);
    }
  }

  async function toggleHistory(itemId: string) {
    if (historyItemId === itemId) {
      setHistoryItemId(null);
      setHistory([]);
      return;
    }
    setHistoryItemId(itemId);
    await loadHistory(itemId);
  }

  return (
    <Stack gap="lg">
      <div>
        <Title
          order={1}
          className="font-[family-name:var(--font-space-grotesk)] text-3xl tracking-tight"
        >
          Inventory
        </Title>
        <Text className="mt-2 max-w-2xl text-[color-mix(in_srgb,var(--sb-ink)_75%,transparent)]">
          Controle cópias físicas por impressão, condição e status. Reserva
          competitiva e disponibilidade para trade são calculadas por carta
          lógica.
        </Text>
      </div>

      {error ? (
        <Alert
          color="red"
          title="Erro"
          onClose={() => setError(null)}
          withCloseButton
        >
          {error}
        </Alert>
      ) : null}

      <Paper
        p="md"
        radius="md"
        className="border border-[var(--sb-line)] bg-[var(--sb-panel)]"
      >
        <form onSubmit={onAdd}>
          <Stack gap="sm">
            <Text fw={600}>Adicionar carta</Text>
            <PrintingPicker
              value={cardPrintingId}
              onChange={(id) => setCardPrintingId(id)}
            />
            <div className="grid grid-cols-2 items-end gap-3 sm:grid-cols-3">
              <NumberInput
                label="Quantidade"
                min={1}
                value={quantity}
                onChange={setQuantity}
                required
              />
              <Select
                label="Condição"
                data={CONDITIONS}
                value={condition}
                onChange={setCondition}
                allowDeselect={false}
              />
              <LanguageSelect value={language} onChange={setLanguage} />
            </div>
            <div className="grid grid-cols-2 items-end gap-3 sm:grid-cols-4">
              <Select
                label="Status"
                data={STATUSES}
                value={collectionStatus}
                onChange={setCollectionStatus}
                allowDeselect={false}
              />
              <Select
                label="Motivo"
                data={REASONS}
                value={reason}
                onChange={setReason}
                allowDeselect={false}
              />
              <TextInput
                label="Nota"
                value={note}
                onChange={(event) => setNote(event.currentTarget.value)}
              />
              <Button
                type="submit"
                loading={pending}
                disabled={!cardPrintingId}
              >
                Adicionar
              </Button>
            </div>
          </Stack>
        </form>
      </Paper>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        <SegmentedControl
          value={filter}
          onChange={(value) =>
            setFilter(value as "ALL" | "COMPETITIVE" | "COLLECTION")
          }
          data={[
            { label: "Todos", value: "ALL" },
            { label: "Competitive", value: "COMPETITIVE" },
            { label: "Collection", value: "COLLECTION" },
          ]}
        />
        <Switch
          label="Unificar coleções"
          description="Mesma carta em vários sets vira um card só"
          checked={unify}
          onChange={(event) => setUnify(event.currentTarget.checked)}
        />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:flex sm:items-end">
          <Select
            label="Motivo do ajuste ±"
            data={REASONS}
            value={adjustReason}
            onChange={setAdjustReason}
            allowDeselect={false}
            className="sm:w-[180px]"
          />
          <TextInput
            label="Buscar"
            placeholder="Nome, set, localId…"
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
            className="sm:w-[240px]"
          />
        </div>
      </div>

      {groups.length === 0 ? (
        <Text c="dimmed" py="md">
          Nenhum item no inventário.
        </Text>
      ) : (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
          {groups.map((group) => {
            const single = group.items.length === 1 ? group.items[0] : null;
            return (
              <button
                key={group.key}
                type="button"
                onClick={() => setOpenGroupKey(group.key)}
                aria-label={`Abrir ${group.name}`}
                className="group min-w-0 cursor-pointer border-0 bg-transparent p-0 text-left text-[var(--sb-ink)] transition-transform hover:-translate-y-0.5"
              >
                <CardImage
                  src={group.imageUrl}
                  alt={group.name}
                  dimmed={group.quantity === 0}
                  sizes="(max-width: 640px) 30vw, 150px"
                  className="group-hover:ring-2 group-hover:ring-[var(--sb-accent)]"
                >
                  <span className="absolute bottom-1 left-1/2 min-w-8 -translate-x-1/2 rounded-full bg-black/75 px-2 py-0.5 text-center text-sm font-bold text-white shadow">
                    ×{group.quantity}
                  </span>
                  {group.sleeved > 0 ? (
                    <Badge
                      size="xs"
                      color="green"
                      variant="filled"
                      className="absolute left-1 top-1"
                    >
                      {group.sleeved} sleeved
                    </Badge>
                  ) : null}
                </CardImage>
                <Text size="xs" fw={600} mt={4} lineClamp={1}>
                  {group.name}
                </Text>
                <Group gap={4} wrap="nowrap">
                  {single ? (
                    <>
                      <LanguageFlag code={single.language} width={14} />
                      <Text size="xs" c="dimmed" truncate>
                        {single.cardPrinting.set.code ?? single.cardPrinting.set.name} #
                        {single.cardPrinting.localId} · {single.condition}
                      </Text>
                    </>
                  ) : (
                    <Text size="xs" c="dimmed" truncate>
                      {group.items.length} lotes · troca{" "}
                      {group.availability.availableForTrade}
                    </Text>
                  )}
                </Group>
              </button>
            );
          })}
        </div>
      )}

      <Modal
        opened={openGroup !== null}
        onClose={() => {
          setOpenGroupKey(null);
          setHistoryItemId(null);
        }}
        title={openGroup?.name}
        size="lg"
        centered
      >
        {openGroup ? (
          <Stack gap="sm">
            <Text size="sm" c="dimmed">
              Carta lógica: owned {openGroup.availability.ownedQuantity} · sleeved{" "}
              {openGroup.availability.sleevedAllocatedQuantity} · protegidas{" "}
              {openGroup.availability.protectedQuantity} · disponíveis p/ troca{" "}
              {openGroup.availability.availableForTrade}
            </Text>
            {openGroup.items.map((item) => (
              <Paper
                key={item.id}
                p="sm"
                radius="md"
                className="border border-[var(--sb-line)] bg-[var(--sb-panel)]"
              >
                <div className="flex items-start gap-3">
                  <CardThumb
                    src={item.cardPrinting.imageUrl}
                    alt={item.cardPrinting.name}
                    width={56}
                  />
                  <div className="min-w-0 flex-1">
                    <Text fw={600} size="sm" truncate>
                      {item.cardPrinting.set.name}
                    </Text>
                    <Group gap={6} mt={2} wrap="wrap">
                      <LanguageFlag code={item.language} />
                      <Text size="xs" c="dimmed">
                        {item.cardPrinting.set.code ?? "—"} #{item.cardPrinting.localId}
                      </Text>
                      <Badge variant="light" size="sm">
                        {item.condition}
                      </Badge>
                      <Badge
                        variant="light"
                        size="sm"
                        color={item.collectionStatus === "COMPETITIVE" ? "ember" : "ink"}
                      >
                        {item.collectionStatus}
                      </Badge>
                    </Group>
                    <Text size="xs" c="dimmed" mt={4}>
                      Sleeved {item.sleevedAllocatedQuantity}
                    </Text>
                  </div>
                  <Group gap={6} wrap="nowrap" className="shrink-0">
                    <ActionIcon
                      size="lg"
                      variant="default"
                      aria-label="Diminuir"
                      disabled={pending || item.quantity <= item.sleevedAllocatedQuantity}
                      onClick={() => void onAdjust(item.id, -1)}
                    >
                      −
                    </ActionIcon>
                    <Text fw={700} w={28} ta="center">
                      {item.quantity}
                    </Text>
                    <ActionIcon
                      size="lg"
                      variant="default"
                      aria-label="Aumentar"
                      disabled={pending}
                      onClick={() => void onAdjust(item.id, 1)}
                    >
                      +
                    </ActionIcon>
                  </Group>
                </div>
                <Group justify="flex-end" mt={4}>
                  <Button
                    variant="subtle"
                    size="compact-xs"
                    onClick={() => void toggleHistory(item.id)}
                  >
                    {historyItemId === item.id ? "Ocultar histórico" : "Histórico"}
                  </Button>
                </Group>
                {historyItemId === item.id ? (
                  <Stack gap={2} mt="xs" className="border-t border-[var(--sb-line)] pt-2">
                    {historyLoading ? (
                      <Text size="xs" c="dimmed">
                        Carregando…
                      </Text>
                    ) : history.length === 0 ? (
                      <Text size="xs" c="dimmed">
                        Sem transações.
                      </Text>
                    ) : (
                      history.map((tx) => (
                        <div key={tx.id} className="flex justify-between gap-2 text-xs">
                          <span>
                            {tx.quantityDelta > 0 ? "+" : ""}
                            {tx.quantityDelta} {tx.reason}
                            {tx.note ? ` — ${tx.note}` : ""}
                          </span>
                          <span className="shrink-0 text-[color-mix(in_srgb,var(--sb-ink)_55%,transparent)]">
                            {new Date(tx.createdAt).toLocaleString("pt-BR")}
                          </span>
                        </div>
                      ))
                    )}
                  </Stack>
                ) : null}
              </Paper>
            ))}
          </Stack>
        ) : null}
      </Modal>
    </Stack>
  );
}
