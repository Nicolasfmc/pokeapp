import { redirect } from "next/navigation";
import { AppShellLayout } from "@/components/shell/AppShellLayout";
import { getSession } from "@/server/auth";
import { isAdminUser } from "@/server/services/admin";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const isAdmin = await isAdminUser(session.id);

  return <AppShellLayout isAdmin={isAdmin}>{children}</AppShellLayout>;
}
