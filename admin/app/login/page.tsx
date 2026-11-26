import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAdmin } from "@/lib/auth";

export const metadata: Metadata = { title: "Entrar" };

const ERRORS: Record<string, string> = {
  invalid: "Credenciais inválidas ou conta sem acesso de administrador.",
  rate: "Muitas tentativas. Aguarde alguns minutos e tente de novo.",
};

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/** Plain HTML form: works without client-side JavaScript. */
export default async function LoginPage({ searchParams }: PageProps) {
  if (await getAdmin()) redirect("/");
  const { error } = await searchParams;
  const message = typeof error === "string" ? ERRORS[error] : undefined;

  return (
    <main className="login panel">
      <div>
        <div className="brand">SleeveBuild Admin</div>
        <div className="muted">Acesso restrito a administradores.</div>
      </div>
      {message ? (
        <p className="error" role="alert">
          {message}
        </p>
      ) : null}
      <form method="post" action="/api/login" className="login" style={{ margin: 0 }}>
        <label>
          E-mail
          <input type="email" name="email" autoComplete="username" required maxLength={254} />
        </label>
        <label>
          Senha
          <input type="password" name="password" autoComplete="current-password" required maxLength={128} />
        </label>
        <button type="submit">Entrar</button>
      </form>
      <div className="muted">A sessão expira em 2 horas.</div>
    </main>
  );
}
