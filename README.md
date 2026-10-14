# A.T.F.O. (AI Tools For Owners): homepage redesign

The new homepage for https://aitoolsforowners.com. It's a plain static site with no build step. Everything the public sees lives in `public/`; the scan API lives in `functions/`.

## What's here

| Path | What it is |
| --- | --- |
| `public/index.html` | The homepage |
| `public/assets/site.css` | All styles (light and dark themes, responsive) |
| `public/assets/main.js` | Interactions: stack finder, budget filters, scroll story, task index, assistant deck |
| `public/assets/data.js` | Tool stack data (`STACKS`, `ASST`, `AORD`), carried over from the original site's `app.js` |
| `public/404.html` | Not-found page |
| `public/favicon.svg`, `public/og.png` | Icon and social share image |
| `public/_headers` | Cloudflare Pages response headers |
| `design/og-source.html` | Source used to render `og.png` (not linked from the site) |
| `scripts/build.py` | Regenerates the crawler-readable parts of the site from `assets/data.js` (see below) |
| `functions/api/scan.js` | The free business scan (Cloudflare Pages Function at `POST /api/scan`) |
| `scripts/dev.mjs` | Local preview with the scan working: `node scripts/dev.mjs` → http://localhost:8788 |
| `newsletter/` | Email newsletter template, builder and the guide for Grok (`newsletter/GROK_NEWSLETTER_GUIDE.md`) |
| `public/llms.txt`, `public/llms-full.txt` | Plain-text guides for AI assistants (generated) |
| `public/sitemap.xml`, `public/robots.txt` | Search engine files (generated) |

## Deploy to Cloudflare Pages (free)

1. Cloudflare dashboard → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.
2. Pick this repository and the `main` branch.
3. Build settings: **Framework preset: None**, **Build command: empty**, **Build output directory: `public`**.
4. Save and deploy. You get a free `*.pages.dev` URL.
5. To use the real domain, open the project → **Custom domains** → add `aitoolsforowners.com`.

Or from a terminal: `npx wrangler pages deploy public --project-name aitoolsforowners` (run from the repo root so `functions/` deploys too).

## Before switching the live domain

The current live site has pages and an API that are **not** in this repo. The homepage links to them, so carry them over or they will 404:

- Task pages: `/best-ai-tools-for-<slug>/` (16 of them, one per stack in `assets/data.js`)
- `/compare-ai-assistants-for-small-business/`, `/how-to-use-grok-bots-in-everyday-life/`
- `/grok-bot-templates-for-real-estate/`, `/grok-bot-templates-for-bookkeeping/`
- `/tools/`, `/data/tools.json`, `/newsletter/`, `/sponsor/`, `/about/`, `/privacy/`, `/llms.txt`
- The newsletter endpoint `POST /api/subscribe` (the form sends JSON `{email, company}` and expects `{ok, message}` back)

The simplest path is to copy everything in `public/` into the existing Cloudflare Pages project (replacing the old `index.html`, `style.css`, `app.js`, `llms.txt`, `robots.txt` and `sitemap.xml`) and add `functions/api/scan.js` next to the existing `functions/api/subscribe` code.

## Editing content

