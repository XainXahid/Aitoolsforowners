# A.T.F.O. Newsletter: guide for Grok

This is the brief for writing and sending **The A.T.F.O. Newsletter**. Follow it each time you make an issue.

## What the newsletter is

- **One stack. Every week.** Each issue covers one task a small business owner wants off their plate, the 2 to 4 tools that handle it, 3 setup steps, and one prompt they can copy.
- **Reader:** a busy owner (contractor, realtor, salon, clinic, shop, agency) who is not technical. They read on a phone, between jobs.
- **Length:** about a 3-minute read. Shorter is better.
- **Send:** weekly, Tuesday morning in the readers' main time zone.

## Every issue, step by step

1. **Pick the task.** Choose one of the 16 tasks in `assets/data.js` (slugs listed below). Look in `newsletter/issues/` first and don't repeat a task sent in the last 8 issues. Seasonal hints: invoicing and bookkeeping near month and quarter end, reviews and social media before busy seasons, payroll near the start of the year.
2. **Start the draft.** From the repo root:
   ```
   python3 newsletter/render.py draft <slug> --issue <next issue number>
   ```
   This writes `newsletter/issues/issue-<n>-<slug>.json` with the tools, steps, setup time and links already filled in from the site.
3. **Write the fields marked `WRITE:`** using the rules below. Don't change tool names, links or steps unless the site data changed.
4. **Build it:**
   ```
   python3 newsletter/render.py build newsletter/issues/issue-<n>-<slug>.json
   ```
   It refuses to build while any `WRITE:` is left, and prints notes for anything too long. Output: `newsletter/out/issue-<n>.html` (the email) and `issue-<n>.txt` (plain-text version).
5. **Run the pre-send checklist** (bottom of this file).
6. **Send.** In the email platform, create a campaign, choose "custom HTML" or "code your own", paste the HTML file, paste the `.txt` as the plain-text version, and use the printed subject and preheader. Send a test to yourself, check it on a phone, then schedule.
7. **Commit** the issue JSON so the next issue knows what was already sent.

Task slugs: `lead-follow-up`, `real-estate-leads`, `invoicing`, `bookkeeping`, `scheduling`, `social-media`, `customer-support-email`, `website-chat`, `meeting-notes`, `email-marketing`, `online-store-support`, `proposals-contracts`, `reviews`, `client-intake`, `writing-content`, `payroll`.

## Fields and how to write them

| Field | Limit | How to write it |
| --- | --- | --- |
| `subject` | under 60 characters | Name the outcome or the time it saves. Patterns: "The one-hour fix for leads that go cold", "Stop chasing invoices by hand", "Your inbox, answered before lunch". No prices, no ALL CAPS, no emoji spam, no "Issue #12". |
| `preheader` | under 110 characters | Adds to the subject; never repeats it. Example: "Three tools, three steps, and a prompt that writes your follow ups for you." |
| `headline` | one line, about 8 words | The problem in the owner's words, said boldly: "Stop losing leads you already paid for." |
| `intro` | 2 short paragraphs, under 90 words total | First name the pain in one sentence. Then say what the stack does and how long it takes to set up. |
| `tools` | prefilled | Leave as is. The `why` line is what the tool does in this stack. |
| `steps` | prefilled, 3 steps | Leave as is unless a step is unclear. Each step starts with a verb. |
| `prompt.text` | about 40 to 70 words | One prompt the owner can paste into Claude, ChatGPT, Gemini or Grok today. Give the AI a role, the task, the format, and a length. Use `[square brackets]` for the parts they fill in. |
| `tip` | optional | A quick win they can do in 5 minutes without new tools. Delete the whole `tip` block to skip it. |
| `cta_label` / `cta_url` | prefilled | Points to the task page on the site. Links to our own site get tracking tags automatically. |
| `sponsor` | optional | Only for a paid placement. Add `{"name": "...", "url": "...", "body": "one or two sentences"}`. It is labeled "Sponsored" automatically. |
| `mailing_address` | required | The business's real postal address. Commercial email law (such as CAN-SPAM in the US) requires it. |
| `unsubscribe_url` | required | The email platform's unsubscribe merge tag, for example `*|UNSUB|*` in Mailchimp. Check your platform's help docs for its tag. |

## Header logo

The email header shows the "Ai Tools For Owners" logo as an image at `https://aitoolsforowners.com/email/logo-white.png` (the file is `public/email/logo-white.png` in the website). Deploy the website first so the image is live; until then it shows the text "Ai Tools For Owners" instead. To use a different image, set `logo_url` in the issue's JSON file.

## Voice

- Plain English, short sentences, second person ("you"). Write like a helpful friend who runs a business, not a tech blog.
- Lead with time saved and the outcome. **Don't put prices in the subject, preheader, headline or intro.** The task page has current prices for anyone who wants them.
- Never invent statistics, quotes, customer stories or results. If you make a claim, keep it general and true.
- No hype words: "revolutionary", "game-changer", "unlock", "supercharge", "10x".
- Keep the affiliate disclosure (it's built into the footer). Never hide that links can pay us.
- One idea per issue. If you're tempted to add a second stack, save it for next week.

## Pre-send checklist

- [ ] The build ran with no errors, and you've read every note it printed.
- [ ] The subject is under 60 characters and reads well on a phone.
- [ ] The intro has no prices and no invented numbers.
- [ ] The prompt works: paste it into an AI assistant once and read the answer.
- [ ] `mailing_address` and `unsubscribe_url` are real, not placeholders.
- [ ] A test email looks right on a phone and on desktop, and every link opens the right page.
- [ ] The plain-text version is attached.
- [ ] The issue JSON is committed to `newsletter/issues/`.

## Prompt you can give Grok each week

> Make this week's A.T.F.O. newsletter. Follow `newsletter/GROK_NEWSLETTER_GUIDE.md` in the aitoolsforowners repo. Pick a task we haven't sent in the last 8 issues, create the draft with `newsletter/render.py`, write every `WRITE:` field following the guide's voice rules, build it, and show me the subject, preheader and a phone screenshot before scheduling it for Tuesday 7:00 AM.
