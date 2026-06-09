import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Allow the optimizer to serve our own trusted static SVG token marks
    // (e.g. /assets/tokens/eth.svg). Sandboxed via CSP + non-inline disposition.
    dangerouslyAllowSVG: true,
    contentDispositionType: "attachment",
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
};

export default nextConfig;
