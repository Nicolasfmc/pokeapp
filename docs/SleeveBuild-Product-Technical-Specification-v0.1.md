# SleeveBuild
## Product & Technical Specification — v0.1

**Status:** Draft  
**Versão:** 0.1  
**Data:** Setembro de 2026  
**Plataforma inicial:** Web  
**Objetivo:** Unificar Deckbuilder, Inventory/Collection e Training/Match Tracking para jogadores de Pokémon TCG.

---

# 1. Visão geral

O SleeveBuild será uma plataforma web para jogadores de Pokémon TCG que centraliza três necessidades atualmente distribuídas entre diferentes ferramentas:

1. **Construção e gerenciamento de decks**
2. **Gerenciamento físico de cartas e coleção**
3. **Registro e análise de partidas e torneios**

A principal característica do produto será a integração entre esses módulos.

O usuário não terá três sistemas independentes. A mesma base de cartas alimentará:

- Deckbuilder;
- Inventory;
- verificação de disponibilidade;
- alocação física aos decks;
- perfil público;
- histórico de partidas;
- estatísticas.

A arquitetura deve permitir que novos módulos sejam adicionados futuramente sem alterar fundamentalmente esses domínios.

---

# 2. Objetivos do produto

## 2.1 Objetivo principal

Criar um único aplicativo para que um jogador competitivo possa:

- encontrar cartas;
- montar decks;
- verificar quais cartas possui;
- saber quais cartas faltam;
- separar fisicamente cartas para decks;
- controlar sua coleção;
- disponibilizar cartas excedentes para negociação;
- importar logs de partidas;
- registrar torneios;
- acompanhar seu desempenho por deck e matchup.

---

# 3. Problemas que o SleeveBuild resolve

Atualmente, informações relevantes ficam separadas:

```text
Decklist
    ↓
Limitless / outro deckbuilder

Cartas físicas
    ↓
Coleção pessoal / planilha / pasta

Partidas
    ↓
Pokémon TCG Live / Training Court

Estatísticas
    ↓
Controle manual
```

O SleeveBuild pretende transformar isso em:

```text
                    SleeveBuild
                       │
       ┌───────────────┼────────────────┐
       │               │                │
       ▼               ▼                ▼
  Deckbuilder      Inventory       Training
       │               │                │
       └───────────────┼────────────────┘
                       ▼
                 Unified Data
```

---

# 4. Princípios do produto

## 4.1 Uma única fonte operacional

O PostgreSQL será a fonte operacional de verdade do SleeveBuild.

Fontes externas, como TCGdex, serão utilizadas para sincronização.

---

## 4.2 Separação entre carta lógica e impressão física

O sistema deve distinguir:

**Carta lógica:**

> Buddy-Buddy Poffin

de:

**Impressão física:**

> Buddy-Buddy Poffin — TEF 144

Isso permite que diferentes reprints sejam intercambiáveis no Deckbuilder, mantendo o controle físico individual no Inventory.

---

## 4.3 Dados externos desacoplados

O sistema não deve depender da disponibilidade da TCGdex ou de outra fonte externa para operações normais.

Fluxo:

```text
TCGdex
   ↓
Synchronization
   ↓
PostgreSQL
   ↓
SleeveBuild
```

---

## 4.4 Regras de negócio no backend

Regras como:

- disponibilidade;
- reserva de quatro cópias;
- alocação;
- transferência;
- estado Sleevado;
- legalidade;

não devem ser confiadas ao frontend.

O frontend apenas apresenta e solicita operações.

---

# 5. Escopo do MVP

## 5.1 Card Database

- sincronização com TCGdex;
- cards;
- sets;
- impressões;
- legalidade;
- regulation mark;
- categorias;
- imagens;
- dados de Pokémon;
- suporte inicial a inglês;
- estrutura preparada para múltiplos idiomas.

---

## 5.2 Deckbuilder

- criação de decks;
- edição;
- exclusão/arquivamento;
- seleção de formato;
- tags;
- busca de cartas;
- adição/remoção de cartas;
- contador de quantidade;
- validação de deck;
- importação no formato Limitless;
- integração com Inventory;
- status físico `SLEEVED`.

---

## 5.3 Inventory

- cadastro de cartas;
- quantidade;
- condição;
- idioma;
- status de coleção;
- incrementos/decrementos rápidos;
- histórico de movimentações;
- alocação aos decks;
- cálculo de disponibilidade;
- integração com Deckbuilder.

---

## 5.4 Perfil público

- username;
- URL `/user/username`;
- perfil público habilitado por padrão;
- visualização do estoque disponível;
- ocultação de cartas protegidas;
- acesso sem login.

---

## 5.5 Training

- importação de log;
- armazenamento do raw log;
- identificação dos dados da partida;
- seleção do deck utilizado;
- seleção/edição do arquétipo adversário;
- resultado;
- ordem de turno;
- formato;
- notas;
- histórico de partidas;
- estatísticas básicas.

---

## 5.6 Torneios

- criação;
- data;
- nome;
- localização;
- formato;
- colocação;
- quantidade de participantes;
- associação de partidas;
- rodada.

---

# 6. Fora do escopo do MVP

Não serão implementados inicialmente:

- marketplace;
- venda diretamente dentro do SleeveBuild;
- sistema de pagamentos;
- preços cadastrados;
- integração com Liga;
- sistema de trades completo;
- Google Login;
- Discord Login;
- aplicativo mobile nativo;
- deck versioning;
- análise avançada de partidas;
- análise automática de jogadas;
- recomendação automática de decks;
- rede social;
- seguidores;
- mensagens;
- suporte completo de UI multilíngue;
- sincronização automática direta com Pokémon TCG Live.

---

# 7. Stack tecnológica

## Frontend

- React
- Next.js
- TypeScript
- Mantine
- Tailwind CSS

## Backend

- Next.js
- Route Handlers / APIs
- TypeScript

## Database

- PostgreSQL

## ORM

**TBD:** Prisma ou Drizzle.

A decisão deve ser tomada após o desenho definitivo do schema.

## Deploy

Inicialmente:

