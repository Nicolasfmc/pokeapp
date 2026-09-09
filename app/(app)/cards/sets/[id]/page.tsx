import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CardsServiceError, getSetById } from "@/modules/cards";
import { CardSetDetail } from "@/modules/cards/ui/CardSetDetail";

type PageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  try {
    const { id } = await params;
    const set = await getSetById(id);
    return { title: set.name };
  } catch {
    return { title: "Set" };
  }
}

export default async function CardSetPage({ params }: PageProps) {
  const { id } = await params;
  let set;
  try {
    set = await getSetById(id);
  } catch (error) {
    if (error instanceof CardsServiceError && error.status === 404) {
      notFound();
    }
    throw error;
  }

  return <CardSetDetail set={set} />;
}
