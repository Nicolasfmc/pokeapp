# SleeveBuild Admin

Painel de administração **separado** da plataforma: outro projeto na Vercel,
outro domínio, outro segredo de sessão. Lê o mesmo banco (Neon), **somente leitura**.

## O que tem
- Totais da plataforma (usuários, novos em 7/30 dias, sessões ativas, decks, inventário, partidas, torneios)
- Lista de usuários com busca por username/e-mail e paginação
- **Coleções** (`/sets`): legalidade Standard de cada coleção da TCGdex, com opção de
  forçar uma coleção como Standard, fora do Standard ou voltar ao automático. Vale na
  hora para a busca do deckbuilder e a validação de formato, e os próximos syncs respeitam.

## Segurança
- **Login próprio**: e-mail + senha da conta SleeveBuild, e a conta precisa ter
  `users."isAdmin" = true` e estar ativa. Mensagem de erro sempre genérica.
- **Sessão**: JWT HS256 assinado com `ADMIN_JWT_SECRET` (diferente do app principal),
  audiência `sleevebuild-admin`, expira em **2 horas**. Cookie `sb_admin` httpOnly,
  Secure e SameSite=Strict.
- **Permissão conferida no banco a cada página**: tirar o `isAdmin` derruba o acesso na hora.
- **Banco somente leitura**: toda conexão abre com `default_transaction_read_only = on`;
  só o limitador de tentativas e o ajuste de legalidade de coleção usam uma transação de
  escrita explícita. Em produção use o usuário dedicado abaixo, que só pode escrever
  nessas colunas.
- **SQL injection**: todas as queries são parametrizadas (`$1`, `$2`…); a busca escapa
  `%` e `_`. Nenhuma query lê `passwordHash` fora do login.
- **Força bruta**: limite por IP e por conta no PostgreSQL (mesma tabela e chave do app
  principal: erros nos dois apps somam).
- **CSRF**: POST de outra origem recebe 403; cookie SameSite=Strict.
- **Cabeçalhos**: CSP com nonce, `frame-ancestors 'none'`, HSTS, `X-Robots-Tag: noindex`,
  `Cache-Control: no-store`, `robots.txt` bloqueando tudo.
- **Opcional**: `ADMIN_ALLOWED_IPS` restringe o painel a IPs fixos (os demais recebem 404).

## Deploy na Vercel
1. **Antes**: aplicar no Neon a migration `auth_sessions` do app principal (cria
   `users."isAdmin"`, `user_sessions` e `auth_rate_limits`).
2. **Usuário só leitura no Neon**: no console do Neon, *Roles → New role*
   `sleevebuild_admin`. Depois, no SQL Editor:
   ```sql
   GRANT USAGE ON SCHEMA public TO sleevebuild_admin;
   GRANT SELECT ON users, user_profiles, decks, inventory_items, matches, tournaments, user_sessions
     TO sleevebuild_admin;
   GRANT SELECT, INSERT, UPDATE ON auth_rate_limits TO sleevebuild_admin;
   -- Coleções: leitura + só as colunas do ajuste manual de Standard
   -- (precisa da migration set_standard_override do app principal).
   GRANT SELECT ON card_sets, card_printings TO sleevebuild_admin;
   GRANT UPDATE ("standardOverride", "standardOverrideById", "standardOverrideAt")
     ON card_sets TO sleevebuild_admin;
   GRANT UPDATE ("legalStandard") ON card_printings TO sleevebuild_admin;
   ```
3. **Marcar os administradores**:
   ```sql
   UPDATE users SET "isAdmin" = true WHERE username = 'SEU_USERNAME';
   ```
4. **Novo projeto na Vercel** importando este mesmo repositório, com
   **Root Directory = `admin`** (framework Next.js).
5. **Variáveis de ambiente** (Production):
   - `ADMIN_DATABASE_URL`: connection string do usuário `sleevebuild_admin` (pooled)
   - `ADMIN_JWT_SECRET`: gerar com
     `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`
   - `ADMIN_ALLOWED_IPS` (opcional)
6. Recomendado: em *Settings → Deployment Protection*, ativar **Vercel Authentication**
   para as previews deste projeto.

## Desenvolvimento
```bash
cd admin
npm install
cp .env.example .env.local   # preencher
npm run dev                  # http://localhost:3200
npm test && npm run lint && npm run typecheck
```
