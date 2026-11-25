"use client";

import Link from "next/link";
import { Button } from "@mantine/core";
import { useI18n } from "@/lib/i18n/I18nProvider";

export function HomeCtas() {
  const { t } = useI18n();
  return (
    <div className="sb-rise-delay mt-8 flex flex-wrap gap-3">
      <Button component={Link} href="/decks" size="md" color="ember">
        {t("home.openDecks")}
      </Button>
      <Button
        component={Link}
        href="/inventory"
        size="md"
        variant="light"
        color="ink"
      >
        {t("home.seeInventory")}
      </Button>
    </div>
  );
}
