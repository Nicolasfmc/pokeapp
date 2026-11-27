import type { AdminUser } from "@/lib/auth";

const LINKS = [
  { href: "/", label: "Usuários" },
  { href: "/sets", label: "Coleções" },
] as const;

/** Top bar shared by every admin page. */
export function AdminHeader({ admin, current }: { admin: AdminUser; current: (typeof LINKS)[number]["href"] }) {
  return (
    <div className="topbar">
      <div>
        <div className="brand">SleeveBuild Admin</div>
        <div className="muted">Conectado como @{admin.username}</div>
      </div>
      <nav className="row" aria-label="Seções">
        {LINKS.map((link) => (
          <a key={link.href} href={link.href} className={link.href === current ? "nav current" : "nav"}>
            {link.label}
          </a>
        ))}
        <form method="post" action="/api/logout">
          <button type="submit" className="ghost">
            Sair
          </button>
        </form>
      </nav>
    </div>
  );
}
