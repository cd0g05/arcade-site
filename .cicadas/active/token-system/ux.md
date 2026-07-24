---
summary: "Token balance/notifications ride the existing arcade header (Light Film Room + pixel-layer system, JetBrains Mono / Press Start 2P). New admin dashboard at dev.cartercripe.com/arcade reuses the same design tokens in a denser, data-table-heavy layout: user list -> transaction drill-down, achievement builder as an inline criteria-row editor. Discord bot has no visual surface (its 'UX' is message copy, covered in Copy & Tone)."
phase: "ux"
when_to_load:
  - "When designing or reviewing journeys, flows, states, copy, and interaction constraints."
  - "When implementation questions depend on experience details rather than product goals alone."
depends_on:
  - "prd.md"
modules:
  - "Arcade site header/hub (token balance, transaction toasts)"
  - "New admin dashboard (dev.cartercripe.com/arcade)"
  - "Discord bot message copy (no visual surface)"
index:
  design_goals: "## Design Goals & Constraints"
  journeys: "## User Journeys & Touchpoints"
  information_architecture: "## Information Architecture"
  key_flows: "## Key User Flows"
  ui_states: "## UI States"
  copy_tone: "## Copy & Tone"
  visual_design: "## Visual Design Direction"
  mockups: "## HTML/CSS Mock-Ups"
  consistency: "## UX Consistency Patterns"
  accessibility: "## Responsive & Accessibility"
next_section: "done"
---

# UX Design: Token System

**Pace: `all`** — drafting straight through without per-section stops; full doc presented for review at the end of the spec chain (Tasks).

## Progress

- [x] Design Goals & Constraints
- [x] User Journeys & Touchpoints
- [x] Information Architecture
- [x] Key User Flows
- [x] UI States
- [x] Copy & Tone
- [x] Visual Design Direction
- [x] HTML/CSS Mock-Ups
- [x] UX Consistency Patterns
- [x] Responsive & Accessibility

---

## Design Goals & Constraints

**Primary goal:** On the arcade site, the token system should feel like ambient positive feedback — numbers ticking up while you play, never a gate you have to think about. On the admin dashboard, it should feel like a fast, dense, no-nonsense internal tool: Carter needs to scan a user's history and edit config in seconds, not click through wizards.

**Design constraints:**
- Arcade-site surfaces must extend the existing **Light Film Room + pixel-layer** system already established in `src/styles/tokens.css` (see Visual Design Direction) — no new visual language for player-facing balance/toast UI.
- Admin dashboard is a new surface (`dev.cartercripe.com/arcade`) but should reuse the same design tokens for brand consistency, even though its density and layout patterns differ (data tables, forms) from the game-focused hub.
- Small trusted user base (~5-20) means no onboarding flow complexity is warranted — login is one click, nothing to configure.
- Discord bot has no visual UI; its experience is entirely message copy (channel posts, DMs) — covered under Copy & Tone, not as screens.

---

## User Journeys & Touchpoints

### Casual Player — First Balance Growth

**Entry point:** Lands on arcade hub, clicks "Sign in with Google" in the header (new element, existing header layout).
**First touchpoint:** Header now shows a token balance pill (LED-style square indicator + count, matching the existing 8px LED convention) next to the sign-in state.
**Key moment:** Plays Dino Run, beats their first-ever high score, sees a brief toast slide in from the balance pill: `+15 High Score: Dino Run`. This is the moment they understand tokens exist and are earnable.
**Exit state:** Balance visibly higher than session start; user has an intuitive (not explained) sense that playing = earning.
**Pain points to design around:** Toasts must not steal keyboard focus from an active game (breaks the click-to-wake input model) — render as non-interactive, auto-dismissing, `aria-live="polite"` announcements only.

---

### Discord-Native Player — Score to Bounty

**Entry point:** Posts a score in the family Discord channel, same as always — no arcade-site visit required.
**First touchpoint:** N/A (no screen) — the bot's reply message in-channel is the entire touchpoint.
**Key moment:** Sees the bot's public bounty message (`"Beat Carter's score for a 10 token bounty"`) and, later, a confirmation reply when they claim it.
**Exit state:** Token balance updated server-side; visible only if/when they later visit the site.
**Pain points to design around:** Since there's no screen, all clarity has to live in bot message copy — a player should never be confused about whether their score counted (see Copy & Tone for exact bot message templates).

---

### Carter (Admin) — Tune the Economy

