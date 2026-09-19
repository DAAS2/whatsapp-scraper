# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

A single user: the owner, a developer/creator. They habitually send themselves links in their own WhatsApp "Message yourself" chat (reels, posts, repos, papers, articles — mostly Instagram reels). They visit this surface to find a saved resource fast, skim what they saved recently by topic, and jump into the link.

## Product Purpose

A private link library that harvests links from the owner's WhatsApp self-chat, scrapes each one, uses Gemini to classify and outline them into topical sections, and renders the whole collection as a browsable library (markdown + web UI). Success = the user finds and reuses a saved link in seconds, and sees their saved stream as an organized knowledge base instead of a message log.

## Positioning

The only path from "I sent a link to myself" to a curated, categorized personal library with zero manual sorting: the AI is the curator; the human's only habit is the one they already have. This claim is impossible for bookmark managers to copy because the source of truth is the WhatsApp self-chat, not a browser.

## Operating Context

Runs on the owner's Windows dev machine (Node pipeline: collect → extract → scrape → classify → outline → render → web). Data is static JSON (web/public/library.json) served by a Vite SPA — no backend, no accounts, no multi-user anything. Re-runs are cheap because scraping and classification are cached. The UI is used casually over coffee (mobile) and next to an editor (desktop).

## Capabilities and Constraints

- Typical volume: ~100–500 links; current run: 99 links, ~90% Instagram reels.
- Search, tag filter, type filter, section navigation; links open externally.
- Static data refresh happens via CLI, never in-app.
- Scraping may be degraded (login-walled sites get partial metadata) — must be visibly labeled, never faked.
- No invented content: every title, summary, count, and date in the UI comes from real scraped/classified data.
- Single surface: the library page itself. No onboarding, no accounts, no admin.

## Brand Commitments

None established — no name, logo, or brand asset exists. Voice (inferred from session): plain, personal, technical, a little warm. *(Inferred — interview substituted; user said "continue the redesign".)*

## Evidence on Hand

Real content: `data/links.classified.json` (99 links with scraped captions + Gemini titles/summaries/tags), `data/outline.json` (6 topical sections with subsections), `web/public/library.json` (built for the UI). Real engagement numbers (stars, likes, comments) from scraping. Source of truth for dates/counts is the data, never hand-authored.

## Product Principles

1. **Retrieval over collection.** The library exists to find and use links, not admire a count.
2. **The AI curates, the human judges.** Gemini proposes sections and summaries; the user edits truth by looking.
3. **Show degraded data as degraded.** A partial scrape is labeled partial, never silently prettified.
4. **Seconds matter.** Scan, filter, open. The UI serves the impatient owner.
5. **A one-person tool stays one-person.** No growth features, no engagement hooks.

## Accessibility & Inclusion

Keyboard-first interactions (/ for search, Esc to clear), browsable without a mouse, both dark and light themes kept at readable contrast, `prefers-reduced-motion` respected. Mobile is a first-class layout, not a shrunken desktop.
