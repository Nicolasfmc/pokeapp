# Ownership de agentes — workstreams paralelos

Objetivo: evitar conflitos de merge quando vários agentes trabalham ao mesmo tempo.  
Cada workstream (WS) só edita as pastas/prefixos da coluna **Pode tocar**. Cruzar ownership exige acordo explícito.

Contratos compartilhados: [contracts.md](./contracts.md).  
Spec: [PokeApp-Product-Technical-Specification-v0.1.md](./PokeApp-Product-Technical-Specification-v0.1.md).

---

## Tabela de ownership

| WS | Escopo | Pode tocar | Não tocar (exemplos críticos) |
|----|--------|------------|--------------------------------|
| **Wave 0** | Contratos & deps base | `docs/`, `.env.example`, `README.md` (links/ORM), `package.json` / lock **somente** deps listadas na Wave 0 | Domínio, schema Prisma, auth, UI de feature, APIs |
| **A** | Database / Prisma | `prisma/`, `server/database/` | `server/auth`, `server/tcgdex`, `modules/*`, `app/api/**` de features |
| **B** | Auth | `server/auth/`, `app/api/auth/**`, `app/(auth)/**` | `prisma/schema*`, inventory/decks, `server/tcgdex` |
| **C** | Sync TCGdex | `server/tcgdex/`, `scripts/sync-tcgdex*` | Runtime de features, `app/api/cards/**` (WS-F), schema (exceto se A coordenar enums de card) |
| **D** | Shell UI / design system | `components/`, `app/layout.tsx`, `app/globals.css`, `app/(app)/**` (layouts/nav) | Lógica de domínio em `modules/*`, APIs de feature |
| **E** | Parsers | `server/parsers/`, `tests/parsers/**`, `tests/fixtures/**` | Persistência, APIs HTTP de domínio |
| **F** | Cards (leitura/busca) | `modules/cards/`, `app/api/cards/**` | Sync TCGdex (WS-C), inventory/decks |
| **G** | Decks (sem sleeve) | `modules/decks/`, `app/api/decks/**` | Endpoints/serviços `*sleeve*` / allocation (WS-I) |
| **H** | Inventory | `modules/inventory/`, `app/api/inventory/**` | Sleeve/allocation (WS-I), decks |
| **I** | Sleeve & allocation | Serviços + endpoints `*sleeve*` / allocation (ex.: sob `server/services/` e rotas acordadas) | CRUD genérico de decks (WS-G) e inventory (WS-H), salvo contratos compartilhados |
| **J** | Training / matches | `modules/training/`, `app/api/training/**`, `app/api/matches/**` | Torneios (WS-K), estatísticas agregadas (WS-L) |
| **K** | Torneios | `modules/tournaments/`, `app/api/tournaments/**` | Matches avulsos de training (WS-J) |
| **L** | Estatísticas | `modules/statistics/`, `app/api/statistics/**` | Escrita de matches/torneios |
| **M** | Perfil público | `modules/profile/`, `app/user/[username]/**`, `app/api/public/**` | Auth privado (WS-B), mutações de inventory autenticado (WS-H) |

---

## Regras gerais

1. **Um dono por path.** Se dois WS precisam do mesmo arquivo, o dono cria o contrato (tipo/export) e o outro consome.
2. **`package.json`:** Wave 0 instalou Prisma, Mantine v7 e Vitest. Novas deps → pedir ao orquestrador ou documentar no PR; evitar `npm install` solto que altere majors dessas libs.
3. **`prisma/schema.prisma`:** só WS-A. Outros WS propõem campos via issue/contrato; A aplica.
4. **`app/layout.tsx` / `globals.css`:** só WS-D. Providers (Mantine, auth) entram via composição acordada com B/D.
5. **APIs:** prefixo `app/api/<domínio>/**` = WS do domínio. Não criar handlers fora do prefixo.
6. **Imports cruzados:** permitido ler tipos/contratos de outro módulo; alteração de código “do outro” é proibida.
7. **`.env*`:** Wave 0 mantém `.env.example`. Secrets reais nunca no git. WS-A/B/C atualizam o *exemplo* se introduzirem variáveis novas.

---

## Wave 1 — paralelismo seguro

Pronto para disparar em paralelo **após** Wave 0:

| WS | Motivo da ausência de conflito |
|----|--------------------------------|
| **A** | Só `prisma/` + `server/database/` |
| **D** | Só shell UI / layout / components |
| **E** | Só parsers + testes isolados |

Não disparar ainda no mesmo lote: B (auth em layout), C (pode precisar de schema A), F–M (dependem de A e/ou contratos de dados).

---

## Pontos de atenção (conflitos residuais)

| Risco | Mitigação |
|-------|-----------|
| WS-G × WS-I em `modules/decks` ou `app/api/decks` | G não implementa sleeve; I usa paths `*sleeve*` / services dedicados |
| WS-D × WS-B em `app/layout.tsx` | D dono do arquivo; B exporta provider/helpers consumidos por D |
| WS-A × todos (schema) | Enums e nomes de campos seguem [contracts.md](./contracts.md) |
| WS-C × WS-F | C escreve via sync; F só lê PostgreSQL |
| `server/services/` | Preferir subpastas por domínio; sleeve/allocation = WS-I |
| Lockfile | Um agente por vez em `package-lock.json` se precisar de deps novas |
