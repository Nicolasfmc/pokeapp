import { AdminHeader } from "@/app/_components/AdminHeader";
import { requireAdmin } from "@/lib/auth";
import { parseListQuery } from "@/lib/security";
import { SETS_PAGE_SIZE, listSets, type SetRow } from "@/lib/sets";

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const dateFmt = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", dateStyle: "short" });
const dateTimeFmt = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  dateStyle: "short",
  timeStyle: "short",
});
const num = new Intl.NumberFormat("pt-BR");

const CHOICES = [
  { value: "standard", label: "Standard", override: true },
  { value: "not-standard", label: "Fora", override: false },
  { value: "auto", label: "Automático", override: null },
] as const;

const NOTICES: Record<string, { text: string; tone: string }> = {
  saved: { text: "Legalidade da coleção atualizada. O deckbuilder já usa o novo valor.", tone: "ok" },
  invalid: { text: "Pedido inválido. Nada foi alterado.", tone: "error" },
  missing: { text: "Coleção não encontrada.", tone: "error" },
  failed: { text: "Não foi possível salvar. Tente de novo.", tone: "error" },
};

function pageHref(q: string, page: number) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (page > 1) params.set("page", String(page));
  const s = params.toString();
  return s ? `/sets?${s}` : "/sets";
}

function StandardStatus({ row }: { row: SetRow }) {
  if (row.standardOverride === true) {
    return <span className="badge ok" style={{ marginLeft: 0 }}>Forçada: Standard</span>;
  }
  if (row.standardOverride === false) {
    return <span className="badge warn" style={{ marginLeft: 0 }}>Forçada: fora</span>;
  }
  const label =
    row.cards === 0 ? "Sem cartas" : row.standardAuto === 0 ? "Fora" : row.standardAuto === row.cards ? "Standard" : "Parcial";
  return (
    <span className="badge" style={{ marginLeft: 0 }}>
      Automático: {label}
    </span>
  );
}

/**
 * Card sets with their Standard legality. TCGdex can take weeks to classify a
 * new set; an admin can force it in (or out) of Standard here.
 */
export default async function SetsPage({ searchParams }: PageProps) {
  const admin = await requireAdmin();
  const raw = await searchParams;
  const { q, page } = parseListQuery(raw);
  const noticeKey = typeof raw.notice === "string" ? raw.notice : "";
  const notice = NOTICES[noticeKey];
  const sets = await listSets(q, page);
  const totalPages = Math.max(1, Math.ceil(sets.total / SETS_PAGE_SIZE));
  const back = pageHref(q, page);

  return (
    <main className="wrap">
      <AdminHeader admin={admin} current="/sets" />

      <section className="panel" style={{ marginTop: 20 }}>
        <div className="row space">
          <div>
            <strong>Coleções</strong>
            <div className="muted">
              {num.format(sets.total)} coleção(ões). &quot;Automático&quot; segue a TCGdex; coleções lançadas depois
              da última que ela classificou contam como Standard. Forçar vale também para os próximos syncs.
            </div>
          </div>
          <form method="get" action="/sets" className="row">
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Nome, código ou série"
              aria-label="Buscar coleção"
              maxLength={100}
            />
            <button type="submit">Buscar</button>
          </form>
        </div>

        {notice ? (
          <p className={notice.tone === "error" ? "error" : "notice"} role="status">
            {notice.text}
          </p>
        ) : null}

        {sets.rows.length === 0 ? (
          <p className="muted">Nenhuma coleção encontrada.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Coleção</th>
                  <th>Lançamento</th>
                  <th className="num">Cartas</th>
                  <th className="num">Standard agora</th>
                  <th>Situação</th>
                  <th>Definir Standard</th>
                </tr>
              </thead>
              <tbody>
                {sets.rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <strong>{row.name}</strong>
                      {row.code ? <span className="badge">{row.code}</span> : null}
                      {!row.isActive ? <span className="badge warn">inativa</span> : null}
                      <div className="muted">
                        {row.series ?? "—"} · {row.tcgdexId}
                      </div>
                    </td>
                    <td>{row.releaseDate ? dateFmt.format(row.releaseDate) : "—"}</td>
                    <td className="num">{num.format(row.cards)}</td>
                    <td className="num">
                      {num.format(row.standardNow)}
                      {row.standardOverride !== null && row.standardAuto !== row.standardNow ? (
                        <div className="muted">automático: {num.format(row.standardAuto)}</div>
                      ) : null}
                    </td>
                    <td>
                      <StandardStatus row={row} />
                      {row.standardOverride !== null && row.standardOverrideAt ? (
                        <div className="muted">
                          por @{row.overrideBy ?? "?"} em {dateTimeFmt.format(row.standardOverrideAt)}
                        </div>
                      ) : null}
                    </td>
                    <td>
                      <form method="post" action={`/api/sets/${row.id}/standard`} className="segmented">
                        <input type="hidden" name="back" value={back} />
                        {CHOICES.map((choice) => {
                          const active = row.standardOverride === choice.override;
                          return (
                            <button
                              key={choice.value}
                              type="submit"
                              name="value"
                              value={choice.value}
                              className={active ? "seg active" : "seg"}
                              aria-pressed={active}
                              disabled={active}
                            >
                              {choice.label}
                            </button>
                          );
                        })}
                      </form>
                    </td>
                  </tr>
                ))}
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
