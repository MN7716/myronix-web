# MYRONIX INDUSTRIES website

React + TypeScript + Vite + Tailwind CSS. Single-page site: Home, About, Services (9, each opens a detail drawer), Portfolio (filterable, all items labelled MYRONIX CONCEPT), How we work, Collaboration, project enquiry form, Contact.

## Run locally
```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-checks, then builds to dist/
npm run preview
```

## What works where (be honest about this)
| Layer | What it does | Needs a backend? |
|---|---|---|
| FRONTEND (this repo) | Navigation, drawers, filters, validation, animations, all UI states | No |
| BACKEND/API + DATABASE (optional) | Real enquiry storage | Yes: Supabase (steps below) |

**Enquiry form.** Without Supabase configured, the form validates, then tells the visitor plainly that nothing has been sent and offers a pre-filled email to `myronix.industries@gmail.com`. It never shows a success message unless the database returned a 2xx.

### Enable real submission (Supabase)
1. In the Supabase SQL editor run `supabase/schema.sql` (creates a new `project_enquiries` table; existing tables untouched). Row Level Security lets the public site **insert only**.
2. Copy `.env.example` to `.env` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (the **anon/publishable** key only. Never use a service-role key in a `VITE_` variable).
3. Rebuild/redeploy. Read enquiries in Supabase Studio (Table editor).
File uploads are intentionally not offered: a secure upload needs server-side validation and private storage.

## Deploy
- **Netlify / Cloudflare Pages:** build `npm run build`, publish `dist`. `public/_headers` applies the security headers (CSP, HSTS, nosniff, referrer, permissions, frame-ancestors).
- **GitHub Pages:** push to `main`; enable Pages > Source: GitHub Actions. For a project site set repository variable `VITE_BASE` to `/your-repo/`. GitHub Pages cannot set HTTP headers, so only the `<meta>` CSP in `index.html` applies (no frame-ancestors/HSTS there).
- **Before launch:** set `VITE_SITE_URL` (your real https URL, no trailing slash) in the build environment. The build then writes canonical, Open Graph image, JSON-LD URL, `robots.txt` and `sitemap.xml`. Until it is set those URL tags are omitted; no placeholder domain exists anywhere.

## Logo
`public/logo-light*.png` and `public/logo-dark*.png` are your uploaded logos, cropped to remove empty margin only (no redraw, recolour or retouch); `-640` files are downscaled copies for faster loading. Favicon files are a crop of the symbol from the same artwork. Light logo sits on `#ffffff`, dark logo on `#202c65`; both match their original backgrounds.

## Adding portfolio work / services
Edit `src/data/portfolio.ts` (use `type: "client"` only for real client work) and `src/data/services.ts`.

## Dev vs production CSP
The Content-Security-Policy `<meta>` is injected only by `npm run build` (see `vite.config.ts`). In `npm run dev` Vite injects CSS and a React-refresh script inline, so a strict CSP there blocks all styling.

## Security notes
No `eval`, no `dangerouslySetInnerHTML`; all user input is rendered by React as text. Server-side validation is enforced by database constraints. No public site can be guaranteed unhackable; this keeps the attack surface small.