- **Tool stacks, prices, setup steps:** edit `public/assets/data.js`, then run `python3 scripts/build.py`. **Run it after any change to the CSS or JS too:** it stamps a version on each asset link, so visitors never get a mix of old and new files (assets are cached for a year). The finder, the to-do pad, the week story and the ticker read the data at runtime. The task index, assistant cards, FAQ, structured data, `llms.txt`, `llms-full.txt` and `sitemap.xml` are written into the files by the script, so crawlers see them without running JavaScript.
- **Task categories** (Sales / Money / Operations / Marketing filters): `window.CATS` in `public/assets/data.js`.
- **Date prices were last checked:** `window.CHECKED` in `public/assets/data.js`. Update it whenever you re-check prices.
- **Finder phrasing:** the `SYN` (extra words per stack), `AMBIG` ("which one?") and `MISSING` (tasks we don't cover yet) lists in `public/assets/main.js`.
- **Hero to-do list items:** the `PAD` array in `public/assets/main.js`.
- **Week story blocks:** the `WEEK` array in `public/assets/main.js`.

## Business scan

Visitors paste a website or Google Maps link. `functions/api/scan.js` reads that public page, checks for online booking, chat, an email signup, a CRM or contact form, reviews, an online store, payments, a blog and social links, guesses the type of business, and returns up to four stacks that fill the gaps. Cloudflare Pages runs anything in `functions/` automatically; no build step is needed.

Optional settings (Cloudflare Pages → your project → Settings):

- **`GOOGLE_PLACES_API_KEY`** (environment variable, encrypted). Without it, a Google Maps link only gives the business name, and the visitor is asked for their website too. With it, Maps links also return the category, star rating, review count and website, and the website is scanned automatically. Create the key in Google Cloud with the **Places API (New)** enabled and restrict it to that API. Google bills per lookup beyond its free monthly allowance.
- **`SCANS`** (KV namespace binding). Saves every scan for 180 days, so you can see which businesses scanned and follow up.
- **Rate limit.** Add a Cloudflare rate-limiting rule for `/api/scan` (for example 10 requests per minute per IP) so nobody can use the scanner to hammer other sites.

The scanner only fetches public `http`/`https` pages on ports 80 and 443, checks every redirect hop the same way, refuses IP addresses and internal hostnames, stops after 9 seconds, reads at most 1.5 MB, and limits each visitor to 10 scans a minute.

**Cloudflare plan:** the free plan allows 10 ms of processing per request. The analysis was rewritten to fit (2 to 10 ms on real homepages in testing), but large sites can go over and fail. The Workers Paid plan ($5/month) removes that risk; it's the safer choice once the scan gets real traffic.

**Accuracy:** it reads the homepage only, so tools that load later (some booking and chat widgets) can be missed. Reports say "we didn't spot" rather than "you don't have", and show that caveat.

## Newsletter

`newsletter/template.html` is an email-safe design (tables and inline styles, so it works in Gmail, Outlook and Apple Mail). `newsletter/render.py` fills it from a short JSON file per issue and also writes a plain-text version. `newsletter/GROK_NEWSLETTER_GUIDE.md` is the full weekly brief for Grok, and `newsletter/issues/example-issue-1-lead-follow-up.json` is a finished example (built output in `newsletter/out/`).

## Prices on the homepage

The homepage leads with setup time, not cost. Prices only appear in the stack finder after a visitor taps **See monthly costs**, which also unlocks the budget filter. Task pages and `llms-full.txt` still carry the full starting prices.

## Being found by search engines and AI assistants

- All key content (16 task picks, assistant cards, FAQ) is plain HTML, so ChatGPT, Claude, Gemini, Grok, Perplexity and search crawlers can read it without running JavaScript.
- Structured data (JSON-LD): Organization, WebSite, WebApplication, ItemList (the 16 task pages) and FAQPage.
- `llms.txt` tells AI assistants what the site is and which page to cite for each task. `llms-full.txt` has every stack in plain text.
- `robots.txt` allows all crawlers and names the major AI crawlers explicitly.
- **Check Cloudflare doesn't block AI crawlers.** In the Cloudflare dashboard for aitoolsforowners.com, look under **Security → Bots** (and **AI Crawl Control**, if your plan shows it). Make sure "Block AI bots" is off and Cloudflare isn't adding its own disallow rules to `robots.txt`. Newer Cloudflare zones can block AI crawlers by default.
- After going live, submit `https://aitoolsforowners.com/sitemap.xml` in Google Search Console and Bing Webmaster Tools. Bing's index feeds ChatGPT search and Copilot.
- Other pages carry over the same pattern: one clear "Best AI tools for …" heading, a short plain-English answer near the top, and FAQ structured data.

## Design notes

- Fonts are self-hosted in `public/assets/fonts/` (no requests to Google, latin characters only, about 145 KB in total): Bricolage Grotesque (display), Geist (body), Geist Mono (labels), Caveat (handwritten notes). All are SIL Open Font License.
- Colors are CSS variables at the top of `public/assets/site.css` (electric violet `--pen`, lime highlighter `--hl`, hot pink `--pink`); dark mode follows the visitor's system setting.
- All motion respects `prefers-reduced-motion`.
