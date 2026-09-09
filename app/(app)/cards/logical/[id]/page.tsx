import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CardsServiceError, getLogicalById } from "@/modules/cards";
import { CardLogicalDetail } from "@/modules/cards/ui/CardLogicalDetail";

type PageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  try {
    const { id } = await params;
    const logical = await getLogicalById(id);
    return { title: logical.canonicalName };
  } catch {
    return { title: "Carta lógica" };
  }
}

export default async function CardLogicalPage({ params }: PageProps) {
  const { id } = await params;
  let logical;
  try {
    logical = await getLogicalById(id);
  } catch (error) {
    if (error instanceof CardsServiceError && error.status === 404) {
      notFound();
    }
    throw error;
  }

  return <CardLogicalDetail logical={logical} />;
}
