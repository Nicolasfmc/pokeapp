import TCGdex, { type SupportedLanguages } from "@tcgdex/sdk";
import { TcgdexNotFoundError } from "./errors";
import { normalizeCard, normalizeSet } from "./normalize";
import { mapPool } from "./pool";
import type {
  CardDataProvider,
  ExternalCard,
  ExternalSet,
  TcgdexCardNormalizeInput,
  TcgdexSetNormalizeInput,
} from "./types";

const DEFAULT_CONCURRENCY = 8;

const SUPPORTED_LANGUAGES = new Set<string>([
  "en",
  "fr",
  "es",
  "es-mx",
  "it",
  "pt",
  "pt-br",
  "de",
  "nl",
  "pl",
  "ru",
  "ja",
  "ko",
  "zh-tw",
  "id",
  "th",
  "zh-cn",
]);

function resolveLanguage(value: string | undefined): SupportedLanguages {
  const normalized = (value ?? "en").trim().toLowerCase();
  if (SUPPORTED_LANGUAGES.has(normalized)) {
    return normalized as SupportedLanguages;
  }
  return "en";
}

export type TCGdexProviderOptions = {
  language?: string;
  concurrency?: number;
  client?: TCGdex;
};

function asSetInput(value: object): TcgdexSetNormalizeInput {
  return value as TcgdexSetNormalizeInput;
}

function asCardInput(value: object): TcgdexCardNormalizeInput {
  return value as TcgdexCardNormalizeInput;
}

export class TCGdexProvider implements CardDataProvider {
  private readonly client: TCGdex;
  private readonly concurrency: number;

  constructor(options: TCGdexProviderOptions = {}) {
    const language = resolveLanguage(
      options.language ?? process.env.TCGDEX_LANGUAGE,
    );
    this.client = options.client ?? new TCGdex(language);
    const endpoint = process.env.TCGDEX_API_BASE_URL?.trim();
    if (endpoint && !options.client) {
      this.client.setEndpoint(endpoint);
    }
    this.concurrency = options.concurrency ?? DEFAULT_CONCURRENCY;
  }

  async getCard(id: string): Promise<ExternalCard> {
    const card = await this.client.card.get(id);
    if (!card) {
      throw new TcgdexNotFoundError("card", id);
    }
    return normalizeCard(asCardInput(card));
  }

  async getSet(id: string): Promise<ExternalSet> {
    const set = await this.client.set.get(id);
    if (!set) {
      throw new TcgdexNotFoundError("set", id);
    }
    return normalizeSet(asSetInput(set));
  }

  async listSets(): Promise<ExternalSet[]> {
    const resumes = await this.client.set.list();
    return mapPool(resumes, this.concurrency, async (resume) => {
      return this.getSet(resume.id);
    });
  }

  async listCards(): Promise<ExternalCard[]> {
    const resumes = await this.client.card.list();
    return mapPool(resumes, this.concurrency, async (resume) => {
      return this.getCard(resume.id);
    });
  }

  async listSeriesThenSetsThenCards(): Promise<{
    sets: ExternalSet[];
    cards: ExternalCard[];
  }> {
    const seriesResumes = await this.client.serie.list();
    const setIds = new Set<string>();

    await mapPool(seriesResumes, this.concurrency, async (serieResume) => {
      const serie = await this.client.serie.get(serieResume.id);
      if (!serie?.sets) {
        return;
      }
      for (const setResume of serie.sets) {
        setIds.add(setResume.id);
      }
    });

    const fullSets = await mapPool([...setIds], this.concurrency, async (setId) => {
      const set = await this.client.set.get(setId);
      if (!set) {
        throw new TcgdexNotFoundError("set", setId);
      }
      return set;
    });

    const sets = fullSets.map((set) => normalizeSet(asSetInput(set)));

    const cardIds = new Set<string>();
    for (const set of fullSets) {
      for (const cardResume of set.cards ?? []) {
        cardIds.add(cardResume.id);
      }
    }

    const cards = await mapPool([...cardIds], this.concurrency, async (cardId) => {
      return this.getCard(cardId);
    });

    return { sets, cards };
  }
}
