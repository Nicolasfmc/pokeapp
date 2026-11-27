"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Group,
  NumberInput,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useI18n } from "@/lib/i18n/I18nProvider";

type FormatOption = { id: string; code: string; name: string };

const num = (value: string | number) => (typeof value === "number" ? value : "");

export function HostedCreateForm({ formats }: { formats: FormatOption[] }) {
  const { t, te, tEnum } = useI18n();
  const router = useRouter();
  const defaultFormat = formats.find((f) => f.code.toUpperCase() === "STANDARD") ?? formats[0];

  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [locationType, setLocationType] = useState<"IN_PERSON" | "ONLINE">("IN_PERSON");
  const [location, setLocation] = useState("");
  const [formatId, setFormatId] = useState<string | null>(defaultFormat?.id ?? null);
  const [bestOf, setBestOf] = useState<"1" | "3">("3");
  const [deckPolicy, setDeckPolicy] = useState<"REQUIRED" | "OPTIONAL">("REQUIRED");
  const [rounds, setRounds] = useState<number | "">("");
  const [minutes, setMinutes] = useState<number | "">(50);
  const [maxPlayers, setMaxPlayers] = useState<number | "">("");
  const [pointsWin, setPointsWin] = useState<number | "">(3);
  const [pointsDraw, setPointsDraw] = useState<number | "">(1);
  const [pointsLoss, setPointsLoss] = useState<number | "">(0);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function onBestOf(value: string) {
    const next = value === "1" ? "1" : "3";
    // Follow the usual timers unless the organizer typed another value.
    if (minutes === (bestOf === "3" ? 50 : 30)) setMinutes(next === "3" ? 50 : 30);
    setBestOf(next);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      const response = await fetch("/api/hosted-tournaments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          // datetime-local is the organizer's local time: send it as an instant.
          date: date ? new Date(date).toISOString() : null,
          locationType,
          location: locationType === "IN_PERSON" ? location : null,
          formatId,
          bestOf: Number(bestOf),
          deckPolicy,
          plannedRounds: rounds === "" ? null : rounds,
          roundMinutes: minutes === "" ? undefined : minutes,
          maxPlayers: maxPlayers === "" ? null : maxPlayers,
          pointsWin: pointsWin === "" ? 3 : pointsWin,
          pointsDraw: pointsDraw === "" ? 1 : pointsDraw,
          pointsLoss: pointsLoss === "" ? 0 : pointsLoss,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as { code?: string; error?: string };
      if (!response.ok || !data.code) {
        setError(te(data.error) ?? t("hosted.createError"));
        setPending(false);
        return;
      }
      router.push(`/t/${data.code}`);
    } catch {
      setError(t("hosted.createError"));
      setPending(false);
    }
  }

  return (
    <Stack gap="lg" className="max-w-3xl animate-[sb-rise_0.45s_ease-out]">
      <Text component={Link} href="/tournaments?tab=hosted" size="sm" c="dimmed" className="no-underline hover:underline">
        {t("hosted.back")}
      </Text>
      <div>
        <Title order={2}>{t("hosted.createTitle")}</Title>
        <Text c="dimmed" size="sm" mt={4}>
          {t("hosted.createSubtitle")}
        </Text>
      </div>

      <form onSubmit={onSubmit}>
        <Stack gap="md" className="rounded-xl border border-[var(--sb-line)] bg-[var(--sb-panel)]/80 px-4 py-4">
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            <TextInput
              label={t("hosted.name")}
              required
              minLength={3}
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.currentTarget.value)}
            />
            <TextInput
              label={t("hosted.date")}
              type="datetime-local"
              value={date}
              onChange={(e) => setDate(e.currentTarget.value)}
            />
          </SimpleGrid>

          <Stack gap={6}>
            <Text size="sm" fw={500}>
              {t("hosted.locationType")}
            </Text>
            <SegmentedControl
              value={locationType}
              onChange={(value) => setLocationType(value as typeof locationType)}
              data={[
                { value: "IN_PERSON", label: t("hosted.inPerson") },
                { value: "ONLINE", label: t("hosted.online") },
              ]}
            />
            {locationType === "IN_PERSON" ? (
              <TextInput
                aria-label={t("hosted.location")}
                placeholder={t("hosted.locationPlaceholder")}
                required
                maxLength={120}
                value={location}
                onChange={(e) => setLocation(e.currentTarget.value)}
              />
            ) : null}
          </Stack>

          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            <Select
              label={t("hosted.format")}
              required
              allowDeselect={false}
              data={formats.map((f) => ({ value: f.id, label: tEnum("format", f.code) }))}
              value={formatId}
              onChange={setFormatId}
            />
            <Stack gap={6}>
              <Text size="sm" fw={500}>
                {t("hosted.bestOf")}
              </Text>
              <SegmentedControl
                value={bestOf}
                onChange={onBestOf}
                data={[
                  { value: "1", label: t("hosted.bo1") },
                  { value: "3", label: t("hosted.bo3") },
                ]}
              />
            </Stack>
          </SimpleGrid>

          <Stack gap={6}>
            <Text size="sm" fw={500}>
              {t("hosted.deckPolicy")}
            </Text>
            <SegmentedControl
              value={deckPolicy}
              onChange={(value) => setDeckPolicy(value as typeof deckPolicy)}
              data={[
                { value: "REQUIRED", label: t("hosted.deckRequired") },
                { value: "OPTIONAL", label: t("hosted.deckOptional") },
              ]}
            />
            <Text size="xs" c="dimmed">
              {deckPolicy === "REQUIRED" ? t("hosted.deckRequiredHint") : t("hosted.deckOptionalHint")}
            </Text>
          </Stack>

          <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
            <NumberInput
              label={t("hosted.rounds")}
              description={t("hosted.roundsHint")}
              placeholder={t("hosted.roundsAuto")}
              min={1}
              max={20}
              value={rounds}
              onChange={(v) => setRounds(num(v))}
            />
            <NumberInput
              label={t("hosted.roundMinutes")}
              min={5}
              max={180}
              required
              value={minutes}
              onChange={(v) => setMinutes(num(v))}
            />
            <NumberInput
              label={t("hosted.maxPlayers")}
              placeholder={t("hosted.noLimit")}
              min={2}
              max={512}
              value={maxPlayers}
              onChange={(v) => setMaxPlayers(num(v))}
            />
          </SimpleGrid>

          <Stack gap={6}>
            <Text size="sm" fw={500}>
              {t("hosted.points")}
            </Text>
            <SimpleGrid cols={3} spacing="md">
              <NumberInput label={t("hosted.pointsWin")} min={0} max={10} value={pointsWin} onChange={(v) => setPointsWin(num(v))} />
              <NumberInput label={t("hosted.pointsDraw")} min={0} max={10} value={pointsDraw} onChange={(v) => setPointsDraw(num(v))} />
              <NumberInput label={t("hosted.pointsLoss")} min={0} max={10} value={pointsLoss} onChange={(v) => setPointsLoss(num(v))} />
            </SimpleGrid>
          </Stack>

          {error ? (
            <Text c="red" size="sm">
              {error}
            </Text>
          ) : null}
          <Group justify="flex-end">
            <Button type="submit" loading={pending} disabled={!formatId}>
              {t("hosted.createSubmit")}
            </Button>
          </Group>
        </Stack>
      </form>
    </Stack>
  );
}
