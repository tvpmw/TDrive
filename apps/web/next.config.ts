import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@tdrive/shared"],
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
  async rewrites() {
    const api = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:3003";
    return [
      { source: "/api/:path*", destination: `${api}/api/:path*` },
      { source: "/auth/:path*", destination: `${api}/api/auth/:path*` },
      { source: "/dashboard/:path*", destination: `${api}/api/dashboard/:path*` },
      { source: "/enterprise/:path*", destination: `${api}/api/enterprise/:path*` },
      { source: "/public/share/:path*", destination: `${api}/api/public/share/:path*` },
      { source: "/webdav/:path*", destination: `${api}/webdav/:path*` },
      { source: "/server/:path*", destination: `${api}/api/:path*` },
      { source: "/storage/status", destination: `${api}/api/storage/status` },
      { source: "/storage/settings", destination: `${api}/api/storage/settings` },
      { source: "/storage/analytics", destination: `${api}/api/storage/analytics` },
      { source: "/files", destination: `${api}/api/files` },
      { source: "/files/:path*", destination: `${api}/api/files/:path*` },
      { source: "/folders", destination: `${api}/api/folders` },
      { source: "/folders/:path*", destination: `${api}/api/folders/:path*` },
      { source: "/trash/:path*", destination: `${api}/api/trash/:path*` },
      { source: "/bot/:path*", destination: `${api}/api/bot/:path*` },
      { source: "/share", destination: `${api}/api/share` },
      { source: "/share/:path*", destination: `${api}/api/share/:path*` },
      { source: "/automation", destination: `${api}/api/automation` },
      { source: "/automation/:path*", destination: `${api}/api/automation/:path*` },
      { source: "/notifications", destination: `${api}/api/notifications` },
      { source: "/notifications/:path*", destination: `${api}/api/notifications/:path*` },
      { source: "/webauthn/:path*", destination: `${api}/api/webauthn/:path*` },
      { source: "/uploads/:path*", destination: `${api}/api/uploads/:path*` },
    ];
  },
};

export default nextConfig;
