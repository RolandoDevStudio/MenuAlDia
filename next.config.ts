import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/demo-fonda",
        destination: "/demo-restaurante",
        permanent: true,
      },
      {
        source: "/demo-estetica",
        destination: "/demo-servicios",
        permanent: true,
      },
      {
        source: "/demo-productos",
        destination: "/demo-tienda",
        permanent: true,
      },
    ];
  },
  images: {
    dangerouslyAllowSVG: true,
    contentDispositionType: "attachment",
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
