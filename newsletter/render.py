#!/usr/bin/env python3
"""Build A.T.F.O. newsletter issues from a small JSON file.

  1) Start a draft from one of the site's stacks:
       python3 newsletter/render.py draft invoicing --issue 13
     -> newsletter/issues/issue-13-invoicing.json  (tools, steps and links filled in)

  2) Write the parts marked WRITE: in that file (subject, preheader, headline,
     intro, prompt, tip).

  3) Build the email:
       python3 newsletter/render.py build newsletter/issues/issue-13-invoicing.json
     -> newsletter/out/issue-13.html  (paste into your email platform as custom HTML)
        newsletter/out/issue-13.txt   (plain-text version)

The build stops with a clear message if anything required is missing or still
says WRITE:. See newsletter/GROK_NEWSLETTER_GUIDE.md for the full brief.
"""
import datetime
import html
import json
import re
import sys
from pathlib import Path
from urllib.parse import urlencode, urlsplit, urlunsplit, parse_qsl

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
SITE = "https://aitoolsforowners.com"
sys.path.insert(0, str(ROOT / "scripts"))
from build import load_data, setup_total, fmt_minutes, difficulty  # noqa: E402

DEFAULTS = {
    "site_url": SITE + "/",
    "scan_url": SITE + "/#scan",
    "unsubscribe_url": "WRITE: your email platform's unsubscribe merge tag, e.g. *|UNSUB|* in Mailchimp",
    "mailing_address": "WRITE: your business mailing address (required by law in commercial email)",
}


# ---------- a tiny Mustache subset: {{var}}, {{#section}}...{{/section}}, {{.}} ----------
TAG = re.compile(r"{{\s*([#/^]?)\s*([\w.]+)\s*}}")


def _lookup(stack, name):
    if name == ".":
        return stack[-1]
    for ctx in reversed(stack):
        if isinstance(ctx, dict) and name in ctx:
            return ctx[name]
    return ""


def _render(tpl, stack):
    out, i = [], 0
    while True:
        m = TAG.search(tpl, i)
        if not m:
            out.append(tpl[i:])
            return "".join(out)
        out.append(tpl[i:m.start()])
        kind, name = m.groups()
        if kind in ("#", "^"):
            depth, j = 1, m.end()
            while depth:
                n = TAG.search(tpl, j)
                if not n:
                    raise ValueError(f"Section {{{{#{name}}}}} is never closed")
                if n.group(2) == name and n.group(1) in ("#", "^"):
                    depth += 1
                elif n.group(2) == name and n.group(1) == "/":
                    depth -= 1
                j = n.end()
            inner = tpl[m.end():n.start()]
            val = _lookup(stack, name)
            if kind == "^":
                out.append("" if val else _render(inner, stack))
            elif isinstance(val, list):
                out.extend(_render(inner, stack + [v]) for v in val)
            elif val:
                out.append(_render(inner, stack + [val]))
            i = j
        else:
            val = _lookup(stack, name)
            out.append(html.escape(str(val)))
            i = m.end()


# ---------- helpers ----------
def utm(url, issue):
    """Tag links to our own site so you can see newsletter traffic in analytics."""
    if not url.startswith(SITE):
        return url
    p = urlsplit(url)
    q = dict(parse_qsl(p.query))
    q.update({"utm_source": "newsletter", "utm_medium": "email", "utm_campaign": f"issue-{issue}"})
    return urlunsplit((p.scheme, p.netloc, p.path, urlencode(q), p.fragment))


def draft(slug, issue):
    stacks, _, _ = load_data()
    s = next((x for x in stacks if x["slug"] == slug), None)
    if not s:
        sys.exit("Unknown task. Pick one of: " + ", ".join(x["slug"] for x in stacks))
    d = {
        "issue_number": issue,
        "date": (datetime.date.today() + datetime.timedelta(days=(1 - datetime.date.today().weekday()) % 7)).strftime("%B %-d, %Y"),
        "slug": slug,
        "subject": "WRITE: under 60 characters, names the outcome (e.g. 'The 55-minute fix for leads that go cold')",
        "preheader": "WRITE: under 110 characters, adds to the subject instead of repeating it",
        "task_label": s["label"],
        "headline": "WRITE: one bold line about the problem this stack solves",
        "intro": ["WRITE: 2 to 3 short sentences. Name the pain, then the promise."],
        "tools": [{"name": t["name"], "url": t["url"], "why": t["why"], "setup": t["setup"], "difficulty": t["diff"]} for t in s["tools"]],
        "setup_total": fmt_minutes(setup_total(s)),
        "steps": s["steps"],
        "prompt": {"text": "WRITE: one copy-and-paste prompt an owner can use today for this task", "works_in": "Claude, ChatGPT, Gemini or Grok"},
        "tip": {"title": "WRITE: optional quick win (delete this whole tip block to skip it)", "body": "WRITE: one or two sentences"},
        "cta_label": "See the full stack",
        "cta_url": f"{SITE}/best-ai-tools-for-{slug}/",
        "web_url": f"{SITE}/newsletter/",
        **{k: v for k, v in DEFAULTS.items() if k not in ("site_url", "scan_url")},
    }
    out = HERE / "issues" / f"issue-{issue}-{slug}.json"
    out.parent.mkdir(exist_ok=True)
    out.write_text(json.dumps(d, indent=2, ensure_ascii=False) + "\n")
    print(f"Draft written: {out.relative_to(ROOT)}\nFill in every field that starts with WRITE:, then run:\n  python3 newsletter/render.py build {out.relative_to(ROOT)}")


