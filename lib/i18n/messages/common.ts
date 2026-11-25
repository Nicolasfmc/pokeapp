import { defineMessages } from "../define";

export const common = defineMessages({
  "common.error": ["Error", "Erro"],
  "common.save": ["Save", "Salvar"],
  "common.cancel": ["Cancel", "Cancelar"],
  "common.delete": ["Delete", "Excluir"],
  "common.edit": ["Edit", "Editar"],
  "common.back": ["Back", "Voltar"],
  "common.close": ["Close", "Fechar"],
  "common.add": ["Add", "Adicionar"],
  "common.remove": ["Remove", "Remover"],
  "common.search": ["Search", "Buscar"],
  "common.loading": ["Loading…", "Carregando…"],
  "common.none": ["None", "Nenhum"],
  "common.all": ["All", "Todos"],
  "common.any": ["Any", "Qualquer"],
  "common.yes": ["Yes", "Sim"],
  "common.no": ["No", "Não"],
  "common.name": ["Name", "Nome"],
  "common.notes": ["Notes", "Notas"],
  "common.note": ["Note", "Nota"],
  "common.quantity": ["Quantity", "Quantidade"],
  "common.qty": ["Qty", "Qtd"],
  "common.format": ["Format", "Formato"],
  "common.description": ["Description", "Descrição"],
  "common.tags": ["Tags", "Tags"],
  "common.date": ["Date", "Data"],
  "common.status": ["Status", "Status"],
  "common.connectionError": [
    "Couldn't connect. Try again.",
    "Não foi possível conectar. Tente novamente.",
  ],
  "common.previous": ["Previous", "Anterior"],
  "common.next": ["Next", "Próxima"],
  "common.pageOf": ["Page {page} of {total}", "Página {page} de {total}"],
  "common.cards": ["{count} cards", "{count} cartas"],
  "common.appVersion": ["App version", "Versão do app"],
});

/** Labels for enum-like values. Use tEnum("group", value). */
export const enums = defineMessages({
  "format.standard": ["Standard", "Padrão"],
  "format.expanded": ["Expanded", "Expandido"],
  "format.all": ["Any", "Qualquer"],
  "format.STANDARD": ["Standard", "Padrão"],
  "format.EXPANDED": ["Expanded", "Expandido"],
  "format.Standard": ["Standard", "Padrão"],
  "format.Expanded": ["Expanded", "Expandido"],

  "physicalStatus.SLEEVED": ["Sleeved", "Sleevado"],
  "physicalStatus.NOT_SLEEVED": ["Not sleeved", "Não sleevado"],

  "importStatus.IMPORTED": ["Imported", "Importado"],
  "importStatus.PARTIALLY_RESOLVED": ["Partially resolved", "Parcial"],
  "importStatus.READY": ["Ready", "Pronto"],
  "importStatus.INVALID": ["Invalid", "Inválido"],

  "deckTag.FAVORITE": ["Favorite", "Favorito"],
  "deckTag.TESTING": ["Testing", "Testando"],
  "deckTag.ARCHIVED": ["Archived", "Arquivado"],

  "category.POKEMON": ["Pokémon", "Pokémon"],
  "category.TRAINER": ["Trainer", "Treinador"],
  "category.ENERGY": ["Energy", "Energia"],

  "condition.NM": ["Near Mint (NM)", "Quase nova (NM)"],
  "condition.LP": ["Lightly Played (LP)", "Pouco jogada (LP)"],
  "condition.MP": ["Moderately Played (MP)", "Jogada (MP)"],
  "condition.HP": ["Heavily Played (HP)", "Muito jogada (HP)"],
  "condition.DMG": ["Damaged (DMG)", "Danificada (DMG)"],

  "collectionStatus.COMPETITIVE": ["Competitive", "Competitivo"],
  "collectionStatus.COLLECTION": ["Collection", "Coleção"],

  "reason.PURCHASE": ["Purchase", "Compra"],
  "reason.SALE": ["Sale", "Venda"],
  "reason.TRADE": ["Trade", "Troca"],
  "reason.GIFT": ["Gift", "Presente"],
  "reason.LOST": ["Lost", "Perda"],
  "reason.DAMAGED": ["Damaged", "Danificada"],
  "reason.CORRECTION": ["Correction", "Correção"],
  "reason.OTHER": ["Other", "Outro"],

  "matchResult.WIN": ["Win", "Vitória"],
  "matchResult.LOSS": ["Loss", "Derrota"],
  "matchResult.DRAW": ["Draw", "Empate"],
  "matchResult.UNKNOWN": ["Unknown", "Indefinido"],

  "turnOrder.FIRST": ["First", "Primeiro"],
  "turnOrder.SECOND": ["Second", "Segundo"],

  "accountStatus.ACTIVE": ["Active", "Ativa"],
  "accountStatus.DELETION_PENDING": ["Deletion pending", "Exclusão pendente"],
  "accountStatus.PERMANENTLY_DELETED": ["Deleted", "Excluída"],

  "inventoryCheck.OWNED": ["Owned", "Possuída"],
  "inventoryCheck.PARTIAL": ["Partial", "Parcial"],
  "inventoryCheck.MISSING": ["Missing", "Faltando"],
});
