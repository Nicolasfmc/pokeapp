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

  let params;
  try {
    params = parseCardSearchParams(urlParams);
  } catch (error) {
    if (error instanceof CardsServiceError) {
      params = parseCardSearchParams(new URLSearchParams());
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