- Vercel para aplicação;
- PostgreSQL gerenciado.

Fornecedor específico do PostgreSQL: **TBD**.

---

# 8. Arquitetura de alto nível

```text
                         ┌──────────────┐
                         │    TCGdex    │
                         └──────┬───────┘
                                │
                         Card Sync Service
                                │
                                ▼
                        ┌───────────────┐
                        │  PostgreSQL   │
                        └───────┬───────┘
                                │
          ┌─────────────────────┼─────────────────────┐
          │                     │                     │
          ▼                     ▼                     ▼
     Deckbuilder            Inventory             Training
          │                     │                     │
          └─────────────────────┼─────────────────────┘
                                │
                                ▼
                         Statistics Engine
                                │
                                ▼
                         Public Profile
```

---

# 9. Card Database

## 9.1 Fonte

A fonte externa principal será a TCGdex.

A TCGdex fornece:

- cards;
- sets;
- séries;
- imagens;
- categorias;
- ataques;
- habilidades;
- fraquezas;
- resistências;
- retreat;
- regulation mark;
- legalidade;
- variantes;
- idiomas.

A integração deve ocorrer através de uma camada própria do SleeveBuild.

---

# 10. TCGdex Provider

O sistema não deve espalhar chamadas à TCGdex pelo código.

Criar uma abstração conceitual:

```typescript
interface CardDataProvider {
  getCard(id: string): Promise<ExternalCard>;
  getSet(id: string): Promise<ExternalSet>;
  listCards(): Promise<ExternalCard[]>;
  listSets(): Promise<ExternalSet[]>;
}
```

Implementação inicial:

```text
TCGdexProvider
```

Isso permite trocar a fonte futuramente.

---

# 11. Sincronização da TCGdex

## 11.1 Fluxo inicial

```text
TCGdex
 ↓
Series
 ↓
Sets
 ↓
Cards
 ↓
Normalize
 ↓
PostgreSQL
```

---

## 11.2 Sincronização posterior

O sincronizador deve identificar:

```text
NEW
UPDATED
UNCHANGED
REMOVED
```

Registros existentes devem ser atualizados através de UPSERT ou mecanismo equivalente.

---

## 11.3 Nunca deletar cartas utilizadas

Se uma carta deixa de existir na fonte externa, ela não deve ser removida fisicamente do PostgreSQL se já tiver sido utilizada pelo sistema.

Em vez disso:

```text
is_active = false
```

Isso protege:

- decks;
- Inventory;
- alocações;
- partidas;
- históricos.

---

# 12. Identidade das cartas

O sistema terá duas camadas.

## 12.1 Logical Card

Representa a identidade competitiva da carta.

Exemplo:

```text
Buddy-Buddy Poffin
```

---

## 12.2 Card Printing

Representa uma impressão específica.

Exemplo:

```text
Buddy-Buddy Poffin
TEF 144
```

---

# 13. Modelo conceitual

```text
CardLogical
    │
    ├── CardPrinting
    ├── CardPrinting
    └── CardPrinting
```

Exemplo:

```text
Buddy-Buddy Poffin
│
├── TEF 144
├── TWM 223
├── PRE ...
└── outras impressões
```

---

# 14. CardLogical

Campos conceituais:

```text
id
canonical_name
category
```

Categorias:

```text
POKEMON
TRAINER
ENERGY
```

---

# 15. CardPrinting

Campos conceituais:

```text
id
tcgdex_id
logical_card_id
set_id
local_id
name
category
rarity
illustrator
regulation_mark
legal_standard
legal_expanded
image_url
tcgdex_updated_at
is_active
```

Outros campos poderão ser adicionados conforme a estrutura final da TCGdex.

---

# 16. Reprints

Reprints diferentes podem satisfazer a mesma carta lógica no Deckbuilder.

Exemplo:

```text
Deck:
4 × Buddy-Buddy Poffin

Inventory:
2 × TEF 144
3 × PRE xxx
```

Resultado:

```text
5 cópias disponíveis
4 necessárias
```

O deck não precisa especificar qual impressão física será utilizada.

---

# 17. Inventory e impressão física

Embora o Deckbuilder trabalhe com `CardLogical`, o Inventory trabalha com `CardPrinting`.

Isso permite saber exatamente quais impressões o usuário possui.

---

# 18. Energia básica

Energia básica será tratada como uma identidade lógica compartilhada.

Exemplo:

```text
Fire Energy
│
├── Printing A
├── Printing B
└── Printing C
```

No Deckbuilder:

```text
3 × Fire Energy
```

qualquer impressão compatível pode satisfazer a necessidade.

No Inventory, as impressões físicas continuam podendo ser diferenciadas.

---

# 19. Idiomas

Idioma inicial da aplicação:

```text
English
```

O modelo deve estar preparado para múltiplos idiomas.

O idioma físico da carta deve ser armazenável no Inventory.

---

# 20. Variantes físicas

A TCGdex possui conceitos como:

- normal;
- reverse;
- holo;
- first edition;
- promo/variantes.

No MVP, o foco do Inventory será:

- impressão;
- idioma;
- condição;
- quantidade.

Um modelo mais detalhado de acabamento poderá ser introduzido posteriormente.

---

# 21. Legalidade

Formatos serão entidades próprias.

Exemplo:

```text
STANDARD
EXPANDED
```

`STANDARD` não será uma tag.

---

# 22. Format Rules

As regras de cada formato não devem ficar hardcoded no frontend.

Conceito:

```text
Format
   ↓
FormatRules
   ↓
DeckValidator
```

Regras poderão incluir:

- tamanho do deck;
- quantidade máxima por carta;
- exceções;
- cartas proibidas;
- cartas restritas;
- regras de legalidade.

---

# 23. Deckbuilder

## 23.1 Deck

Um deck terá:

```text
id
user_id
name
format_id
archetype_id
description
physical_status
created_at
updated_at
```

---

# 24. DeckCard

```text
deck_id
logical_card_id
quantity
```

O DeckCard referencia `CardLogical`, não `CardPrinting`.

---

# 25. Categorias do DeckCard

A categoria será determinada pela carta lógica.

