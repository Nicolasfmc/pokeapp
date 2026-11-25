"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState, startTransition } from "react";
import {
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
import type { InventoryCheckResult } from "@/server/services/inventory-check-compute";
import { InventoryCheckTable } from "./DeckInventoryCheckPanel";
import type { DeckDto, UnresolvedImportLine } from "./types";
import { useI18n } from "@/lib/i18n/I18nProvider";

type FormatOption = {
  id: string;
  code: string;
  name: string;
};

type ImportReport = {
  deck: DeckDto;
  validation: {
    valid: boolean;
    errors: Array<{ code: string; message: string }>;
    warnings: Array<{ code: string; message: string }>;
  };
  inventoryCheck: InventoryCheckResult;
  resolvedCount: number;
  unresolvedCount: number;
  unresolved: UnresolvedImportLine[];
  parseErrors: Array<{ code: string; message: string; lineNumber?: number }>;
  nameMismatches: Array<{
    expected: string;
    resolved: string;
    setCode: string;
    collectorNumber: string;
  }>;
};

const STATUS_COLOR: Record<string, string> = {
  READY: "green",
  IMPORTED: "blue",
  PARTIALLY_RESOLVED: "yellow",
  INVALID: "red",
};

function ImportReportView({ report, onReset }: { report: ImportReport; onReset: () => void }) {
  const { t, te, tEnum } = useI18n();
  const total = report.resolvedCount + report.unresolvedCount;
  const status = report.deck.importStatus ?? "IMPORTED";
  return (
    <Stack gap="lg" className="max-w-4xl animate-[sb-rise_0.45s_ease-out]">
      <div>
        <Group gap="sm">
          <Title order={2}>{t("decks.importOf", { name: report.deck.name })}</Title>
          <Badge color={STATUS_COLOR[status] ?? "gray"} variant="light" size="lg">
            {tEnum("importStatus", status)}
          </Badge>
        </Group>
        <Text c="dimmed" size="sm" mt={4}>
          {t("decks.resolvedOf", { resolved: report.resolvedCount, total })}
          {report.unresolvedCount > 0
            ? ` · ${t("decks.unresolvedCount", { count: report.unresolvedCount })}`
            : ""}
        </Text>
      </div>

      {report.unresolved.length > 0 ? (
        <Alert color="yellow" title={t("decks.unresolvedTitle")}>
          <Stack gap={2}>
            {report.unresolved.map((line, i) => (
              <Text key={`${line.setCode}-${line.collectorNumber}-${i}`} size="sm">
                {line.quantity} {line.name} {line.setCode} {line.collectorNumber} —{" "}
                {te(line.reason)}
              </Text>
            ))}
          </Stack>
        </Alert>
      ) : null}

      {report.parseErrors.length > 0 ? (
        <Alert color="orange" title={t("decks.parseErrorsTitle")}>
          <Stack gap={2}>
            {report.parseErrors.map((err, i) => (
              <Text key={`${err.code}-${i}`} size="sm">
                {err.lineNumber ? t("decks.lineN", { n: err.lineNumber }) : ""}
                {te(err.message)}
              </Text>
            ))}
          </Stack>
        </Alert>
      ) : null}

      {report.nameMismatches.length > 0 ? (
        <Alert color="blue" title={t("decks.nameMismatchTitle")}>
          <Stack gap={2}>
            {report.nameMismatches.map((m, i) => (
              <Text key={`${m.setCode}-${m.collectorNumber}-${i}`} size="sm">
                {t("decks.nameMismatch", { code: `${m.setCode} ${m.collectorNumber}`, expected: m.expected, resolved: m.resolved })}
              </Text>
            ))}
          </Stack>
        </Alert>
      ) : null}

      <Stack
        gap="xs"
        className="rounded-xl border border-[var(--sb-line)] bg-[var(--sb-panel)]/85 p-4"
      >
        <Group gap="sm">
          <Text fw={700}>{t("decks.formatValidation", { format: tEnum("format", report.deck.format.name) })}</Text>
          <Badge color={report.validation.valid ? "green" : "red"} variant="light">
            {report.validation.valid ? t("decks.valid") : t("decks.invalid")}
          </Badge>
        </Group>
        {report.validation.errors.map((issue, i) => (
          <Text key={`${issue.code}-${i}`} size="sm" c="red">
            {te(issue.message)}
          </Text>
        ))}
        {report.validation.warnings.map((issue, i) => (
          <Text key={`${issue.code}-${i}`} size="sm" c="orange">
            {te(issue.message)}
          </Text>
        ))}
      </Stack>

      <Stack
        gap="sm"
        className="rounded-xl border border-[var(--sb-line)] bg-[var(--sb-panel)]/85 p-4"
      >
        <Text fw={700}>Inventory Check</Text>
        <InventoryCheckTable check={report.inventoryCheck} />
      </Stack>

      <Group justify="space-between">
        <Button variant="subtle" onClick={onReset}>
          {t("decks.importAnother")}
        </Button>
        <Button component={Link} href={`/decks/${report.deck.id}`}>
          {t("decks.openDeck")}
        </Button>
      </Group>
    </Stack>
  );
}

const TAG_VALUES = ["FAVORITE", "TESTING", "ARCHIVED"] as const;

export function DeckImportPanel() {
  const router = useRouter();
  const { t, te, tEnum } = useI18n();
  const [formats, setFormats] = useState<FormatOption[]>([]);
  const [name, setName] = useState("");
  const [formatId, setFormatId] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [decklist, setDecklist] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [loadingFormats, setLoadingFormats] = useState(true);
  const [report, setReport] = useState<ImportReport | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/decks/formats");
        const data = (await response.json()) as {
          formats?: FormatOption[];
          error?: string;
        };
        if (!response.ok) {
          if (!cancelled) {
            setError(te(data.error) ?? t("decks.loadFormatsFailed"));
            setLoadingFormats(false);
          }
          return;
        }
        if (!cancelled) {
          setFormats(data.formats ?? []);
          setFormatId(
            (data.formats?.find((f) => f.code === "STANDARD") ?? data.formats?.[0])?.id ??
              null,
          );
          setLoadingFormats(false);
        }
      } catch {
        if (!cancelled) {
          setError(t("decks.loadFormatsError"));
          setLoadingFormats(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [t, te]);

  function toggleTag(tag: string) {
    setTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    try {
      const response = await fetch("/api/decks/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          formatId,
          description: description || null,
          tags,
          decklist,
        }),
      });
      const data = (await response.json()) as Partial<ImportReport> & {
        error?: string;
      };
      if (!response.ok || !data.deck) {
        setError(te(data.error) ?? t("decks.importFailed"));
        setPending(false);
        return;
      }
      setReport(data as ImportReport);
      setPending(false);
      startTransition(() => router.refresh());
    } catch {
      setError(t("decks.importError"));
      setPending(false);
    }
  }

  if (report) {
    return (
      <ImportReportView
        report={report}
        onReset={() => {
          setReport(null);
          setName("");
          setDecklist("");
        }}
      />
    );
  }

  return (
    <Stack gap="lg" className="max-w-3xl animate-[sb-rise_0.45s_ease-out]">
      <div>
        <Title order={2}>{t("decks.importLimitless")}</Title>
        <Text c="dimmed" size="sm" mt={4}>
          {t("decks.importSubtitle")}
        </Text>
      </div>

      <form onSubmit={onSubmit}>
        <Stack
          gap="md"
          className="rounded-xl border border-[var(--sb-line)] bg-[var(--sb-panel)]/85 p-5"
        >
          {error ? <Alert color="red">{error}</Alert> : null}

          <TextInput
            label={t("decks.deckName")}
            required
            value={name}
            onChange={(e) => setName(e.currentTarget.value)}
          />

          <Select
            label={t("common.format")}
            required
            data={formats.map((f) => ({ value: f.id, label: tEnum("format", f.name) }))}
            value={formatId}
            onChange={setFormatId}
            disabled={loadingFormats}
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
            <Group gap="md">
              {TAG_VALUES.map((tag) => (
                <Checkbox
                  key={tag}
                  label={tEnum("deckTag", tag)}
                  checked={tags.includes(tag)}
                  onChange={() => toggleTag(tag)}
                />
              ))}
            </Group>
          </Stack>

          <Textarea
            label={t("decks.limitlessDecklist")}
            required
            value={decklist}
            onChange={(e) => setDecklist(e.currentTarget.value)}
            minRows={14}
            styles={{
              input: {
                fontFamily: "var(--font-ibm-plex-mono), ui-monospace, monospace",
                fontSize: 13,
              },
            }}
            placeholder={`Pokémon: 19\n4 Dreepy TWM 128\n...`}
          />

          <Group justify="space-between" mt="sm">
            <Button component={Link} href="/decks" variant="subtle">
              {t("common.cancel")}
            </Button>
            <Button
              type="submit"
              loading={pending}
              disabled={!formatId || !decklist.trim()}
            >
              {t("decks.import")}
            </Button>
          </Group>
        </Stack>
      </form>
    </Stack>
  );
}
