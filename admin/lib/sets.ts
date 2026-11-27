import "server-only";
import { query, withWriteTransaction } from "./db";
import { escapeLike } from "./security";

export const SETS_PAGE_SIZE = 50;

export type SetRow = {
  id: string;
  tcgdexId: string;
  name: string;
  code: string | null;
  series: string | null;
  releaseDate: Date | null;
  isActive: boolean;
  standardOverride: boolean | null;
  standardOverrideAt: Date | null;
  overrideBy: string | null;
  cards: number;
  standardNow: number;
  standardAuto: number;
};

/** Card sets from the TCGdex catalog, newest first, with their Standard legality. */
export async function listSets(search: string, page: number) {
  const pattern = search ? `%${escapeLike(search)}%` : null;
  const offset = (page - 1) * SETS_PAGE_SIZE;
  const where = `$1::text IS NULL OR s.name ILIKE $1 OR s.code ILIKE $1 OR s."tcgdexId" ILIKE $1 OR s.series ILIKE $1`;

  const [{ total }] = await query<{ total: string }>(
    `SELECT count(*) AS total FROM card_sets s WHERE ${where}`,
    [pattern],
  );

  const rows = await query<SetRow & { cards: string; standardNow: string; standardAuto: string }>(
    `SELECT s.id, s."tcgdexId", s.name, s.code, s.series, s."releaseDate", s."isActive",
            s."standardOverride", s."standardOverrideAt", u.username AS "overrideBy",
            count(p.id) AS cards,
            count(p.id) FILTER (WHERE p."legalStandard") AS "standardNow",
            count(p.id) FILTER (WHERE p."legalStandardAuto") AS "standardAuto"
       FROM card_sets s
       LEFT JOIN card_printings p ON p."setId" = s.id AND p."isActive"
       LEFT JOIN users u ON u.id = s."standardOverrideById"
      WHERE ${where}
      GROUP BY s.id, u.username
      ORDER BY s."releaseDate" DESC NULLS LAST, s.name, s.id
      LIMIT $2 OFFSET $3`,
    [pattern, SETS_PAGE_SIZE, offset],
  );

  return {
    total: Number(total),
    rows: rows.map((row) => ({
      ...row,
      cards: Number(row.cards),
      standardNow: Number(row.standardNow),
      standardAuto: Number(row.standardAuto),
    })),
  };
}

/**
 * Forces a set in or out of Standard (or back to automatic with `null`) and
 * applies it to its printings right away, so the deck builder search and the
 * format validation see it immediately. The sync keeps honoring it.
 */
export async function setStandardOverride(
  setId: string,
  override: boolean | null,
  adminId: string,
): Promise<boolean> {
  return withWriteTransaction(async (run) => {
    const updated = await run<{ id: string }>(
      `UPDATE card_sets
          SET "standardOverride" = $2,
              "standardOverrideById" = CASE WHEN $2::boolean IS NULL THEN NULL ELSE $3 END,
              "standardOverrideAt" = CASE WHEN $2::boolean IS NULL THEN NULL ELSE now() AT TIME ZONE 'UTC' END
        WHERE id = $1
        RETURNING id`,
      [setId, override, adminId],
    );
    if (updated.length === 0) return false;
    await run(
      `UPDATE card_printings SET "legalStandard" = coalesce($2::boolean, "legalStandardAuto") WHERE "setId" = $1`,
      [setId, override],
    );
    return true;
  });
}
