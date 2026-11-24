import { describe, expect, it } from "vitest";
import {
  cardImageSize,
  isSpecialRarity,
  pickRepresentative,
} from "@/modules/cards/representative";

const base = {
  legalStandard: true,
  legalExpanded: true,
  isActive: true,
};

describe("pickRepresentative", () => {
  it("prefere arte comum à Illustration/Secret (Acerola's Mischief)", () => {
    const picked = pickRepresentative([
      { ...base, id: "sir", imageUrl: "a", rarity: "Special illustration rare", releaseDate: "2025-01-01" },
      { ...base, id: "common", imageUrl: "b", rarity: "Uncommon", releaseDate: "2024-01-01" },
      { ...base, id: "hyper", imageUrl: "c", rarity: "Hyper rare", releaseDate: "2025-01-01" },
    ]);
    expect(picked?.id).toBe("common");
  });

  it("entre artes comuns, escolhe o set mais recente", () => {
    const picked = pickRepresentative([
      { ...base, id: "old", imageUrl: "a", rarity: "Common", releaseDate: "2023-03-01" },
      { ...base, id: "new", imageUrl: "b", rarity: "Common", releaseDate: "2025-06-01" },
    ]);
    expect(picked?.id).toBe("new");
  });

  it("no formato pedido, prioriza impressões legais", () => {
    const picked = pickRepresentative(
      [
        { ...base, id: "legal", imageUrl: "a", rarity: "Illustration rare", releaseDate: "2024-01-01" },
        { ...base, id: "rotated", imageUrl: "b", rarity: "Common", legalStandard: false, releaseDate: "2025-01-01" },
      ],
      "standard",
    );
    expect(picked?.id).toBe("legal");
  });

  it("ignora impressões sem imagem ou inativas", () => {
    expect(
      pickRepresentative([
        { ...base, id: "noimg", imageUrl: null, rarity: "Common" },
        { ...base, id: "inactive", imageUrl: "x", rarity: "Common", isActive: false },
      ]),
    ).toBeNull();
  });

  it("ACE SPEC Rare é raridade base, não arte alternativa", () => {
    expect(isSpecialRarity("ACE SPEC Rare")).toBe(false);
    expect(isSpecialRarity("Ultra Rare")).toBe(true);
  });
});

describe("cardImageSize", () => {
  it("troca high por low nas miniaturas", () => {
    expect(cardImageSize("https://assets.tcgdex.net/en/sv/sv05/144/high.webp")).toBe(
      "https://assets.tcgdex.net/en/sv/sv05/144/low.webp",
    );
    expect(cardImageSize(null)).toBeNull();
  });
});
