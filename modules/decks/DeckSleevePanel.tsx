"use client";

import { useEffect, useState, startTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  Badge,
  Button,
  Group,
  Select,
  Stack,
  Text,
} from "@mantine/core";
import type { DeckDto } from "./types";
import { useI18n } from "@/lib/i18n/I18nProvider";

type AllocationRow = {
  id: string;
  quantity: number;
  printingName: string;
  setCode: string | null;
  logicalCardId: string;
};

type Props = {
  deck: DeckDto;
  onDeckChange: (deck: DeckDto) => void;
};

export function DeckSleevePanel({ deck, onDeckChange }: Props) {
  const router = useRouter();
  const { t, te, tEnum } = useI18n();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [sourceDeckId, setSourceDeckId] = useState<string | null>(null);
  const [sleevedSources, setSleevedSources] = useState<
    Array<{ value: string; label: string }>
  >([]);
  const [allocations, setAllocations] = useState<AllocationRow[]>([]);

  const isSleeved = deck.physicalStatus === "SLEEVED";

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/decks");
        const data = (await response.json()) as { decks?: DeckDto[] };
        if (!cancelled && response.ok) {
          setSleevedSources(
            (data.decks ?? [])
              .filter(
                (item) =>
                  item.id !== deck.id && item.physicalStatus === "SLEEVED",
              )
              .map((item) => ({
                value: item.id,
                label: `${item.name} (${tEnum("format", item.format.code)})`,
              })),
          );
        }
      } catch {
        /* silent */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [deck.id, deck.physicalStatus, tEnum]);

  useEffect(() => {
    if (!isSleeved) {
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(`/api/decks/${deck.id}/sleeve`);
        const data = (await response.json()) as {
          allocations?: AllocationRow[];
        };
        if (!cancelled && response.ok) {
          setAllocations(data.allocations ?? []);
        }
      } catch {
        /* silent */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [deck.id, isSleeved, deck.updatedAt]);

  const visibleAllocations = isSleeved ? allocations : [];

  async function onSleeve() {
    setError(null);
    setMessage(null);
    setPending(true);
    try {
      const response = await fetch(`/api/decks/${deck.id}/sleeve`, {
        method: "POST",
      });
      const data = (await response.json()) as {
        deck?: DeckDto;
        allocations?: AllocationRow[];
        error?: string;
      };
      if (!response.ok || !data.deck) {
        setError(te(data.error) ?? t("sleeve.markFailed"));
        setPending(false);
        return;
      }
      onDeckChange(data.deck);
      setAllocations(data.allocations ?? []);
      setMessage(t("sleeve.marked"));
      setPending(false);
      startTransition(() => router.refresh());
    } catch {
      setError(t("sleeve.markError"));
      setPending(false);
    }
  }

  async function onUnsleeve() {
    setError(null);
    setMessage(null);
    setPending(true);
    try {
      const response = await fetch(`/api/decks/${deck.id}/unsleeve`, {
        method: "POST",
      });
      const data = (await response.json()) as {
        deck?: DeckDto;
        error?: string;
      };
      if (!response.ok || !data.deck) {
        setError(te(data.error) ?? t("sleeve.unsleeveFailed"));
        setPending(false);
        return;
      }
      onDeckChange(data.deck);
      setAllocations([]);
      setMessage(t("sleeve.unsleeved"));
      setPending(false);
      startTransition(() => router.refresh());
    } catch {
      setError(t("sleeve.unsleeveError"));
      setPending(false);
    }
  }

  async function onTransfer() {
    if (!sourceDeckId) {
      setError(t("sleeve.pickSource"));
      return;
    }
    setError(null);
    setMessage(null);
    setPending(true);
    try {
      const response = await fetch(`/api/decks/${deck.id}/transfer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceDeckId }),
      });
      const data = (await response.json()) as {
        targetDeck?: DeckDto;
        allocations?: AllocationRow[];
        error?: string;
      };
      if (!response.ok || !data.targetDeck) {
        setError(te(data.error) ?? t("sleeve.transferFailed"));
        setPending(false);
        return;
      }
      onDeckChange(data.targetDeck);
      setAllocations(data.allocations ?? []);
      setSourceDeckId(null);
      setMessage(t("sleeve.transferred"));
      setPending(false);
      startTransition(() => router.refresh());
    } catch {
      setError(t("sleeve.transferError"));
      setPending(false);
    }
  }

  return (
    <Stack
      gap="sm"
      className="rounded-xl border border-[var(--sb-line)] bg-[var(--sb-panel)]/85 p-4"
    >
      <Group justify="space-between" align="center">
        <Text fw={700}>{t("sleeve.title")}</Text>
        <Badge color={isSleeved ? "green" : "gray"} variant="light">
          {tEnum("physicalStatus", deck.physicalStatus)}
        </Badge>
      </Group>
      <Text size="sm" c="dimmed">
        {t("sleeve.hint")}
      </Text>

      {error ? <Alert color="red">{error}</Alert> : null}
      {message ? <Alert color="green">{message}</Alert> : null}

      <Group gap="sm" wrap="wrap">
        {!isSleeved ? (
          <Button loading={pending} onClick={onSleeve}>
            {t("sleeve.mark")}
          </Button>
        ) : (
          <Button loading={pending} variant="light" onClick={onUnsleeve}>
            {t("sleeve.unsleeve")}
          </Button>
        )}
      </Group>

      {!isSleeved ? (
        <Stack gap="xs">
          <Select
            label={t("sleeve.transferFrom")}
            placeholder={t("sleeve.source")}
            data={sleevedSources}
            value={sourceDeckId}
            onChange={setSourceDeckId}
            searchable
            clearable
            disabled={sleevedSources.length === 0}
          />
          <Button
            loading={pending}
            variant="light"
            onClick={onTransfer}
            disabled={!sourceDeckId}
          >
            {t("sleeve.transferAndSleeve")}
          </Button>
        </Stack>
      ) : null}

      {isSleeved && visibleAllocations.length > 0 ? (
        <Stack gap={4}>
          <Text size="sm" fw={600}>
            {t("sleeve.allocations", { count: visibleAllocations.length })}
          </Text>
          {visibleAllocations.slice(0, 12).map((row) => (
            <Text key={row.id} size="xs" c="dimmed">
              {row.quantity}× {row.printingName}
              {row.setCode ? ` (${row.setCode})` : ""}
            </Text>
          ))}
          {visibleAllocations.length > 12 ? (
            <Text size="xs" c="dimmed">
              {t("sleeve.morePrintings", { count: visibleAllocations.length - 12 })}
            </Text>
          ) : null}
        </Stack>
      ) : null}
    </Stack>
  );
}
