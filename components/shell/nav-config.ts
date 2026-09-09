export type NavItem = {
  label: string;
  href: string;
};

export const primaryNav: NavItem[] = [
  { label: "Dashboard", href: "/" },
  { label: "Cards", href: "/cards" },
  { label: "Decks", href: "/decks" },
  { label: "Inventory", href: "/inventory" },
  { label: "Training", href: "/training" },
  { label: "Tournaments", href: "/tournaments" },
  { label: "Statistics", href: "/statistics" },
  { label: "Profile", href: "/profile" },
];

export function isNavActive(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}
