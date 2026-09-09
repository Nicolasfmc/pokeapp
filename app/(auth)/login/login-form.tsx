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

export function LoginForm() {
  const router = useRouter();
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
        setError(data.error ?? "Falha no login.");
        setPending(false);
        return;
      }

      startTransition(() => {
        router.replace(nextPath.startsWith("/") ? nextPath : "/");
        router.refresh();
      });
    } catch {
      setError("Não foi possível conectar. Tente novamente.");
      setPending(false);
    }
  }

  return (
    <Stack gap="lg">
      <div>
        <Title order={2}>Entrar</Title>
        <Text c="dimmed" size="sm" mt={4}>
          Acesse decks, inventário e treino.
        </Text>
      </div>

      <form onSubmit={onSubmit}>
        <Stack gap="md">
          {error ? (
            <Alert color="red" title="Erro" variant="light">
              {error}
            </Alert>
          ) : null}

          <TextInput
            label="E-mail"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.currentTarget.value)}
          />

          <PasswordInput
            label="Senha"
            name="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.currentTarget.value)}
          />

          <Button type="submit" loading={pending} fullWidth>
            Entrar
          </Button>
        </Stack>
      </form>

      <Text size="sm" ta="center">
        Não tem conta?{" "}
        <Text
          component={Link}
          href="/register"
          span
          c="ember"
          fw={600}
          className="no-underline"
        >
          Criar conta
        </Text>
      </Text>
    </Stack>
  );
}
