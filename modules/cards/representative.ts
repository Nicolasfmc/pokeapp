/**
 * Escolhe a impressão "padrão" de uma carta lógica para exibir como imagem
 * (cartas unificadas): prefere arte comum (não Illustration/Secret/Hyper…),
 * legal no formato pedido, do set mais recente.
 *
 * Puro — usado em serviços (cards, decks, perfil) e nos testes.
 */
export type RepresentativeCandidate = {
  id: string;
  imageUrl: string | null;
  rarity: string | null;
  legalStandard: boolean;
  legalExpanded: boolean;
  isActive?: boolean;
  releaseDate?: Date | string | null;
};

const SPECIAL_RARITY =
  /illustration|hyper|ultra|secret|shiny|full art|rainbow|gold|crown|amazing|radiant rare|trainer gallery|ace spec/i;

export function isSpecialRarity(rarity: string | null | undefined): boolean {
  if (!rarity) return false;
  // ACE SPEC é a raridade base dessas cartas; não é arte alternativa.
  if (/^ace spec rare$/i.test(rarity.trim())) return false;
  return SPECIAL_RARITY.test(rarity);
}

function time(value: Date | string | null | undefined): number {
  if (!value) return 0;
  const t = new Date(value).getTime();
  return Number.isFinite(t) ? t : 0;
}

export function pickRepresentative<T extends RepresentativeCandidate>(
  printings: T[],
  format?: "standard" | "expanded" | null,
): T | null {
  const usable = printings.filter((p) => p.imageUrl && p.isActive !== false);
  if (usable.length === 0) return null;

  const score = (p: T) => {
    let s = 0;
    if (format === "standard" && p.legalStandard) s += 4;
    if (format === "expanded" && p.legalExpanded) s += 4;
    if (!isSpecialRarity(p.rarity)) s += 2;
    return s;
  };

  return [...usable].sort((a, b) => {
    const diff = score(b) - score(a);
    if (diff !== 0) return diff;
    return time(b.releaseDate) - time(a.releaseDate);
  })[0];
}

/** Versão menor da imagem da TCGdex (≈245px) para miniaturas. */
export function cardImageSize(
  url: string | null | undefined,
  size: "low" | "high" = "low",
): string | null {
  if (!url) return null;
  if (size === "low") return url.replace(/\/high\.(webp|png|jpg)$/i, "/low.$1");
  return url;
}
