import type { ExternalCard } from "./types";

/**
 * What TCGdex has already classified for Standard: the regulation marks of
 * its Standard-legal cards and the release date of the newest set holding
 * one of them.
 */
export type StandardReference = {
  legalMarks: Set<string>;
  newestClassifiedRelease: string | null;
};

/** Builds the reference from cards whose `legalStandard` came from TCGdex. */
export function buildStandardReference(
  cards: Array<Pick<ExternalCard, "legalStandard" | "regulationMark" | "setTcgdexId">>,
  releaseDateBySet: Map<string, string | null>,
): StandardReference {
  const legalMarks = new Set<string>();
  let newest: string | null = null;
  for (const card of cards) {
    if (!card.legalStandard) continue;
    if (card.regulationMark) legalMarks.add(card.regulationMark);
    const release = releaseDateBySet.get(card.setTcgdexId) ?? null;
    if (release && (newest === null || release > newest)) newest = release;
  }
  return { legalMarks, newestClassifiedRelease: newest };
}

export function mergeStandardReferences(a: StandardReference, b: StandardReference): StandardReference {
  const dates = [a.newestClassifiedRelease, b.newestClassifiedRelease].filter(
    (d): d is string => d !== null,
  );
  return {
    legalMarks: new Set([...a.legalMarks, ...b.legalMarks]),
    newestClassifiedRelease: dates.length ? dates.reduce((x, y) => (y > x ? y : x)) : null,
  };
}

/**
 * TCGdex takes weeks to mark a newly released set as Standard-legal (and often
 * ships it without regulation marks), so its cards vanish from Standard deck
 * searches. A card counts as Standard when TCGdex says so, or when its set is
 * newer than every set TCGdex has classified, the card is Expanded-legal and
 * it carries no rotated-out regulation mark. Once TCGdex catches up, its own
 * value is used again.
 */
export function inferLegalStandard(
  card: Pick<ExternalCard, "legalStandard" | "legalExpanded" | "regulationMark">,
  setReleaseDate: string | null,
  reference: StandardReference,
): boolean {
  if (card.legalStandard) return true;
  if (!card.legalExpanded || !setReleaseDate || !reference.newestClassifiedRelease) return false;
  if (setReleaseDate <= reference.newestClassifiedRelease) return false;
  return card.regulationMark === null || reference.legalMarks.has(card.regulationMark);
}
