"use client";

import { FormEvent, useEffect, useState, startTransition } from "react";
import {
  ActionIcon,
  Alert,
  Button,
  Group,
  NumberInput,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
  Badge,
  SegmentedControl,
  Collapse,
  Paper,
} from "@mantine/core";

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

  const [tcgdexId, setTcgdexId] = useState("");
  const [quantity, setQuantity] = useState<number | string>(1);
  const [condition, setCondition] = useState<string | null>("NM");
  const [language, setLanguage] = useState("en");
  const [collectionStatus, setCollectionStatus] = useState<string | null>(
    "COMPETITIVE",
  );
  const [reason, setReason] = useState<string | null>("PURCHASE");
  const [note, setNote] = useState("");
  const [adjustReason, setAdjustReason] = useState<string | null>("CORRECTION");

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
          tcgdexId: tcgdexId.trim(),
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

      setTcgdexId("");
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
        <Text className="mt-2 max-w-2xl text-[color-mix(in_srgb,var(--poke-ink)_75%,transparent)]">
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
        className="border border-[var(--poke-line)] bg-[var(--poke-panel)]"
      >
        <form onSubmit={onAdd}>
          <Stack gap="sm">
            <Text fw={600}>Adicionar carta</Text>
            <Group grow align="flex-end">
              <TextInput
                label="TCGdex ID"
                placeholder="ex.: swsh3-136"
                value={tcgdexId}
                onChange={(event) => setTcgdexId(event.currentTarget.value)}
                required
              />
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
              <TextInput
                label="Idioma"
                value={language}
                onChange={(event) => setLanguage(event.currentTarget.value)}
              />
            </Group>
            <Group grow align="flex-end">
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
                disabled={!tcgdexId.trim()}
              >
                Adicionar
              </Button>
            </Group>
          </Stack>
        </form>
      </Paper>

      <Group justify="space-between" align="flex-end">
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
        <Group align="flex-end">
          <Select
            label="Motivo do ajuste ±"
            data={REASONS}
            value={adjustReason}
            onChange={setAdjustReason}
            allowDeselect={false}
            w={180}
          />
          <TextInput
            label="Buscar"
            placeholder="Nome, set, localId…"
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
            w={240}
          />
        </Group>
      </Group>

      <Paper
        radius="md"
        className="overflow-x-auto border border-[var(--poke-line)] bg-[var(--poke-panel)]"
      >
        <Table
          striped
          highlightOnHover
          horizontalSpacing="md"
          verticalSpacing="sm"
        >
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Carta</Table.Th>
              <Table.Th>Condição</Table.Th>
              <Table.Th>Idioma</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Qtd</Table.Th>
              <Table.Th>Sleeved</Table.Th>
              <Table.Th>Trade (lógica)</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {items.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={8}>
                  <Text c="dimmed" py="md">
                    Nenhum item no inventário.
                  </Text>
                </Table.Td>
              </Table.Tr>
            ) : (
              items.map((item) => (
                <Table.Tr key={item.id}>
                  <Table.Td>
                    <Stack gap={2}>
                      <Text fw={600}>{item.cardPrinting.name}</Text>
                      <Text size="sm" c="dimmed">
                        {item.cardPrinting.set.code ??
                          item.cardPrinting.set.name}{" "}
                        · #{item.cardPrinting.localId} ·{" "}
                        {item.cardPrinting.tcgdexId}
                      </Text>
                    </Stack>
                  </Table.Td>
                  <Table.Td>
                    <Badge variant="light">{item.condition}</Badge>
                  </Table.Td>
                  <Table.Td>{item.language}</Table.Td>
                  <Table.Td>
                    <Badge
                      color={
                        item.collectionStatus === "COMPETITIVE" ? "ember" : "ink"
                      }
                      variant="light"
                    >
                      {item.collectionStatus}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Group gap={6} wrap="nowrap">
                      <ActionIcon
                        variant="default"
                        aria-label="Diminuir"
                        disabled={
                          pending ||
                          item.quantity <= item.sleevedAllocatedQuantity
                        }
                        onClick={() => void onAdjust(item.id, -1)}
                      >
                        −
                      </ActionIcon>
                      <Text fw={600} w={28} ta="center">
                        {item.quantity}
                      </Text>
                      <ActionIcon
                        variant="default"
                        aria-label="Aumentar"
                        disabled={pending}
                        onClick={() => void onAdjust(item.id, 1)}
                      >
                        +
                      </ActionIcon>
                    </Group>
                  </Table.Td>
                  <Table.Td>{item.sleevedAllocatedQuantity}</Table.Td>
                  <Table.Td>
                    <Stack gap={0}>
                      <Text size="sm">
                        Disp. {item.logicalAvailability.availableForTrade}
                      </Text>
                      <Text size="xs" c="dimmed">
                        owned {item.logicalAvailability.ownedQuantity} · prot{" "}
                        {item.logicalAvailability.protectedQuantity}
                      </Text>
                    </Stack>
                  </Table.Td>
                  <Table.Td>
                    <Button
                      variant="subtle"
                      size="compact-sm"
                      onClick={() => void toggleHistory(item.id)}
                    >
                      {historyItemId === item.id ? "Ocultar" : "Histórico"}
                    </Button>
                  </Table.Td>
                </Table.Tr>
              ))
            )}
          </Table.Tbody>
        </Table>
      </Paper>

      <Collapse in={historyItemId != null}>
        <Paper
          p="md"
          radius="md"
          className="border border-[var(--poke-line)] bg-[var(--poke-panel)]"
        >
          <Text fw={600} mb="sm">
            Transações
          </Text>
          {historyLoading ? (
            <Text c="dimmed">Carregando…</Text>
          ) : history.length === 0 ? (
            <Text c="dimmed">Sem transações.</Text>
          ) : (
            <Stack gap="xs">
              {history.map((tx) => (
                <Group key={tx.id} justify="space-between">
                  <Text>
                    {tx.quantityDelta > 0 ? "+" : ""}
                    {tx.quantityDelta} {tx.reason}
                    {tx.note ? ` — ${tx.note}` : ""}
                  </Text>
                  <Text size="sm" c="dimmed">
                    {new Date(tx.createdAt).toLocaleString("pt-BR")}
                  </Text>
                </Group>
              ))}
            </Stack>
          )}
        </Paper>
      </Collapse>
    </Stack>
  );
}
