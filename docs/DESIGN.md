# CORA Design Direction

## Visual Tone

CORA uses a vintage, warm color direction while keeping the overall UI and interaction style modern.

## Main Colors

- `#274137`
- `#9db496`
- `#cbe3c1`
- `#f8d694`
- `#ba6931`
- `#6f3a28`

These colors are selected to communicate a warm, vintage atmosphere.

## Color Palette

Palette 1
- `#FCD8C0`
- `#DBB98B`
- `#85A1A5`
- `#3C5C5F`
- `#6F3A28`
Palette 2
- `#274137`
- `#7F9175`
- `#F8D694`
- `#BA6931`
- `#121919`
Palette 3
- `#E0DDAA`
- `#CBE3C1`
- `#9DB496`
- `#A27B47`
- `#8A5634`

Main colors were picked from these palettes.

## Additional Accent Tokens

These colors are pulled from the three palettes above and added to the token system to resolve specific contrast and hierarchy gaps:

- `#121919` — True dark (from Palette 2); used for deep background moments (e.g. CtaBanner dark section). Gives the darkest surface a real near-black anchor instead of stopping at forest green.
- `#3C5C5F` — Dark teal (from Palette 1); replaces sage (`#9DB496`) as `--accent-secondary`. Sage was too muted to carry accent weight on cream backgrounds. Dark teal reads as authoritative — used for on-chain phase markers, secondary stat bars, and Escrow/Settlement highlights.
- `#E0DDAA` — Warm ecru (from Palette 3); used as an elevated surface highlight. Slightly more alive than `#fffaf0` (near-white) on warm cream layouts — applied to scientist card portrait areas for a vintage academic feel.

## Character and World Concept

- Characters are historical scientists from the past.
- Each scientist has a thematic "base" that can be destroyed in battle.
- The base should represent that scientist's iconic discovery.

Example:
- Alan Turing -> base concept: computer.

## Typography

- Headline and logo font: `Caprasimo`
- Body and UI font: `Gabarito`

This pairing keeps the identity expressive at display level while preserving readability for gameplay and interface text.

## Landing Page Art Direction

The landing page follows a **collectible battle-game** aesthetic inspired by Axie Infinity / Pixelmon-style splash pages, not a SaaS or dev-dashboard look. The tone is cinematic, playful, and world-building — it should feel like a game you want to play, not a product you evaluate.

### Section Rhythm

The page alternates between dark cinematic moments and warm collectible/world-building moments:

```
Hero (dark cinematic)  →  TokenMarquee (dark strip)
  →  Features / Roster (WARM cream)  →  HowItWorks (WARM cream)
  →  VideoSlot (DARK arena)  →  CtaBanner (DARK)  →  Footer (dark)
```

- **Dark sections** use the forest/near-black backgrounds (`#0f1a14`, `#0a1410`, `#080c09`) with light text (`#f4f0e6`). These are for cinematic hero, arena/battle demo, and final CTA.
- **Warm sections** use cream/parchment backgrounds (`--warm-bg: #faf3e6`, `--warm-surface: #f0e8d4`) with dark bark text (`--warm-text: #3a2518`). These are for the roster and battle-flow explainer.

### Warm Surface Tokens

These CSS variables define the warm cream/parchment surface system:

| Token | Value | Usage |
|---|---|---|
| `--warm-bg` | `#faf3e6` | Section background (parchment) |
| `--warm-surface` | `#f0e8d4` | Card/panel surface on parchment |
| `--warm-border` | `rgba(111, 58, 40, 0.18)` | Subtle bark-toned borders |
| `--warm-text` | `#3a2518` | Primary text on warm surfaces |
| `--warm-muted` | `#8a7a68` | Secondary/muted text on warm surfaces |
| `--warm-card-shadow` | `rgba(111, 58, 40, 0.12)` | Card shadow color |

### Panel & Card Systems

Two distinct card/panel systems coexist, each used in specific contexts:

**`.frame-cut`** — HUD-style clipped corners. Used for:
- Dark/battle sections (VideoSlot, arena UI)
- Technical stat panels
- Demo/video frames
- Any element that should feel like in-game HUD

**`.game-card`** — Rounded collectible cards. Used for:
- Warm sections (roster, battle explainer)
- Scientist character cards
- Stage/phase panels on cream backgrounds
- Any element that should feel like a physical collectible

