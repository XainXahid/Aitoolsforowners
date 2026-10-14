/**
 * POST /api/scan  — Cloudflare Pages Function
 *
 * Body: { "url": "<website or Google Maps link>" }
 * Reads the public homepage, looks for the tools a small business already uses
 * (booking, chat, email signup, reviews, store, CRM...) and returns the A.T.F.O.
 * stacks that fill the gaps.
 *
 * Built to stay inside Cloudflare's free-plan CPU budget: one pass over the
 * page for vendor names, and text checks on a small slice only.
 *
 * Optional environment bindings (Cloudflare Pages → Settings):
 *   GOOGLE_PLACES_API_KEY  lets Google Maps links resolve to the business's
 *                          category, rating, review count and website.
 *   SCANS                  a KV namespace; when bound, each scan is saved so
 *                          you can follow up (key "scan:<time>:<id>").
 */

const MAX_BYTES = 1_500_000;   // read at most this much from the network
const MAX_SCAN = 250_000;      // analyze at most this much of the <body>
const MAX_TEXT = 100_000;      // strip tags from at most this much of the body
const TIMEOUT_MS = 9000;
const MAX_REDIRECTS = 5;
const RATE = { max: 10, windowMs: 60_000 };
const UA = 'Mozilla/5.0 (compatible; ATFO-Scanner/1.0; +https://aitoolsforowners.com/)';

/* ---------- what we look for ---------- */
const LABELS = {
  booking: 'Online booking', chat: 'Website chat', email: 'Email signup', crm: 'CRM or lead capture',
  form: 'Contact form', reviews: 'Reviews on your site', store: 'Online store', payments: 'Online payments',
  blog: 'Blog or articles', social: 'Social media links',
};

