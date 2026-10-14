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

  // Starting monthly cost of a stack: sum of known prices, plus a count of "check site" tools.
  const cost = s => {
    let total = 0, unk = 0;
    s.tools.forEach(t => { t.num === '' ? unk++ : (total += +t.num); });
    return { total, unk };
  };
  const money = n => '$' + (Number.isInteger(n) ? n : n.toFixed(2));
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

  /* ---------- ticker ---------- */
  const ticker = $('#ticker');
  if (ticker) {
    const names = [...new Set(STACKS.flatMap(s => s.tools.map(t => t.name)))];
    const html = names.map(n => `<span class="ticker__item">${esc(n)}</span>`).join('');
    ticker.innerHTML = html + html.replace(/class="ticker__item"/g, 'class="ticker__item" aria-hidden="true"');
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
      const c = cost(s);
      const tools = s.tools.slice(0, 2).map(t => short(t.name)).join(' + ');
      return `<li><span class="pad__task">${esc(task)}${strike}</span><span class="pad__note">→ ${esc(tools)} <b>${money(c.total)}/mo${c.unk ? '+' : ''}</b></span></li>`;
    }).join('');
    const items = $$('li', padList);
    if (reduce) items.forEach(li => li.classList.add('done'));
    else {
      let i = 0;
      const step = () => {
        if (i < items.length) { items[i++].classList.add('done'); setTimeout(step, 1300); }
        else setTimeout(() => { items.forEach(li => li.classList.remove('done')); i = 0; setTimeout(step, 900); }, 3600);
      };
      setTimeout(step, 1400);
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
  const match = q => {
    q = q.toLowerCase(); let best = null, score = 0;
    for (const s of STACKS) { let n = 0; for (const k of s.kw) if (q.includes(k)) n += k.length; if (n > score) { score = n; best = s; } }
    return best;
  };

  // Typed placeholder that cycles through real examples.
  if (input && !reduce) {
    const ex = ['Following up with leads takes forever', 'Chasing late invoices', 'Answering the same customer emails', 'Posting on social every day', 'Taking notes on every client call', 'Running payroll'];
    let k = 0, j = 0, del = false;
    const type = () => {
      if (document.activeElement === input || input.value) { setTimeout(type, 1200); return; }
      const w = ex[k];
      input.placeholder = w.slice(0, j) + (j < w.length || del ? '|' : '');
      if (!del && j < w.length) j++;
      else if (!del) { del = true; setTimeout(type, 1800); return; }
      else if (j > 0) j -= 2;
      else { del = false; j = 0; k = (k + 1) % ex.length; }
      j = Math.max(0, j);
      setTimeout(type, del ? 22 : 55);
    };
    setTimeout(type, 1600);
  }

  const renderStack = (s, isExample) => {
    const ids = s.tools.map(t => t.id);
    const dflt = ids.find(i => ASST[i]) || '';
    const rows = s.tools.map(t => ({ ...t, role: ASST[t.id] ? 'assistant' : 'tool' }))
      .concat(AORD.filter(a => !ids.includes(a)).map(a => ({
        id: a, name: ASST[a].name, url: ASST[a].url, why: s.how[AORD.indexOf(a)][0], price: ASST[a].price,
        num: ASST[a].num, free: ASST[a].free, setup: a === 'grokbot' ? '1 hr' : '15 min', diff: a === 'grokbot' ? 'Medium' : 'Easy', role: 'alt',
      })));
    const row = t => `<li class="receipt__row" data-id="${t.id}" data-role="${t.role}" data-price="${t.num}" data-free="${t.free}"${t.role === 'alt' ? ' hidden' : ''}>
        <a class="receipt__name" href="${esc(t.url)}" rel="sponsored nofollow noopener" target="_blank">${esc(t.name)}${ARR}</a>
        <span class="receipt__price" data-o="${esc(t.price)}">${esc(t.price)}</span>
        <p class="receipt__why">${esc(t.why)}</p>
        <span class="receipt__meta"><span class="chip">Setup ${esc(t.setup)}</span><span class="chip">${esc(t.diff)}</span>${t.role !== 'tool' ? '<span class="chip chip--ai">AI assistant</span>' : ''}${t.free === '1' ? '<span class="chip">Free plan</span>' : ''}</span>
      </li>`;
    const asst = AORD.map((a, i) => `<button type="button" class="asst__item" data-a="${a}" aria-pressed="false">
        <span class="asst__name">${esc(ASST[a].name)}</span><span class="asst__price">${esc(ASST[a].plan)}: ${esc(ASST[a].price)}</span>
        <p class="asst__how">${esc(s.how[i][0])} <em>Add-ons: ${esc(s.how[i][1])}.</em></p></button>`).join('');
    const no = String(STACKS.indexOf(s) + 1).padStart(3, '0');
    out.innerHTML = `<div class="res" data-default="${dflt}">
      <div class="res__left">
        <p class="res__eyebrow">${isExample ? '<b>Example</b> Type your own task above' : 'Your A.T.F.O. stack'}</p>
        <h2 class="res__title">${esc(s.label)}</h2>
        <p class="res__task">The tools that handle ${esc(s.task)}, with starting prices, setup time and difficulty.</p>
        <div class="res__total"><small>Estimated monthly cost</small><span class="res__num"><span class="t-val">$0</span><sub>/mo</sub></span><p class="res__unk"></p><p class="res__drop"></p></div>
        <div class="res__ctrl">
          <label for="f-budget">Budget<select id="f-budget" class="f-budget"><option value="any">Any budget</option><option value="0">Free only</option><option value="25">Under $25/mo</option><option value="50">Under $50/mo</option></select></label>
          <label for="f-asst">AI assistant<select id="f-asst" class="f-asst"><option value="">No preference</option>${AORD.map(a => `<option value="${a}">${esc(ASST[a].name)}</option>`).join('')}</select></label>
        </div>
      </div>
      <div class="receipt">
        <div class="receipt__head"><span>Stack no. ${no}</span><span>Starting prices</span></div>
        <ul class="receipt__list">${rows.map(row).join('')}</ul>
        <div class="receipt__sum"><span>Total / month</span><strong class="t-val">$0</strong></div>
        <div class="receipt__bar" aria-hidden="true"></div>
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
    sync(); bindMagnets(box);
  };

  // Budget + assistant filters (same rules as the original finder).
  function apply(b) {
    const bud = $('.f-budget', b).value, a = $('.f-asst', b).value;
    const lim = bud === 'any' ? Infinity : +bud;
    let total = 0, unk = 0; const dropped = [];
    $$('.receipt__row', b).forEach(r => {
      const id = r.dataset.id, role = r.dataset.role;
      let show = role === 'tool' || (a ? id === a : role === 'assistant');
      const p = r.dataset.price === '' ? null : +r.dataset.price, free = r.dataset.free === '1';
      const pc = $('.receipt__price', r); pc.textContent = pc.dataset.o; pc.classList.remove('is-free');
      if (show) {
        if (p === null) { if (lim === 0 && !free) { show = false; dropped.push(r.querySelector('a').textContent); } else unk++; }
        else if (total + p > lim) { if (free) { pc.textContent = 'Free plan'; pc.classList.add('is-free'); } else { show = false; dropped.push(r.querySelector('a').textContent); } }
        else total += p;
      }
      r.hidden = !show;
    });
    $$('.t-val', b).forEach(el => countTo(el, total));
    $('.res__unk', b).textContent = unk ? `Plus ${unk} tool${unk > 1 ? 's' : ''} marked "check site".` : '';
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

  if (form) {
    $$('[data-ex]').forEach(b => b.addEventListener('click', () => { input.value = b.dataset.ex; form.requestSubmit(); }));
    form.addEventListener('submit', e => {
      e.preventDefault();
      const s = match(input.value);
      if (!s) {
        out.innerHTML = `<div class="res__miss"><p class="res__eyebrow">No match yet</p><h2 class="res__title">We don't have a stack for that yet.</h2>
          <p>Try one of the tasks below, or join the A.T.F.O. Newsletter and reply with your task. We read every one.</p>
          <div class="res__cta"><a class="btn magnet" href="#tasks"><span>Browse by task</span>${ARR}</a><a class="link-arrow" href="#signup">Join the newsletter ${ARR}</a></div></div>`;
        bindMagnets(out);
      } else renderStack(s, false);
      $('#stack').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
    });
    // Open in a working state with a labeled example.
    if (bySlug['lead-follow-up']) renderStack(bySlug['lead-follow-up'], true);
  }

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
    const total = r.height - innerHeight;
    const p = total > 0 ? Math.min(1, Math.max(0, -r.top / total)) : 1;
    const n = reduce ? blocks.length : Math.round(p * 1.15 * blocks.length);
    if (n === lastOn) return; lastOn = n;
    let hrs = 0;
    blocks.forEach((b, i) => { const on = i < n; b.classList.toggle('on', on); if (on) hrs += +b.dataset.h; });
    wn.textContent = hrs.toFixed(1);
  };

  /* ---------- task index ---------- */
  const CAT = {
    sales: ['lead-follow-up', 'real-estate-leads', 'reviews', 'client-intake', 'proposals-contracts'],
    money: ['invoicing', 'bookkeeping', 'payroll'],
    ops: ['scheduling', 'meeting-notes', 'customer-support-email', 'website-chat', 'online-store-support'],
    marketing: ['social-media', 'email-marketing', 'writing-content'],
  };
  const catOf = slug => Object.keys(CAT).find(k => CAT[k].includes(slug)) || 'ops';
  const idx = $('#index'), peek = $('#peek');
  if (idx) {
    idx.innerHTML = STACKS.map(s => {
      const c = cost(s);
      return `<li data-cat="${catOf(s.slug)}"><a class="row" href="/best-ai-tools-for-${s.slug}/" data-slug="${s.slug}">
        <span class="row__name">${esc(s.label)}</span>
        <span class="row__tools">${s.tools.map(t => `<span>${esc(t.name)}</span>`).join('')}</span>
        <span class="row__cost"><small>From</small>${money(c.total)}/mo${c.unk ? '+' : ''}</span>
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
        peek.innerHTML = `<h4>${esc(s.label)}</h4><ul>${s.tools.map(t => `<li><span>${esc(t.name)}</span><span>${esc(t.price)}</span></li>`).join('')}</ul>`;
        peek.classList.add('on');
        if (!raf) { px = tx; py = ty; loop(); }
      });
      idx.addEventListener('pointermove', e => { tx = e.clientX; ty = e.clientY; });
      idx.addEventListener('pointerleave', () => { peek.classList.remove('on'); cancelAnimationFrame(raf); raf = 0; });
    }
  }

  /* ---------- assistant deck ---------- */
  const deck = $('#deck');
  if (deck) {
    const KIND = { claude: 'Writer', gemini: 'Workspace native', grokbot: 'Runs on a schedule', chatgpt: 'All-rounder' };
    deck.innerHTML = AORD.map((a, i) => `<button type="button" class="card${i === 0 ? ' is-open' : ''}" data-a="${a}" aria-expanded="${i === 0}">
      <span class="card__k">${esc(KIND[a] || 'Assistant')}</span>
      <span class="card__name">${esc(ASST[a].name)}</span>
      <span class="card__plan">${esc(ASST[a].plan)} · ${esc(ASST[a].price)}</span>
      <span class="card__best">Best for: ${esc(ASST[a].best)}.</span>
      <span class="card__glyph" aria-hidden="true">${esc(ASST[a].name[0])}</span></button>`).join('');
    const open = c => $$('.card', deck).forEach(x => { x.classList.toggle('is-open', x === c); x.setAttribute('aria-expanded', String(x === c)); });
    $$('.card', deck).forEach(c => {
      c.addEventListener('click', () => open(c));
      c.addEventListener('focus', () => open(c));
      if (fine) c.addEventListener('pointerenter', () => open(c));
    });
  }

  /* ---------- manifesto: words ink in as you read ---------- */
  const mt = $('#manifestoText');
  let words = [];
  if (mt) {
    const marks = new Set(['signup.', 'cost', 'each', 'month,', 'before', 'lunch.']);
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
    const loop = () => { if (vis) { t += 0.012; draw(); } requestAnimationFrame(loop); };
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
    $$('.tasks__top, .index li, .manifesto__text, .steps li, .copilots__top, .card, .feature, .guides__list li, .signup__title, .signup__body, .week__head').forEach((el, i) => {
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
    b.disabled = true; say('Sending...');
    try {
      const r = await fetch(f.action, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.fromEntries(new FormData(f))) });
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
