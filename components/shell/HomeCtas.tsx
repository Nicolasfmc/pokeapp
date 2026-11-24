"use client";

import Link from "next/link";
import { Button } from "@mantine/core";

export function HomeCtas() {
  return (
    <div className="sb-rise-delay mt-8 flex flex-wrap gap-3">
      <Button component={Link} href="/decks" size="md" color="ember">
        Abrir decks
      </Button>
      <Button
        component={Link}
        href="/inventory"
        size="md"
        variant="light"
        color="ink"
      >
        Ver inventário
      </Button>
    </div>
  );
}