// Vendor fingerprints, matched in a single pass over the page source.
const VENDORS = [
  ['booking', 'calendly.com'], ['booking', 'acuityscheduling'], ['booking', 'squareup.com/appointments'], ['booking', 'square.site/book'],
  ['booking', 'booksy.com'], ['booking', 'vagaro.com'], ['booking', 'mindbodyonline'], ['booking', 'setmore.com'], ['booking', 'simplybook'],
  ['booking', 'schedulicity'], ['booking', 'housecallpro'], ['booking', 'getjobber'], ['booking', 'clienthub'], ['booking', 'zocdoc'],
  ['booking', 'opentable.com'], ['booking', 'resy.com'], ['booking', 'exploretock'], ['booking', 'fresha.com'], ['booking', 'glossgenius'],
  ['booking', 'servicetitan'], ['booking', 'localmed'], ['booking', 'nexhealth'], ['booking', 'janeapp'], ['booking', 'booking.wix'],
  ['chat', 'tidio'], ['chat', 'widget.intercom'], ['chat', 'intercomcdn'], ['chat', 'js.driftt'], ['chat', 'livechatinc'], ['chat', 'embed.tawk.to'],
  ['chat', 'client.crisp.chat'], ['chat', 'zdassets.com'], ['chat', 'gorgias.chat'], ['chat', 'olark'], ['chat', 'podium.com'], ['chat', 'webchat'],
  ['chat', 'manychat'], ['chat', 'smith.ai'], ['chat', 'ngageics'], ['chat', 'apexchat'],
  ['email', 'list-manage.com'], ['email', 'chimpstatic'], ['email', 'klaviyo'], ['email', 'convertkit'], ['email', 'ck.page'], ['email', 'kit.com'],
  ['email', 'constantcontact'], ['email', 'beehiiv'], ['email', 'mailerlite'], ['email', 'sendinblue'], ['email', 'brevo.com'], ['email', 'omnisend'],
  ['crm', 'js.hs-scripts'], ['crm', 'hsforms'], ['crm', 'hs-analytics'], ['crm', 'followupboss'], ['crm', 'salesforce'], ['crm', 'pipedrive'],
  ['crm', 'zohopublic'], ['crm', 'keap'], ['crm', 'activecampaign'], ['crm', 'gohighlevel'], ['crm', 'leadconnectorhq'], ['crm', 'msgsndr'],
  ['form', 'typeform.com'], ['form', 'jotform'], ['form', 'wpforms'], ['form', 'gravityforms'], ['form', 'wpcf7'], ['form', 'formspree'],
  ['reviews', 'birdeye'], ['reviews', 'trustpilot'], ['reviews', 'yotpo'], ['reviews', 'judge.me'], ['reviews', 'stamped.io'], ['reviews', 'okendo'],
  ['reviews', 'reviews.io'], ['reviews', 'grade.us'], ['reviews', 'nicejob'], ['reviews', 'elfsight'], ['reviews', 'trustindex'],
  ['store', 'cdn.shopify.com'], ['store', 'myshopify'], ['store', 'woocommerce'], ['store', 'bigcommerce'], ['store', 'ecwid'], ['store', 'squarespace-commerce'],
  ['payments', 'js.stripe.com'], ['payments', 'buy.stripe.com'], ['payments', 'paypal.com'], ['payments', 'paypalobjects'], ['payments', 'squareup.com'],
  ['payments', 'quickbooks'], ['payments', 'invoicesimple'],
  ['social', 'instagram.com/'], ['social', 'facebook.com/'], ['social', 'tiktok.com/@'], ['social', 'linkedin.com/company'], ['social', 'youtube.com/'],
];
// Longest first, so "squareup.com/appointments" wins over "squareup.com".
const VENDOR_LIST = [...VENDORS].sort((a, b) => b[1].length - a[1].length);
const VENDOR_RE = new RegExp(VENDOR_LIST.map(([, v]) => v.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')).join('|'), 'g');
const VENDOR_OF = Object.fromEntries(VENDOR_LIST.map(([k, v]) => [v, k]));

// Phrases a visitor would see, checked against a small text slice.
const PHRASES = [
  ['booking', /\b(?:book (?:now|online|an appointment|a visit|your)|schedule (?:now|online|an appointment|service)|request an appointment|reserve a table)\b/],
  ['reviews', /\b(?:testimonials?|what (?:our )?(?:customers|clients|patients) say|google reviews)\b/],
  ['store', /\b(?:add to cart|shop now)\b/],
  ['blog', /\b(?:latest posts|our blog|read the blog)\b/],
];

const PLATFORMS = [
  ['Shopify', 'cdn.shopify.com'], ['WordPress', 'wp-content'], ['Wix', 'wixstatic'], ['Squarespace', 'static1.squarespace'],
  ['Webflow', 'webflow'], ['GoDaddy', 'img1.wsimg.com'], ['Weebly', 'weebly'],
];

// Industry: words in the title and description count 4x; body text counts once and is capped.
const INDUSTRIES = [
  ['real-estate', 'Real estate', /\b(?:real estate|realtors?|realty|homes for sale|brokerage)\b/g],
  ['home-services', 'Home services', /\b(?:plumb(?:er|ers|ing)|hvac|heating and (?:air|cooling)|roofing|roofers?|electricians?|landscap(?:e|ing)|lawn care|house cleaning|maid service|pest control|handyman|general contractor|remodel(?:ing)?|painting contractor|garage doors?|pressure washing|drain cleaning)\b/g],
  ['health', 'Health and wellness', /\b(?:dental|dentists?|orthodont\w*|chiropract\w*|physical therapy|physiotherap\w*|med ?spa|optometr\w*|veterinar\w*|pediatric\w*|dermatolog\w*|family medicine)\b/g],
  ['beauty', 'Salon and beauty', /\b(?:hair salon|salons?|barbers?|barbershop|nail salon|lash extensions|brows|massage therapy|day spa|estheticians?)\b/g],
  ['legal', 'Legal and professional', /\b(?:attorneys?|law firm|lawyers?|cpas?|accounting firm|tax preparation|bookkeeping services|financial advis\w*|insurance agency)\b/g],
  ['food', 'Restaurant and food', /\b(?:restaurant|pizzeria|pizza|bakery|caf[eé]|coffee shop|catering|food truck|brewery|taqueria|sushi|bistro|our menu)\b/g],
  ['fitness', 'Fitness', /\b(?:gym|fitness studio|yoga studio|pilates|crossfit|personal trainers?|personal training|martial arts)\b/g],
  ['retail', 'Retail and e-commerce', /\b(?:shop now|add to cart|free shipping|new arrivals|boutique)\b/g],
  ['agency', 'Agency and creative', /\b(?:marketing agency|digital agency|web design agency|photography studio|wedding photograph\w*|videograph\w*|design studio)\b/g],
];

/* ---------- recommendation rules ---------- */
// Reasons say "we didn't spot", because widgets that load later can be missed.
function recommend(found, industry, maps, scanned) {
  const recs = [];
  const add = (slug, score, why) => { if (!recs.some(r => r.slug === slug)) recs.push({ slug, score, why }); };
  const appointmentBased = ['home-services', 'health', 'beauty', 'legal', 'fitness', 'agency', 'real-estate'].includes(industry);
  const leadBased = !['food', 'retail'].includes(industry) && !found.store;

  if (industry === 'real-estate') add('real-estate-leads', 100, 'Fast first replies win listings. This stack answers new leads within minutes.');
  if (maps && maps.rating != null && (maps.rating < 4.6 || (maps.reviews ?? 0) < 60))
    add('reviews', 95, `Your Google profile shows ${maps.rating} stars from ${maps.reviews ?? 0} reviews. Asking every happy customer automatically is the fastest way to grow both.`);
  if (!scanned) {
    // We couldn't read the site, so only suggest common starting points for the business type.
    if (appointmentBased || !industry) add('scheduling', 60, 'Letting customers book a time themselves saves the most back-and-forth for service businesses.');
    if (leadBased) add('lead-follow-up', 55, 'Answering every inquiry quickly, with an automatic follow-up, is where most owners win back time.');
    if (industry === 'food') add('social-media', 60, 'Restaurants win on photos. Post your dishes and specials every week without the scramble.');
    add('reviews', 50, 'Reviews are often the first thing new customers check. Asking for them automatically keeps them coming.');
    add('website-chat', 40, 'A chat assistant answers common questions after hours and collects contact details.');
    return recs.sort((a, b) => b.score - a.score).slice(0, 3);
  }
  if (!found.booking && (appointmentBased || (!industry && !found.store)))
    add('scheduling', 90, "We didn't spot online booking on your homepage. If customers still call or email to book, let them pick a time themselves.");
  if (leadBased && found.form && !found.crm)
    add(industry === 'real-estate' ? 'real-estate-leads' : 'lead-follow-up', 85, "Your site collects inquiries, but we didn't spot a CRM. Without one, leads can slip through before anyone follows up.");
  if (leadBased && !found.form && !found.crm)
    add('lead-follow-up', 70, "We didn't spot a contact form. A simple form plus an automatic follow-up turns visitors into leads.");
  if (!found.chat) add('website-chat', found.store ? 80 : 65, "We didn't spot a chat tool. A chat assistant answers common questions after hours and collects contact details.");
  if (found.store) add('online-store-support', 82, 'You sell online. This stack answers "where is my order?" emails and recovers abandoned carts.');
  if (industry === 'food') add('social-media', 75, 'Restaurants win on photos. Post your dishes and specials every week without the scramble.');
  if (!found.reviews && !maps) add('reviews', industry === 'food' ? 88 : 60, "We didn't spot reviews or testimonials on your homepage. Reviews are often the first thing new customers check.");
  if (!found.email) add('email-marketing', 58, "We didn't spot an email signup. A short monthly email keeps past customers coming back.");
  if (found.social) add('social-media', 50, 'You link to social profiles. Plan and schedule a month of posts in one sitting.');
  if (!found.blog) add('writing-content', 40, "We didn't spot a blog. A few helpful posts help you show up in Google and AI answers.");
  if (['legal', 'agency', 'home-services'].includes(industry)) add('proposals-contracts', 55, 'Your kind of business sends quotes and proposals. Templates and e-signatures get them signed faster.');
  if (['legal', 'health', 'agency'].includes(industry)) add('client-intake', 52, 'Intake forms that fill your records automatically save you typing for every new client.');
  if (found.payments || ['home-services', 'agency', 'legal'].includes(industry)) add('invoicing', 45, 'Automatic invoices and payment reminders mean less chasing.');
  return recs.sort((a, b) => b.score - a.score).slice(0, 4);
}

/* ---------- helpers ---------- */
const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
});

