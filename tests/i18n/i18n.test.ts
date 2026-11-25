import { describe, expect, it } from "vitest";
import { messages } from "@/lib/i18n/messages";
import { createTranslator } from "@/lib/i18n/translate";
import { translateServerMessage } from "@/lib/i18n/server-messages";
import { DEFAULT_LOCALE, resolveLocale } from "@/lib/i18n/config";

describe("i18n dictionaries", () => {
  it("has a non-empty English and Portuguese text for every key", () => {
    for (const [key, [en, pt]] of Object.entries(messages)) {
      expect(en.trim(), `${key} (en)`).not.toBe("");
      expect(pt.trim(), `${key} (pt)`).not.toBe("");
    }
  });

  it("uses the same placeholders in both languages", () => {
    const vars = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    for (const [key, [en, pt]] of Object.entries(messages)) {
      expect(vars(pt), key).toEqual(vars(en));
    }
  });
});

describe("translator", () => {
  it("defaults to English", () => {
    expect(DEFAULT_LOCALE).toBe("en");
    expect(resolveLocale(undefined)).toBe("en");
    expect(resolveLocale("xx")).toBe("en");
    expect(resolveLocale("pt-BR")).toBe("pt-BR");
  });

  it("translates and interpolates", () => {
    const en = createTranslator("en");
    const pt = createTranslator("pt-BR");
    expect(en.t("nav.inventory")).toBe("Inventory");
    expect(pt.t("nav.inventory")).toBe("Inventário");
    expect(pt.t("common.cards", { count: 60 })).toBe("60 cartas");
  });

  it("labels enum values and falls back to the raw value", () => {
    const pt = createTranslator("pt-BR");
    expect(pt.tEnum("physicalStatus", "NOT_SLEEVED")).toBe("Não sleevado");
    expect(pt.tEnum("format", "standard")).toBe("Padrão");
    expect(pt.tEnum("format", "Expanded")).toBe("Expandido");
    expect(pt.tEnum("reason", "PURCHASE")).toBe("Compra");
    expect(pt.tEnum("reason", "SOMETHING_NEW")).toBe("SOMETHING_NEW");
  });
});

describe("server message translation", () => {
  it("keeps Portuguese messages for pt-BR", () => {
    expect(translateServerMessage("pt-BR", "Deck não encontrado.")).toBe("Deck não encontrado.");
  });

  it("translates exact and dynamic messages to English", () => {
    expect(translateServerMessage("en", "Credenciais inválidas.")).toBe("Invalid credentials.");
    expect(translateServerMessage("en", '"Iono" é banida neste formato')).toBe(
      '"Iono" is banned in this format',
    );
    expect(
      translateServerMessage("en", "Deck precisa de pelo menos 60 cartas (atual: 58)"),
    ).toBe("Deck needs at least 60 cards (current: 58)");
    expect(
      translateServerMessage(
        "en",
        "Estoque insuficiente para sleevado. Iono: precisa 2, disponível 1; Arven: precisa 4, disponível 3",
      ),
    ).toBe("Not enough stock to sleeve. Iono: needs 2, available 1; Arven: needs 4, available 3");
  });

  it("leaves unknown messages untouched", () => {
    expect(translateServerMessage("en", "Something else")).toBe("Something else");
  });
});
