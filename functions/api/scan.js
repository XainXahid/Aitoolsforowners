/**
 * POST /api/scan  — Cloudflare Pages Function
 *
 * Body: { "url": "<website or Google Maps link>" }
 * Reads the public page, looks for the tools a small business already uses
 * (booking, chat, email signup, reviews, store, CRM forms...) and returns
 * the A.T.F.O. stacks that fill the gaps.
 *
 * Optional environment bindings (Cloudflare Pages → Settings):
 *   GOOGLE_PLACES_API_KEY  lets Google Maps links resolve to the business's
 *                          category, rating, review count and website.
 *   SCANS                  a KV namespace; when bound, each scan is saved so
 *                          you can follow up (key "scan:<time>:<id>").
 */

const MAX_BYTES = 1_500_000;
const TIMEOUT_MS = 9000;
const UA = 'Mozilla/5.0 (compatible; ATFO-Scanner/1.0; +https://aitoolsforowners.com/)';

/* ---------- what we look for ---------- */
const SIGNALS = {
  booking: { label: 'Online booking', re: /calendly\.com|acuityscheduling|squareup\.com\/appointments|square\.site\/book|booksy\.com|vagaro\.com|mindbodyonline|setmore\.com|simplybook|schedulicity|housecallpro|getjobber|clienthub|zocdoc|opentable\.com|resy\.com|tockhq|book (?:now|online|an appointment)|schedule (?:now|online|an appointment)/ },
  chat: { label: 'Website chat', re: /tidio|widget\.intercom|intercomcdn|js\.driftt|drift\.com|livechatinc|embed\.tawk\.to|client\.crisp\.chat|zdassets\.com|gorgias\.chat|olark|hs-scripts.*conversations|messenger\.com\/t\/|fb-customerchat|podium\.com\/widget|birdeye.*webchat/ },
  email: { label: 'Email signup', re: /list-manage\.com|chimpstatic|mailchimp|klaviyo|convertkit|ck\.page|constantcontact|beehiiv|mailerlite|sendinblue|brevo|newsletter|sign up for (?:our )?(?:emails|updates)|subscribe/ },
  crm: { label: 'CRM or lead capture', re: /js\.hs-scripts|hsforms|hubspot|followupboss|salesforce|pipedrive|zoho|keap|activecampaign|gohighlevel|leadconnectorhq|typeform|jotform/ },
  form: { label: 'Contact form', re: /<form[\s>]|wpforms|gravityforms|contact-form-7|wpcf7|formspree|jotform|typeform|squarespace-form|wix-forms/ },
  reviews: { label: 'Reviews on your site', re: /birdeye|podium|trustpilot|yotpo|judge\.me|stamped\.io|okendo|elfsight.*review|reviews\.io|grade\.us|nicejob|google reviews|testimonials?/ },
  store: { label: 'Online store', re: /cdn\.shopify\.com|myshopify|woocommerce|bigcommerce|ecwid|add to cart|add-to-cart|\/cart\b|squarespace-commerce/ },
  payments: { label: 'Online payments', re: /js\.stripe\.com|stripe\.com|squareup\.com|paypal\.com|paypalobjects|quickbooks|invoice/ },
  blog: { label: 'Blog or articles', re: /href="[^"]*\/(?:blog|news|articles|insights)\b|<article[\s>]/ },
  social: { label: 'Social media links', re: /instagram\.com\/[a-z0-9_.]+|facebook\.com\/[a-z0-9.]+|tiktok\.com\/@|linkedin\.com\/company|youtube\.com\/(?:@|c\/|channel)/ },
};
const PLATFORMS = [
  ['Shopify', /cdn\.shopify\.com|myshopify/], ['WordPress', /wp-content|wp-includes/], ['Wix', /wixstatic|wix\.com/],
  ['Squarespace', /squarespace/], ['Webflow', /webflow/], ['GoDaddy', /godaddy|secureserver\.net/], ['Weebly', /weebly/],
];
const INDUSTRIES = [
  ['real-estate', 'Real estate', /real estate|realtor|realty|homes for sale|mls\b|listings|brokerage/],
  ['home-services', 'Home services', /plumb|hvac|heating|roofing|electrician|landscap|lawn care|cleaning service|pest control|handyman|contractor|remodel|painting/],
  ['health', 'Health and wellness', /dental|dentist|orthodont|chiropract|clinic|physio|therapy|med ?spa|optometr|veterinar|wellness/],
  ['beauty', 'Salon and beauty', /salon|barber|spa\b|nails|lashes|brows|massage|aesthetic/],
  ['legal', 'Legal and professional', /attorney|law firm|lawyer|legal|cpa\b|accountant|bookkeeping|tax prep|financial advis|insurance agency|consulting/],
  ['food', 'Restaurant and food', /restaurant|our menu|cafe|café|bakery|catering|food truck|grill|pizza|pizzeria|tacos|sushi|deli\b|coffee|brewery|kitchen/],
  ['fitness', 'Fitness', /gym|fitness|yoga|pilates|crossfit|personal train|martial arts/],
  ['retail', 'Retail and e-commerce', /shop now|boutique|online store|free shipping|add to cart|new arrivals/],
  ['agency', 'Agency and creative', /agency|marketing services|web design|photograph|videograph|design studio/],
];