Exemplo:

```text
POKEMON
TRAINER
ENERGY
```

O deck pode apresentar:

```text
Pokémon: 19
Trainer: 32
Energy: 9

Total: 60
```

---

# 26. Tags

Tags serão independentes de formato.

Exemplos:

```text
FAVORITE
TESTING
ARCHIVED
```

O status físico será separado:

```text
SLEEVED
NOT_SLEEVED
```

Não utilizar `STANDARD` como tag.

---

# 27. Sleevado

`SLEEVED` significa:

> Todas as cartas físicas necessárias para o deck estão separadas e alocadas fisicamente para aquele deck.

Não existe estado parcial:

```text
90% SLEEVED
```

O estado é binário:

```text
SLEEVED
NOT_SLEEVED
```

---

# 28. Apenas Sleevado consome estoque

Decks em:

```text
TESTING
FAVORITE
NOT_SLEEVED
```

não consomem estoque físico.

Somente:

```text
SLEEVED
```

gera `DeckAllocation`.

---

# 29. Marcação como Sleevado

Ao solicitar:

```text
Mark as SLEEVED
```

o backend verifica se todas as cartas necessárias estão fisicamente disponíveis.

Se sim:

```text
Create allocations
Set SLEEVED
```

Se não:

```text
Identify shortage
```

e apresentar opções de resolução.

---

# 30. Alocação física

Uma alocação deve registrar qual Inventory Item foi utilizado.

Conceito:

```text
DeckAllocation
├── deck_id
├── inventory_item_id
└── quantity
```

Isso permite saber quais impressões físicas estão naquele deck.

---

# 31. Escolha automática de impressão

Quando um deck exige:

```text
4 × Buddy-Buddy Poffin
```

e existem:

```text
2 × TEF
3 × PRE
```

o sistema pode selecionar automaticamente:

```text
2 × TEF
2 × PRE
```

no MVP.

A política de seleção deve ser determinística.

No futuro poderá existir seleção manual das impressões.

---

# 32. Regra de reserva competitiva

Para cada carta lógica:

```text
competitive_reserve =
min(owned_quantity, 4)
```

As primeiras quatro cópias são protegidas para utilização competitiva futura.

---

# 33. Interação entre reserva e decks

As cartas alocadas a um deck Sleevado fazem parte da proteção competitiva.

Portanto:

```text
protected_quantity =
max(
  competitive_reserve,
  sleeved_allocated_quantity
)
```

E:

```text
available_for_trade =
max(
  0,
  owned_quantity - protected_quantity
)
```

---

# 34. Exemplos

## 5 cópias, nenhuma alocada

```text
Owned: 5
Reserve: 4
Sleeved: 0
Available: 1
```

---

## 5 cópias, 2 alocadas

```text
Owned: 5
Reserve: 4
Sleeved: 2
Protected: 4
Available: 1
```

---

## 10 cópias, 6 alocadas

```text
Owned: 10
Reserve: 4
Sleeved: 6
Protected: 6
Available: 4
```

---

# 35. Inventory

O Inventory representa as cartas físicas possuídas pelo usuário.

Campos conceituais:

```text
id
user_id
card_printing_id
quantity
condition
language
collection_status
created_at
updated_at
```

---

# 36. Condition

Condições iniciais:

```text
NM
LP
MP
HP
DMG
```

Definições visuais e regras exatas poderão ser documentadas posteriormente.

---

# 37. Collection Status

O status representa a finalidade da carta, não sua disponibilidade para venda.

Sugestão inicial:

```text
COMPETITIVE
COLLECTION
```

A disponibilidade para trade/venda é derivada do estoque.

Não criar um estado `TRADE` que possa entrar em conflito com a quantidade disponível.

---

# 38. Adição rápida

A interface do Inventory deve permitir:

```text
[ − ] [ 5 ] [ + ]
```

diretamente na visualização da carta.

O incremento/decremento deve resultar em uma transação de estoque.

---

# 39. Inventory Transactions

Toda alteração de quantidade deve possuir histórico.

Motivos:

```text
PURCHASE
SALE
TRADE
GIFT
LOST
DAMAGED
CORRECTION
OTHER
```

Campos:

```text
id
user_id
inventory_item_id
quantity_delta
reason
note
created_at
```

---

# 40. Observações

O usuário pode adicionar uma observação opcional.

Exemplo:

```text
Reason:
SALE

Quantity:
-1

Note:
Carta vendida para João
```

---

# 41. Histórico

Exemplo:

```text
+4  PURCHASE
+2  TRADE
-1  SALE
-1  DAMAGED
```

O histórico serve tanto para transparência quanto para recuperação de inconsistências.

---

# 42. Remoção de carta do deck

Quando uma carta é removida de um deck Sleevado:

```text
DeckAllocation ↓
Inventory availability ↑
```

A carta fica disponível para:

- outro deck;
- reserva competitiva;
- negociação.

---

# 43. Desmontagem do deck

Ao remover o estado:

```text
SLEEVED → NOT_SLEEVED
```

todas as alocações são liberadas.

As cartas retornam ao Inventory disponível.

---

# 44. Exclusão de deck

Ao excluir ou arquivar um deck Sleevado:

- suas alocações são liberadas;
- nenhuma carta física é destruída;
- Inventory permanece intacto.

---

# 45. Transferência entre decks

O SleeveBuild deverá suportar transferência de cartas físicas entre decks.

Cenário:

```text
Deck A = SLEEVED
Deck B = SLEEVED
Deck C = NOT_SLEEVED
```

Usuário tenta:

```text
Deck C → SLEEVED
```

e não possui cartas suficientes.

O sistema identifica decks que possuem as cartas necessárias.

---

# 46. Fluxo de transferência

```text
Deck C
 ↓
Missing cards
 ↓
Available in Deck A / Deck B
 ↓
User chooses source deck
 ↓
Transfer
```

---

# 47. Consequência da transferência

Se cartas forem retiradas do Deck A:

```text
Deck A → NOT_SLEEVED
```

mesmo que 90% das cartas continuem no deck.

Isso ocorre porque `SLEEVED` significa:

> conjunto físico completo.

As cartas transferidas passam para o Deck C.

Resultado:

```text
Deck A = NOT_SLEEVED
Deck C = SLEEVED
```

---

# 48. Atomicidade

A transferência deve ser uma única transação PostgreSQL.

Conceito:

```text
BEGIN

remove allocations from Deck A
mark Deck A NOT_SLEEVED

create allocations for Deck C
mark Deck C SLEEVED

COMMIT
```

Qualquer erro deve resultar em rollback.

---

# 49. Edição de deck Sleevado

A edição deve ser suportada.

Entretanto, qualquer alteração que modifique a quantidade necessária deve disparar uma nova validação física.

Se o deck continuar completamente coberto:

```text
SLEEVED
```

Se não:

```text
resolver allocations
```

O fluxo deve permitir transferência de cartas quando necessário.

---

# 50. Importação de decks Limitless

O SleeveBuild aceitará o formato fornecido pelo Limitless.

Exemplo:

```text
Pokémon: 19
4 Dreepy TWM 128
...

Trainer: 32
4 Lillie's Determination MEG 119
...

Energy: 9
3 Fire Energy MEE 2
...
```

---

# 51. Parser Limitless

Estrutura:

```text
[quantity] [name] [set_code] [collector_number]
```

Exemplo:

```text
4 Dreepy TWM 128
```

vira:

```json
{
  "quantity": 4,
  "name": "Dreepy",
  "setCode": "TWM",
  "collectorNumber": "128"
}
```

---

# 52. Parsing de nomes

Não usar simplesmente:

```text
split(" ")
```

para identificar o nome.

O parser deve considerar:

- primeiro token = quantidade;
- penúltimo token = set code;
- último token = collector number;
- tokens intermediários = nome.

Isso suporta:

```text
Buddy-Buddy Poffin
Lillie's Determination
Special Red Card
Risky Ruins
```

---

# 53. Card Resolution

O resolver deve usar prioritariamente:

```text
setCode
+
collectorNumber
```

para localizar a impressão exata.

O nome deve servir como validação adicional.

Fluxo:

```text
Limitless
 ↓
setCode + collectorNumber
 ↓
TCGdex / local CardPrinting
 ↓
CardPrinting
 ↓
CardLogical
```

---

# 54. Estados da importação

Estados:

```text
IMPORTED
PARTIALLY_RESOLVED
READY
INVALID
```

Exemplo:

```text
READY

60 / 60 cards resolved
```

Ou:

```text
PARTIALLY_RESOLVED

59 / 60 cards resolved
1 unknown card
```

---

# 55. Validação do deck

Após resolver as cartas:

```text
Parser
 ↓
Resolver
 ↓
Format Validator
 ↓
Inventory Check
```

Valida:

- quantidade total;
- limite de cópias;
- legalidade;
- regras especiais;
- formato.

---

# 56. Inventory Check

Exemplo:

```text
4 × Dreepy             4/4  OWNED
4 × Drakloak           4/4  OWNED
3 × Dragapult ex       3/3  OWNED
4 × Buddy-Buddy Poffin 2/4  PARTIAL
```

Estados:

```text
OWNED
PARTIAL
MISSING
```

---

# 57. Carta lógica no Inventory Check

O check deve somar todas as impressões compatíveis.

Exemplo:

```text
Deck:
4 × Buddy-Buddy Poffin

Inventory:
2 × TEF
3 × PRE
```

Resultado:

```text
5 available
4 required
OWNED
```

---

# 58. Training

O módulo Training utilizará como fonte principal os logs exportados pelo Pokémon TCG Live.

O Training Court é uma referência funcional, mas o SleeveBuild terá seu próprio modelo.

---

# 59. Raw Battle Log

O log original deve ser armazenado integralmente.

```text
BattleLog
├── id
├── user_id
├── raw_log
├── source
├── imported_at
└── parser_version
```

O `raw_log` não deve ser alterado.

---

# 60. Parser TCG Live

Fluxo:

```text
Raw Log
 ↓
Parser
 ↓
Structured Match Data
```

O parser deverá extrair somente informações comprovadamente presentes no log.

Não inventar campos.

---

# 61. Match

O Match representa a partida normalizada.

Campos conceituais:

```text
id
user_id
battle_log_id
deck_id
opponent_archetype_id
result
turn_order
format
notes
played_at
created_at
```

---

# 62. Result

Internamente:

```text
WIN
LOSS
DRAW
UNKNOWN
```

Mapeamento de importação:

```text
W → WIN
L → LOSS
D → DRAW
```

---

# 63. Turn Order

Internamente:

```text
FIRST
SECOND
```

O valor externo do log será convertido.

Isso permitirá estatísticas:

```text
Win rate going first
Win rate going second
```

---

# 64. Formato do TCG Live

O log pode conter valores como:

```text
TEF-PBL
```

Esse valor deve ser preservado.

Não devemos assumir imediatamente que o código possui o mesmo significado dos formatos internos do Deckbuilder.

O SleeveBuild terá:

```text
GameFormatCode
```

ou mecanismo equivalente para preservar o valor externo.

---

# 65. Meu deck

O Match deve apontar para um `Deck`.

No beta, o usuário poderá selecionar manualmente qual deck utilizou.

Futuramente o SleeveBuild poderá sugerir automaticamente um deck baseado nas cartas identificadas no log.

---

# 66. Arquétipo

Arquétipo será uma entidade própria.

Exemplos:

```text
Dragapult
Gardevoir
Charizard
Alakazam / Dudunsparce
```

---

# 67. Arquétipo do oponente

O log fornece os Pokémon utilizados.

O sistema pode sugerir:

```text
Opponent:
Alakazam / Dudunsparce
```

Mas o usuário pode alterar.

O valor final salvo é sempre a escolha do usuário.

---

# 68. Arquétipo editável

Fluxo:

```text
Log
 ↓
Detected Pokémon
 ↓
Suggested Archetype
 ↓
User Review
 ↓
Save
```

O usuário pode:

- aceitar;
- escolher outro;
- editar;
- criar um arquétipo, quando suportado.