export function cleanUrl(raw) {
  let s = String(raw || '').trim();
  if (!s || s.length > 2048) return null;
  if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
  let u;
  try { u = new URL(s); } catch { return null; }
  if (!/^https?:$/.test(u.protocol) || u.username || u.password) return null;
  if (u.port && !['80', '443'].includes(u.port)) return null;
  const h = u.hostname.toLowerCase();
  // Public hostnames only: no IP literals, localhost or internal names.
  if (!h.includes('.') || /^[\d.]+$/.test(h) || h.includes(':') || /(^|\.)(localhost|local|internal|lan|home|arpa|test|invalid)$/.test(h)) return null;
  return u;
}

const isMaps = u => (/(^|\.)google\.[a-z.]+$/.test(u.hostname) && u.pathname.startsWith('/maps'))
  || /^maps\.google\./.test(u.hostname) || u.hostname === 'maps.app.goo.gl' || (u.hostname === 'goo.gl' && u.pathname.startsWith('/maps')) || u.hostname === 'g.page';

/** Fetch, following redirects by hand so every hop is checked against cleanUrl. */
async function fetchText(u) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    let cur = u, r;
    for (let hop = 0; ; hop++) {
      r = await fetch(cur.toString(), { headers: { 'user-agent': UA, accept: 'text/html,*/*;q=0.8' }, redirect: 'manual', signal: ctl.signal });
      if (r.status < 300 || r.status > 399) break;
      const loc = r.headers.get('location');
      const next = loc && cleanUrl(new URL(loc, cur).toString());
      if (!next || hop >= MAX_REDIRECTS) return { error: "That site redirects somewhere we can't follow.", finalUrl: cur };
      cur = next;
    }
    if ([401, 403, 429, 503].includes(r.status)) return { error: "That site blocks automated visitors, so we couldn't read it.", finalUrl: cur };
    if (!r.ok) return { error: `The site answered with an error (${r.status}).`, finalUrl: cur };
    const type = r.headers.get('content-type') || '';
    if (!/html|xml|text/.test(type)) return { error: "That link isn't a web page we can read.", finalUrl: cur };
    const reader = r.body.getReader();
    const chunks = []; let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value); size += value.length;
      if (size >= MAX_BYTES) { await reader.cancel(); break; }
    }
    const buf = new Uint8Array(Math.min(size, MAX_BYTES)); let o = 0;
    for (const c of chunks) { const n = Math.min(c.length, buf.length - o); buf.set(c.subarray(0, n), o); o += n; if (o >= buf.length) break; }
    return { html: new TextDecoder().decode(buf), finalUrl: cur };
  } catch (e) {
    return { error: e.name === 'AbortError' ? 'The site took too long to answer.' : "We couldn't reach that site." };
  } finally { clearTimeout(t); }
}

