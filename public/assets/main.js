/* A.T.F.O. homepage interactions. No dependencies. */
(() => {
  'use strict';
  const STACKS = window.STACKS || [], ASST = window.ASST || {}, AORD = window.AORD || [];
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const bySlug = Object.fromEntries(STACKS.map(s => [s.slug, s]));
  const ARR = '<svg class="arr" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h15m-6-6 6 6-6 6"/></svg>';

  const money = n => '$' + (Number.isInteger(n) ? n : n.toFixed(2));
  // Setup time: "30 min" / "1 hr" -> minutes, and back to a friendly label.
  const mins = s => { const [n, u] = s.split(' '); return Math.round(+n * (u.startsWith('hr') ? 60 : 1)); };
  const setupOf = s => s.tools.reduce((a, t) => a + mins(t.setup), 0);
  // Honest ranges instead of false precision (same rules as scripts/build.py).
  const friendly = m => m <= 35 ? '~30 min' : m <= 70 ? '~1 hr' : m <= 120 ? '1–2 hrs' : m <= 180 ? '2–3 hrs' : 'Half a day';
  const CHECKED = window.CHECKED ? new Date(window.CHECKED + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : '';
  const announce = t => { const a = $('#announce'); if (a) { a.textContent = ''; setTimeout(() => { a.textContent = t; }, 50); } };
  // Motion can be paused by the visitor (and is off with Reduce Motion).
  let paused = reduce;
  try { if (localStorage.getItem('atfo-motion') === 'off') paused = true; } catch (_) { /* storage blocked */ }
  document.documentElement.classList.toggle('paused', paused);
  const short = n => n.replace(' Online', '').replace('.ai', '');

  /* ---------- year + clock ---------- */
  const yr = $('#yr'); if (yr) yr.textContent = new Date().getFullYear();
  const clock = $('#clock');
  if (clock) {
    const tick = () => {
      const d = new Date();
      const day = d.toLocaleDateString('en-US', { weekday: 'long' });
      const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
      clock.textContent = `It's ${time} on a ${day}. What's still on your list?`;
    };
    tick(); setInterval(tick, 30000);
  }

  /* ---------- nav: hide on scroll down, blur when scrolled, mobile drawer ---------- */
  const nav = $('#nav'), bar = $('.progress span'), burger = $('#burger'), drawer = $('#drawer');
  let lastY = scrollY;
  const onScrollNav = () => {
    const y = scrollY, h = document.documentElement.scrollHeight - innerHeight;
    nav.classList.toggle('is-scrolled', y > 10);
    if (burger.getAttribute('aria-expanded') !== 'true') nav.classList.toggle('is-hidden', y > lastY && y > 400);
    lastY = y;
    bar.style.setProperty('--p', h > 0 ? (y / h).toFixed(4) : 0);
  };
  burger.addEventListener('click', () => {
    const open = burger.getAttribute('aria-expanded') !== 'true';
    burger.setAttribute('aria-expanded', open); burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    drawer.hidden = !open;
  });
  drawer.addEventListener('click', e => { if (e.target.closest('a')) burger.click(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && burger.getAttribute('aria-expanded') === 'true') { burger.click(); burger.focus(); }
  });

  /* ---------- pause motion ---------- */
  const motionBtn = $('#motionBtn');
  const syncMotion = () => {
    document.documentElement.classList.toggle('paused', paused);
    if (motionBtn) { motionBtn.setAttribute('aria-pressed', String(paused)); motionBtn.lastChild.textContent = paused ? 'Play motion' : 'Pause motion'; }
  };
  if (motionBtn) {
    if (reduce) motionBtn.hidden = true;
    motionBtn.addEventListener('click', () => {
      paused = !paused; syncMotion();
      try { localStorage.setItem('atfo-motion', paused ? 'off' : 'on'); } catch (_) { /* storage blocked */ }
    });
    syncMotion();
  }

  /* ---------- tool shelf: two rows of tool chips drifting in opposite directions ---------- */
  const tracks = $$('.shelf__track');
  if (tracks.length) {
    const firstTask = {};
    STACKS.forEach(s => s.tools.forEach(t => { if (!firstTask[t.name]) firstTask[t.name] = s.label; }));
    const names = Object.keys(firstTask);
    const chip = (n, hide) => `<span class="tool"${hide ? ' aria-hidden="true"' : ''}><span class="tool__mono" aria-hidden="true">${esc(n[0])}</span><span class="tool__name">${esc(n)}</span><span class="tool__task">${esc(firstTask[n])}</span></span>`;
    const half = Math.ceil(names.length / 2);
    [names.slice(0, half), names.slice(half)].forEach((row, i) => {
      if (!tracks[i]) return;
      tracks[i].innerHTML = row.map(n => chip(n)).join('') + row.map(n => chip(n, true)).join('');
    });
    const cnt = $('#shelfCount'); if (cnt) cnt.textContent = `${names.length} tools across ${STACKS.length} tasks`;
  }

  /* ---------- legal pad: chores get crossed off ---------- */
  const PAD = [
    ['Follow up with 14 new leads', 'lead-follow-up'],
    ['Send this month\'s invoices', 'invoicing'],
    ['Answer the support inbox', 'customer-support-email'],
    ['Post on Instagram (again)', 'social-media'],
    ['Book the Johnson estimate', 'scheduling'],
    ['Write the newsletter', 'email-marketing'],
  ];
  const padList = $('#padList');
  if (padList) {
    const strike = '<svg class="pad__strike" viewBox="0 0 300 16" preserveAspectRatio="none" aria-hidden="true"><path d="M2 10 C 40 4, 70 13, 110 8 S 180 4, 220 9 S 270 13, 298 6"/></svg>';
    padList.innerHTML = PAD.map(([task, slug]) => {
      const s = bySlug[slug]; if (!s) return '';
      const tools = s.tools.slice(0, 2).map(t => short(t.name)).join(' + ');
      return `<li><span class="pad__task">${esc(task)}${strike}</span><span class="pad__note">→ ${esc(tools)} <b>${friendly(setupOf(s))} setup</b></span></li>`;
    }).join('');
    const items = $$('li', padList);
    // Crosses the list off once, then stays still.
    if (paused) items.forEach(li => li.classList.add('done'));
    else {
      let i = 0;
      const step = () => { if (i < items.length) { items[i++].classList.add('done'); setTimeout(step, paused ? 0 : 1100); } };
      setTimeout(step, 1200);
    }
    // gentle tilt toward the pointer
    const pad = $('#pad'), sheet = $('.pad__sheet', pad);
    if (fine && !reduce) {
      pad.addEventListener('pointermove', e => {
        const r = pad.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
        sheet.style.transform = `perspective(900px) rotateY(${x * 8}deg) rotateX(${-y * 6}deg)`;
      });
      pad.addEventListener('pointerleave', () => { sheet.style.transform = ''; });
    }
  }

  /* ---------- finder ---------- */
  const form = $('#finder'), input = $('#task'), out = $('#result');
  // Words people actually type, mapped to the stacks that handle them.
  const SYN = {
    'scheduling': ['no shows', 'no show', 'reminder', 'appointment reminders', 'text reminders', 'sms', 'book appointments', 'bookings', 'booking', 'reschedul'],
    'payroll': ['hiring', 'hire', 'new hires', 'new employees', 'employee onboarding', 'onboarding employees', 'pay my team', 'pay employees', 'timesheet', 'contractors 1099'],
    'reviews': ['google business', 'google profile', 'yelp', 'reputation', 'ratings', 'star rating', 'surveys', 'customer feedback'],
    'website-chat': ['same questions', 'faqs', 'questions from customers', 'website visitors', 'after hours'],
    'customer-support-email': ['inbox', 'customer emails', 'replying to customers', 'customer service', 'support tickets'],
    'invoicing': ['late payments', 'collect payments', 'collecting payments', 'getting paid', 'billing', 'unpaid'],
    'proposals-contracts': ['quote', 'quotes', 'estimate', 'estimates', 'bids', 'contract', 'contracts', 'e sign', 'esign', 'signatures'],
    'writing-content': ['seo', 'blog', 'website copy', 'website content', 'ad copy', 'product descriptions', 'writing'],
    'social-media': ['facebook', 'instagram', 'tiktok', 'linkedin', 'content calendar', 'social'],
    'email-marketing': ['newsletter', 'email list', 'promotions', 'email campaigns'],
    'meeting-notes': ['call notes', 'notes from calls', 'transcribe', 'meeting minutes', 'notes'],
    'bookkeeping': ['taxes', 'tax', 'expenses', 'receipts', 'accountant'],
    'lead-follow-up': ['inquiries', 'enquiries', 'prospects', 'follow up', 'follow-up'],
    'client-intake': ['new clients', 'intake forms', 'client onboarding', 'onboarding clients', 'onboarding new clients'],
    'online-store-support': ['where is my order', 'shopify', 'returns', 'refunds', 'abandoned cart'],
  };
  const norm = q => ' ' + q.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() + ' ';
  // Score each stack by the keywords that start a word in the query, so "design" doesn't match "sign".
  const scoreAll = q => {
    const n = norm(q);
    return STACKS.map(s => {
      let sc = 0;
      for (const k of s.kw.concat(SYN[s.slug] || [])) if (n.includes(' ' + norm(k).trim())) sc += k.length;
      return [s, sc];
    }).filter(x => x[1] > 0).sort((a, b) => b[1] - a[1]);
  };
  // Phrases that could mean more than one stack.
  const AMBIG = [
    [/\bemails?\b/, ['customer-support-email', 'email-marketing'], 'Which kind of email?'],
    [/\b(?:text(?:ing| messages?)|sms)\b/, ['scheduling', 'reviews', 'lead-follow-up'], 'What do you want to text customers about?'],
    [/\b(?:marketing|advertis\w*|more customers|new customers|get(?:ting)? customers|grow\w*)\b/, ['social-media', 'email-marketing', 'reviews', 'writing-content'], 'Which kind of marketing?'],
  ];
  // Tasks we don't cover yet, so we can say so plainly and point to the closest help.
  const MISSING = [
    [/\b(?:phone|calls?|voicemail|answering service|receptionist)\b/, 'answering phone calls', ['website-chat', 'scheduling'], 'Chat answers questions so fewer people need to call, and online booking cuts the "can I get an appointment?" calls.'],
    [/\b(?:inventory|stock levels?)\b/, 'inventory', ['online-store-support', 'bookkeeping'], ''],
    [/\b(?:shifts?|rota|staff schedul\w*|employee schedul\w*)\b/, 'staff shift scheduling', ['payroll'], 'Payroll tools like Gusto handle hours and time off, but not shift planning.'],
    [/\b(?:video|youtube|podcasts?|reels)\b/, 'video and podcasts', ['social-media', 'writing-content'], ''],
    [/\b(?:spreadsheets?|data entry|excel)\b/, 'data entry and spreadsheets', ['bookkeeping', 'client-intake'], ''],
    [/\b(?:logo|graphic design|branding)\b/, 'logo and brand design', ['social-media'], 'Canva in the social media stack covers simple graphics.'],
    [/\btranslat\w*\b/, 'translation', ['customer-support-email'], ''],
  ];
  const INDUSTRY = /\b(?:plumb\w*|hvac|roof\w*|electrician|salon|barber\w*|dentist|dental|restaurant|realtor|real estate agent|lawyer|attorney|contractor|landscap\w*|cleaning company|gym|spa|bakery|cafe|clinic|agency|shop owner|store owner)\b/;

  // Typed placeholder that cycles through real examples.
  if (input && !reduce) {
    const ex = ['Following up with leads takes forever', 'Chasing late invoices', 'Answering the same customer emails', 'Posting on social every day', 'Taking notes on every client call', 'Running payroll'];
    let k = 0, j = 0, del = false;
    const type = () => {
      if (paused) { input.placeholder = ex[0]; return; }
      if (document.activeElement === input || input.value) { setTimeout(type, 1200); return; }
      const w = ex[k];
      input.placeholder = w.slice(0, j) + (j < w.length || del ? '|' : '');
      if (!del && j < w.length) j++;
      else if (!del) { del = true; setTimeout(type, 1800); return; }
      else if (j > 0) j -= 2;
      else { del = false; j = 0; k++; if (k >= ex.length) { input.placeholder = ex[0]; return; } }
      j = Math.max(0, j);
      setTimeout(type, del ? 22 : 55);
    };
    setTimeout(type, 1600);
  }

  const renderStack = s => {
    const ids = s.tools.map(t => t.id);
    const dflt = ids.find(i => ASST[i]) || '';
    const rows = s.tools.map(t => ({ ...t, role: ASST[t.id] ? 'assistant' : 'tool' }))
      .concat(AORD.filter(a => !ids.includes(a)).map(a => ({
        id: a, name: ASST[a].name, url: ASST[a].url, why: s.how[AORD.indexOf(a)][0], price: ASST[a].price,
        num: ASST[a].num, free: ASST[a].free, setup: a === 'grokbot' ? '1 hr' : '15 min', diff: a === 'grokbot' ? 'Medium' : 'Easy', role: 'alt',
      })));
    const row = t => `<li class="receipt__row" data-id="${t.id}" data-role="${t.role}" data-price="${t.num}" data-free="${t.free}"${t.role === 'alt' ? ' hidden' : ''}>
        <a class="receipt__name" href="${esc(t.url)}" rel="sponsored nofollow noopener" target="_blank">${esc(t.name)}${ARR}</a>
        <span class="receipt__price" data-o="${esc(t.price)}" data-setup="${esc(t.setup)}">${esc(t.setup)}</span>
        <p class="receipt__why">${esc(t.why)}</p>
        <span class="receipt__meta"><span class="chip">${esc(t.diff)}</span>${t.role !== 'tool' ? '<span class="chip chip--ai">AI assistant</span>' : ''}${t.free === '1' ? '<span class="chip">Free plan</span>' : ''}</span>
      </li>`;
    const asst = AORD.map((a, i) => `<button type="button" class="asst__item" data-a="${a}" aria-pressed="false">
        <span class="asst__name">${esc(ASST[a].name)}</span><span class="asst__price">${ASST[a].free === '1' ? 'Free plan available' : 'Paid plans'}</span>
        <p class="asst__how">${esc(s.how[i][0])} <em>Add-ons: ${esc(s.how[i][1])}.</em></p></button>`).join('');
    out.innerHTML = `<div class="res" data-default="${dflt}">
      <div class="res__left">
        <p class="res__eyebrow">Your stack</p>
        <h2 class="res__title">${esc(s.label)}</h2>
        <p class="res__task">The tools that handle ${esc(s.task)}, why each one is there, setup time and difficulty.</p>
        <div class="res__total"><small>Time to connect the tools</small><span class="res__num"><span class="t-time">${friendly(setupOf(s))}</span></span><p class="res__sub">${s.tools.length} tools · ${s.tools.some(t => t.diff === 'Medium') ? 'Easy to medium' : 'All easy'} setup. Writing your own templates and content takes longer, so plan an afternoon.</p></div>
        <button type="button" class="costs-btn" aria-expanded="false" aria-controls="costs">See monthly costs <span aria-hidden="true">+</span></button>
        <div class="costs" id="costs" hidden>
        <div class="costs__sum"><small>Known starting costs</small><strong class="t-val">$0</strong><span class="t-plus"></span><span>/mo</span></div>
        <p class="res__unk t-unk"></p><p class="res__drop"></p>
        <div class="res__ctrl">
          <label for="f-budget">Budget<select id="f-budget" class="f-budget"><option value="any">Any budget</option><option value="0">Free only</option><option value="25">Under $25/mo</option><option value="50">Under $50/mo</option></select></label>
          <label for="f-asst">AI assistant<select id="f-asst" class="f-asst"><option value="">No preference</option>${AORD.map(a => `<option value="${a}">${esc(ASST[a].name)}</option>`).join('')}</select></label>
        </div>
        <p class="costs__note">Starting prices${CHECKED ? `, last checked ${CHECKED}` : ''}. Many tools have free plans, and prices change, so check each tool's site before you budget.</p>
        </div>
      </div>
      <div class="receipt">
        <div class="receipt__head"><span>${esc(s.label)}</span><span class="r-col">Setup time</span></div>
        <ul class="receipt__list">${rows.map(row).join('')}</ul>
        <div class="receipt__sum"><span class="r-sum">Total setup</span><strong class="r-tot">${friendly(setupOf(s))}</strong></div>
        <div class="receipt__bar" aria-hidden="true"></div>
        <p class="receipt__fine">Tool links may be affiliate links. We may earn a commission at no cost to you.</p>
      </div>
      <div class="res__lower">
        <div><h3>Setup steps</h3><ol class="checklist">${s.steps.map((x, i) => `<li><label for="st-${i}"><input type="checkbox" id="st-${i}"><span>${esc(x)}</span></label></li>`).join('')}</ol></div>
        <div><h3>Pick your AI assistant</h3><div class="asst">${asst}</div>
          <div class="res__cta"><a class="btn magnet" href="/best-ai-tools-for-${s.slug}/"><span>See the full comparison</span>${ARR}</a><a class="link-arrow" href="/compare-ai-assistants-for-small-business/">Compare AI assistants ${ARR}</a></div>
        </div>
      </div>
    </div>`;
    const box = $('.res', out);
    const sync = () => apply(box);
    $('.f-budget', box).addEventListener('change', sync);
    $('.f-asst', box).addEventListener('change', sync);
    $$('.asst__item', box).forEach(b => b.addEventListener('click', () => {
      const sel = $('.f-asst', box); sel.value = sel.value === b.dataset.a ? '' : b.dataset.a; sync();
    }));
    const cb = $('.costs-btn', box), cp = $('.costs', box);
    cb.addEventListener('click', () => {
      const open = cb.getAttribute('aria-expanded') !== 'true';
      cb.setAttribute('aria-expanded', String(open)); cp.hidden = !open; box.classList.toggle('show-costs', open);
      cb.firstChild.textContent = open ? 'Hide monthly costs ' : 'See monthly costs ';
      sync();
    });
    sync(); bindMagnets(box);
  };

  // Budget + assistant filters (same rules as the original finder).
  function apply(b) {
    const bud = $('.f-budget', b).value, a = $('.f-asst', b).value;
    const lim = bud === 'any' ? Infinity : +bud;
    const showCosts = b.classList.contains('show-costs');
    let total = 0, setup = 0; const dropped = [], unknown = [];
    $$('.receipt__row', b).forEach(r => {
      const id = r.dataset.id, role = r.dataset.role;
      let show = role === 'tool' || (a ? id === a : role === 'assistant');
      const p = r.dataset.price === '' ? null : +r.dataset.price, free = r.dataset.free === '1';
      const pc = $('.receipt__price', r); pc.textContent = showCosts ? pc.dataset.o : pc.dataset.setup; pc.classList.remove('is-free');
      if (show && !showCosts) { /* budget only applies once costs are shown */ }
      else if (show) {
        if (p === null) { if (lim === 0 && !free) { show = false; dropped.push(r.querySelector('a').textContent); } else unknown.push(r.querySelector('a').textContent); }
        else if (total + p > lim) { if (free) { pc.textContent = 'Free plan'; pc.classList.add('is-free'); } else { show = false; dropped.push(r.querySelector('a').textContent); } }
        else total += p;
      }
      r.hidden = !show;
      if (show) setup += mins(pc.dataset.setup);
      if (show && showCosts && pc.textContent === pc.dataset.o && r.dataset.price === '') pc.textContent = 'Check site';
    });
    $$('.t-val', b).forEach(el => countTo(el, total));
    $('.r-col', b).textContent = showCosts ? 'Starting prices' : 'Setup time';
    $('.r-sum', b).textContent = showCosts ? 'Total / month' : 'Total setup';
    $('.r-tot', b).textContent = showCosts ? money(total) + (unknown.length ? '+' : '') : friendly(setup);
    $('.t-time', b).textContent = friendly(setup);
    $('.t-plus', b).textContent = unknown.length ? '+' : '';
    $('.t-unk', b).textContent = unknown.length ? `Not included: ${unknown.join(', ')}. ${unknown.length > 1 ? "They don't" : "It doesn't"} publish a simple monthly price, and some features need a higher plan. Check before you budget.` : '';
    $('.res__drop', b).textContent = dropped.length ? `Left out to fit your budget: ${dropped.join(', ')}.` : '';
    $$('.asst__item', b).forEach(x => x.setAttribute('aria-pressed', String(x.dataset.a === a)));
  }

  function countTo(el, to) {
    const from = parseFloat((el.textContent || '0').replace(/[^0-9.]/g, '')) || 0;
    if (reduce || from === to) { el.textContent = money(to); return; }
    const t0 = performance.now(), d = 700;
    const f = now => {
      const k = Math.min(1, (now - t0) / d), e = 1 - Math.pow(1 - k, 3);
      el.textContent = '$' + (from + (to - from) * e).toFixed(2).replace(/\.00$/, '');
      if (k < 1) requestAnimationFrame(f); else el.textContent = money(to);
    };
    requestAnimationFrame(f);
  }

  // Show a stack in the results band (hidden until first used).
  const band = $('#stack');
  function showStack(slug) {
    const st = bySlug[slug]; if (!st) return;
    renderStack(st);
    band.hidden = false;
    announce(`Showing the ${st.label} stack.`);
    band.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
  }
  const choices = (title, intro, slugs, extra = '') => {
    out.innerHTML = `<div class="res__miss"><p class="res__eyebrow">${esc(title)}</p><h2 class="res__title">${intro}</h2>${extra}
      <div class="choices">${slugs.filter(x => bySlug[x]).map(x => `<button type="button" class="choice" data-show="${x}"><b>${esc(bySlug[x].label)}</b><span>${esc(bySlug[x].tools.map(t => t.name).join(' + '))}</span></button>`).join('')}</div>
      <div class="res__cta"><a class="link-arrow" href="#scan">Or scan your business ${ARR}</a><a class="link-arrow" href="#tasks">See all 16 tasks ${ARR}</a></div></div>`;
    band.hidden = false; announce(title);
    band.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
  };
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-show]'); if (b) showStack(b.dataset.show);
  });

  if (form) {
    const msg = $('#finderMsg');
    $$('[data-ex]').forEach(b => b.addEventListener('click', () => { input.value = b.dataset.ex; form.requestSubmit(); }));
    input.addEventListener('input', () => { if (msg) msg.textContent = ''; });
    form.addEventListener('submit', e => {
      e.preventDefault();
      const q = input.value.trim();
      if (!q) { if (msg) msg.textContent = 'Type a task in your own words, or tap one of the examples below.'; input.focus(); return; }
      const ranked = scoreAll(q);
      const amb = AMBIG.find(([re]) => re.test(q.toLowerCase()));
      const miss = MISSING.find(([re]) => re.test(q.toLowerCase()));
      // A clear winner: show it. Two close matches: let the owner pick.
      if (ranked.length && (!miss || ranked[0][1] >= 6)) {
        if (ranked[1] && ranked[1][1] >= ranked[0][1] * 0.9) {
          return choices('Two good fits', 'Which one is closer?', ranked.slice(0, 3).map(x => x[0].slug));
        }
        return showStack(ranked[0][0].slug);
      }
      if (miss) return choices('Not covered yet', `We don't have a stack for ${esc(miss[1])} yet.`, miss[2],
        `<p>${miss[3] ? esc(miss[3]) + ' ' : ''}These are the closest stacks we have. Join the newsletter and reply with your task; it helps us decide what to cover next.</p>`);
      if (amb) return choices('A few ways to go', esc(amb[2]), amb[1]);
      if (INDUSTRY.test(q.toLowerCase())) return choices('Picks for your business', 'Tell us the task, or let us scan your site.',
        ['scheduling', 'lead-follow-up', 'reviews'], '<p>Paste your website or Google Maps link in the free scan and we\'ll point to the gaps. Or start with one of these popular stacks.</p>');
      choices('No match yet', "We don't have a stack for that yet.", ['lead-follow-up', 'invoicing', 'scheduling', 'social-media'],
        '<p>Try describing the chore, like "chasing late invoices" or "answering the same emails". These are the most popular stacks. Join the newsletter and reply with your task; we read every one.</p>');
    });
  }

  /* ---------- business scan ---------- */
  const scanForm = $('#scanForm'), scanOut = $('#scanOut'), scanUrl = $('#scanUrl');
  const CHECK_LABELS = { booking: 'Online booking', chat: 'Website chat', email: 'Email signup', crm: 'CRM or lead capture', form: 'Contact form', reviews: 'Reviews on your site', store: 'Online store', payments: 'Online payments', blog: 'Blog or articles', social: 'Social media links' };
  const EXAMPLE_SCAN = {
    example: true, caveat: 'This is a sample report. Paste your own link above to scan your business.', name: 'A neighborhood dental practice', url: 'https://yourbusiness.com', industry: 'Health and wellness', platform: 'WordPress',
    checks: Object.keys(CHECK_LABELS).map(k => ({ key: k, label: CHECK_LABELS[k], found: ['form', 'social', 'payments'].includes(k) })),
    recommendations: [
      { slug: 'scheduling', why: "We didn't spot online booking on your homepage. If patients still call or email to book, let them pick a time themselves." },
      { slug: 'lead-follow-up', why: "Your site collects inquiries, but we didn't spot a CRM. Without one, leads can slip through before anyone follows up." },
      { slug: 'website-chat', why: "We didn't spot a chat tool. A chat assistant answers common questions after hours and collects contact details." },
      { slug: 'client-intake', why: 'Intake forms that fill your records automatically save you typing for every new patient.' },
    ],
  };
  const reportFrame = (url, tag, inner) => `<div class="report"><div class="report__bar"><span class="report__dots" aria-hidden="true"><i></i><i></i><i></i></span>
      <span class="report__url">${esc(url)}</span>${tag ? `<span class="report__tag">${esc(tag)}</span>` : ''}</div>
      <div class="report__scan" aria-hidden="true"></div><div class="report__in">${inner}</div></div>`;
  const renderReport = d => {
    const host = d.url ? d.url.replace(/^https?:\/\//, '').replace(/\/$/, '') : 'Google Maps listing';
    const meta = [d.industry, d.platform && `Built on ${d.platform}`, d.maps && d.maps.rating != null && `${d.maps.rating}★ from ${d.maps.reviews} Google reviews`].filter(Boolean);
    const recs = (d.recommendations || []).filter(r => bySlug[r.slug]);
    scanOut.innerHTML = reportFrame(host, d.example ? 'Example report' : 'Your report', `
      <div><p class="report__name">${esc(d.name || 'Your business')}</p>${meta.length ? `<div class="report__meta">${meta.map(m => `<span class="chip">${esc(m)}</span>`).join('')}</div>` : ''}</div>
      ${d.note ? `<p class="report__note">${esc(d.note)}</p>` : ''}
      ${d.checks && d.checks.length ? `<div><h3>What we spotted on your homepage</h3><ul class="checks">${d.checks.map(c => `<li class="${c.found ? 'yes' : ''}">${esc(c.label)}<span class="sr">${c.found ? ': found' : ': not spotted'}</span></li>`).join('')}</ul><p class="checks__key"><span class="checks__dot checks__dot--yes"></span>Found <span class="checks__dot"></span>Not spotted</p></div>` : ''}
      ${d.caveat ? `<p class="report__caveat">${esc(d.caveat)}</p>` : ''}
      ${recs.length ? `<div><h3>${d.checks && d.checks.length ? 'Where to start' : 'Popular starting points'}</h3><ol class="recs">${recs.map(r => {
        const st = bySlug[r.slug];
        return `<li class="rec"><h4>${esc(st.label)}</h4><p>${esc(r.why)}</p><span class="rec__go"><button type="button" data-show="${st.slug}">Show me this stack</button><a href="/best-ai-tools-for-${st.slug}/">Read the full guide →</a></span></li>`;
      }).join('')}</ol></div>` : ''}`);
  };
  if (scanOut) {
    renderReport(EXAMPLE_SCAN);
  }
  if (scanForm) scanForm.addEventListener('submit', async e => {
    e.preventDefault();
    const url = scanUrl.value.trim();
    if (!url) { scanUrl.focus(); scanUrl.setAttribute('aria-invalid', 'true'); return; }
    scanUrl.removeAttribute('aria-invalid');
    const btn = scanForm.querySelector('button'); btn.disabled = true;
    scanOut.innerHTML = reportFrame(url.replace(/^https?:\/\//, ''), 'Scanning', '<p class="report__status" id="scanStatus">Reading your page…</p>');
    const box = $('.report', scanOut); box.classList.add('is-loading');
    const steps = ['Reading your page…', 'Looking for online booking…', 'Checking for chat and email signup…', 'Looking for reviews…', 'Matching you to stacks…'];
    let k = 0; const tk = setInterval(() => { const st = $('#scanStatus'); if (st) st.textContent = steps[++k % steps.length]; }, 1400);
    try {
      const r = await fetch('/api/scan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }) });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.ok) { renderReport(d); announce(`Scan finished for ${d.name || url}.`); }
      else scanOut.innerHTML = reportFrame(url, 'Try again', `<p class="report__note">${esc(d.error || 'The scanner is not available right now. Please try again in a minute.')}</p>`);
    } catch (_) {
      scanOut.innerHTML = reportFrame(url, 'Try again', '<p class="report__note">We couldn\'t reach the scanner. Check your connection and try again.</p>');
    } finally { clearInterval(tk); btn.disabled = false; }
  });

  /* ---------- the week ---------- */
  const WEEK = [
    ['Mon', [['Chase new leads', 2, 'lead-follow-up'], ['Inbox triage', 1.5, 'customer-support-email']]],
    ['Tue', [['Write social posts', 2, 'social-media'], ['Book appointments', 1, 'scheduling']]],
    ['Wed', [['Send invoices', 1.5, 'invoicing'], ['Type up call notes', 1, 'meeting-notes']]],
    ['Thu', [['Website questions', 1, 'website-chat'], ['Ask for reviews', 1, 'reviews']]],
    ['Fri', [['Receipts and books', 2, 'bookkeeping'], ['Write the newsletter', 1.5, 'email-marketing']]],
  ];
  const wg = $('#weekGrid'), wn = $('#weekNum'), weekSec = $('#week');
  let blocks = [];
  if (wg) {
    wg.innerHTML = WEEK.map(([d, list]) => `<div class="day"><span class="day__name">${d}</span>${list.map(([t, h, slug]) => {
      const s = bySlug[slug];
      return `<div class="blk" style="--h:${70 + h * 50}px" data-h="${h}"><span class="blk__h">${h} hr</span><span class="blk__t">${esc(t)}</span><span class="blk__a" aria-hidden="true"><b>Handled</b><s>${esc(t)}</s><small>${esc(s.tools.slice(0, 2).map(x => short(x.name)).join(' + '))}</small></span></div>`;
    }).join('')}</div>`).join('');
    // Order blocks by day so they flip Monday to Friday.
    blocks = $$('.blk', wg);
  }
  let lastOn = -1;
  const onScrollWeek = () => {
    if (!weekSec || !blocks.length) return;
    const r = weekSec.getBoundingClientRect();
    const sticky = getComputedStyle($('.week__sticky')).position === 'sticky';
    const total = sticky ? r.height - innerHeight : r.height * 0.7;
    const p = Math.min(1, Math.max(0, sticky ? -r.top / total : (innerHeight * 0.8 - r.top) / total));
    const n = paused ? blocks.length : Math.round(p * 1.15 * blocks.length);
    if (n === lastOn) return; lastOn = n;
    let hrs = 0;
    blocks.forEach((b, i) => { const on = i < n; b.classList.toggle('on', on); if (on) hrs += +b.dataset.h; });
    wn.textContent = hrs.toFixed(1);
  };

  /* ---------- task index ---------- */
  const CAT = window.CATS || {};
  const catOf = slug => Object.keys(CAT).find(k => CAT[k].includes(slug)) || 'ops';
  const idx = $('#index'), peek = $('#peek');
  if (idx) {
    if (!idx.querySelector('li')) idx.innerHTML = STACKS.map(s => {
      return `<li data-cat="${catOf(s.slug)}"><a class="row" href="/best-ai-tools-for-${s.slug}/" data-slug="${s.slug}">
        <span class="row__name">${esc(s.label)}</span>
        <span class="row__tools">${s.tools.map(t => `<span>${esc(t.name)}</span>`).join('')}</span>
        <span class="row__cost"><small>Setup</small>${friendly(setupOf(s))}</span>
        <span class="row__go" aria-hidden="true">${ARR}</span></a></li>`;
    }).join('');
    $$('.pill').forEach(p => p.addEventListener('click', () => {
      $$('.pill').forEach(x => { x.classList.toggle('is-on', x === p); x.setAttribute('aria-pressed', String(x === p)); });
      const c = p.dataset.cat;
      $$('li', idx).forEach(li => li.classList.toggle('is-out', c !== 'all' && li.dataset.cat !== c));
    }));
    // Cursor-following preview of the stack.
    if (fine && peek) {
      let px = 0, py = 0, tx = 0, ty = 0, raf = 0;
      const loop = () => { px += (tx - px) * .18; py += (ty - py) * .18; peek.style.transform = `translate(${px + 24}px, ${py - 40}px) scale(1)`; raf = requestAnimationFrame(loop); };
      idx.addEventListener('pointerover', e => {
        const a = e.target.closest('.row'); if (!a) return;
        const s = bySlug[a.dataset.slug];
        peek.innerHTML = `<h4>${esc(s.label)}</h4><ul>${s.tools.map(t => `<li><span>${esc(t.name)}</span><span>${esc(t.setup)} · ${esc(t.diff)}</span></li>`).join('')}</ul>`;
        peek.classList.add('on');
        if (!raf) { px = tx; py = ty; loop(); }
      });
      idx.addEventListener('pointermove', e => { tx = e.clientX; ty = e.clientY; });
      idx.addEventListener('pointerleave', () => { peek.classList.remove('on'); cancelAnimationFrame(raf); raf = 0; });
    }
  }

  /* ---------- assistant deck ---------- */
  const deck = $('#deck');
  if (deck && !deck.querySelector('.card')) {
    const KIND = { claude: 'Writer', gemini: 'Workspace native', grokbot: 'Runs on a schedule', chatgpt: 'All-rounder' };
    deck.innerHTML = AORD.map((a, i) => `<button type="button" class="card${i === 0 ? ' is-open' : ''}" data-a="${a}" aria-expanded="${i === 0}">
      <span class="card__k">${esc(KIND[a] || 'Assistant')}</span>
      <span class="card__name">${esc(ASST[a].name)}</span>
      <span class="card__plan">${ASST[a].free === '1' ? 'Free plan available' : 'Paid plans'}</span>
      <span class="card__best">Best for: ${esc(ASST[a].best)}.</span>
      <span class="card__glyph" aria-hidden="true">${esc(ASST[a].name[0])}</span></button>`).join('');
  }
  if (deck) {
    const open = c => $$('.card', deck).forEach(x => { x.classList.toggle('is-open', x === c); x.setAttribute('aria-expanded', String(x === c)); });
    $$('.card', deck).forEach(c => {
      c.addEventListener('click', () => open(c));
      if (fine) c.addEventListener('pointerenter', () => open(c));
    });
  }

  /* ---------- manifesto: words ink in as you read ---------- */
  const mt = $('#manifestoText');
  let words = [];
  if (mt) {
    const marks = new Set(['signup.', 'why', 'before', 'lunch.']);
    mt.innerHTML = mt.textContent.trim().split(/\s+/).map(w => `<span class="w${marks.has(w) ? ' mark' : ''}">${esc(w)}</span>`).join(' ');
    words = $$('.w', mt);
  }
  const onScrollWords = () => {
    if (!words.length) return;
    const r = mt.getBoundingClientRect();
    const p = reduce ? 1 : Math.min(1, Math.max(0, (innerHeight * .85 - r.top) / (r.height + innerHeight * .35)));
    const n = Math.round(p * words.length);
    words.forEach((w, i) => w.classList.toggle('on', i < n));
  };

  /* ---------- footer wordmark fills as you reach the end ---------- */
  const mark = $('.foot__mark');
  const onScrollMark = () => {
    if (!mark) return;
    const r = mark.getBoundingClientRect();
    const p = Math.min(1, Math.max(0, (innerHeight - r.top) / r.height));
    mark.style.setProperty('--fill', (p * 100).toFixed(1) + '%');
  };

  /* ---------- orbit canvas in the featured guide ---------- */
  const cv = $('#orbit');
  if (cv) {
    const ctx = cv.getContext('2d');
    let w = 0, h = 0, t = 0, vis = false;
    const size = () => { const d = Math.min(devicePixelRatio || 1, 2); w = cv.clientWidth; h = cv.clientHeight; cv.width = w * d; cv.height = h * d; ctx.setTransform(d, 0, 0, d, 0, 0); };
    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      const cx = w / 2, cy = h / 2, R = Math.min(w, h) / 2 - 8;
      const css = getComputedStyle(document.documentElement);
      const pen = css.getPropertyValue('--pen').trim() || '#8D96FF', hl = css.getPropertyValue('--hl').trim() || '#FFE94D';
      for (let i = 1; i <= 4; i++) {
        const r = R * i / 4;
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(160,166,210,.22)'; ctx.lineWidth = 1; ctx.stroke();
        const n = i + 1;
        for (let k = 0; k < n; k++) {
          const a = t * (0.4 / i) * (i % 2 ? 1 : -1) + k * Math.PI * 2 / n;
          ctx.beginPath(); ctx.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, i === 4 && k === 0 ? 7 : 4, 0, Math.PI * 2);
          ctx.fillStyle = i === 4 && k === 0 ? hl : pen; ctx.fill();
        }
      }
      ctx.beginPath(); ctx.arc(cx, cy, 14, 0, Math.PI * 2); ctx.fillStyle = hl; ctx.fill();
    };
    const loop = () => { if (vis && !paused) { t += 0.012; draw(); } requestAnimationFrame(loop); };
    size(); draw();
    addEventListener('resize', () => { size(); draw(); });
    if (!reduce) {
      new IntersectionObserver(([en]) => { vis = en.isIntersecting; }).observe(cv);
      loop();
    }
  }

  /* ---------- magnetic buttons ---------- */
  function bindMagnets(root = document) {
    if (!fine || reduce) return;
    $$('.magnet', root).forEach(el => {
      if (el.dataset.mag) return; el.dataset.mag = 1;
      el.addEventListener('pointermove', e => {
        const r = el.getBoundingClientRect();
        el.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * .22}px, ${(e.clientY - r.top - r.height / 2) * .3}px)`;
      });
      el.addEventListener('pointerleave', () => { el.style.transform = ''; });
    });
  }
  bindMagnets();

  /* ---------- reveal on scroll (only for things below the fold at load) ---------- */
  let pending = [];
  if (!reduce) {
    $$('.tasks__top, .index li, .manifesto__text, .steps li, .copilots__top, .card, .feature, .guides__list li, .signup__main, .week__head, .scan__out, .faq__head, .qa').forEach((el, i) => {
      if (el.getBoundingClientRect().top > innerHeight) {
        el.classList.add('pre');
        el.dataset.delay = el.matches('.index li, .steps li, .card, .guides__list li') ? (i % 6) * 60 : 0;
        pending.push(el);
      }
    });
  }
  const onScrollReveal = () => {
    if (!pending.length) return;
    const atEnd = innerHeight + scrollY >= document.documentElement.scrollHeight - 4;
    pending = pending.filter(el => {
      if (!atEnd && el.getBoundingClientRect().top > innerHeight * .92) return true;
      el.style.transitionDelay = el.dataset.delay + 'ms';
      el.classList.add('reveal-in'); el.classList.remove('pre');
      setTimeout(() => { el.style.transitionDelay = ''; }, 1200 + +el.dataset.delay);
      return false;
    });
  };

  /* ---------- newsletter (posts to the existing /api/subscribe endpoint) ---------- */
  $$('form.js-api').forEach(f => f.addEventListener('submit', async e => {
    e.preventDefault();
    const msg = f.parentNode.querySelector('.form-msg'), b = f.querySelector('button'), say = t => { if (msg) msg.textContent = t; };
    const data = Object.fromEntries(new FormData(f));
    // Bot trap: people never see this field. Its name avoids browser autofill.
    if (data.hp_check) { f.reset(); say('Thanks! You are on the list.'); return; }
    b.disabled = true; say('Sending...');
    try {
      const r = await fetch(f.action, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: data.email, company: '' }) });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.ok) { f.reset(); say(d.message || 'Thanks! You are on the list.'); }
      else say(d.error || 'Something went wrong. Please try again.');
    } catch (_) { say('Could not connect. Check your connection and try again.'); }
    finally { b.disabled = false; }
  }));

  /* ---------- one scroll loop ---------- */
  let ticking = false;
  const onScroll = () => {
    if (ticking) return; ticking = true;
    requestAnimationFrame(() => { onScrollNav(); onScrollWeek(); onScrollWords(); onScrollMark(); onScrollReveal(); ticking = false; });
  };
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll);
  onScrollNav(); onScrollWeek(); onScrollWords(); onScrollMark(); onScrollReveal();
})();
