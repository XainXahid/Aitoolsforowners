# A.T.F.O. (AI Tools For Owners): homepage redesign

The new homepage for https://aitoolsforowners.com. It's a plain static site with no build step, so it deploys to Cloudflare Pages as is.

## What's here

| Path | What it is |
| --- | --- |
| `index.html` | The homepage |
| `assets/site.css` | All styles (light and dark themes, responsive) |
| `assets/main.js` | Interactions: stack finder, budget filters, scroll story, task index, assistant deck |
| `assets/data.js` | Tool stack data (`STACKS`, `ASST`, `AORD`), carried over from the original site's `app.js` |
| `404.html` | Not-found page |
| `favicon.svg`, `og.png` | Icon and social share image |
| `_headers` | Cloudflare Pages response headers |
| `design/og-source.html` | Source used to render `og.png` (not linked from the site) |
| `scripts/build.py` | Regenerates the crawler-readable parts of the site from `assets/data.js` (see below) |
| `llms.txt`, `llms-full.txt` | Plain-text guides for AI assistants (generated) |
| `sitemap.xml`, `robots.txt` | Search engine files (generated) |

## Deploy to Cloudflare Pages (free)

1. Cloudflare dashboard → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.
2. Pick this repository and the `main` branch.
3. Build settings: **Framework preset: None**, **Build command: empty**, **Build output directory: `/`**.
4. Save and deploy. You get a free `*.pages.dev` URL.
5. To use the real domain, open the project → **Custom domains** → add `aitoolsforowners.com`.

Or from a terminal: `npx wrangler pages deploy . --project-name aitoolsforowners`.

## Before switching the live domain

The current live site has pages and an API that are **not** in this repo. The homepage links to them, so carry them over or they will 404:

- Task pages: `/best-ai-tools-for-<slug>/` (16 of them, one per stack in `assets/data.js`)
- `/compare-ai-assistants-for-small-business/`, `/how-to-use-grok-bots-in-everyday-life/`
- `/grok-bot-templates-for-real-estate/`, `/grok-bot-templates-for-bookkeeping/`
- `/tools/`, `/data/tools.json`, `/newsletter/`, `/sponsor/`, `/about/`, `/privacy/`, `/llms.txt`
- The newsletter endpoint `POST /api/subscribe` (the form sends JSON `{email, company}` and expects `{ok, message}` back)

The simplest path is to drop `index.html`, `assets/`, `404.html`, `favicon.svg`, `og.png` and `_headers` into the existing Cloudflare Pages project, replacing only the old homepage files (`index.html`, `style.css`, `app.js`).

## Editing content

- **Tool stacks, prices, setup steps:** edit `assets/data.js`, then run `python3 scripts/build.py`. The finder, the to-do pad, the week story and the ticker read the data at runtime. The task index, assistant cards, FAQ, structured data, `llms.txt`, `llms-full.txt` and `sitemap.xml` are written into the files by the script, so crawlers see them without running JavaScript.
- **Task categories** (Sales / Money / Operations / Marketing filters): the `CAT` map in `assets/main.js` and in `scripts/build.py` (keep both the same).
- **Hero to-do list items:** the `PAD` array in `assets/main.js`.
- **Week story blocks:** the `WEEK` array in `assets/main.js`.

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

- Fonts (Google Fonts): Bricolage Grotesque (display), Geist (body), Geist Mono (prices and labels), Caveat (handwritten notes).
- Colors are CSS variables at the top of `assets/site.css`; dark mode follows the visitor's system setting.
- All motion respects `prefers-reduced-motion`.
