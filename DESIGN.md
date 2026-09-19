# Design — Link Log

<!-- impeccable:design-schema 1 -->

The precise typographic register (user-pinned replacement; the owner vetoed the field-notebook world, seed key `d84d0804`). A personal link library presented as a ruled index: no faux materials, no ornament, one working accent, and every saved link as a numbered row you can scan in seconds.

## World

- **Surface**: near-white paper ground (`#f6f6f4`), white surfaces, slate ink. Plain — no grid, texture, glass, gradients, or decorative chrome. Depth comes from one hairline rule and a soft 2-layer shadow on controls.
- **Scene**: used at a desk under daylight and casually on a phone. Light is the default; dark is a full alternative theme, not a tint.
- **Accent law**: electric blue (`#2e59ff` light / `#6c8bff` dark) is the only working color — active tabs, links on hover, focus, selection, masthead count numerals, the finder focus ring. Color is reserved for state and identity, never decoration.
- **Type identities**: content types (reel, repo, …) are carried by drawn line-glyphs in neutral ink; the glyph turns blue only when that type filter is active. No per-type color carnival.
- **Honesty**: degraded entries get a plain outlined "partial" label in amber; unfetchable links live in an "Unlogged entries" section. No stamps, no rotations.

## Typography

- **Display**: Bricolage Grotesque 600–700 (variable, self-hosted) for the wordmark, mastheads, and the large count numerals that open each section. Chosen outside the familiar display-face list; letter-spacing −0.02/0.03em.
- **Instruments**: IBM Plex Mono 400/500/600 (self-hosted) reserved for serials, counts, dates, tags, the finder hint. Used without uppercase-tracking theatrics.
- **Reading/UI**: system sans stack. 15px base, line-height 1.55.

## Tokens

`--bg --surface --surface-2 --ink --ink-dim --ink-faint --line --line-strong --accent --accent-hover --accent-ink --accent-soft --warn --ok --focus`, defined per theme. Contrast floor (verified by audit): body 16.5:1, dim 7.2:1, faint 4.6:1 light / 4.9:1 dark, accent count numerals 4.9:1.

## Components

- **Sticky header**: wordmark ("Link Log /index"), underlined finder with `/` shortcut and orange-blue caret, live mono stats (match count · sections), theme toggle.
- **Tab strip**: sections as underline-active tabs with mono counts — horizontal scroll on narrow screens.
- **Tool strip**: type chips (glyph + name + count) and tag chips with counts (26 shown, expandable).
- **Course**: active filters as solid blue-outlined chips + "retrace" clear — plain, no dashed borders.
- **Index rows**: the core component — a ruled row grid `[serial | glyph | title+note | tags | meta]` separated by hairline rules; hover tints the row and turns the title blue. Serials are the real `L###` data ids. No cards.
- **Masthead**: large blue Bricolage count numeral + Bricolage title + quiet annotation.
- **Unlogged entries**: mono rows with amber status tags.

## States & Motion

- Hover: row tint + title accent (150–200ms); chips border-accent. Focus: 2px blue ring. Empty: centered type + solid blue action. Loading: single spinner.
- One authored moment: rows cascade in on load/filter-change (12ms stagger, 320ms, exponential ease-out, capped at 20). `prefers-reduced-motion` disables it.
- Browser surfaces themed: blue selection, blue caret, slim ink scrollbars, offset focus rings.

## Responsive

820px: header compresses (stats hide), rows collapse to `[glyph | content]` with tags/meta on a second line, copy button always visible. 480px: serials hide, single content column. No horizontal scroll at any width (strips scroll internally only).

## Build notes

- Direction contract in `web/index.html` as the first body child; survives the build (grep `d84d0804` in dist).
- Fonts self-hosted (Bricolage variable + 3 IBM Plex Mono weights). Icons are authored inline SVG stamps (`web/src/Icons.jsx`), 1.5–1.7 stroke, one ink language — no emoji.
- Data contract unchanged: `web/public/library.json` from `npm run web:data`.
- Design detector: zero findings on this world.
