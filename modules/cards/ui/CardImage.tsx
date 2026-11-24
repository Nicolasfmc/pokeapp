import Image from "next/image";
import type { ReactNode } from "react";
import { cardImageSize } from "../representative";

type CardImageProps = {
  src: string | null | undefined;
  alt: string;
  /** "low" (≈245px) para grades/miniaturas; "high" para detalhe. */
  size?: "low" | "high";
  sizes?: string;
  className?: string;
  /** Conteúdo sobreposto (quantidade, botões…). */
  children?: ReactNode;
  dimmed?: boolean;
};

/** Imagem de carta na proporção física (63×88 mm) com fallback de texto. */
export function CardImage({
  src,
  alt,
  size = "low",
  sizes = "(max-width: 640px) 30vw, 160px",
  className = "",
  children,
  dimmed = false,
}: CardImageProps) {
  const url = cardImageSize(src, size);
  return (
    <div
      className={`relative aspect-[63/88] overflow-hidden rounded-[4.5%/3.2%] bg-[color-mix(in_srgb,var(--sb-mist)_55%,transparent)] ring-1 ring-[var(--sb-line)] ${className}`}
    >
      {url ? (
        <Image
          src={url}
          alt={alt}
          fill
          sizes={sizes}
          className={`object-cover ${dimmed ? "opacity-40 grayscale" : ""}`}
        />
      ) : (
        <div className="flex h-full items-center justify-center p-2 text-center text-xs leading-tight text-[color-mix(in_srgb,var(--sb-ink)_65%,transparent)]">
          {alt}
        </div>
      )}
      {children}
    </div>
  );
}

/**
 * Recorte só da ilustração (sem nome, HP, ataques). Funciona para o layout
 * padrão das cartas (caixa de arte ≈ 8–92% da largura, 11–52% da altura).
 */
export function CardArt({
  src,
  alt,
  className = "",
}: {
  src: string | null | undefined;
  alt: string;
  className?: string;
}) {
  const url = cardImageSize(src, "high");
  return (
    <div
      role="img"
      aria-label={alt}
      className={`aspect-[3/2] overflow-hidden bg-[color-mix(in_srgb,var(--sb-mist)_70%,transparent)] bg-no-repeat ${className}`}
      style={
        url
          ? {
              backgroundImage: `url("${url}")`,
              backgroundSize: "119% auto",
              backgroundPosition: "50% 19%",
            }
          : undefined
      }
    />
  );
}

/** Miniatura pequena para linhas de lista (largura fixa). */
export function CardThumb({
  src,
  alt,
  width = 40,
}: {
  src: string | null | undefined;
  alt: string;
  width?: number;
}) {
  return (
    <div style={{ width }} className="shrink-0">
      <CardImage src={src} alt={alt} sizes={`${width * 2}px`} />
    </div>
  );
}
