import { AdminHeader } from "@/app/_components/AdminHeader";
import { requireAdmin } from "@/lib/auth";
import { USERS_PAGE_SIZE, getOverview, listUsers } from "@/lib/queries";
import { parseUsersQuery } from "@/lib/security";

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const STATUS: Record<string, { label: string; tone: string }> = {
  ACTIVE: { label: "Ativa", tone: "ok" },
  DELETION_PENDING: { label: "Exclusão pendente", tone: "warn" },
  PERMANENTLY_DELETED: { label: "Excluída", tone: "" },
};

const dateFmt = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short" });
const dateTimeFmt = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  dateStyle: "short",
  timeStyle: "short",
});
const num = new Intl.NumberFormat("pt-BR");

function pageHref(q: string, page: number) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (page > 1) params.set("page", String(page));
  const s = params.toString();
  return s ? `/?${s}` : "/";
}

/** Read-only overview of the platform and its users. */
export default async function DashboardPage({ searchParams }: PageProps) {
  const admin = await requireAdmin();
  const { q, page } = parseUsersQuery(await searchParams);
  const [overview, users] = await Promise.all([getOverview(), listUsers(q, page)]);
  const totalPages = Math.max(1, Math.ceil(users.total / USERS_PAGE_SIZE));

  const tiles = [
    { label: "Usuários", value: overview.users, hint: `${num.format(overview.active)} ativos · ${num.format(overview.deletionPending)} com exclusão pendente` },
    { label: "Novos (7 dias)", value: overview.newLast7Days, hint: `${num.format(overview.newLast30Days)} nos últimos 30 dias` },
    { label: "Sessões ativas", value: overview.activeSessions, hint: "logins ainda válidos" },
    { label: "Perfis públicos", value: overview.publicProfiles },
    { label: "Decks", value: overview.decks, hint: `${num.format(overview.sleevedDecks)} sleevados` },
    { label: "Cópias no inventário", value: overview.inventoryCopies },
    { label: "Partidas", value: overview.matches },
    { label: "Torneios", value: overview.tournaments },
  ];

  return (
    <main className="wrap">
      <AdminHeader admin={admin} current="/" />

      <section className="tiles">
        {tiles.map((tile) => (
          <div key={tile.label} className="panel">
            <div className="tile-label">{tile.label}</div>
            <div className="tile-value">{num.format(tile.value)}</div>
            {tile.hint ? <div className="muted">{tile.hint}</div> : null}
          </div>
        ))}
      </section>

      <section className="panel">
        <div className="row space">
          <div>
            <strong>Usuários cadastrados</strong>
            <div className="muted">{num.format(users.total)} usuário(s)</div>
          </div>
          <form method="get" action="/" className="row">
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Buscar por username ou e-mail"
              aria-label="Buscar por username ou e-mail"
              maxLength={100}
            />
            <button type="submit">Buscar</button>
          </form>
        </div>

        {users.rows.length === 0 ? (
          <p className="muted">Nenhum usuário encontrado.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Usuário</th>
                  <th>E-mail</th>
                  <th>Status</th>
                  <th>Cadastro</th>
                  <th>Último acesso</th>
                  <th className="num">Decks</th>
                  <th className="num">Cartas</th>
                  <th className="num">Partidas</th>
                  <th className="num">Torneios</th>
                </tr>
              </thead>
              <tbody>
                {users.rows.map((row) => {
                  const status = STATUS[row.accountStatus] ?? { label: row.accountStatus, tone: "" };
                  return (
                    <tr key={row.id}>
                      <td>
                        <strong>@{row.username}</strong>
                        {row.isAdmin ? <span className="badge accent">admin</span> : null}
                        {row.isPublic ? <span className="badge">público</span> : null}
                        {row.displayName && row.displayName !== row.username ? (
                          <div className="muted">{row.displayName}</div>
                        ) : null}
                      </td>
                      <td>{row.email}</td>
                      <td>
                        <span className={`badge ${status.tone}`} style={{ marginLeft: 0 }}>
                          {status.label}
                        </span>
                      </td>
                      <td>{dateFmt.format(row.createdAt)}</td>
                      <td>{row.lastSeenAt ? dateTimeFmt.format(row.lastSeenAt) : "—"}</td>
                      <td className="num">{num.format(row.decks)}</td>
                      <td className="num">{num.format(row.inventoryCopies)}</td>
                      <td className="num">{num.format(row.matches)}</td>
                      <td className="num">{num.format(row.tournaments)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 ? (
          <nav className="pager" aria-label="Paginação">
            {page > 1 ? <a href={pageHref(q, page - 1)}>Anterior</a> : null}
            <span>
              Página {page} de {totalPages}
            </span>
            {page < totalPages ? <a href={pageHref(q, page + 1)}>Próxima</a> : null}
          </nav>
        ) : null}
      </section>
    </main>
  );
}
