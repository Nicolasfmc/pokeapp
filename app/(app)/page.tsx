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
import { getTranslator } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslator();
  return { title: t("nav.dashboard") };
}

const RESULT_COLOR: Record<string, string> = {
  WIN: "green",
  LOSS: "red",
  DRAW: "gray",
  UNKNOWN: "gray",
};

function formatWinRate(value: number | null) {
  return value === null ? "—" : `${(value * 100).toFixed(1)}%`;
}


function Panel({
  title,
  href,
  linkLabel,
  children,
}: {
  title: string;
  href?: string;
  linkLabel: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-[var(--sb-line)] bg-[var(--sb-panel)]/85 p-4">
      <div className="flex items-center justify-between gap-2">
        <Text fw={700}>{title}</Text>
        {href ? (
          <Link href={href} className="text-sm text-[var(--sb-accent)] no-underline">
            {linkLabel}
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
  const { t, tEnum, formatDate: fmtDate } = await getTranslator();
  const formatDate = (iso: string | null) => (iso ? fmtDate(iso) : t("home.noDate"));

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
          <Title order={2}>{t("home.hello", { name: user.username })}</Title>
          <Text c="dimmed" size="sm">
            {t("home.subtitle")}
          </Text>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/decks/import"
            className="rounded-md bg-[var(--sb-accent-soft)] px-3 py-1.5 text-sm font-semibold text-[var(--sb-accent)] no-underline"
          >
            {t("home.importDeck")}
          </Link>
          <Link
            href="/training"
            className="rounded-md bg-[var(--sb-accent)] px-3 py-1.5 text-sm font-semibold text-white no-underline"
          >
            {t("home.logMatch")}
          </Link>
        </div>
      </div>

      {isEmpty ? (
        <section className="rounded-xl border border-dashed border-[var(--sb-line)] p-6">
          <Text fw={600}>{t("home.startHere")}</Text>
          <ol className="mt-2 list-decimal pl-5 text-sm leading-7">
            <li>
              {t("home.step1a")} <Link href="/inventory">{t("nav.inventory")}</Link>.
            </li>
            <li>
              {t("home.step2a")} <Link href="/decks/import">{t("home.step2b")}</Link> {t("home.step2c")}
            </li>
            <li>{t("home.step3")}</li>
            <li>
              {t("home.step4a")} <Link href="/training">{t("nav.training")}</Link>.
            </li>
          </ol>
        </section>
      ) : null}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: t("home.activeDecks"), value: activeDecks.length, hint: t("home.sleevedCount", { count: sleevedDecks.length }) },
          { label: t("home.inventoryCards"), value: ownedCopies, hint: t("home.distinctCards", { count: byLogical.size }) },
          { label: t("home.forTrade"), value: availableForTrade, hint: t("home.forTradeHint") },
          {
            label: t("home.winRate"),
            value: formatWinRate(stats.overall.winRate),
            hint: t("home.wld", { w: stats.overall.wins, l: stats.overall.losses, d: stats.overall.draws }),
          },
        ].map((tile) => (
          <div
            key={tile.label}
            className="rounded-xl border border-[var(--sb-line)] bg-[var(--sb-panel)]/85 p-4"
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
        <Panel title={t("home.incompleteAlerts")} href="/decks" linkLabel={t("nav.decks")}>
          {incomplete.length === 0 ? (
            <Text size="sm" c="dimmed">
              {t("home.noIncomplete")}
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
                        {t("home.missingCount", { count: check.summary.missing })}
                      </Badge>
                    ) : null}
                    {check.summary.partial > 0 ? (
                      <Badge color="yellow" variant="light" size="sm">
                        {t("home.partialCount", { count: check.summary.partial })}
                      </Badge>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title={t("home.recentDecks")} href="/decks" linkLabel={t("home.seeAll")}>
          {activeDecks.length === 0 ? (
            <Text size="sm" c="dimmed">
              {t("home.noDecks")}
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
                      {t("common.cards", { count: deck.cardCount })} · {tEnum("format", deck.format.code)}
                    </Text>
                    <Badge
                      size="sm"
                      variant="light"
                      color={deck.physicalStatus === "SLEEVED" ? "green" : "gray"}
                    >
                      {tEnum("physicalStatus", deck.physicalStatus)}
                    </Badge>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title={t("home.recentMatches")} href="/training" linkLabel={t("home.seeAll")}>
          {recentMatches.length === 0 ? (
            <Text size="sm" c="dimmed">
              {t("home.noMatches")}
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
                      {match.turnOrder ? tEnum("turnOrder", match.turnOrder) : ""} · {formatDate(match.playedAt ?? match.createdAt)}
                    </Text>
                    <Badge size="sm" variant="light" color={RESULT_COLOR[match.result]}>
                      {tEnum("matchResult", match.result)}
                    </Badge>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title={t("home.lastTournament")} href="/tournaments" linkLabel={t("nav.tournaments")}>
          {lastTournament ? (
            <Link href={`/tournaments/${lastTournament.id}`} className="flex flex-col gap-1 no-underline">
              <Text fw={600}>{lastTournament.name}</Text>
              <Text size="sm" c="dimmed">
                {formatDate(lastTournament.date)}
                {lastTournament.location ? ` · ${lastTournament.location}` : ""}
                {lastTournament.format ? ` · ${tEnum("format", lastTournament.format.name)}` : ""}
              </Text>
              <Text size="sm">
                {lastTournament.placement
                  ? t("home.placement", { place: `${lastTournament.placement}${lastTournament.participantCount ? ` / ${lastTournament.participantCount}` : ""}` })
                  : t("home.noPlacement")}
                {` · ${t("home.matchCount", { count: lastTournament.matchCount })}`}
              </Text>
            </Link>
          ) : (
            <Text size="sm" c="dimmed">
              {t("home.noTournaments")}
            </Text>
          )}
        </Panel>
      </div>
    </div>
  );
}
