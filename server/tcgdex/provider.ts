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

/** Pokémon TCG Pocket (`tcgp`) é um jogo digital: não existe carta física para o Inventory. */
export const DEFAULT_EXCLUDED_SERIES = ["tcgp"];

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

async function withRetry<T>(label: string, fn: () => Promise<T>, attempts = 6): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      if (error instanceof TcgdexNotFoundError) throw error;
      lastError = error;
      if (attempt < attempts) {
        // backoff exponencial com jitter: ~0.5s, 1s, 2s, 4s, 8s
        const delay = 500 * 2 ** (attempt - 1) + Math.random() * 250;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  console.warn(`[tcgdex] ${label} falhou após ${attempts} tentativas`);
  throw lastError;
}

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
    const card = await withRetry(`card ${id}`, () => this.client.card.get(id));
    if (!card) {
      throw new TcgdexNotFoundError("card", id);
    }
    return normalizeCard(asCardInput(card));
  }

  async getSet(id: string): Promise<ExternalSet> {
    const set = await withRetry(`set ${id}`, () => this.client.set.get(id));
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

  async listSeriesThenSetsThenCards(
    options: { setIds?: string[]; excludedSeriesIds?: string[] } = {},
  ): Promise<{
    sets: ExternalSet[];
    cards: ExternalCard[];
    unavailableCardIds: string[];
  }> {
    const excluded = new Set(
      (options.excludedSeriesIds ?? DEFAULT_EXCLUDED_SERIES).map((id) =>
        id.trim().toLowerCase(),
      ),
    );
    const onlySets = options.setIds?.length
      ? new Set(options.setIds.map((id) => id.trim().toLowerCase()))
      : null;
    const seriesResumes = (await this.client.serie.list()).filter(
      (serie) => !excluded.has(serie.id.toLowerCase()),
    );
    const setIds = new Set<string>();

    await mapPool(seriesResumes, this.concurrency, async (serieResume) => {
      const serie = await withRetry(`serie ${serieResume.id}`, () =>
        this.client.serie.get(serieResume.id),
      );
      if (!serie?.sets) {
        return;
      }
      for (const setResume of serie.sets) {
        if (onlySets && !onlySets.has(setResume.id.toLowerCase())) {
          continue;
        }
        setIds.add(setResume.id);
      }
    });

    const fullSets = await mapPool([...setIds], this.concurrency, async (setId) => {
      const set = await withRetry(`set ${setId}`, () => this.client.set.get(setId));
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

    const skippedCardIds: string[] = [];
    const failedCardIds: string[] = [];
    let fetched = 0;
    const total = cardIds.size;
    const maybeCards = await mapPool([...cardIds], this.concurrency, async (cardId) => {
      try {
        return await this.getCard(cardId);
      } catch (error) {
        // Some upstream ids (e.g. "exu-?") are listed by TCGdex but cannot be
        // fetched individually. Skip them instead of aborting the whole sync.
        if (error instanceof TcgdexNotFoundError) {
          skippedCardIds.push(cardId);
          return null;
        }
        // Erro transitório que sobreviveu aos retries: pula a carta, mas ela
        // NÃO é tratada como removida (ver `unavailableCardIds`).
        failedCardIds.push(cardId);
        return null;
      } finally {
        fetched += 1;
        if (fetched % 1000 === 0) {
          console.log(`[tcgdex] baixadas ${fetched}/${total}`);
        }
      }
    });
    const cards = maybeCards.filter((card): card is ExternalCard => card !== null);

    if (skippedCardIds.length > 0) {
      console.warn(
        `[tcgdex] ${skippedCardIds.length} card(s) not found upstream and skipped: ${skippedCardIds.join(", ")}`,
      );
    }
    if (failedCardIds.length > 0) {
      console.warn(
        `[tcgdex] ${failedCardIds.length} card(s) falharam por erro de rede/servidor e serão tentadas no próximo sync: ${failedCardIds.join(", ")}`,
      );
    }

    return { sets, cards, unavailableCardIds: failedCardIds };
  }
}
