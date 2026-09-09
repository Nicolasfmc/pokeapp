import { redirect } from "next/navigation";
import { AppShellLayout } from "@/components/shell/AppShellLayout";
import { getSession } from "@/server/auth";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  return <AppShellLayout>{children}</AppShellLayout>;
}
