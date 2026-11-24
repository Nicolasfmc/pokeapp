import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // As imagens da TCGdex já vêm em webp do CDN deles (§123). Otimizar aqui só
    // consumiria a cota de transformações de imagem do plano Hobby da Vercel.
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "assets.tcgdex.net",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
