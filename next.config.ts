import type { NextConfig } from "next";

// Export statique : le dossier out/ se dépose tel quel sur l'hébergement OVH.
const nextConfig: NextConfig = {
  output: "export",
};

export default nextConfig;