// Match industry words at a word start, so "thumbnails" doesn't count as "nails".
const wordRe = (re, flags = '') => new RegExp('\\b(?:' + re.source + ')', flags);

/* ---------- recommendation rules ---------- */
function recommend(found, industry, maps) {
  const recs = [];
  const add = (slug, score, why) => { if (!recs.some(r => r.slug === slug)) recs.push({ slug, score, why }); };
  const appointmentBased = ['home-services', 'health', 'beauty', 'legal', 'fitness', 'agency', 'real-estate'].includes(industry);

  if (industry === 'real-estate') add('real-estate-leads', 100, 'You work in real estate. Fast first replies win listings, and this stack answers new leads within minutes.');
  if (maps && maps.rating != null && (maps.rating < 4.6 || (maps.reviews ?? 0) < 60))
    add('reviews', 95, `Your Google profile shows ${maps.rating} stars from ${maps.reviews ?? 0} reviews. Asking every happy customer automatically is the fastest way to grow both.`);
  if (!found.booking && (appointmentBased || (!industry && !found.store))) add('scheduling', 90, "We didn't find a way to book online. Let customers pick a time themselves instead of calling or emailing back and forth.");
  const leadBased = !['food', 'retail'].includes(industry) && !found.store;
  if (leadBased && found.form && !found.crm) add(industry === 'real-estate' ? 'real-estate-leads' : 'lead-follow-up', 85, "Your site collects inquiries, but we didn't spot a CRM. New leads can slip through without an automatic follow up.");
  if (leadBased && !found.form && !found.crm) add('lead-follow-up', 70, "We didn't find a contact form or lead capture. A simple form plus automatic follow up turns visitors into leads.");
  if (!found.chat) add('website-chat', found.store ? 80 : 65, "There's no chat on your site. A chat assistant answers common questions after hours and collects contact details.");
  if (found.store) add('online-store-support', 82, 'You sell online. This stack answers "where is my order?" emails and recovers abandoned carts.');
  if (industry === 'food') add('social-media', 75, 'Restaurants win on photos. Post your dishes and specials every week without the scramble.');
  if (!found.reviews && !maps) add('reviews', industry === 'food' ? 88 : 60, "We didn't see reviews or testimonials on your site. Reviews are often the first thing new customers check.");
  if (!found.email) add('email-marketing', 58, "There's no email signup. A short monthly email keeps past customers coming back.");
  if (found.social) add('social-media', 50, 'You link to social profiles. Plan and schedule a month of posts in one sitting.');
  if (!found.blog) add('writing-content', 40, 'No blog or articles found. A few helpful posts help you show up in Google and AI answers.');
  if (['legal', 'agency', 'home-services'].includes(industry)) add('proposals-contracts', 55, 'Your kind of business sends quotes and proposals. Templates and e-signatures get them signed faster.');
  if (['legal', 'health', 'agency'].includes(industry)) add('client-intake', 52, 'Intake forms that fill your records automatically save you typing for every new client.');
  if (found.payments || ['home-services', 'agency', 'legal'].includes(industry)) add('invoicing', 45, 'Automatic invoices and payment reminders mean less chasing.');

  return recs.sort((a, b) => b.score - a.score).slice(0, 4);
}

/* ---------- helpers ---------- */
const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
});

