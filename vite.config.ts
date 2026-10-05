import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

const CSP =
  "default-src 'self'; script-src 'self'; style-src 'self'; style-src-attr 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self' https://*.supabase.co; object-src 'none'; base-uri 'self'; form-action 'self'";

/**
 * - Injects the Content-Security-Policy <meta> ONLY in production builds. In `npm run dev`, Vite injects CSS
 *   and a React-refresh script inline, which a strict CSP blocks (that makes the page render as raw HTML).
 * - Builds canonical / Open Graph / JSON-LD / robots.txt / sitemap.xml from VITE_SITE_URL.
 *   If VITE_SITE_URL is not set, those URL-bearing tags are simply omitted (no fake domain is ever written).
 */
function siteMeta(siteUrl: string): Plugin {
  const base = siteUrl.replace(/\/$/, "");
  return {
    name: "myronix-site-meta",
    transformIndexHtml: {
      order: "pre",
      handler(html, ctx) {
        const tags: string[] = [];
        if (ctx.server === undefined) tags.push(`<meta http-equiv="Content-Security-Policy" content="${CSP}" />`);
        const org: Record<string, unknown> = {
          "@context": "https://schema.org", "@type": "Organization", name: "MYRONIX INDUSTRIES",
          slogan: "Technology • Digital • Creative", email: "myronix.industries@gmail.com",
          sameAs: ["https://www.instagram.com/myronix.industries", "https://x.com/MYRONIXINDUSTRI"],
        };
        if (base) {
          tags.push(`<link rel="canonical" href="${base}/" />`, `<meta property="og:url" content="${base}/" />`,
            `<meta property="og:image" content="${base}/og-image.png" />`, `<meta name="twitter:image" content="${base}/og-image.png" />`);
          org.url = `${base}/`; org.logo = `${base}/logo-light.png`;
        }
        tags.push(`<script type="application/ld+json">${JSON.stringify(org)}</script>`);
        return html.replace("<!--SITE_META-->", tags.join("\n    "));
      },
    },
    generateBundle() {
      this.emitFile({ type: "asset", fileName: "robots.txt", source: `User-agent: *\nAllow: /\n${base ? `\nSitemap: ${base}/sitemap.xml\n` : ""}` });
      if (base) this.emitFile({ type: "asset", fileName: "sitemap.xml",
        source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${base}/</loc></url>\n</urlset>\n` });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  return {
    base: env.VITE_BASE || "/",
    plugins: [react(), siteMeta(env.VITE_SITE_URL || "")],
    build: { target: "es2020", sourcemap: false },
  };
});
