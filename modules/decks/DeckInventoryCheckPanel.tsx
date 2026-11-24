"use client";

import { useEffect, useState } from "react";
import { Alert, Badge, Group, Loader, Stack, Table, Text } from "@mantine/core";
import type { InventoryCheckResult } from "@/server/services/inventory-check-compute";

const STATUS_COLOR: Record<string, string> = {
  OWNED: "green",
  PARTIAL: "yellow",
  MISSING: "red",
};

type Props = {
  deckId: string;
  /** Muda quando o deck é salvo/sleevado, para recarregar o check. */
  refreshKey: string;
  /** Resultado já calculado (ex.: logo após import), evita um fetch. */
  initial?: InventoryCheckResult | null;
  onLoaded?: (result: InventoryCheckResult) => void;
};

/** §56 — Inventory Check: OWNED / PARTIAL / MISSING por carta lógica. */
export function DeckInventoryCheckPanel({ deckId, refreshKey, initial, onLoaded }: Props) {
  const [check, setCheck] = useState<InventoryCheckResult | null>(initial ?? null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!initial);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/decks/${deckId}/inventory-check`);
        const data = (await response.json()) as {
          inventoryCheck?: InventoryCheckResult;
          error?: string;
        };
        if (cancelled) return;
        if (!response.ok || !data.inventoryCheck) {
          setError(data.error ?? "Falha no Inventory Check.");
        } else {
          setError(null);
          setCheck(data.inventoryCheck);
          onLoaded?.(data.inventoryCheck);
        }
      } catch {
        if (!cancelled) setError("Não foi possível carregar o Inventory Check.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // onLoaded é callback do pai; não deve disparar refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deckId, refreshKey]);

  return (
    <Stack
      gap="sm"
      className="rounded-xl border border-[var(--poke-line)] bg-[var(--poke-panel)]/85 p-4"
    >
      <Group justify="space-between">
        <Text fw={700}>Inventory Check</Text>
        {loading ? <Loader size="xs" /> : null}
      </Group>
      {error ? <Alert color="red">{error}</Alert> : null}
      {check ? <InventoryCheckTable check={check} /> : null}
    </Stack>
  );
}

export function InventoryCheckTable({ check }: { check: InventoryCheckResult }) {
  const { summary } = check;
  if (check.lines.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        Deck sem cartas.
      </Text>
    );
  }

  return (
    <Stack gap="sm">
      <Group gap="xs" wrap="wrap">
        <Badge color="green" variant="light">
          {summary.owned} OWNED
        </Badge>
        <Badge color="yellow" variant="light">
          {summary.partial} PARTIAL
        </Badge>
        <Badge color="red" variant="light">
          {summary.missing} MISSING
        </Badge>
        <Text size="sm" c="dimmed">
          {summary.totalOwned}/{summary.totalRequired} cópias possuídas
        </Text>
      </Group>

      {summary.readyToSleeve ? (
        <Alert color="green" variant="light">
          Todas as cartas estão fisicamente disponíveis: o deck pode ser marcado
          como SLEEVED.
        </Alert>
      ) : summary.resolvableByTransfer ? (
        <Alert color="yellow" variant="light">
          Você possui todas as cartas, mas parte delas está em outro deck
          SLEEVED. Transfira de:{" "}
          {summary.suggestedSourceDecks
            .map((s) => `${s.deckName} (${s.quantity})`)
            .join(", ")}
          .
        </Alert>
      ) : (
        <Alert color="red" variant="light">
          Faltam cartas no Inventory para montar este deck fisicamente.
          {summary.suggestedSourceDecks.length > 0
            ? ` Parte está em: ${summary.suggestedSourceDecks
                .map((s) => `${s.deckName} (${s.quantity})`)
                .join(", ")}.`
            : ""}
        </Alert>
      )}

      <div className="overflow-x-auto">
        <Table striped withTableBorder={false} verticalSpacing={4} fz="sm">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Carta</Table.Th>
              <Table.Th className="text-right">Possuídas</Table.Th>
              <Table.Th className="hidden text-right sm:table-cell">Livres</Table.Th>
              <Table.Th>Status</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {check.lines.map((line) => (
              <Table.Tr key={line.logicalCardId}>
                <Table.Td>
                  {line.required} × {line.canonicalName}
                  {line.sourceDecks.length > 0 && line.physicalShortage > 0 ? (
                    <Text size="xs" c="dimmed">
                      em uso: {line.sourceDecks.map((s) => `${s.deckName} (${s.quantity})`).join(", ")}
                    </Text>
                  ) : null}
                </Table.Td>
                <Table.Td className="text-right">
                  {Math.min(line.owned, 99)}/{line.required}
                </Table.Td>
                <Table.Td className="hidden text-right sm:table-cell">
                  {line.freeForDeck}
                </Table.Td>
                <Table.Td>
                  <Badge color={STATUS_COLOR[line.status]} variant="light" size="sm">
                    {line.status}
                  </Badge>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </div>
    </Stack>
  );
}