const decode = s => s.replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
  .replace(/&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const metaContent = (head, attr, val) => {
  const m = head.match(new RegExp(`<meta[^>]+${attr}=["']${val}["'][^>]*>`, 'i'));
  const c = m && m[0].match(/content=(["'])([\s\S]*?)\1/i);
  return c ? decode(c[2]) : '';
};

/** Pure analysis of a page's HTML. Exported for tests. */
export function analyze(html, pageUrl) {
  // Read the <head> without its inline styles (some sites inline hundreds of KB of CSS),
  // plus the start of the <body>. This keeps the work small and predictable.
  const bodyIdx = html.search(/<body[\s>]/i);
  let head = bodyIdx > 0 ? html.slice(0, bodyIdx) : html.slice(0, 20_000);
  if (head.length > 40_000) head = head.replace(/<style\b[\s\S]*?<\/style>/gi, ' ').replace(/data:[^"')\s]{200,}/g, '').slice(0, 80_000);
  const body = bodyIdx > 0 ? html.slice(bodyIdx, bodyIdx + MAX_SCAN) : html.slice(0, MAX_SCAN);
  const low = (head + body).toLowerCase();
  const title = decode((head.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '').slice(0, 120);
  const metaDesc = metaContent(head, 'name', 'description').slice(0, 300);
  const ogName = metaContent(head, 'property', 'og:site_name');

  const found = {};
  // 1) Vendor fingerprints: one pass over the source.
  for (const m of low.matchAll(VENDOR_RE)) found[VENDOR_OF[m[0]]] = true;
  // 2) Visible text: strip tags from a slice of the body only.
  const bodyStart = Math.max(0, low.indexOf('<body'));
  const text = low.slice(bodyStart, bodyStart + MAX_TEXT)
    .replace(/<(script|style|noscript|svg)\b[\s\S]*?<\/\1>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/g, ' ').replace(/\s+/g, ' ');
  for (const [k, re] of PHRASES) if (!found[k] && re.test(text)) found[k] = true;
  if (!found.blog && /href=["'][^"']*\/(?:blog|news|articles|insights)(?:\/|["'])/.test(low)) found.blog = true;
  // 3) Forms: a real contact form has a message box or asks for a phone, name or email;
  //    a search box doesn't count. An email-only form near "subscribe" is an email signup.
  let n = 0;
  for (const m of low.matchAll(/<form\b[\s\S]{0,6000}?<\/form>/g)) {
    if (++n > 25) break;
    const f = m[0];
    if (/role=["']search|type=["']search|action=["'][^"']*search/.test(f)) continue;
    const hasEmail = /type=["']email|name=["'][^"']*email/.test(f);
    if (/<textarea|type=["']tel/.test(f) || (hasEmail && /name=["'][^"']*(?:first|last|full|your)?_?name["']|name=["'][^"']*(?:message|phone)/.test(f))) found.form = true;
    else if (hasEmail && /subscribe|newsletter|sign up|signup|join/.test(f)) found.email = true;
  }

  const platform = (PLATFORMS.find(([, v]) => low.includes(v)) || [null])[0];
  const strong = `${title} ${metaDesc} ${ogName}`.toLowerCase();
  const bodyText = text.slice(0, 40_000);
  const scored = INDUSTRIES.map(([id, label, re]) => {
    const s = (strong.match(re) || []).length * 4 + Math.min((bodyText.match(re) || []).length, 6) + (found.store && id === 'retail' ? 4 : 0);
    return [id, label, s];
  }).sort((a, b) => b[2] - a[2]);
  const industry = scored[0][2] >= 4 && scored[0][2] > scored[1][2] ? { id: scored[0][0], label: scored[0][1] } : null;

  return {
    name: ogName || title.split(/\s[|\-–—•:]\s/)[0] || (pageUrl && pageUrl.hostname),
    description: metaDesc.slice(0, 200), platform, industry, found,
  };
}

function industryFromText(t) {
  const s = String(t || '').toLowerCase();
  const hit = INDUSTRIES.find(([, , re]) => { re.lastIndex = 0; const ok = re.test(s); re.lastIndex = 0; return ok; });
  return hit ? { id: hit[0], label: hit[1] } : null;
}

async function resolveMaps(u, env) {
  // Short links redirect to the full Maps URL, which carries the place name.
  let full = u;
  if (['maps.app.goo.gl', 'goo.gl', 'g.page'].includes(u.hostname)) {
    try {
      let cur = u;
      for (let i = 0; i < 4; i++) {
        const r = await fetch(cur.toString(), { redirect: 'manual', headers: { 'user-agent': UA } });
        const loc = r.headers.get('location');
        if (!loc) break;
        cur = new URL(loc, cur); full = cur;
        if (/google\./.test(cur.hostname) && cur.pathname.startsWith('/maps')) break;
      }
    } catch { /* keep the short link */ }
  }
  const m = full.pathname.match(/\/maps\/place\/([^/]+)/);
  let name = m ? decodeURIComponent(m[1].replace(/\+/g, ' ')) : (full.searchParams.get('q') || full.searchParams.get('query') || '');
  name = name.split(',')[0].trim();
  const info = { name: name || null, website: null, rating: null, reviews: null, category: null };
  const key = env && env.GOOGLE_PLACES_API_KEY;
  if (key && name) {
    try {
      const r = await fetch('https://places.googleapis.com/v1/places:searchText', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'X-Goog-Api-Key': key,
          'X-Goog-FieldMask': 'places.displayName,places.websiteUri,places.rating,places.userRatingCount,places.primaryTypeDisplayName,places.formattedAddress' },
        body: JSON.stringify({ textQuery: name, maxResultCount: 1 }),
      });
      const p = (await r.json()).places?.[0];
      if (p) Object.assign(info, {
        name: p.displayName?.text || info.name, website: p.websiteUri || null, rating: p.rating ?? null,
        reviews: p.userRatingCount ?? null, category: p.primaryTypeDisplayName?.text || null, address: p.formattedAddress || null,
      });
    } catch { /* fall back to the name only */ }
  }
  return info;
}

// Light per-instance rate limit. Add a Cloudflare rate-limiting rule for /api/scan as well.
const hits = new Map();
function limited(ip) {
  const now = Date.now();
  const h = hits.get(ip);
  if (!h || now - h.t > RATE.windowMs) { if (hits.size > 5000) hits.clear(); hits.set(ip, { t: now, n: 1 }); return false; }
  return ++h.n > RATE.max;
}

export async function onRequestPost({ request, env }) {
  const ip = request.headers.get('cf-connecting-ip') || 'local';
  if (limited(ip)) return json({ ok: false, error: 'Too many scans in a row. Please wait a minute and try again.' }, 429);
  let body;
  try { body = await request.json(); } catch { return json({ ok: false, error: 'Send a website or Google Maps link.' }, 400); }
  const u = cleanUrl(body && body.url);
  if (!u) return json({ ok: false, error: "That doesn't look like a website or Google Maps link. Try something like yourbusiness.com." }, 400);

  let maps = null, target = u;
  if (isMaps(u)) {
    maps = await resolveMaps(u, env);
    target = maps.website ? cleanUrl(maps.website) : null;
  }

  let page = null, error = null, finalUrl = target;
  if (target) {
    const r = await fetchText(target);
    finalUrl = r.finalUrl || target;
    if (r.html) page = analyze(r.html, finalUrl); else error = r.error;
  }

  const industry = page?.industry || industryFromText([maps?.category, maps?.name, page?.name].filter(Boolean).join(' '));
  const found = page?.found || {};
  const recs = recommend(found, industry?.id, maps && maps.rating != null ? maps : null, !!page);

  const result = {
    ok: true,
    source: maps ? 'maps' : 'website',
    name: maps?.name || page?.name || (maps ? null : u.hostname),
    url: finalUrl ? finalUrl.toString() : null,
    platform: page?.platform || null,
    industry: industry?.label || maps?.category || null,
    maps: maps ? { rating: maps.rating, reviews: maps.reviews, category: maps.category, address: maps.address || null } : null,
    scanned: !!page,
    note: page ? null : maps
      ? (!maps.name ? "We couldn't read that Google Maps link. Use the Share button in Google Maps to copy it, or paste your website instead."
        : maps.website ? error : 'We found your Google listing. Add your website link for a full scan of what your site already does.')
      : error,
    caveat: page ? 'We read your homepage only. Some booking, chat and review tools load after the page opens, so we can miss them. If you already have something we suggest, skip it.' : null,
    checks: page ? Object.keys(LABELS).map(k => ({ key: k, label: LABELS[k], found: !!found[k] })) : [],
    recommendations: recs,
  };

  if (env && env.SCANS) {
    const id = crypto.randomUUID().slice(0, 8);
    try {
      await env.SCANS.put(`scan:${new Date().toISOString()}:${id}`, JSON.stringify({ input: u.toString(), ...result }), { expirationTtl: 60 * 60 * 24 * 180 });
    } catch { /* saving is best effort */ }
  }
  return json(result);
}

export const onRequestGet = () => json({ ok: false, error: 'Use POST with {"url": "..."}.' }, 405);
