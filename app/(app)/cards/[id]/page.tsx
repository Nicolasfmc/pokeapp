import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CardsServiceError, getPrintingById } from "@/modules/cards";
import { CardPrintingDetail } from "@/modules/cards/ui/CardPrintingDetail";
import { getTranslator } from "@/lib/i18n/server";

type PageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  try {
    const { id } = await params;
    const printing = await getPrintingById(id);
    return { title: printing.name };
  } catch {
    const { t } = await getTranslator();
    return { title: t("cards.card") };
  }
}

export default async function CardPrintingPage({ params }: PageProps) {
  const { id } = await params;
  let printing;
  try {
    printing = await getPrintingById(id);
  } catch (error) {
    if (error instanceof CardsServiceError && error.status === 404) {
      notFound();
    }
    throw error;
  }

  return <CardPrintingDetail printing={printing} />;
}
