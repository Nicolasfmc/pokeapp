# Contratos — Wave 0 (congelados)

Fonte: [PokeApp Product & Technical Specification v0.1](./PokeApp-Product-Technical-Specification-v0.1.md).  
Este documento congela decisões e contratos compartilhados para agentes paralelos. Alterações exigem coordenação explícita.

---

## 1. Decisão de ORM

| Item | Valor |
|------|--------|
| ORM | **Prisma** |
| Spec (§7) | TBD (Prisma ou Drizzle) |
| Decisão Wave 0 | Prisma — alinhado ao scaffold (`prisma/`) |

`prisma/schema.prisma` e migrations são ownership exclusivo do **WS-A**. Wave 0 apenas adiciona as deps `prisma` (dev) e `@prisma/client`.

---

## 2. Ownership de pastas e prefixos de API

| WS | Pastas / rotas permitidas |
|----|---------------------------|
| **A** | `prisma/`, `server/database/` |
| **B** | `server/auth/`, `app/api/auth/**`, `app/(auth)/**` |
| **C** | `server/tcgdex/`, `scripts/sync-tcgdex*` |
| **D** | `components/`, `app/layout.tsx`, `app/globals.css`, `app/(app)/**` (layouts/nav) |
| **E** | `server/parsers/`, `tests/parsers/**`, `tests/fixtures/**` |
| **F** | `modules/cards/`, `app/api/cards/**` |
| **G** | `modules/decks/`, `app/api/decks/**` (sem sleeve) |
| **H** | `modules/inventory/`, `app/api/inventory/**` |
| **I** | serviços/endpoints de sleeve e allocation (`*sleeve*`, allocation) |
| **J** | `modules/training/`, `app/api/training/**`, `app/api/matches/**` |
| **K** | `modules/tournaments/`, `app/api/tournaments/**` |
| **L** | `modules/statistics/`, `app/api/statistics/**` |
| **M** | `modules/profile/` (público), `app/user/[username]/**`, `app/api/public/**` |

Detalhamento de proibições: [agent-ownership.md](./agent-ownership.md).

---

## 3. Interface `CardDataProvider` (§10)

```typescript
interface CardDataProvider {
  getCard(id: string): Promise<ExternalCard>;
  getSet(id: string): Promise<ExternalSet>;
  listCards(): Promise<ExternalCard[]>;
  listSets(): Promise<ExternalSet[]>;
}
```

Implementação inicial: `TCGdexProvider` (WS-C). Tipos `ExternalCard` / `ExternalSet` são definidos pelo WS-C junto ao provider.

---

## 4. Fórmulas de reserva e disponibilidade (§32–33)

```text
competitive_reserve =
  min(owned_quantity, 4)

protected_quantity =
  max(competitive_reserve, sleeved_allocated_quantity)

available_for_trade =
  max(0, owned_quantity - protected_quantity)
```

Por carta lógica. As primeiras quatro cópias são protegidas para uso competitivo. Alocações de decks `SLEEVED` entram na proteção.

---

## 5. Shape `SessionUser`

```typescript
interface SessionUser {
  id: string;
  username: string;
}
```

Contrato mínimo da sessão autenticada. Campos extras (email, display_name, etc.) não fazem parte deste shape congelado na Wave 0.

---

## 6. Enums congelados

### condition (§36)

```text
NM | LP | MP | HP | DMG
```

### collection_status (§37)

```text
COMPETITIVE | COLLECTION
```

Não criar estado `TRADE` que conflite com `available_for_trade` derivado.

### physical_status (§26–27)

```text
SLEEVED | NOT_SLEEVED
```

Binário. Somente `SLEEVED` gera `DeckAllocation` e consome estoque físico.

### Match result (§62)

```text
WIN | LOSS | DRAW | UNKNOWN
```

Mapeamento de importação: `W → WIN`, `L → LOSS`, `D → DRAW`.

### turn_order (§63)

```text
FIRST | SECOND
```

### Estados de importação de deck (§54)

```text
IMPORTED | PARTIALLY_RESOLVED | READY | INVALID
```

### Motivos de transação de inventory (§39)

```text
PURCHASE | SALE | TRADE | GIFT | LOST | DAMAGED | CORRECTION | OTHER
```

### Estados de conta (exclusão, §93) — referência

```text
ACTIVE | DELETION_PENDING | PERMANENTLY_DELETED
```

---

## 7. Rotas públicas

Convenção:

```text
/user/{username}
```

- `username` é o identificador público, globalmente único.
- Inventário/perfil público não exige login.
- APIs públicas sob `app/api/public/**` (WS-M).

---

## 8. TCGdex e runtime

```text
TCGdex → Synchronization → PostgreSQL → PokeApp
```

- Chamadas à TCGdex **somente** no sync (WS-C / scripts).
- Runtime da app **não** chama TCGdex; lê apenas PostgreSQL.
- Código de domínio não deve importar cliente TCGdex diretamente.

---

## 9. Identidade de carta: Deck vs Inventory

| Contexto | Referência |
|----------|------------|
| `DeckCard` | `logical_card_id` → `CardLogical` |
| Inventory | `card_printing_id` → `CardPrinting` |

Reprints são intercambiáveis no deckbuilder; o inventory controla impressões físicas individuais.

---

## 10. Fora do MVP (§6)

Não implementar inicialmente:

- marketplace
- venda dentro do PokeApp
- sistema de pagamentos
- preços cadastrados
- integração com Liga
- sistema de trades completo
- Google Login / Discord Login
- aplicativo mobile nativo
- deck versioning
- análise avançada de partidas / análise automática de jogadas
- recomendação automática de decks
- rede social / seguidores / mensagens
- suporte completo de UI multilíngue
- sincronização automática direta com Pokémon TCG Live

---

## 11. Dependências Wave 0 / Wave 1 (`package.json`)

Instaladas na Wave 0 (não alterar sem coordenação):

| Pacote | Versão instalada | Papel | Notas |
|--------|------------------|--------|--------|
| `prisma` (dev) | `^7.10.0` | CLI ORM | Schema criado pelo WS-A; **não** rodar `prisma init` em outros WS |
| `@prisma/client` | `^7.10.0` | Client runtime | Gerar client após schema (WS-A) |
| `@mantine/core` | `^7.17.8` | UI (WS-D) | v7 estável; peer `react ^18 \|\| ^19` (não usar Mantine 9 sem alinhamento) |
| `@mantine/hooks` | `^7.17.8` | UI (WS-D) | |
| `@mantine/notifications` | `^7.17.8` | UI (WS-D) | WS-D pode precisar de `postcss-preset-mantine` / imports CSS |
| `vitest` (dev) | `^3.2.4` | Testes de parsers (WS-E) | |

Stack base já existente: Next 16.3.4, React 19.2.8, Tailwind 4, TypeScript.

Conflito potencial: qualquer WS que rode `npm install` de outras libs deve documentar e evitar bump de majors destas deps sem alinhamento. `package-lock.json` é ponto único de contenção se vários agentes instalarem deps ao mesmo tempo.

---

## 12. Variáveis de ambiente (template)

Ver `.env.example` na raiz. Sem secrets reais. WS-A / WS-B / WS-C preenchem valores locais conforme implementam.
