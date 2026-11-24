"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState, startTransition } from "react";
import {
  Alert,
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

type FormatOption = {
  id: string;
  code: string;
  name: string;
};

const TAG_OPTIONS = [
  { value: "FAVORITE", label: "Favorito" },
  { value: "TESTING", label: "Testando" },
  { value: "ARCHIVED", label: "Arquivado" },
] as const;

export function DeckCreatePanel() {
  const router = useRouter();
  const [formats, setFormats] = useState<FormatOption[]>([]);
  const [name, setName] = useState("");
  const [formatId, setFormatId] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [loadingFormats, setLoadingFormats] = useState(true);

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
            setError(data.error ?? "Falha ao carregar formatos.");
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
          setError("Não foi possível carregar formatos.");
          setLoadingFormats(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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
      const response = await fetch("/api/decks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          formatId,
          description: description || null,
          tags,
        }),
      });
      const data = (await response.json()) as {
        deck?: { id: string };
        error?: string;
      };
      if (!response.ok || !data.deck) {
        setError(data.error ?? "Falha ao criar deck.");
        setPending(false);
        return;
      }
      startTransition(() => {
        router.push(`/decks/${data.deck!.id}`);
        router.refresh();
      });
    } catch {
      setError("Não foi possível criar o deck.");
      setPending(false);
    }
  }

  return (
    <Stack gap="lg" className="max-w-xl animate-[sb-rise_0.45s_ease-out]">
      <div>
        <Title order={2}>Novo deck</Title>
        <Text c="dimmed" size="sm" mt={4}>
          Defina nome, formato e tags. As cartas entram no editor.
        </Text>
      </div>

      <form onSubmit={onSubmit}>
        <Stack
          gap="md"
          className="rounded-xl border border-[var(--sb-line)] bg-[var(--sb-panel)]/85 p-5"
        >
          {error ? <Alert color="red">{error}</Alert> : null}

          <TextInput
            label="Nome"
            required
            value={name}
            onChange={(e) => setName(e.currentTarget.value)}
          />

          <Select
            label="Formato"
            required
            data={formats.map((f) => ({ value: f.id, label: f.name }))}
            value={formatId}
            onChange={setFormatId}
            disabled={loadingFormats}
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
            <Group gap="md">
              {TAG_OPTIONS.map((tag) => (
                <Checkbox
                  key={tag.value}
                  label={tag.label}
                  checked={tags.includes(tag.value)}
                  onChange={() => toggleTag(tag.value)}
                />
              ))}
            </Group>
            <Text size="xs" c="dimmed">
              Tags são independentes do formato.
            </Text>
          </Stack>

          <Group justify="space-between" mt="sm">
            <Button component={Link} href="/decks" variant="subtle">
              Cancelar
            </Button>
            <Button type="submit" loading={pending} disabled={!formatId}>
              Criar
            </Button>
          </Group>
        </Stack>
      </form>
    </Stack>
  );
}