**Entry point:** Navigates directly to `dev.cartercripe.com/arcade`, authenticated as the elevated admin account.
**First touchpoint:** User list view — dense table, sortable by balance / last active.
**Key moment:** Clicks a user row, sees their full transaction log inline (no page navigation), spots an achievement that never fired, jumps to the achievement builder tab, adds a criteria row, sees it apply immediately (no redeploy, no confirmation modal beyond a lightweight save state).
**Exit state:** Confident the economy is correctly configured; can verify by watching the next score submission trigger the new criteria.
**Pain points to design around:** Manual balance edits are consequential (they're logged and visible to the user) — needs a confirm step, but a lightweight one (inline "Confirm: 40 -> 55?" not a full modal dialog), since this is a single trusted operator, not a multi-admin system needing heavy guardrails.

---

## Information Architecture

### Arcade Site (extends existing hub)

```
Arcade Hub (existing)
├── Header (existing) + [Sign in with Google] + [Token Balance Pill]
├── Hub cartridges (existing, now token-gated: -1 per play)
├── Cabinets (existing, now token-gated: -3 per play)
├── Games Tab (existing per Handoff doc) — daily leaderboards, score submission, riddles/tasks list
└── Account (new, minimal) — link Discord, view own transaction log
```

### Admin Dashboard (new)

```
dev.cartercripe.com/arcade
├── Users — list (balance, last active) -> click-through transaction drill-down
├── Games — per-game config (cost, achievement builder criteria rows)
├── Leaderboards — daily leaderboard history, edit/delete a bad entry
├── Bot Log — read-only Discord bot action feed
└── Analytics — most-played games, participation counts, first-place counts
```

**Navigation model:** Left sidebar (tab-per-top-level-area), consistent with a standard internal-tool layout — deliberately different from the arcade site's card-grid hub nav, since this is Carter's own working tool, not a public-facing surface.
**Key entry points:** Direct URL only; no discovery/link from the public arcade site (admin surface is not advertised to players).

---

## Key User Flows

### Flow 1: Score Submission -> Achievement Check (Happy Path)

1. Player finishes a game on-site (or bot submits on their behalf from a Discord post).
2. System records the score, checks it against that game's active achievement criteria rows.
3. If a criteria threshold/gap is newly met and not yet awarded to this user, a transaction is created and (if on-site) a toast fires.
4. Player's balance pill updates in place, no reload.

**Alternate path A:** Score does not meet any criteria -> no award, no toast, score still recorded for leaderboard purposes.
**Alternate path B:** Score is a new daily-game submission and 2+ people have submitted today -> leaderboard recalculates; if this score is the new top, top-score award fires per FR-3.3/FR-6.3.

---

### Flow 2: Admin Adds an Achievement Criteria Row

1. Carter opens Games -> selects a game -> Achievement Builder tab.
2. Clicks "Add criteria," fills inline row: mode (Threshold / Interval-Gap), value, award amount, one-time toggle (defaults on, since MVP achievements are always one-time per FR-3.2).
3. Saves — row appears in the live list immediately, badge shows "Active."
4. Next matching score submission from any user is checked against it automatically.

---

### Flow 3: Admin Manual Balance Edit

1. Carter opens a user's transaction drill-down, clicks "Adjust balance."
2. Inline field appears with current balance pre-filled; Carter types new value.
3. Inline confirm: "Confirm: 40 -> 55?" [Confirm] [Cancel].
4. On confirm, a transaction row is written (`"Admin adjusted 40 -> 55"`), visible immediately in both this view and (next time they check) the user's own log.

---

## UI States

### Token Balance Pill (arcade site header)

| State | Trigger | What the User Sees |
|-------|---------|-------------------|
| **Signed out** | No session | Pill hidden; "Sign in with Google" shown instead |
| **Loading** | Session resolving | Pill shows a pixel-dot pulse placeholder (reuse existing LED-pulse pattern) |
| **Populated** | Balance loaded | LED square (lit green) + numeric balance |
| **Toast (transient)** | New transaction | Small `aria-live="polite"` slide-in below the pill, auto-dismisses ~3s, `prefers-reduced-motion` disables the slide (fades instead) |
| **Insufficient balance** | Player tries to spend below cost | Game card shows a brief inline "Need {N} tokens" veil instead of starting; does not steal focus |

### Admin User Transaction Log

| State | Trigger | What Carter Sees |
|-------|---------|-------------------|
| **Empty** | Brand-new user, no transactions yet | "No activity yet" row, muted text |
| **Loading** | Fetching log | Skeleton rows (3-4 grey bars) |
| **Populated** | Transactions present | Sortable table: timestamp, amount (+/- colored), reason, source |
| **Error** | Fetch failed | Inline error row + "Retry" link |
| **Editing (balance adjust)** | Carter clicks "Adjust balance" | Inline input + Confirm/Cancel replaces the static balance display |

### Riddles/Tasks List (Games Tab)

| State | Trigger | What the User Sees |
|-------|---------|-------------------|
| **Empty** | No content items seeded yet (expected at initial launch — content authoring is deferred, per PRD Open Questions) | Same empty-state convention as other lists: muted "Nothing here yet" text, no error |
| **Populated** | One or more active `content_items` rows exist | List of prompts with award amount; riddles/trivia show a "completed today" badge once done; tasks never show that badge (unlimited repeats) |
| **Submitting** | User submits an answer | Inline disabled state on the submit control, no full-page block |
| **Already completed today** | Riddle/trivia re-attempted same day | Inline message, no token award, per FR-3.4 once-per-day rule |

### Achievement Builder Criteria List

| State | Trigger | What Carter Sees |
|-------|---------|-------------------|
| **Empty** | Game has no criteria configured | "No achievements configured for this game yet" + Add button |
| **Populated** | Criteria rows exist | List of rows, each showing mode/value/award/status badge |
| **Saving** | Row being added/edited | Row dims slightly, disabled inputs, no full-page block |
| **Save error** | Write failed | Inline error under the row, row reverts to prior saved state |

---

## Copy & Tone

**Voice (site):** Terse, technical-readout style — matches the existing JetBrains Mono "stat ticker" feel already on the hub. Never cutesy, never apologetic.
**Voice (admin dashboard):** Same terseness, more utilitarian — this is Carter's own tool, copy can assume domain familiarity.
**Voice (Discord bot):** Slightly more personable since it's posting in a family channel, but still short — one line where possible.

**Key principles:**
- Every award/spend toast states the exact reason and amount — never a vague "You earned tokens!"
- Admin destructive/consequential actions (balance edit) get an explicit before -> after confirmation, not a generic "Are you sure?"
- Bot messages never expose internal mechanics (no "criteria met" language) — plain-language, in-character for a casual channel.

**Critical copy samples:**

| Context | Copy |
|---------|------|
| Balance toast (achievement) | `+15 High Score: Dino Run` |
| Balance toast (daily login) | `+10 Daily Login` |
| Balance toast (spend) | `-3 Cabinet: Setrit` |
| Insufficient balance veil | `Need 3 tokens` |
| Admin balance edit confirm | `Confirm: 40 -> 55?` |
| Admin balance edit log entry | `Admin adjusted 40 -> 55` |
| Bot: bounty posted | `Beat Carter's score for a {N} token bounty.` |
| Bot: bounty prompt (DM to Carter) | `Set a bounty for today's {game}? Reply with a number.` |
| Bot: score logged confirmation | `Logged {score} for {game}. +5 for posting.` |
| Empty achievement list (admin) | `No achievements configured for this game yet.` |

---

## Visual Design Direction

**Style:** Pixel-layer on top of Light Film Room (per existing `Arcade Handoff.md` system) for the arcade site; a plainer, denser variant of the same tokens for the admin dashboard (no scanline overlay, no hard offset shadows — those are reserved for game surfaces per the existing "deliberately NOT changed" rule).
**Color palette:** Reuse `--base #fff`, `--panel #f4f4f5`, `--border #d4d4d8`, `--ink #18181b`, `--sub #52525b`, `--pink #be185d` / `--pink-dark #9d174d`, `--green #047857` directly from `src/styles/tokens.css`. Positive transactions in `--green`, negative in `--pink-dark`, admin-adjustment rows in `--sub` (neutral, since they're neither an earn nor a spend in the gameplay sense).
**Typography:** `--font-ui` (JetBrains Mono) for all balance figures, transaction tables, and admin UI — matches the "technical readout" convention already established for pills/stats/ticker. `--font-display` (Press Start 2P) reserved for headings only, sparingly, consistent with existing usage.
**Spacing & density:** Site-side balance/toast: compact, matches existing header chrome. Admin dashboard: comfortable-dense — real data tables, not touch-optimized card grids (this is a desktop-first internal tool).
**Existing design system:** Light Film Room + pixel layer, as documented in `Arcade Handoff.md` §5 and implemented in `src/styles/tokens.css`.

**Mood reference:** Site-side additions should be invisible as "new" — a player shouldn't be able to tell the balance pill wasn't in the original mockup. Admin dashboard: "internal ops tool," same DNA, different outfit.

---

## HTML/CSS Mock-Ups

### Mock-Up 1: Admin Dashboard — Users List + Transaction Drill-Down

**Artifact path:** `.cicadas/drafts/token-system/mockups/admin-users.html`
**Viewport target:** Desktop, 1280px+ (admin dashboard is desktop-first)
**Purpose:** Makes concrete the two-pane users list -> transaction log flow (Flow 3), the balance-edit inline confirm pattern, and the reused Light Film Room token palette in a denser admin layout.
**Notes:** Static mock with placeholder data; sidebar nav shows all five admin sections per the Information Architecture tree, only "Users" is populated.

### Mock-Up 2: Arcade Site — Token Balance Pill + Toast

**Artifact path:** `.cicadas/drafts/token-system/mockups/site-balance-pill.html`
**Viewport target:** Desktop 1280px, with a mobile 375px stacked variant in the same file
**Purpose:** Makes concrete the header balance pill (Populated + Loading states) and the transient achievement toast (Flow 1, step 3), styled to blend into the existing hub header.
**Notes:** Static mock; toast shown mid-animation via a `.toast--visible` class snapshot rather than live JS.

---

## UX Consistency Patterns

### Button Hierarchy
- **Primary action** (site): hard-offset-shadow pixel button on hover/active, matches existing cabinet card CTA styling.
- **Primary action** (admin): flat panel button, `--pink` fill, no offset shadow — admin surfaces don't carry the game-surface pixel treatment.
- **Destructive/consequential action** (admin balance edit): requires the inline before -> after confirm step; no separate modal.

### Feedback Patterns
- **Success (site):** Transient toast under the balance pill, `aria-live="polite"`, ~3s auto-dismiss, fades instead of slides under `prefers-reduced-motion`.
- **Success (admin):** Inline row-level confirmation (e.g. row briefly highlights `--green` border on successful save), no toast stack — admin actions are infrequent enough not to need a notification system.
- **Error (both):** Inline, next to the failing element/row; no full-page error states for this scale of app.

### Form Patterns
- **Validation timing:** On submit for achievement criteria rows (values are numeric, easy to validate synchronously); inline for the balance-edit confirm (value must differ from current to enable Confirm).
- **Required fields:** All achievement builder fields required; no partial-save state.

### Navigation Patterns
- **Active state (admin sidebar):** Filled `--pink` left-border + bold label, matches the LED-lit-active convention already used for hub cartridges.
- **Active state (site):** Existing hub convention (LED indicator) extends to show "you have an active session" state, not introduced net-new.

### Modal & Overlay Patterns
- **When to use modals:** Not used for the balance-edit confirm (inline instead, per Design Goals — this is a single trusted operator, heavy guardrails aren't warranted). Reserved only for genuinely destructive, hard-to-reverse admin actions if any emerge in Tech Design (e.g. deleting a daily leaderboard entry).
- **Dismissal:** ESC or click-outside for any modal that does end up being used, consistent with the existing fullscreen-game ESC convention on the site.

---

## Responsive & Accessibility

**Breakpoints:**

| Breakpoint | Width | Layout |
|-----------|-------|--------|
| Mobile | < 640px | Site: balance pill collapses to icon+number only, toast becomes a top banner. Admin: not a target — dashboard is desktop-only for this scale of use. |
| Tablet | 640-1024px | Site: unchanged from existing hub responsive behavior. Admin: sidebar collapses to icon rail. |
| Desktop | > 1024px | Site: full pill + toast as designed. Admin: full sidebar + two-pane layout. |

**Accessibility standards:** WCAG 2.1 AA, matching the existing arcade site commitment (per `Arcade Handoff.md` §6).

**Key requirements:**
- Keyboard navigation: full, both surfaces (admin dashboard is a new surface and must meet the same bar as the game site).
- Screen reader support: required — balance changes announced via `aria-live="polite"` (not `assertive`, to avoid interrupting active gameplay narration/focus).
- Color contrast: AA minimum; reuse the already-fixed `--sub #52525b` (darkened during the launch a11y pass per `.cicadas/index.json` history) rather than a lower-contrast grey for admin secondary text.
- Touch targets: 44x44px minimum on any mobile-responsive site-side controls; not a constraint for the desktop-only admin dashboard.
- Reduced motion: `prefers-reduced-motion` disables the toast slide-in (fade only) and any LED-pulse loading states, consistent with the existing site convention.
