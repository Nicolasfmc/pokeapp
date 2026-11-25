import type { MessageKey } from "@/lib/i18n/messages";

export type NavItem = {
  labelKey: MessageKey;
  href: string;
};

export const primaryNav: NavItem[] = [
  { labelKey: "nav.dashboard", href: "/" },
  { labelKey: "nav.cards", href: "/cards" },
  { labelKey: "nav.decks", href: "/decks" },
  { labelKey: "nav.inventory", href: "/inventory" },
  { labelKey: "nav.training", href: "/training" },
  { labelKey: "nav.tournaments", href: "/tournaments" },
  { labelKey: "nav.statistics", href: "/statistics" },
  { labelKey: "nav.profile", href: "/profile" },
];

/** Shown only to admin accounts (the page itself also checks). */
export const adminNav: NavItem = { labelKey: "nav.admin", href: "/admin" };

export function isNavActive(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}
