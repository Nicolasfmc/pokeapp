import type { NextConfig } from "next";
import packageJson from "./package.json";
import { STATIC_SECURITY_HEADERS } from "./server/security";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: STATIC_SECURITY_HEADERS }];
  },
  // Versão exibida no rodapé (fonte única: package.json).
  env: {
    NEXT_PUBLIC_APP_VERSION: packageJson.version,
  },
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
