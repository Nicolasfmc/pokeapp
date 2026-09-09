"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { startTransition } from "react";
import { Pagination } from "@mantine/core";

export function CardsPagination({
  page,
  totalPages,
}: {
  page: number;
  totalPages: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (totalPages <= 1) {
    return null;
  }

  return (
    <Pagination
      value={page}
      total={totalPages}
      color="ember"
      onChange={(nextPage) => {
        const params = new URLSearchParams(searchParams.toString());
        if (nextPage <= 1) {
          params.delete("page");
        } else {
          params.set("page", String(nextPage));
        }
        const next = params.toString();
        startTransition(() => {
          router.push(next ? `${pathname}?${next}` : pathname);
        });
      }}
    />
  );
}
