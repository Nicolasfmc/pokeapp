import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Button, Table, Text, TextInput, Title } from "@mantine/core";
import { getTranslator } from "@/lib/i18n/server";
import {
  getAdminOverview,
  listAdminUsers,
  parseAdminUsersQuery,
  requireAdmin,
} from "@/server/services/admin";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslator();
  return { title: t("admin.title"), robots: { index: false, follow: false } };
}

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const STATUS_COLOR: Record<string, string> = {
  ACTIVE: "green",
  DELETION_PENDING: "orange",
  PERMANENTLY_DELETED: "gray",
};

function pageHref(q: string, page: number) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/admin?${query}` : "/admin";
}

/** Admin panel: platform totals and registered users (read-only). */
export default async function AdminPage({ searchParams }: PageProps) {
  await requireAdmin();
  const { t, tEnum, formatDate, formatNumber } = await getTranslator();
  const query = parseAdminUsersQuery(await searchParams);
  const [overview, users] = await Promise.all([getAdminOverview(), listAdminUsers(query)]);
  const totalPages = Math.max(1, Math.ceil(users.total / users.pageSize));

  const tiles: Array<{ label: string; value: number; hint?: string }> = [
    {
      label: t("admin.users"),
      value: overview.users.total,
      hint: t("admin.usersHint", {
        active: overview.users.active,
        pending: overview.users.deletionPending,
      }),
    },
    {
      label: t("admin.newUsers"),
      value: overview.users.newLast7Days,
      hint: t("admin.newUsersHint", { d30: overview.users.newLast30Days }),
    },
    { label: t("admin.publicProfiles"), value: overview.users.publicProfiles },
    {
      label: t("admin.decks"),
      value: overview.decks.total,
      hint: t("admin.decksHint", { count: overview.decks.sleeved }),
    },
    { label: t("admin.inventoryCopies"), value: overview.inventoryCopies },
    { label: t("admin.matches"), value: overview.matches },
    { label: t("admin.tournaments"), value: overview.tournaments },
  ];

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-2 py-6 sm:px-4">
      <div>
        <Title order={2}>{t("admin.title")}</Title>
        <Text c="dimmed" size="sm">
          {t("admin.subtitle")}
        </Text>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {tiles.map((tile) => (
          <div
            key={tile.label}
            className="rounded-xl border border-[var(--sb-line)] bg-[var(--sb-panel)]/85 p-4"
          >
            <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
              {tile.label}
            </Text>
            <Text className="font-[family-name:var(--font-space-grotesk)] text-3xl font-semibold">
              {formatNumber(tile.value)}
            </Text>
            {tile.hint ? (
              <Text size="xs" c="dimmed">
                {tile.hint}
              </Text>
            ) : null}
          </div>
        ))}
      </div>

      <section className="flex flex-col gap-3 rounded-xl border border-[var(--sb-line)] bg-[var(--sb-panel)]/85 p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <Text fw={700}>{t("admin.registeredUsers")}</Text>
            <Text size="xs" c="dimmed">
              {t("admin.resultCount", { count: users.total })}
            </Text>
          </div>
          <form method="get" action="/admin" className="flex gap-2">
            <TextInput
              name="q"
              defaultValue={query.q}
              placeholder={t("admin.searchPlaceholder")}
              aria-label={t("admin.searchPlaceholder")}
              className="w-56 sm:w-72"
            />
            <Button type="submit" variant="light">
              {t("common.search")}
            </Button>
          </form>
        </div>

        {users.rows.length === 0 ? (
          <Text size="sm" c="dimmed">
            {t("admin.noUsers")}
          </Text>
        ) : (
          <div className="overflow-x-auto">
            <Table striped highlightOnHover verticalSpacing={6} fz="sm" miw={820}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>{t("admin.colUser")}</Table.Th>
                  <Table.Th>{t("admin.colEmail")}</Table.Th>
                  <Table.Th>{t("admin.colStatus")}</Table.Th>
                  <Table.Th>{t("admin.colJoined")}</Table.Th>
                  <Table.Th className="text-right">{t("admin.colDecks")}</Table.Th>
                  <Table.Th className="text-right">{t("admin.colCopies")}</Table.Th>
                  <Table.Th className="text-right">{t("admin.colMatches")}</Table.Th>
                  <Table.Th className="text-right">{t("admin.colTournaments")}</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {users.rows.map((row) => (
                  <Table.Tr key={row.id}>
                    <Table.Td>
                      <div className="flex flex-wrap items-center gap-1">
                        {row.isPublic && row.accountStatus === "ACTIVE" ? (
                          <Link href={`/user/${row.username}`} className="font-semibold">
                            @{row.username}
                          </Link>
                        ) : (
                          <span className="font-semibold">@{row.username}</span>
                        )}
                        {row.isAdmin ? (
                          <Badge size="xs" color="ember" variant="light">
                            {t("admin.badgeAdmin")}
                          </Badge>
                        ) : null}
                        {row.isPublic ? (
                          <Badge size="xs" color="gray" variant="light">
                            {t("admin.badgePublic")}
                          </Badge>
                        ) : null}
                      </div>
                      {row.displayName && row.displayName !== row.username ? (
                        <Text size="xs" c="dimmed">
                          {row.displayName}
                        </Text>
                      ) : null}
                    </Table.Td>
                    <Table.Td>{row.email}</Table.Td>
                    <Table.Td>
                      <Badge
                        size="sm"
                        variant="light"
                        color={STATUS_COLOR[row.accountStatus] ?? "gray"}
                      >
                        {tEnum("accountStatus", row.accountStatus)}
                      </Badge>
                    </Table.Td>
                    <Table.Td>{formatDate(row.createdAt)}</Table.Td>
                    <Table.Td className="text-right">{row.decks}</Table.Td>
                    <Table.Td className="text-right">{row.inventoryCopies}</Table.Td>
                    <Table.Td className="text-right">{row.matches}</Table.Td>
                    <Table.Td className="text-right">{row.tournaments}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </div>
        )}

        {totalPages > 1 ? (
          <div className="flex items-center justify-end gap-3 text-sm">
            {users.page > 1 ? (
              <Link href={pageHref(query.q, users.page - 1)}>{t("common.previous")}</Link>
            ) : null}
            <span>{t("common.pageOf", { page: users.page, total: totalPages })}</span>
            {users.page < totalPages ? (
              <Link href={pageHref(query.q, users.page + 1)}>{t("common.next")}</Link>
            ) : null}
          </div>
        ) : null}
      </section>
    </div>
  );
}
