import type { NextConfig } from "next";

// Export statique : le dossier out/ se dépose tel quel sur l'hébergement OVH.
// trailingSlash génère e/index.html, servi directement par Apache à l'adresse /e/.
const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  // Pas de serveur Node en production : les images sont servies telles quelles.
  images: { unoptimized: true },
};

export default nextConfig;
