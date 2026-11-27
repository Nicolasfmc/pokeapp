import { createHash } from "node:crypto";
import type { ExternalCardCategory, TcgdexCardNormalizeInput } from "./types";

/**
 * Gameplay identity of a printing. Two printings with the same name are the
 * same card for deck building only when they play the same way: Limitless
 * shows "Yveltal" (120 HP, Cruel Arrow) and "Yveltal" (110 HP, Dark Feather)
 * as different cards, but groups reprints and alternate arts.
 *
 * Trainers and Energy keep the name as their identity (same name = same card
 * by the rules), so their key is empty. For Pokémon the key hashes HP, types,
 * stage, evolution, ability names, attacks (name, cost, damage) and retreat.
 * Effect texts are left out on purpose: TCGdex wording varies between reprints
 * of the same card, and those fields already tell different cards apart.
 */
export function gameplayKey(
  category: ExternalCardCategory,
  input: Pick<
    TcgdexCardNormalizeInput,
    "hp" | "types" | "stage" | "evolveFrom" | "abilities" | "attacks" | "retreat"
  >,
): string {
  if (category !== "POKEMON") return "";
  const signature = {
    hp: input.hp ?? null,
    types: [...(input.types ?? [])].map(text).sort(),
    stage: text(input.stage),
    evolveFrom: text(input.evolveFrom),
    abilities: (input.abilities ?? []).map((ability) => text(ability?.name)),
    attacks: (input.attacks ?? []).map((attack) => ({
      name: text(attack?.name),
      cost: [...(attack?.cost ?? [])].map(text).sort(),
      damage: text(attack?.damage === undefined || attack?.damage === null ? "" : String(attack.damage)),
    })),
    retreat: input.retreat ?? null,
  };
  return createHash("sha256").update(JSON.stringify(signature)).digest("hex").slice(0, 16);
}

function text(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}