---

# 69. Arquétipo e sprites

O arquétipo deve definir os Pokémon utilizados para apresentação.

Exemplo:

```text
Archetype:
Alakazam / Dudunsparce

Display Pokémon:
Alakazam
Dudunsparce
```

O frontend renderiza os sprites/imagens associados.

O Match não precisa armazenar imagens.

---

# 70. Player Archetype

O Deck poderá possuir:

```text
archetype_id
```

Assim:

```text
Deck
 ↓
Archetype
```

O Match aponta para o Deck utilizado.

Isso evita duplicação desnecessária do arquétipo do jogador.

---

# 71. Alteração posterior do Match

Após salvar, o usuário poderá editar:

- arquétipo adversário;
- deck;
- notas;
- torneio;
- rodada;
- outros campos permitidos.

O raw log continua imutável.

---

# 72. Parser Version

Cada BattleLog deve registrar:

```text
parser_version
```

Isso permite reprocessar logs antigos quando o parser evoluir.

---

# 73. Dados detalhados de jogo

O raw log permite extrair futuramente:

- turnos;
- cartas compradas;
- cartas jogadas;
- cartas descartadas;
- Pokémon colocados no campo;
- evoluções;
- ataques;
- dano;
- energias;
- cartas de prêmio;
- condições especiais.

Entretanto, esse nível detalhado ficará fora do MVP.

---

# 74. Modelo futuro de eventos

Futuramente:

```text
Game
 ↓
Turn
 ↓
Action
```

Possíveis eventos:

```text
CardEvent
PokemonEvent
DamageEvent
EnergyEvent
PrizeEvent
AttackEvent
```

---

# 75. Torneios

Torneio é uma entidade independente.

```text
Tournament
├── id
├── user_id
├── name
├── date
├── location
├── format
├── placement
└── participant_count
```

---

# 76. Tournament Match

```text
TournamentMatch
├── tournament_id
├── match_id
└── round
```

Uma partida pode existir sem torneio.

Portanto:

```text
Match.tournament_id = NULL
```

é permitido.

---

# 77. Estatísticas

O MVP terá estatísticas básicas.

## Por deck

```text
Deck: Gardevoir

Matches: 42
Wins: 29
Losses: 13
Win Rate: 69.0%
```

---

# 78. Matchup

Exemplo:

```text
Gardevoir
vs
Charizard

12 matches
8 wins
4 losses
66.7%
```

---

# 79. Win Rate

Definição:

```text
Win Rate =
Wins / (Wins + Losses)
```

Draws não entram no denominador.

Exemplo:

```text
8 W
2 L
2 D

Win Rate = 80%
```

A interface também deve mostrar o total:

```text
12 matches
8W / 2L / 2D
80% win rate
```

---

# 80. Filtros de estatísticas

Filtros iniciais:

- formato;
- deck;
- arquétipo adversário;
- intervalo de datas;
- torneio.

Filtros futuros:

- primeiro/segundo;
- período avançado;
- versões/listas;
- eventos.

---

# 81. Perfil público

URL:

```text
/user/{username}
```

O username é o identificador público.

---

# 82. Username

Regras:

- obrigatório;
- globalmente único;
- utilizado na URL;
- pode ser alterado;
- alteração limitada a uma vez a cada 3 meses;
- novo username precisa passar novamente pela verificação de unicidade.

---

# 83. Display Name

O nome de exibição é independente do username.

Exemplo:

```text
username:
nicolasfmc

display_name:
Nicolas
```

O usuário pode alterar `display_name` livremente.

Alterar o display name não altera a URL.

---

# 84. Perfil público

Perfil público é:

```text
ON
```

por padrão.

O usuário poderá desabilitá-lo.

---

# 85. Inventário público

Visualizar o inventário público não requer login.

O visitante poderá acessar:

```text
/user/username
```

sem autenticação.

---

# 86. Dados públicos

O perfil pode apresentar:

- username;
- display name;
- avatar, se implementado;
- bio, se implementada;
- cartas disponíveis para negociação.

---

# 87. Dados que não devem ser públicos

O backend não deve enviar:

- quantidade total possuída;
- quantidade reservada;
- cartas alocadas;
- decks responsáveis pela alocação;
- estoque protegido;
- histórico de movimentações;
- dados privados.

---

# 88. Disponibilidade pública

O backend calcula:

```text
available_for_trade
```

e retorna apenas essa informação.

Exemplo:

```text
Buddy-Buddy Poffin
1 copy available
```

Se o usuário possuir 4 ou menos:

```text
4 copies
```

não aparece publicamente.

---

# 89. Exemplo

Usuário possui:

```text
5 × Buddy-Buddy Poffin
```

O sistema protege:

```text
4
```

Perfil público:

```text
Buddy-Buddy Poffin × 1
```

Usuário possui:

```text
4
```

Perfil público:

```text
não aparece
```

---

# 90. Public Inventory API

A API pública deve retornar somente dados necessários.

Exemplo conceitual:

```json
{
  "card": {
    "id": "...",
    "name": "Buddy-Buddy Poffin"
  },
  "availableQuantity": 1
}
```

Nunca retornar:

```json
{
  "owned": 5,
  "reserved": 4,
  "allocated": 0
}
```

---

# 91. Autenticação

Login e senha são obrigatórios para funcionalidades autenticadas.

Sem login:

- não pode criar deck;
- não pode alterar Inventory;
- não pode registrar partidas;
- não pode criar torneios;
- não pode editar perfil.

Sem login:

- pode visualizar inventário público.

---

# 92. OAuth

Fora do MVP:

- Google;
- Discord.

Não haverá integração inicialmente.

---

# 93. Exclusão de conta

A exclusão não será imediata.

Estado conceitual:

```text
ACTIVE
 ↓
DELETION_PENDING
 ↓
PERMANENTLY_DELETED
```

Durante o período de recuperação:

- conta pode ser reativada;
- perfil público fica indisponível;
- inventário público fica indisponível;
- dados permanecem preservados.

Período definitivo:

**TBD**

Sugestão inicial: 30 dias.

---

# 94. Username durante exclusão

