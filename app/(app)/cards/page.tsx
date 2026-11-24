import type { Metadata } from "next";
import { Suspense } from "react";
import { Text } from "@mantine/core";
import {
  CardsServiceError,
  listSets,
  parseCardSearchParams,
  searchCards,
} from "@/modules/cards";
import { CardsSearchView } from "@/modules/cards/ui/CardsSearchView";

export const metadata: Metadata = {
  title: "Cards",
};

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function toURLSearchParams(
  raw: Record<string, string | string[] | undefined>,
): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === "string") {
      params.set(key, value);
    } else if (Array.isArray(value) && value[0]) {
      params.set(key, value[0]);
    }
  }
  return params;
}

export default async function CardsPage({ searchParams }: PageProps) {
  const raw = await searchParams;
  const urlParams = toURLSearchParams(raw);
  // Padrão da aba Cards: cartas unificadas (lógicas) e só Standard —
  // menos linhas por página e menos processamento.
  const effective = new URLSearchParams(urlParams);
  if (!effective.has("format")) effective.set("format", "standard");
  if (!effective.has("mode")) effective.set("mode", "logical");

  let params;
  try {
    params = parseCardSearchParams(effective);
  } catch (error) {
    if (error instanceof CardsServiceError) {
      params = parseCardSearchParams(
        new URLSearchParams({ format: "standard", mode: "logical" }),
      );
    } else {
      throw error;
    }
  }

  const [sets, result] = await Promise.all([
    listSets({ page: 1, pageSize: 48, isActive: true }),
    searchCards(params),
  ]);

  return (
    <Suspense
      fallback={
        <section className="mx-auto w-full max-w-6xl px-2 py-6 sm:px-4">
          <Text c="dimmed">Carregando busca…</Text>
        </section>
      }
    >
      <CardsSearchView
        key={urlParams.toString()}
        initialSets={sets.items}
        result={result}
      />
    </Suspense>
  );
}
