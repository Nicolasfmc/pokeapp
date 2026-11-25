"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NavLink, Stack } from "@mantine/core";
import { isNavActive, primaryNav } from "@/components/shell/nav-config";
import { useI18n } from "@/lib/i18n/I18nProvider";

type AppNavProps = {
  onNavigate?: () => void;
};

export function AppNav({ onNavigate }: AppNavProps) {
  const pathname = usePathname();
  const { t } = useI18n();

  return (
    <Stack gap={4} p="sm">
      {primaryNav.map((item) => (
        <NavLink
          key={item.href}
          component={Link}
          href={item.href}
          label={t(item.labelKey)}
          active={isNavActive(pathname, item.href)}
          onClick={onNavigate}
          className="rounded-md"
        />
      ))}
    </Stack>
  );
}