Durante `DELETION_PENDING`, o username deverá permanecer reservado para evitar que outro usuário ocupe a URL antes da exclusão definitiva.

Regra final:

**TBD**

---

# 95. Privacidade

Cada domínio deverá respeitar autorização no backend.

O usuário somente poderá acessar/modificar:

- seus decks;
- seu Inventory;
- suas partidas;
- seus torneios;
- suas configurações.

Dados públicos serão uma exceção explícita.

---

# 96. UI / UX

## Mantine

Responsável principalmente por componentes funcionais:

- Modal;
- Drawer;
- Select;
- Combobox;
- Tabs;
- Table;
- Forms;
- Notifications;
- DatePicker;
- Pagination;
- componentes de input.

## Tailwind

Responsável principalmente por:

- layout;
- grid;
- spacing;
- responsividade;
- composição;
- posicionamento;
- estados visuais simples.

Não criar dois sistemas concorrentes para a mesma responsabilidade.

---

# 97. Responsividade

O produto deverá suportar:

```text
Desktop
Tablet
Mobile
```

---

# 98. Prioridade por módulo

### Deckbuilder

Prioridade:

```text
Desktop > Tablet > Mobile
```

### Inventory

Prioridade:

```text
Desktop ≈ Mobile > Tablet
```

### Training

A interface de registro deve ser especialmente rápida em mobile.

---

# 99. Navegação principal

Estrutura inicial sugerida:

```text
Dashboard

Decks
  ├── My Decks
  ├── Create Deck
  └── Import Deck

Inventory
  ├── Collection
  ├── Competitive
  └── Transactions

Training
  ├── Matches
  ├── Import Log
  ├── Tournaments
  └── Statistics

Profile
  ├── Public Profile
  └── Settings
```

---

# 100. Dashboard

O Dashboard poderá apresentar:

- decks recentes;
- deck ativo;
- cartas disponíveis;
- partidas recentes;
- win rate;
- próximo/último torneio;
- alertas de decks incompletos.

Detalhes exatos ficam para UX.

---

# 101. Segurança

Requisitos:

- autenticação segura;
- senha armazenada somente através de hash apropriado;
- autorização server-side;
- validação de inputs;
- rate limiting;
- proteção contra abuso de APIs;
- proteção das rotas privadas;
- proteção das operações de Inventory;
- logs de erros;
- auditoria de operações importantes.

---

# 102. Inventory concurrency

Operações de Inventory devem ser transacionais.

Exemplo:

Dois requests simultâneos tentando vender a última carta disponível não podem ambos serem aprovados.

A disponibilidade deve ser verificada dentro da mesma transação que modifica o estoque.

---

# 103. Deck concurrency

O mesmo princípio vale para alocações.

Dois decks não podem receber simultaneamente a mesma carta física.

Operações de:

- Sleevado;
- transferência;
- desmontagem;
- edição de deck;

devem ser transacionais.

---

# 104. Auditoria

Além de `InventoryTransaction`, poderá existir:

```text
AuditLog
├── user_id
├── action
├── entity
├── entity_id
├── metadata
└── created_at
```

O objetivo é investigar alterações importantes.

---

# 105. Performance

O frontend nunca deve depender da TCGdex para buscas normais.

Fluxo:

```text
Browser
 ↓
Next.js
 ↓
PostgreSQL
```

TCGdex somente:

```text
TCGdex
 ↓
Sync
 ↓
PostgreSQL
```

---

# 106. Card Search

O banco local deverá suportar:

- busca por nome;
- set;
- tipo;
- categoria;
- formato;
- legalidade;
- regulation mark;
- outros filtros relevantes.

---

# 107. Índices

O schema final deverá criar índices principalmente para:

- `CardLogical.name`;
- `CardPrinting.tcgdex_id`;
- `CardPrinting.set_id`;
- `CardPrinting.local_id`;
- combinações set/local ID;
- `Deck.user_id`;
- `InventoryItem.user_id`;
- `Match.user_id`;
- `Match.deck_id`;
- `Match.opponent_archetype_id`;
- `Tournament.user_id`;
- username.

Índices definitivos serão determinados no schema SQL.

---

# 108. Modelo de dados conceitual

```text
User
 │
 ├── Profile
 │
 ├── Deck
 │    └── DeckCard
 │          └── CardLogical
 │
 ├── InventoryItem
 │          └── CardPrinting
 │                    └── CardLogical
 │
 ├── InventoryTransaction
 │
 ├── BattleLog
 │      └── Match
 │             ├── Deck
 │             ├── OpponentArchetype
 │             └── Tournament
 │
 └── Tournament
```

Card domain:

```text
CardLogical
    │
    ├── CardPrinting
    │       └── CardSet
    │
    └── DeckCard
```

---

# 109. Entidades principais

## User

Responsável pela identidade e propriedade dos dados.

## UserProfile

Informações públicas/configurações.

## CardLogical

Identidade competitiva da carta.

## CardPrinting

Impressão específica.

## CardSet

Set externo.

## Format

Formato competitivo.

## FormatRule

Regras do formato.

## Deck

Lista criada pelo usuário.

## DeckCard

Cartas lógicas utilizadas.

## DeckAllocation

Cartas físicas alocadas ao deck.

## InventoryItem

Quantidade física possuída.

## InventoryTransaction

Histórico de alteração.

## Archetype

Arquétipo competitivo.

## BattleLog

Raw log do Pokémon TCG Live.

## Match

Partida normalizada.

## Tournament

Torneio.

## TournamentMatch

Relação torneio/partida.

---

# 110. Relações fundamentais

```text
User 1:N Deck

User 1:N InventoryItem

User 1:N Match

User 1:N Tournament

Deck 1:N DeckCard

Deck 1:N DeckAllocation

InventoryItem 1:N DeckAllocation

CardLogical 1:N CardPrinting

CardLogical 1:N DeckCard

CardPrinting N:1 CardSet

Match N:1 Deck

Match N:1 Archetype

Tournament 1:N TournamentMatch

Match 0:1 TournamentMatch
```

---

# 111. Integridade do Inventory

