import type { Locale } from "./config";

/**
 * API error and validation messages are produced in Portuguese by the server.
 * This table translates them for the English UI. Unknown messages are shown
 * as they are.
 */
const EXACT: Record<string, string> = {
  "Arquétipo inválido": "Invalid archetype",
  "Arquétipo já existe.": "Archetype already exists.",
  "Arquétipo não encontrado.": "Archetype not found.",
  "Battle log TCG Live vazio": "Empty TCG Live battle log",
  "Bio inválida.": "Invalid bio.",
  "Carta inválida": "Invalid card",
  "Carta lógica não encontrada.": "Card not found.",
  "Categoria inválida. Use POKEMON, TRAINER ou ENERGY.":
    "Invalid category. Use POKEMON, TRAINER or ENERGY.",
  "Condição inválida.": "Invalid condition.",
  "Conta indisponível.": "Account unavailable.",
  "Conta não pode alterar username neste estado.":
    "This account can't change its username right now.",
  "Credenciais inválidas.": "Invalid credentials.",
  "Dados já cadastrados.": "Already registered.",
  "Data final inválida.": "Invalid end date.",
  "Data inicial inválida.": "Invalid start date.",
  "Deck não encontrado": "Deck not found",
  "Deck não encontrado.": "Deck not found.",
  "Deck sem cartas": "Deck has no cards",
  "Deck sem cartas não pode ser SLEEVED.": "A deck with no cards can't be sleeved.",
  "Decklist Limitless vazia": "Empty Limitless decklist",
  "E-mail inválido.": "Invalid email.",
  "E-mail já cadastrado.": "Email already registered.",
  "Erro interno.": "Internal error.",
  "Exclusão já solicitada.": "Deletion already requested.",
  "Falha ao atualizar arquétipo.": "Failed to update archetype.",
  "Falha ao criar arquétipo.": "Failed to create archetype.",
  "Formato inválido ou inativo": "Invalid or inactive format",
  "Formato inválido": "Invalid format",
  "Formato inválido.": "Invalid format.",
  "Idioma inválido.": "Invalid language.",
  "Importação inválida: nenhuma carta resolvida": "Invalid import: no cards resolved",
  "Impressão não encontrada para o tcgdexId informado.":
    "Printing not found for the given tcgdexId.",
  "Impressão não encontrada.": "Printing not found.",
  "Intervalo de datas inválido.": "Invalid date range.",
  "Item de inventário não encontrado.": "Inventory item not found.",
  "JSON inválido.": "Invalid JSON.",
  "Linha vazia": "Empty line",
  "Match não encontrado.": "Match not found.",
  "Motivo inválido.": "Invalid reason.",
  "Muitas requisições. Tente novamente em breve.": "Too many requests. Try again soon.",
  "Nome da carta ausente": "Missing card name",
  "Nome de exibição é obrigatório.": "Display name is required.",
  "Nome do arquétipo inválido.": "Invalid archetype name.",
  "Nome do arquétipo é obrigatório.": "Archetype name is required.",
  "Nome inválido": "Invalid name",
  "Nome é obrigatório": "Name is required",
  "Nome é obrigatório.": "Name is required.",
  "Nota muito longa (máx. 500).": "Note too long (max. 500).",
  "Não autenticado": "Not signed in",
  "Não foi possível alterar o username.": "Couldn't change the username.",
  "Não foi possível criar a conta.": "Couldn't create the account.",
  "Não há exclusão pendente.": "There is no pending deletion.",
  "O novo username é igual ao atual.": "The new username is the same as the current one.",
  "Partida já vinculada a um torneio.": "Match already linked to a tournament.",
  "Partida não encontrada.": "Match not found.",
  "Quantidade deve ser um inteiro positivo": "Quantity must be a positive integer",
  "Quantidade não pode ficar negativa.": "Quantity can't go negative.",
  "Quantidade não pode ser menor que o estoque alocado em decks SLEEVED.":
    "Quantity can't be lower than the stock allocated to sleeved decks.",
  "Sessão inválida.": "Invalid session.",
  "Set não encontrado.": "Set not found.",
  "Status de coleção inválido.": "Invalid collection status.",
  "Torneio não encontrado.": "Tournament not found.",
  "Uma ou mais cartas lógicas não existem": "One or more cards don't exist",
  "Username deve começar com letra e conter apenas letras minúsculas, números e underscore.":
    "Username must start with a letter and contain only lowercase letters, numbers and underscores.",
  "Username já está em uso.": "Username already taken.",
  "Usuário não encontrado.": "User not found.",
  "Vínculo torneio/partida não encontrado.": "Tournament/match link not found.",
  "set_code ausente": "Missing set_code",
  "setCode e collectorNumber são obrigatórios": "setCode and collectorNumber are required",
};

