import Link from "next/link";
import type { Metadata } from "next";
import { Badge, Text, Title } from "@mantine/core";
import { requireUser } from "@/server/auth";
import { listDecks } from "@/modules/decks";
import { listMatches } from "@/server/services/match";
import { getStatisticsSummary } from "@/server/services/statistics";
import { listTournaments } from "@/server/services/tournament";
import { listInventoryItems } from "@/server/services/inventory";
import { getInventoryCheckSummaries } from "@/server/services/inventory-check";
import { CardArt } from "@/modules/cards/ui/CardImage";

export const metadata: Metadata = {
  title: "Dashboard",
};

const RESULT_COLOR: Record<string, string> = {
  WIN: "green",
  LOSS: "red",
  DRAW: "gray",
  UNKNOWN: "gray",
};

function formatWinRate(value: number | null) {
  return value === null ? "—" : `${(value * 100).toFixed(1)}%`;
}

function formatDate(iso: string | null) {
  if (!iso) return "sem data";
  return new Date(iso).toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

function Panel({
  title,
  href,
  linkLabel,
  children,
}: {
  title: string;
  href?: string;
  linkLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-[var(--poke-line)] bg-[var(--poke-panel)]/85 p-4">
      <div className="flex items-center justify-between gap-2">
        <Text fw={700}>{title}</Text>
        {href ? (
          <Link href={href} className="text-sm text-[var(--poke-accent)] no-underline">
            {linkLabel ?? "Ver tudo"}
          </Link>
        ) : null}
      </div>
      {children}
    </section>
  );
}

/** §100 — Dashboard. */
export default async function DashboardPage() {
  const user = await requireUser();

  const [decks, deckChecks, matches, stats, tournaments, inventory] = await Promise.all([
    listDecks(user.id),
    getInventoryCheckSummaries(user.id),
    listMatches(user.id),
    getStatisticsSummary(user.id),
    listTournaments(user.id),
    listInventoryItems(user.id),
  ]);

  const activeDecks = decks.filter((d) => !d.tags.includes("ARCHIVED"));
  const sleevedDecks = activeDecks.filter((d) => d.physicalStatus === "SLEEVED");
  const incomplete = deckChecks.filter(
    (check) =>
      check.physicalStatus !== "SLEEVED" &&
      check.summary.totalRequired > 0 &&
      !check.summary.fullyOwned,
  );

  // Disponível para negociação é por carta lógica (§32–33): dedupe por logicalCardId.
  const byLogical = new Map<string, number>();
  let ownedCopies = 0;
  for (const item of inventory) {
    ownedCopies += item.quantity;
    byLogical.set(item.cardPrinting.logicalCardId, item.logicalAvailability.availableForTrade);
  }
  const availableForTrade = [...byLogical.values()].reduce((a, b) => a + b, 0);

  const lastTournament = tournaments[0] ?? null;
  const recentMatches = matches.slice(0, 5);
  const isEmpty = decks.length === 0 && inventory.length === 0 && matches.length === 0;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-2 py-6 sm:px-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Title order={2}>Olá, {user.username}</Title>
          <Text c="dimmed" size="sm">
            Visão geral dos seus decks, inventário e treino.
          </Text>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/decks/import"
            className="rounded-md bg-[var(--poke-accent-soft)] px-3 py-1.5 text-sm font-semibold text-[var(--poke-accent)] no-underline"
          >
            Importar deck
          </Link>
          <Link
            href="/training"
            className="rounded-md bg-[var(--poke-accent)] px-3 py-1.5 text-sm font-semibold text-white no-underline"
          >
            Registrar partida
          </Link>
        </div>
      </div>

      {isEmpty ? (
        <section className="rounded-xl border border-dashed border-[var(--poke-line)] p-6">
          <Text fw={600}>Comece por aqui</Text>
          <ol className="mt-2 list-decimal pl-5 text-sm leading-7">
            <li>
              Cadastre suas cartas em <Link href="/inventory">Inventory</Link>.
            </li>
            <li>
              Crie ou <Link href="/decks/import">importe um deck</Link> do Limitless.
            </li>
            <li>Confira o Inventory Check e marque o deck como SLEEVED.</li>
            <li>
              Importe o log de uma partida do TCG Live em <Link href="/training">Training</Link>.
            </li>
          </ol>
        </section>
      ) : null}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: "Decks ativos", value: activeDecks.length, hint: `${sleevedDecks.length} SLEEVED` },
          { label: "Cartas no inventário", value: ownedCopies, hint: `${byLogical.size} cartas distintas` },
          { label: "Disponíveis p/ troca", value: availableForTrade, hint: "acima da reserva de 4" },
          {
            label: "Win rate",
            value: formatWinRate(stats.overall.winRate),
            hint: `${stats.overall.wins}W / ${stats.overall.losses}L / ${stats.overall.draws}D`,
          },
        ].map((tile) => (
          <div
            key={tile.label}
            className="rounded-xl border border-[var(--poke-line)] bg-[var(--poke-panel)]/85 p-4"
          >
            <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
              {tile.label}
            </Text>
            <Text className="font-[family-name:var(--font-space-grotesk)] text-3xl font-semibold">
              {tile.value}
            </Text>
            <Text size="xs" c="dimmed">
              {tile.hint}
            </Text>
          </div>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Panel title="Alertas de decks incompletos" href="/decks" linkLabel="Decks">
          {incomplete.length === 0 ? (
            <Text size="sm" c="dimmed">
              Nenhum deck com cartas faltando no inventário.
            </Text>
          ) : (
            <ul className="flex list-none flex-col gap-2 p-0">
              {incomplete.slice(0, 6).map((check) => (
                <li key={check.deckId} className="flex items-center justify-between gap-2">
                  <Link href={`/decks/${check.deckId}`} className="truncate text-sm">
                    {check.deckName}
                  </Link>
                  <span className="flex shrink-0 gap-1">
                    {check.summary.missing > 0 ? (
                      <Badge color="red" variant="light" size="sm">
                        {check.summary.missing} MISSING
                      </Badge>
                    ) : null}
                    {check.summary.partial > 0 ? (
                      <Badge color="yellow" variant="light" size="sm">
                        {check.summary.partial} PARTIAL
                      </Badge>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Decks recentes" href="/decks">
          {activeDecks.length === 0 ? (
            <Text size="sm" c="dimmed">
              Nenhum deck ainda.
            </Text>
          ) : (
            <ul className="flex list-none flex-col gap-2 p-0">
              {activeDecks.slice(0, 5).map((deck) => (
                <li key={deck.id} className="flex items-center justify-between gap-2">
                  <Link
                    href={`/decks/${deck.id}`}
                    className="flex min-w-0 items-center gap-2 text-sm"
                  >
                    <CardArt
                      src={deck.coverImageUrl}
                      alt=""
                      className="w-14 shrink-0 rounded"
                    />
                    <span className="truncate">{deck.name}</span>
                  </Link>
                  <span className="flex shrink-0 items-center gap-2">
                    <Text size="xs" c="dimmed">
                      {deck.cardCount} cartas · {deck.format.code}
                    </Text>
                    <Badge
                      size="sm"
                      variant="light"
                      color={deck.physicalStatus === "SLEEVED" ? "green" : "gray"}
                    >
                      {deck.physicalStatus}
                    </Badge>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Partidas recentes" href="/training">
          {recentMatches.length === 0 ? (
            <Text size="sm" c="dimmed">
              Nenhuma partida registrada.
            </Text>
          ) : (
            <ul className="flex list-none flex-col gap-2 p-0">
              {recentMatches.map((match) => (
                <li key={match.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate">
                    {match.deck.name} vs {match.opponentArchetype?.name ?? "?"}
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <Text size="xs" c="dimmed">
                      {match.turnOrder ?? ""} · {formatDate(match.playedAt ?? match.createdAt)}
                    </Text>
                    <Badge size="sm" variant="light" color={RESULT_COLOR[match.result]}>
                      {match.result}
                    </Badge>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Último torneio" href="/tournaments" linkLabel="Torneios">
          {lastTournament ? (
            <Link href={`/tournaments/${lastTournament.id}`} className="flex flex-col gap-1 no-underline">
              <Text fw={600}>{lastTournament.name}</Text>
              <Text size="sm" c="dimmed">
                {formatDate(lastTournament.date)}
                {lastTournament.location ? ` · ${lastTournament.location}` : ""}
                {lastTournament.format ? ` · ${lastTournament.format.name}` : ""}
              </Text>
              <Text size="sm">
                {lastTournament.placement
                  ? `Colocação ${lastTournament.placement}${lastTournament.participantCount ? ` / ${lastTournament.participantCount}` : ""}`
                  : "Colocação não registrada"}
                {` · ${lastTournament.matchCount} partida(s)`}
              </Text>
            </Link>
          ) : (
            <Text size="sm" c="dimmed">
              Nenhum torneio registrado.
            </Text>
          )}
        </Panel>
      </div>
    </div>
  );
}