O sistema deve impedir:

```text
quantity < 0
```

e operações que produzam estoque fisicamente impossível.

---

# 112. Integridade do Deck

O sistema deve impedir:

- quantidade negativa;
- cartas inexistentes;
- referências a cards inativos sem tratamento apropriado;
- `SLEEVED` sem alocações suficientes.

---

# 113. Integridade do Sleevado

Para um deck `SLEEVED`:

```text
sum(allocated quantity)
=
required quantity
```

para todas as cartas do deck.

---

# 114. Regras de exclusão

Cards externos:

> nunca excluir se já utilizados.

Decks:

> podem ser arquivados.

Matches:

> poderão ser excluídos pelo usuário, conforme política final.

Inventory:

> alterações devem preferencialmente gerar transações em vez de apagar histórico.

---

# 115. Importação em massa

Futuro:

- CSV;
- coleções;
- listas externas.

A arquitetura de Inventory deve permitir importação em massa sem alterar seu modelo fundamental.

---

# 116. Testes

## Unit tests

Obrigatórios para:

- Limitless parser;
- TCG Live parser;
- Card Resolver;
- Deck Validator;
- Inventory availability;
- competitive reserve;
- Deck Allocation;
- transferências;
- legalidade.

---

# 117. Integration tests

Devem cobrir:

```text
Deck ↔ Inventory

Deck ↔ Allocation

Match ↔ Deck

Match ↔ Archetype

Tournament ↔ Match
```

---

# 118. E2E

Fluxo principal:

```text
Criar conta
 ↓
Criar Inventory
 ↓
Criar Deck
 ↓
Importar deck
 ↓
Verificar cartas
 ↓
Marcar Sleevado
 ↓
Importar Match
 ↓
Selecionar arquétipo
 ↓
Salvar
 ↓
Visualizar estatísticas
 ↓
Abrir perfil público
```

---

# 119. Parser Testing

Os parsers devem possuir fixtures reais.

### Limitless

Usar o deck fornecido:

```text
Pokémon: 19
Trainer: 32
Energy: 9
```

como fixture inicial.

### TCG Live

Usar o log fornecido:

```text
Ayesai vs nicolasfmc
```

como fixture inicial.

Novos exemplos devem ser adicionados quando encontrados formatos diferentes.

---

# 120. Arquétipo Classifier

O classificador automático será opcional no beta.

A primeira versão pode funcionar somente com seleção manual.

Posteriormente:

```text
Detected Pokémon
 ↓
Archetype Classifier
 ↓
Suggested Archetype
 ↓
User confirmation
```

O classificador nunca deve alterar silenciosamente partidas já salvas.

---

# 121. Estatísticas e arquétipos

As estatísticas utilizarão o arquétipo persistido no Match.

Não será executada uma nova classificação do raw log toda vez que a estatística for calculada.

Isso garante estabilidade histórica.

---

# 122. Internacionalização

A UI será inicialmente em inglês.

A arquitetura deverá permitir:

```text
en
pt-BR
es
fr
...
```

Cartas e sets devem possuir estrutura para traduções futuras.

---

# 123. Imagens

Inicialmente, as imagens das cartas serão referenciadas a partir da infraestrutura da TCGdex.

Não haverá necessidade de copiar todas as imagens para storage próprio no MVP.

A política definitiva de uso/distribuição de assets deverá ser revisada antes do lançamento público/comercial.

---

# 124. Preços

O SleeveBuild não armazenará preços no MVP.

O preço de uma eventual venda será verificado externamente no momento da operação.

A arquitetura não deve assumir que uma carta possui um preço persistente.

---

# 125. Marketplace futuro

Quando existir marketplace:

```text
Inventory
 ↓
Available Quantity
 ↓
Listing
 ↓
External/Manual Price
```

Isso deverá ser uma camada separada.

O Inventory não deve depender de marketplace.

---

# 126. Roadmap

## Fase 1 — Foundation

- autenticação;
- User/Profile;
- PostgreSQL;
- Card domain;
- TCGdex sync;
- UI foundation.

---

## Fase 2 — Deckbuilder

- busca;
- criação;
- edição;
- importação Limitless;
- validação;
- formatos;
- tags;
- arquétipos.

---

## Fase 3 — Inventory

- cadastro;
- quantidade;
- condição;
- status;
- transactions;
- disponibilidade;
- integração com decks.

---

## Fase 4 — Physical Deck Management

- Sleevado;
- allocations;
- transferência;
- desmontagem;
- edição com recalculo.

---

## Fase 5 — Training

- raw logs;
- parser;
- Match;
- arquétipo;
- resultados;
- histórico.

---

## Fase 6 — Tournaments & Statistics

- torneios;
- rodadas;
- matchup;
- win rate;
- filtros.

---

## Fase 7 — Public Profile

- `/user/username`;
- inventário público;
- configurações de privacidade.

---

# 127. Pós-MVP

Possíveis funcionalidades:

- CSV;
- importação de coleção;
- escolha manual de impressões ao Sleevado;
- classificador automático de arquétipos;
- análise detalhada de logs;
- turn-by-turn;
- gráficos avançados;
- deck sharing;
- wishlist;
- trades;
- marketplace;
- mobile/PWA;
- Google/Discord;
- múltiplos idiomas;
- preços;
- integração com outras fontes.

---

# 128. Questões pendentes

Estas questões permanecem abertas.

## Conta

- período definitivo de recuperação de conta;
- política de username;
- caracteres permitidos;
- tamanho mínimo/máximo;
- case sensitivity;
- política definitiva de senha;
- comportamento do username durante exclusão.

## Inventory

- definição visual/formal das condições;
- idioma inicial permitido;
- comportamento exato de `COMPETITIVE` vs `COLLECTION`.

## Deckbuilder

- política definitiva para editar um Sleevado;
- comportamento quando a nova lista exige transferência;
- regras específicas de formatos.

## Training

- todos os campos possíveis do log TCG Live;
- identificação automática do deck;
- classificação automática de arquétipos;
- suporte a partidas manuais;
- definição exata de `played_at`.

## Infrastructure

