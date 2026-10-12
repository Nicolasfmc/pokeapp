# PokeApp

Aplicação Next.js para coleção, decks e treinamento Pokémon TCG.

## Documentação

- Spec: [docs/PokeApp-Product-Technical-Specification-v0.1.md](docs/PokeApp-Product-Technical-Specification-v0.1.md)
- Contratos Wave 0: [docs/contracts.md](docs/contracts.md)
- Ownership de agentes: [docs/agent-ownership.md](docs/agent-ownership.md)

## Stack

- Next.js 16, React 19, TypeScript, Tailwind CSS 4, Mantine 7
- PostgreSQL + Prisma
- Vitest (parsers, sync, availability, allocation, statistics)
- Catálogo de cartas via sync TCGdex → PostgreSQL (runtime não chama TCGdex)

## Requisitos

- Node.js 22.6 ou mais novo (versão em `.nvmrc`; com nvm, rode `nvm use`). O seed usa `node --experimental-strip-types`, que não existe no Node 20.
- PostgreSQL.

## Variáveis de ambiente

Copie `.env.example` para `.env`:

| Variável | Uso |
|----------|-----|
| `DATABASE_URL` | Connection string PostgreSQL (Prisma) |
| `AUTH_SECRET` | Segredo JWT/sessão (string longa e aleatória) |
| `TCGDEX_API_BASE_URL` | Base da API TCGdex (default no exemplo) |
| `TCGDEX_LANGUAGE` | Idioma do sync (`en`, `pt-br`, …) |
| `TCGDEX_SYNC_CONCURRENCY` | Concorrência do sync |
| `NEXT_PUBLIC_APP_URL` | URL pública da app (local: `http://localhost:3000`) |

## Setup local

```bash
cp .env.example .env
npm install
npm run prisma:migrate
npm run prisma:seed
npm run sync:tcgdex
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000).

### Scripts úteis

| Script | Descrição |
|--------|-----------|
| `npm run dev` | Dev server |
| `npm run build` / `npm start` | Build e produção |
| `npm run lint` | ESLint |
| `npm test` | Vitest |
| `npm run prisma:migrate` | Migrations (dev) |
| `npm run prisma:migrate:deploy` | Migrations (deploy) |
| `npm run prisma:seed` | Seed (formatos/regras base) |
| `npm run sync:tcgdex` | Sincroniza sets/cartas da TCGdex |

### Migration `CardLogical` unique

A constraint `@@unique([canonicalName, category])` exige que não existam duplicatas `(canonicalName, category)` em `card_logicals`. Em DB limpo/seeded pelo sync atual, aplique normalmente. Se a migration falhar por duplicatas legadas, dedupe manualmente antes de reaplicar.

## Mapa de módulos

```
pokeapp
├── app/
│   ├── (app)/           # Shell autenticado (cards, decks, inventory, …)
│   ├── (auth)/          # Login / registro
│   ├── user/[username]/ # Perfil público
│   └── api/             # Route handlers por domínio
├── components/          # Shell, theme, providers
├── modules/
│   ├── cards/           # Busca e detalhe de cartas
│   ├── decks/           # Decks, import Limitless, UI sleeve
│   ├── inventory/       # Inventário físico
│   ├── training/        # Matches / arquétipos
│   ├── tournaments/     # Torneios
│   ├── statistics/      # Win rates e filtros
│   └── profile/         # Perfil público + settings
├── server/
│   ├── auth/            # Sessão, senha, username, exclusão
│   ├── database/        # Prisma client
│   ├── tcgdex/          # Provider + sync (só scripts)
│   ├── parsers/         # Limitless / TCG Live
│   ├── services/        # Allocation, inventory, matches, …
│   ├── rate-limit.ts    # Rate limit in-memory (MVP)
│   └── audit.ts         # AuditLog helper
├── prisma/              # Schema + migrations + seed
├── scripts/             # sync-tcgdex
└── tests/
```

## Hardening MVP

- **Rate limit** in-memory em `/api/auth/*` e `/api/public/*` (30/min auth, 60/min public por IP). Em multi-instance o contador não é compartilhado — trocar por Redis/store distribuído antes de escala.
- **AuditLog**: falha de login, sleevado de deck, solicitação/cancelamento de exclusão (e eventos auth já existentes).
- Imagens remotas TCGdex via `next/image` (`assets.tcgdex.net`).

## Convenções

- Runtime lê só PostgreSQL; TCGdex apenas no sync.
- `DeckCard` → `CardLogical`; Inventory → `CardPrinting`.
- Imports com alias `@/`.