`.game-card` properties:
- `border-radius: 20px`
- `border: 3px solid var(--tone-bark)`
- `background: var(--warm-surface)`
- Cartoon offset shadow (`0 4px 0` + diffuse)
- Hover lifts card upward with deeper shadow

### Button Styles

**`.btn-game`** — Chunky game-style buttons. Properties:
- `border-radius: 14px`
- `border: 3px solid`
- `padding: 14px 32px`
- Font: Gabarito, 900 weight, uppercase, tracked
- Hover lifts 3px with deepened shadow

Two variants:
- **`.btn-game-primary`**: Clay-to-bark gradient, light text, dark bottom-edge shadow (`0 4px 0 #5a2e1e`), warm glow
- **`.btn-game-secondary`**: Transparent with cream border, light text, subtle shadow

Use `.btn-game` for hero CTAs, final CTA, and prominent actions. Keep the existing rounded-full pill buttons for navbar and subtle inline actions.

### Background Textures

- **`.paper-grain`**: Subtle SVG noise texture overlay (via `::before` pseudo-element, `opacity: 0.35`). Used on warm sections to give a vintage paper feel.
- **Dot pattern**: `radial-gradient(circle, var(--tone-bark) 1px, transparent 1px)` at `28–32px` spacing, very low opacity (`0.05–0.06`). Used as secondary texture on warm sections.
- **`.arena-grid`**: Existing 42px line grid. Reserved for dark/battle sections only — do NOT use on warm surfaces.

### Hero Composition

The hero uses layered depth for a cinematic game-splash feel:

1. **Background**: Oversized CORA emblem letter (`C`, ~40vw, near-invisible `opacity: 0.04`) with `animate-slow-spin` (90s rotation). Scattered science doodle emojis with drift animation. Sparkle dots.
2. **Midground**: Cursor-following orb glow (preserved from original). Radial gradient vignette.
3. **Foreground**: Floating collectible mini-cards (one per scientist) with `animate-float-card` bobbing. Decorative base-object emojis.
4. **Center content**: Eyebrow → Title → Tagline → Subcopy → CTA buttons.

### Animations

New animation utilities added for the game-site direction:

| Class | Keyframe | Duration | Purpose |
|---|---|---|---|
| `.animate-float-card` | `floatCard` | 4.5s | Gentle vertical bobbing for floating cards |
| `.animate-sparkle` | `sparkle` | 2.2s | Fade-in/scale sparkle dots |
| `.animate-slow-spin` | `slowSpin` | 90s | Very slow rotation for background emblem |
| `.animate-drift-x` | `driftX` | 6s | Subtle horizontal drift for doodles |

Existing animations (`.animate-orb-breath`, `.animate-card-reveal`, `.accent-bar-slide`, etc.) are preserved and still used.

### Placeholder Art Strategy

Since final character illustrations and game art do not exist yet, the landing page uses CSS-based placeholder visuals:

- **Chibi silhouettes**: Circular emoji avatar (e.g. 🧠, 🧪, ⚡) inside a bordered circle + rectangular "coat" body shape below
- **Base object icons**: Emoji representation of each scientist's base (🌀, ☢️, 💻)
- **Rarity badges**: Styled `<span>` with border and uppercase text ("Legendary", "Epic", "Rare")
- **HP bars**: Thin rounded gradient bars
- **Floating mini-cards**: Small collectible card shapes with avatar + name + archetype + HP bar

All placeholder elements are structured so a future `<Image>` or `<img>` tag can replace the emoji/shape with real illustrated art. The `emoji` and `baseEmoji` fields in `ScientistProfile` (in `content.ts`) are the swap points.

### Copy Voice

Public-facing copy should sound like a **game** you play, not a protocol you evaluate:

| Avoid (dev/protocol voice) | Prefer (game/player voice) |
|---|---|
| Solana Devnet | A collectible battle game of brilliant minds |
| Match Architecture | How battles unfold |
| 4 phases, 2 on-chain transactions | Pick your mind. Predict the move. Shatter the base. |
| Demo Video | Watch the duel flow |
| Scientist Roster | Meet the minds |
| Off-chain / On-chain | Arena / Blockchain |

Blockchain and technical details can appear as secondary labels or badges, but should never be the primary emotional hook.
