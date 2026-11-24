import { describe, expect, it } from "vitest";
import {
  archetypeDisplayNames,
  normalizeDisplayPokemon,
  suggestArchetype,
} from "../../server/services/archetype-classifier";

const archetypes = [
  { id: "a1", name: "Dragapult", displayPokemon: ["Dragapult ex"] },
  { id: "a2", name: "Alakazam / Dudunsparce", displayPokemon: null },
  { id: "a3", name: "Charizard", displayPokemon: ["Charizard ex", "Pidgeot ex"] },
];

describe("archetype classifier (§67, §120)", () => {
  it("deriva Pokémon de exibição do nome 'A / B' (§69)", () => {
    expect(archetypeDisplayNames(archetypes[1])).toEqual(["Alakazam", "Dudunsparce"]);
    expect(normalizeDisplayPokemon(undefined, "Alakazam / Dudunsparce")).toEqual([
      "Alakazam",
      "Dudunsparce",
    ]);
  });

  it("sugere o arquétipo cujos Pokémon aparecem no log", () => {
    const suggestion = suggestArchetype(
      ["Dreepy", "Drakloak", "Dragapult ex", "Fezandipiti ex"],
      archetypes,
    );
    expect(suggestion?.archetypeId).toBe("a1");
  });

  it("prefere o arquétipo com mais Pokémon casados", () => {
    const suggestion = suggestArchetype(
      ["Alakazam", "Dudunsparce", "Dragapult ex"],
      [...archetypes, { id: "a4", name: "Alakazam", displayPokemon: ["Alakazam"] }],
    );
    expect(suggestion?.archetypeId).toBe("a2");
  });

  it("não sugere quando nenhum arquétipo casa por completo", () => {
    expect(suggestArchetype(["Charizard ex"], archetypes)).toBeNull();
    expect(suggestArchetype([], archetypes)).toBeNull();
  });
});
