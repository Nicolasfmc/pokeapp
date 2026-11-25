"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState, startTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Group,
  NumberInput,
  Select,
  Stack,
  Text,
  TextInput,
  Title,
  Badge,
  SimpleGrid,
} from "@mantine/core";
import type { FormatOption, TournamentListItemDto } from "./types";
import { useI18n } from "@/lib/i18n/I18nProvider";

async function readError(response: Response) {
  const data = (await response.json().catch(() => ({}))) as {
    error?: string;
  };
  return data.error;
}


export function TournamentListPanel({
  initialTournaments,
}: {
  initialTournaments: TournamentListItemDto[];
}) {
  const router = useRouter();
  const { t, te, tEnum, formatDate: fmtDate } = useI18n();
  const failMessage = async (response: Response) =>
    te(await readError(response)) ?? t("tournaments.opFailed");
  const formatDate = (value: string | null) =>
    !value || Number.isNaN(new Date(value).getTime()) ? "—" : fmtDate(value);
  const [tournaments, setTournaments] = useState(initialTournaments);
  const [formats, setFormats] = useState<FormatOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [location, setLocation] = useState("");
  const [formatId, setFormatId] = useState<string | null>(null);
  const [placement, setPlacement] = useState<number | "">("");
  const [participantCount, setParticipantCount] = useState<number | "">("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/decks/formats");
        if (!response.ok) return;
        const data = (await response.json()) as {
          formats?: FormatOption[];
        };
        if (!cancelled) {
          setFormats(data.formats ?? []);
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      const response = await fetch("/api/tournaments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          date: date || null,
          location: location || null,
          formatId: formatId || null,
          placement: placement === "" ? null : placement,
          participantCount: participantCount === "" ? null : participantCount,
        }),
      });
      if (!response.ok) {
        setError(await failMessage(response));
        setPending(false);
        return;
      }
      const data = (await response.json()) as {
        tournament: TournamentListItemDto & { tournamentMatches?: unknown[] };
      };
      const item: TournamentListItemDto = {
        id: data.tournament.id,
        userId: data.tournament.userId,
        name: data.tournament.name,
        date: data.tournament.date,
        location: data.tournament.location,
        formatId: data.tournament.formatId,
        format: data.tournament.format,
        placement: data.tournament.placement,
        participantCount: data.tournament.participantCount,
        matchCount: Array.isArray(data.tournament.tournamentMatches)
          ? data.tournament.tournamentMatches.length
          : 0,
        createdAt: data.tournament.createdAt,
        updatedAt: data.tournament.updatedAt,
      };
      setTournaments((prev) => [item, ...prev]);
      setName("");
      setDate("");
      setLocation("");
      setFormatId(null);
      setPlacement("");
      setParticipantCount("");
      setPending(false);
      startTransition(() => router.refresh());
      router.push(`/tournaments/${item.id}`);
    } catch {
      setError(t("tournaments.createError"));
      setPending(false);
    }
  }

  async function onDelete(tournamentId: string) {
    setError(null);
    setPendingId(tournamentId);
    try {
      const response = await fetch(`/api/tournaments/${tournamentId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        setError(await failMessage(response));
        setPendingId(null);
        return;
      }
      setTournaments((prev) => prev.filter((t) => t.id !== tournamentId));
      setPendingId(null);
      startTransition(() => router.refresh());
    } catch {
      setError(t("tournaments.deleteError"));
      setPendingId(null);
    }
  }

  return (
    <Stack gap="lg" className="max-w-5xl animate-[sb-rise_0.45s_ease-out]">
      <div>
        <Title order={2}>{t("nav.tournaments")}</Title>
        <Text c="dimmed" size="sm" mt={4}>
          {t("tournaments.subtitle")}
        </Text>
      </div>

      {error ? (
        <Text c="red" size="sm">
          {error}
        </Text>
      ) : null}

      <form onSubmit={onCreate}>
        <Stack
          gap="sm"
          className="rounded-xl border border-[var(--sb-line)] bg-[var(--sb-panel)]/80 px-4 py-4"
        >
          <Text fw={600}>{t("tournaments.new")}</Text>
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            <TextInput
              label={t("common.name")}
              required
              value={name}
              onChange={(e) => setName(e.currentTarget.value)}
            />
            <TextInput
              label={t("common.date")}
              type="date"
              value={date}
              onChange={(e) => setDate(e.currentTarget.value)}
            />
          </SimpleGrid>
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            <TextInput
              label={t("tournaments.location")}
              value={location}
              onChange={(e) => setLocation(e.currentTarget.value)}
            />
            <Select
              label={t("common.format")}
              clearable
              data={formats.map((f) => ({ value: f.id, label: tEnum("format", f.name) }))}
              value={formatId}
              onChange={setFormatId}
            />
          </SimpleGrid>
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            <NumberInput
              label={t("tournaments.placement")}
              min={1}
              value={placement}
              onChange={(value) =>
                setPlacement(typeof value === "number" ? value : "")
              }
            />
            <NumberInput
              label={t("tournaments.participants")}
              min={1}
              value={participantCount}
              onChange={(value) =>
                setParticipantCount(typeof value === "number" ? value : "")
              }
            />
          </SimpleGrid>
          <Group justify="flex-end">
            <Button type="submit" loading={pending}>
              {t("tournaments.create")}
            </Button>
          </Group>
        </Stack>
      </form>

      {tournaments.length === 0 ? (
        <Stack
          gap="sm"
          className="rounded-xl border border-[var(--sb-line)] bg-[var(--sb-panel)]/80 px-6 py-10"
        >
          <Text fw={600}>{t("tournaments.empty")}</Text>
          <Text c="dimmed" size="sm">
            {t("tournaments.emptyHint")}
          </Text>
        </Stack>
      ) : (
        <Stack gap="sm">
          {tournaments.map((tournament) => (
            <Group
              key={tournament.id}
              justify="space-between"
              align="center"
              wrap="nowrap"
              className="rounded-xl border border-[var(--sb-line)] bg-[var(--sb-panel)]/85 px-4 py-3 transition-colors hover:border-[var(--sb-accent)]"
            >
              <Stack gap={4} style={{ minWidth: 0, flex: 1 }}>
                <Group gap="sm" wrap="wrap">
                  <Text
                    component={Link}
                    href={`/tournaments/${tournament.id}`}
                    fw={700}
                    className="text-[var(--sb-ink)] no-underline hover:underline"
                  >
                    {tournament.name}
                  </Text>
                  {tournament.format ? (
                    <Badge variant="light">{tEnum("format", tournament.format.name)}</Badge>
                  ) : null}
                  {tournament.placement != null ? (
                    <Badge variant="outline">#{tournament.placement}</Badge>
                  ) : null}
                </Group>
                <Text size="sm" c="dimmed">
                  {formatDate(tournament.date)}
                  {tournament.location ? ` · ${tournament.location}` : ""}
                  {tournament.participantCount != null
                    ? t("tournaments.players", { count: tournament.participantCount })
                    : ""}
                  {t("tournaments.matches", { count: tournament.matchCount })}
                </Text>
              </Stack>
              <Group gap="xs" wrap="nowrap">
                <Button
                  component={Link}
                  href={`/tournaments/${tournament.id}`}
                  variant="light"
                  size="compact-sm"
                >
                  {t("tournaments.open")}
                </Button>
                <Button
                  variant="subtle"
                  color="red"
                  size="compact-sm"
                  aria-label={t("tournaments.deleteNamed", { name: tournament.name })}
                  loading={pendingId === tournament.id}
                  onClick={() => void onDelete(tournament.id)}
                >
                  {t("common.delete")}
                </Button>
              </Group>
            </Group>
          ))}
        </Stack>
      )}
    </Stack>
  );
}