type Pattern = [RegExp, (...groups: string[]) => string];

const PATTERNS: Pattern[] = [
  [/^"(.+)" não é legal em (.+)$/, (name, format) => `"${name}" isn't legal in ${format}`],
  [
    /^"(.+)" permite no máximo (\d+) cópias \(atual: (\d+)\)$/,
    (name, limit, current) => `"${name}" allows at most ${limit} copies (current: ${current})`,
  ],
  [/^"(.+)" é banida neste formato$/, (name) => `"${name}" is banned in this format`],
  [/^"(.+)" é restrita a (\d+) cópia\(s\)$/, (name, limit) => `"${name}" is restricted to ${limit} copy(ies)`],
  [
    /^Deck precisa de pelo menos (\d+) cartas \(atual: (\d+)\)$/,
    (min, current) => `Deck needs at least ${min} cards (current: ${current})`,
  ],
  [
    /^Deck pode ter no máximo (\d+) cartas \(atual: (\d+)\)$/,
    (max, current) => `Deck can have at most ${max} cards (current: ${current})`,
  ],
  [/^Carta lógica não encontrada: (.+)$/, (id) => `Card not found: ${id}`],
  [/^Set não encontrado: (.+)$/, (code) => `Set not found: ${code}`],
  [/^Impressão não encontrada: (.+)$/, (rest) => `Printing not found: ${rest}`],
  [/^Quantidade inválida: (.+)$/, (rest) => `Invalid quantity: ${rest}`],
  [/^Booleano inválido: (.+)$/, (rest) => `Invalid boolean: ${rest}`],
  [/^Tag inválida: (.+)$/, (rest) => `Invalid tag: ${rest}`],
  [/^(.+) inválido\.$/, (field) => `Invalid ${field}.`],
  [/^Bio deve ter até (\d+) caracteres\.$/, (n) => `Bio must have at most ${n} characters.`],
  [
    /^Nome de exibição deve ter até (\d+) caracteres\.$/,
    (n) => `Display name must have at most ${n} characters.`,
  ],
  [
    /^Username deve ter entre (\d+) e (\d+) caracteres\.$/,
    (min, max) => `Username must have between ${min} and ${max} characters.`,
  ],
  [
    /^A senha deve ter pelo menos (\d+) caracteres\.$/,
    (n) => `Password must have at least ${n} characters.`,
  ],
  [
    /^Username só pode ser alterado a cada 3 meses\. Aguarde cerca de (\d+) dia\(s\)\.$/,
    (days) => `Username can only be changed every 3 months. Wait about ${days} day(s).`,
  ],
  [
    /^viewer "(.+)" não corresponde a (.+) ou (.+)$/,
    (viewer, p1, p2) => `viewer "${viewer}" doesn't match ${p1} or ${p2}`,
  ],
  [
    /^Estoque insuficiente para sleevado\. ([\s\S]*)$/,
    (detail) =>
      `Not enough stock to sleeve. ${detail.replace(
        /: precisa (\d+), disponível (\d+)/g,
        ": needs $1, available $2",
      )}`,
  ],
  [/^(.+) é obrigatóri[oa]\.?$/, (field) => `${field} is required`],
];

export function translateServerMessage(locale: Locale, message: string): string {
  if (locale === "pt-BR") return message;
  const exact = EXACT[message];
  if (exact) return exact;
  for (const [pattern, build] of PATTERNS) {
    const match = message.match(pattern);
    if (match) return build(...match.slice(1));
  }
  return message;
}
