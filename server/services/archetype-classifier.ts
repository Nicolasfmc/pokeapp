/**
 * Classificador de arquétipo (§67, §120). Opcional no beta: apenas SUGERE.
 * O valor salvo no Match é sempre a escolha do usuário, e o classificador
 * nunca altera partidas já salvas.
 */

export type ClassifiableArchetype = {
  id: string;
  name: string;
  displayPokemon: unknown;
};

export type ArchetypeSuggestion = {
  archetypeId: string;
  name: string;
  matched: string[];
};

function normalize(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+(ex|v|vmax|vstar|gx)$/i, "")
    .replace(/\s+/g, " ");
}

/** displayPokemon (JSON) → lista de nomes; sem valor, deriva do nome "A / B". */
export function archetypeDisplayNames(archetype: {
  name: string;
  displayPokemon: unknown;
}): string[] {
  if (Array.isArray(archetype.displayPokemon)) {
    const names = archetype.displayPokemon
      .filter((v): v is string => typeof v === "string")
      .map((v) => v.trim())
      .filter(Boolean);
    if (names.length > 0) return names;
  }
  return splitArchetypeName(archetype.name);
}

export function splitArchetypeName(name: string): string[] {
  return name
    .split(/\s*[/&+]\s*/)
    .map((part) => part.trim())
    .filter(Boolean);
}

/** Normaliza o input do usuário para `displayPokemon`: string[] ou derivado do nome. */
export function normalizeDisplayPokemon(value: unknown, name: string): string[] {
  if (Array.isArray(value)) {
    const names = value
      .filter((v): v is string => typeof v === "string")
      .map((v) => v.trim())
      .filter(Boolean);
    if (names.length > 0) return [...new Set(names)].slice(0, 4);
  }
  if (typeof value === "string" && value.trim()) {
    return splitArchetypeName(value).slice(0, 4);
  }
  return splitArchetypeName(name).slice(0, 4);
}

export function suggestArchetype(
  detectedPokemon: string[],
  archetypes: ClassifiableArchetype[],
): ArchetypeSuggestion | null {
  const detected = new Set(detectedPokemon.map(normalize));
  if (detected.size === 0) return null;

  let best: (ArchetypeSuggestion & { score: number }) | null = null;
  for (const archetype of archetypes) {
    const names = archetypeDisplayNames(archetype);
    if (names.length === 0) continue;
    const matched = names.filter((n) => detected.has(normalize(n)));
    // Exige que todos os Pokémon de exibição tenham aparecido no log.
    if (matched.length !== names.length) continue;
    const score = matched.length;
    if (
      !best ||
      score > best.score ||
      (score === best.score && archetype.name.localeCompare(best.name) < 0)
    ) {
      best = { archetypeId: archetype.id, name: archetype.name, matched, score };
    }
  }

  if (!best) return null;
  return { archetypeId: best.archetypeId, name: best.name, matched: best.matched };
}