function cleanUrl(raw) {
  let s = String(raw || '').trim();
  if (!s || s.length > 2048) return null;
  if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
  let u;
  try { u = new URL(s); } catch { return null; }
  if (!/^https?:$/.test(u.protocol) || u.username || u.password) return null;
  if (u.port && !['80', '443'].includes(u.port)) return null;
  const h = u.hostname.toLowerCase();
  // Public hostnames only: no IP literals, localhost or internal names.
  if (!h.includes('.') || /^[\d.]+$/.test(h) || h.includes(':') || /(^|\.)(localhost|local|internal|lan|home|arpa)$/.test(h)) return null;
  return u;
}

const isMaps = u => /(^|\.)google\.[a-z.]+$/.test(u.hostname) && u.pathname.startsWith('/maps')
  || /^maps\.google\./.test(u.hostname) || u.hostname === 'maps.app.goo.gl' || (u.hostname === 'goo.gl' && u.pathname.startsWith('/maps')) || u.hostname === 'g.page';

async function fetchText(u) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(u.toString(), { headers: { 'user-agent': UA, accept: 'text/html,*/*;q=0.8' }, redirect: 'follow', signal: ctl.signal });
    const finalUrl = cleanUrl(r.url) || u;
    if (!r.ok) return { error: `The site answered with an error (${r.status}).`, finalUrl };
    const type = r.headers.get('content-type') || '';
    if (!/html|xml|text/.test(type)) return { error: "That link isn't a web page we can read.", finalUrl };
    const reader = r.body.getReader();
    const chunks = []; let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length; chunks.push(value);
      if (size > MAX_BYTES) { await reader.cancel(); break; }
    }
    const buf = new Uint8Array(size); let o = 0;
    for (const c of chunks) { buf.set(c.subarray(0, Math.min(c.length, size - o)), o); o += c.length; if (o >= size) break; }
    return { html: new TextDecoder().decode(buf), finalUrl };
  } catch (e) {
    return { error: e.name === 'AbortError' ? 'The site took too long to answer.' : "We couldn't reach that site." };
  } finally { clearTimeout(t); }
}

const decode = s => s.replace(/&amp;/g, '&').replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#x27;/g, "'").replace(/\s+/g, ' ').trim();

/** Pure analysis of a page's HTML. Exported for tests. */
export function analyze(html, pageUrl) {
  const low = html.toLowerCase();
  const title = decode((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '').slice(0, 120);
  const metaDesc = decode((html.match(/<meta[^>]+name=["']description["'][^>]*content=["']([^"']*)/i) || [])[1] || '');
  const ogName = decode((html.match(/<meta[^>]+property=["']og:site_name["'][^>]*content=["']([^"']*)/i) || [])[1] || '');
  const text = low.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ');
  const found = {};
  for (const [k, s] of Object.entries(SIGNALS)) found[k] = s.re.test(k === 'blog' || k === 'form' ? low : low);
  const platform = (PLATFORMS.find(([, re]) => re.test(low)) || [null])[0];
  const body = text.slice(0, 80000) + ' ' + title.toLowerCase() + ' ' + metaDesc.toLowerCase();
  const scored = INDUSTRIES.map(([id, label, re]) => [id, label, (body.match(wordRe(re, 'g')) || []).length + (found.store && id === 'retail' ? 5 : 0)]).sort((a, b) => b[2] - a[2]);
  const industry = scored[0][2] >= 2 ? { id: scored[0][0], label: scored[0][1] } : null;
  return {
    name: ogName || title.split(/\s[|\-–—•]\s/)[0] || (pageUrl && pageUrl.hostname),
    description: metaDesc.slice(0, 200),
    platform, industry, found,
    phone: /href=["']tel:/.test(low), emailLink: /href=["']mailto:/.test(low),
  };
}

function summarize(found) {
  return Object.entries(SIGNALS).map(([k, s]) => ({ key: k, label: s.label, found: !!found[k] }));
}

function industryFromText(t) {
  const hit = INDUSTRIES.find(([, , re]) => wordRe(re).test(t.toLowerCase()));
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

export async function onRequestPost({ request, env }) {
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
  const recs = recommend(found, industry?.id, maps && maps.rating != null ? maps : null);

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
    checks: page ? summarize(found) : [],
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
