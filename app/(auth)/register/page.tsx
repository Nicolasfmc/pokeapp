import type { Metadata } from "next";
import { RegisterForm } from "./register-form";
import { getTranslator } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslator();
  return { title: t("auth.createAccount") };
}

export default function RegisterPage() {
  return <RegisterForm />;
}
