"use client";

import { useEffect, useState } from "react";
import { Alert, Badge, Group, Loader, Stack, Table, Text } from "@mantine/core";
import { CardThumb } from "@/modules/cards/ui/CardImage";
import type { InventoryCheckResult } from "@/server/services/inventory-check-compute";
import { useI18n } from "@/lib/i18n/I18nProvider";

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
  const { t, te } = useI18n();
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
          setError(te(data.error) ?? t("check.failed"));
        } else {
          setError(null);
          setCheck(data.inventoryCheck);
          onLoaded?.(data.inventoryCheck);
        }
      } catch {
        if (!cancelled) setError(t("check.loadError"));
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
      className="rounded-xl border border-[var(--sb-line)] bg-[var(--sb-panel)]/85 p-4"
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
  const { t, tEnum } = useI18n();
  const { summary } = check;
  const deckList = (decks: Array<{ deckName: string; quantity: number }>) =>
    decks.map((s) => `${s.deckName} (${s.quantity})`).join(", ");
  if (check.lines.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        {t("check.noCards")}
      </Text>
    );
  }

  return (
    <Stack gap="sm">
      <Group gap="xs" wrap="wrap">
        <Badge color="green" variant="light">
          {t("check.ownedCount", { count: summary.owned })}
        </Badge>
        <Badge color="yellow" variant="light">
          {t("check.partialCount", { count: summary.partial })}
        </Badge>
        <Badge color="red" variant="light">
          {t("check.missingCount", { count: summary.missing })}
        </Badge>
        <Text size="sm" c="dimmed">
          {t("check.copiesOwned", { owned: summary.totalOwned, required: summary.totalRequired })}
        </Text>
      </Group>

      {summary.readyToSleeve ? (
        <Alert color="green" variant="light">
          {t("check.ready")}
        </Alert>
      ) : summary.resolvableByTransfer ? (
        <Alert color="yellow" variant="light">
          {t("check.transfer", { decks: deckList(summary.suggestedSourceDecks) })}
        </Alert>
      ) : (
        <Alert color="red" variant="light">
          {t("check.missing")}
          {summary.suggestedSourceDecks.length > 0
            ? t("check.partlyIn", { decks: deckList(summary.suggestedSourceDecks) })
            : ""}
        </Alert>
      )}

      <div className="overflow-x-auto">
        <Table striped withTableBorder={false} verticalSpacing={4} fz="sm">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{t("check.card")}</Table.Th>
              <Table.Th className="text-right">{t("check.owned")}</Table.Th>
              <Table.Th className="hidden text-right sm:table-cell">{t("check.free")}</Table.Th>
              <Table.Th>{t("common.status")}</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {check.lines.map((line) => (
              <Table.Tr key={line.logicalCardId}>
                <Table.Td>
                  <Group gap="xs" wrap="nowrap">
                    <CardThumb src={line.imageUrl} alt={line.canonicalName} width={32} />
                    <span>
                      {line.required} × {line.canonicalName}
                    </span>
                  </Group>
                  {line.sourceDecks.length > 0 && line.physicalShortage > 0 ? (
                    <Text size="xs" c="dimmed">
                      {t("check.inUse", { decks: deckList(line.sourceDecks) })}
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
                    {tEnum("inventoryCheck", line.status)}
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
