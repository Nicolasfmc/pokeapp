"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
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

export function RegisterForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          username,
          password,
          displayName: displayName || undefined,
        }),
      });

      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(data.error ?? "Falha no cadastro.");
        setPending(false);
        return;
      }

      startTransition(() => {
        router.replace("/");
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
        <Title order={2}>Criar conta</Title>
        <Text c="dimmed" size="sm" mt={4}>
          Username único vira sua URL pública.
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

          <TextInput
            label="Username"
            name="username"
            description="3–20 caracteres: letra inicial, depois letras, números ou _"
            autoComplete="username"
            required
            value={username}
            onChange={(event) => setUsername(event.currentTarget.value)}
          />

          <TextInput
            label="Nome de exibição"
            name="displayName"
            description="Opcional; independente do username"
            value={displayName}
            onChange={(event) => setDisplayName(event.currentTarget.value)}
          />

          <PasswordInput
            label="Senha"
            name="password"
            description="Mínimo de 8 caracteres"
            autoComplete="new-password"
            required
            value={password}
            onChange={(event) => setPassword(event.currentTarget.value)}
          />

          <Button type="submit" loading={pending} fullWidth>
            Criar conta
          </Button>
        </Stack>
      </form>

      <Text size="sm" ta="center">
        Já tem conta?{" "}
        <Text
          component={Link}
          href="/login"
          span
          c="ember"
          fw={600}
          className="no-underline"
        >
          Entrar
        </Text>
      </Text>
    </Stack>
  );
}