- ORM;
- PostgreSQL provider;
- autenticação;
- sistema de jobs;
- observabilidade;
- storage.

---

# 129. Decisões de produto importantes

As seguintes decisões são consideradas fechadas para a versão 0.1:

### Carta

```text
Deckbuilder → CardLogical
Inventory → CardPrinting
```

### Reprints

Reprints diferentes podem satisfazer a mesma carta no Deckbuilder.

### Energia

Energias básicas compartilham identidade lógica.

### Formato

Formato é separado de tags.

### Sleevado

`SLEEVED` significa conjunto físico completo.

### Estoque

Somente `SLEEVED` consome estoque físico.

### Reserva

Até quatro cópias por carta lógica são protegidas.

### Público

Somente quantidade disponível para negociação é exposta.

### Training

Raw log é preservado.

### Arquétipo

Pode ser sugerido, mas sempre pode ser editado pelo usuário.

### Histórico

Estatísticas usam o arquétipo salvo.

### Cards

Cards utilizados pelo sistema nunca são fisicamente deletados.

---

# 130. Critérios de aceite do MVP

## Cards

- [ ] TCGdex sincroniza cards.
- [ ] Sets são sincronizados.
- [ ] Impressões possuem ID externo.
- [ ] Legalidade é armazenada.
- [ ] Cards utilizados não são deletados.
- [ ] Busca local funciona sem depender da TCGdex.

## Deckbuilder

- [ ] Usuário consegue criar deck.
- [ ] Deck possui formato.
- [ ] Deck possui tags independentes do formato.
- [ ] Deck possui cartas lógicas.
- [ ] Reprints satisfazem a mesma carta.
- [ ] Deck é validado.
- [ ] Limitless pode ser importado.
- [ ] Cartas não resolvidas são identificadas.

## Inventory

- [ ] Usuário consegue adicionar cartas.
- [ ] Quantidade pode ser incrementada/decrementada.
- [ ] Condição é armazenada.
- [ ] Status é armazenado.
- [ ] Histórico é criado.
- [ ] Disponibilidade é calculada no backend.
- [ ] Reserva de quatro cópias é respeitada.

## Sleevado

- [ ] Deck só pode virar Sleevado quando fisicamente completo.
- [ ] Alocações são criadas.
- [ ] Somente Sleevado consome estoque.
- [ ] Remover Sleevado libera as cartas.
- [ ] Transferência entre decks funciona.
- [ ] Deck de origem torna-se não Sleevado quando perde cartas.
- [ ] Transferência é atômica.

## Training

- [ ] Raw log é preservado.
- [ ] Parser possui versão.
- [ ] Match é criado.
- [ ] Resultado é armazenado.
- [ ] Ordem de turno é armazenada.
- [ ] Deck é associado.
- [ ] Arquétipo adversário é selecionável/editável.
- [ ] Notas podem ser armazenadas.

## Torneios

- [ ] Torneio pode ser criado.
- [ ] Partidas podem ser associadas.
- [ ] Rodadas podem ser armazenadas.
- [ ] Colocação pode ser registrada.

## Estatísticas

- [ ] Win rate por deck.
- [ ] Win rate por matchup.
- [ ] W/L/D.
- [ ] Filtros básicos.

## Perfil

- [ ] Username único.
- [ ] `/user/username` funciona.
- [ ] Perfil público é habilitado por padrão.
- [ ] Inventário público não exige login.
- [ ] Estoque protegido não é exposto.
- [ ] Usuário pode desabilitar perfil público.

---

# 131. Riscos técnicos

## Dependência da TCGdex

Mitigação:

```text
TCGdex
 ↓
Local PostgreSQL
```

---

## Alterações na estrutura da TCGdex

Mitigação:

```text
TCGdexProvider
 ↓
Normalization Layer
 ↓
Internal Models
```

---

## Reprints

Mitigação:

```text
CardLogical
+
CardPrinting
```

---

## Concorrência no Inventory

Mitigação:

- transactions;
- constraints;
- locking quando necessário.

---

## Parser TCG Live

O formato pode evoluir.

Mitigação:

- raw log;
- parser version;
- fixtures;
- reprocessamento.

---

## Regras do Pokémon TCG

As regras podem mudar.

Mitigação:

```text
Format
 ↓
FormatRules
```

---

# 132. Princípios para futuras decisões

Quando surgir uma nova funcionalidade, aplicar:

### Pergunta 1

Isso representa uma propriedade da carta ou da impressão?

Se impressão:

```text
CardPrinting
```

Se identidade competitiva:

```text
CardLogical
```

### Pergunta 2

Isso representa propriedade física do usuário?

```text
Inventory
```

### Pergunta 3

Isso representa utilização física?

```text
DeckAllocation
```

### Pergunta 4

Isso representa histórico?

```text
Transaction / Match / Tournament
```

### Pergunta 5

Isso representa apresentação pública?

```text
Profile / Public API
```

Essa separação deve evitar que conceitos diferentes sejam misturados no mesmo modelo.

---

# 133. Visão final do produto

O SleeveBuild deverá evoluir para:

```text
                         SleeveBuild
                            │
        ┌───────────────────┼────────────────────┐
        │                   │                    │
        ▼                   ▼                    ▼
   DECKBUILDER          INVENTORY             TRAINING
        │                   │                    │
        │                   │                    │
        └──────────────┬────┘                    │
                       │                         │
                       ▼                         ▼
                 PHYSICAL DECKS              MATCHES
                       │                         │
                       └────────────┬────────────┘
                                    ▼
                                STATISTICS
                                    │
                                    ▼
                             PUBLIC PROFILE
```

E todos os módulos utilizam uma base comum:

```text
                     CARD DOMAIN
                          │
              ┌───────────┴───────────┐
              ▼                       ▼
        CardLogical              CardPrinting
                                      │
                                      ▼
                                  Inventory
```

O objetivo não é apenas reproduzir Limitless + Training Court + uma coleção de cartas em um único site.

O diferencial estrutural do SleeveBuild é conectar **a carta lógica, a carta física, o deck físico e o desempenho do jogador** em um único modelo de dados.