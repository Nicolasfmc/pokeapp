"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState, startTransition } from "react";
import {
  Alert,
  Button,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useI18n } from "@/lib/i18n/I18nProvider";

export function LoginForm() {
  const router = useRouter();
  const { t, te } = useI18n();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") || "/";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(te(data.error) ?? t("auth.signInFailed"));
        setPending(false);
        return;
      }

      startTransition(() => {
        router.replace(nextPath.startsWith("/") ? nextPath : "/");
        router.refresh();
      });
    } catch {
      setError(t("common.connectionError"));
      setPending(false);
    }
  }

  return (
    <Stack gap="lg">
      <div>
        <Title order={2}>{t("auth.signIn")}</Title>
        <Text c="dimmed" size="sm" mt={4}>
          {t("auth.signInSubtitle")}
        </Text>
      </div>

      <form onSubmit={onSubmit}>
        <Stack gap="md">
          {error ? (
            <Alert color="red" title={t("common.error")} variant="light">
              {error}
            </Alert>
          ) : null}

          <TextInput
            label={t("auth.email")}
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.currentTarget.value)}
          />

          <PasswordInput
            label={t("auth.password")}
            name="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.currentTarget.value)}
          />

          <Button type="submit" loading={pending} fullWidth>
            {t("auth.signIn")}
          </Button>
        </Stack>
      </form>

      <Text size="sm" ta="center">
        {t("auth.noAccount")}{" "}
        <Text
          component={Link}
          href="/register"
          span
          c="ember"
          fw={600}
          className="no-underline"
        >
          {t("auth.createAccount")}
        </Text>
      </Text>
    </Stack>
  );
}