def check(d):
    errs, warns = [], []
    need = ["issue_number", "date", "subject", "preheader", "task_label", "headline", "intro", "tools", "steps", "cta_label", "cta_url", "mailing_address", "unsubscribe_url"]
    for k in need:
        if not d.get(k):
            errs.append(f"'{k}' is missing")
    flat = json.dumps(d)
    if "WRITE:" in flat:
        errs.append("some fields still start with WRITE: (" + ", ".join(sorted(set(re.findall(r'"(\w+)": "WRITE:', flat)))) + ")")
    if len(d.get("subject", "")) > 60:
        warns.append(f"subject is {len(d['subject'])} characters; under 60 shows in full on phones")
    if len(d.get("preheader", "")) > 110:
        warns.append("preheader is over 110 characters")
    if not 2 <= len(d.get("tools", [])) <= 4:
        warns.append("aim for 2 to 4 tools")
    if not 2 <= len(d.get("steps", [])) <= 5:
        warns.append("aim for 3 steps (5 at most)")
    if len(" ".join(d.get("intro", [])).split()) > 90:
        warns.append("intro is long; keep it under about 90 words")
    if "[Your" in flat:
        warns.append("replace the [Your ...] placeholders (mailing address, unsubscribe link) before sending")
    if re.search(r"\$\s?\d", flat):
        warns.append("the issue mentions a price; we lead with setup time, so double-check that's intended")
    return errs, warns


def build(path):
    d = {**DEFAULTS, **json.loads(Path(path).read_text())}
    errs, warns = check(d)
    for w in warns:
        print("note:", w)
    if errs:
        sys.exit("Not built:\n- " + "\n- ".join(errs))
    n = d["issue_number"]
    if isinstance(d["intro"], str):
        d["intro"] = [d["intro"]]
    d["steps"] = [{"n": i + 1, "text": t} for i, t in enumerate(d["steps"])]
    for k in ("cta_url", "site_url", "scan_url", "web_url"):
        if d.get(k):
            d[k] = utm(d[k], n)
    for t in d["tools"]:
        t["url"] = utm(t["url"], n)
    if isinstance(d.get("prompt"), str):
        d["prompt"] = {"text": d["prompt"]}
    out_html = _render((HERE / "template.html").read_text(), [d])
    out_dir = HERE / "out"
    out_dir.mkdir(exist_ok=True)
    (out_dir / f"issue-{n}.html").write_text(out_html)
    (out_dir / f"issue-{n}.txt").write_text(plain_text(d))
    print(f"Built newsletter/out/issue-{n}.html and .txt")
    print(f"Subject:   {d['subject']}\nPreheader: {d['preheader']}")


def plain_text(d):
    L = [f"A.T.F.O. — Issue {d['issue_number']} · {d['date']}", "", d["task_label"].upper(), d["headline"], ""]
    L += d["intro"] + ["", "THE STACK"]
    L += [f"- {t['name']} ({t['setup']} setup, {t['difficulty']}): {t['why']}\n  {t['url']}" for t in d["tools"]]
    L += [f"Ready in about {d['setup_total']}.", "", "SET IT UP"] + [f"{s['n']}. {s['text']}" for s in d["steps"]]
    if d.get("prompt"):
        L += ["", "STEAL THIS PROMPT", d["prompt"]["text"]]
    if d.get("tip"):
        L += ["", d["tip"]["title"].upper(), d["tip"]["body"]]
    L += ["", f"{d['cta_label']}: {d['cta_url']}"]
    if d.get("sponsor"):
        L += ["", "SPONSORED: " + d["sponsor"]["name"], d["sponsor"]["body"], d["sponsor"]["url"]]
    L += ["", f"Want picks for your business? Free scan: {d['scan_url']}", "",
          "Some links are affiliate links. We may earn a commission at no cost to you.", d["mailing_address"], f"Unsubscribe: {d['unsubscribe_url']}"]
    return "\n".join(L) + "\n"


if __name__ == "__main__":
    a = sys.argv[1:]
    if len(a) >= 2 and a[0] == "draft":
        draft(a[1], int(a[a.index("--issue") + 1]) if "--issue" in a else 1)
    elif len(a) == 2 and a[0] == "build":
        build(a[1])
    else:
        print(__doc__)
