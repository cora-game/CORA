# FE Dev Log

## 2026-04-25 - Frontend stack setup verification and stabilization

### The Change
- Verified [package.json](/d:/projects/Cora/apps/web/package.json) includes the agreed non-optional frontend stack for Solana:
  - `next`, `react`, `react-dom`
  - `framer-motion`
  - `@solana/web3.js`
  - `@solana/wallet-adapter-base`
  - `@solana/wallet-adapter-react`
  - `@solana/wallet-adapter-react-ui`
  - `@solana/wallet-adapter-phantom`
  - `@coral-xyz/anchor`
  - `@tanstack/react-query`
- Confirmed the install avoids `@solana/wallet-adapter-wallets` to prevent the prior Windows install failure path.

### The Reasoning
- We aligned the web stack to Solana-first requirements (Phantom + Devnet flow) instead of EVM tooling.
- We used explicit wallet adapter packages (especially Phantom) for tighter dependency control and improved install reliability on Windows.

### The Tech Debt
- Wallet support is currently Phantom-focused; if multi-wallet support is needed later, we should add adapters incrementally and verify Windows compatibility package by package.
- We still need implementation wiring for `ConnectionProvider` + `WalletProvider` and environment-based RPC config for Devnet.

## 2026-04-26 - MatchSocket Hook & Shared Types

### The Change
- Created `packages/shared-types/src/websocket.ts` to define the "Contract" between Frontend and Backend based on the card/health game mechanics. Includes `GameState`, `PlayerState`, `Card`, and socket event types.
- Updated `apps/web/tsconfig.json` paths to map `@shared/*` to the local `shared-types` package folder.
- Built `useMatchSocket.ts` hook using the native `WebSocket` API.
- Created `scripts/mock-ws-server.js` to simulate the backend.

### The Reasoning
- Contract-First Development: Defining the payload interfaces before the backend is built forces alignment and unblocks the frontend.
- Native WebSocket: Opted for the browser's built-in `WebSocket` instead of Socket.io to keep the Next.js bundle light and ensure perfect compatibility with the backend's Bun/Hono stack.
- State vs Callbacks: The hook maintains the `GameState` internally and exposes it to the UI instead of using event callbacks, preventing stale closures in React.

### The Tech Debt
- The `tsconfig.json` path mapping is a temporary workaround. If the monorepo expands, we should set up proper NPM Workspaces / Turborepo.
- The `mock-ws-server.js` should be deleted once the real Hono backend is deployed to Devnet.

## 2026-04-26 - Wallet Integration (Devnet)

### The Change
- Created `apps/web/src/components/Providers.tsx` as a Client Component to host the Solana Wallet Adapter contexts (`ConnectionProvider`, `WalletProvider`, `WalletModalProvider`).
- Configured the network to `WalletAdapterNetwork.Devnet` and added `PhantomWalletAdapter`.
- Imported `@solana/wallet-adapter-react-ui/styles.css` inside `Providers.tsx`.
- Wrapped the root `layout.tsx` children with the new `<Providers>` component.
- Replaced the default Next.js boilerplate in `page.tsx` with a clean, monochrome landing page that renders `<WalletMultiButton />`.

### The Reasoning
- React Context (required by Wallet Adapter) can only be used in Client Components (`"use client"`). We abstracted this into a `<Providers>` wrapper so `layout.tsx` can remain a Server Component if needed.
- We set the landing page to act as the actual authentication gateway, as "connecting a wallet" *is* the login mechanism for the wager-fi architecture.

### The Tech Debt
- The RPC endpoint is currently using the public `clusterApiUrl('devnet')` directly in the component. We should move this to an environment variable (`NEXT_PUBLIC_SOLANA_RPC_URL`) later for better stability and potential custom RPC usage.

## 2026-04-27 - Landing Page Graybox Implementation

### The Change
- Set up graybox color tokens (`--color-surface`, `--color-accent`, etc.) and animation keyframes in `globals.css`.
- Built 9 new responsive landing page components in `apps/web/src/components/landing/`: `CursorGlow`, `Navbar`, `Hero`, `TokenMarquee`, `HowItWorks`, `Features`, `VideoSlot`, `CtaBanner`, and `Footer`.
- Replaced the simple wallet-connect card in `page.tsx` with a fully composed, scroll-driven landing page experience.
- Implemented premium Web3 animation patterns (all via Framer Motion & pure CSS): cursor-following radial glow, scroll-driven zoom/fade-out in the hero, SVG path drawing, bento grid staggers, and an invisible-to-glass navbar.

### The Reasoning
- **Graybox First:** By locking in layout, responsive behavior, and complex scroll animations first using neutral tokens, the designer is unblocked to iterate on colors/assets without fighting CSS structure later.
- **Dependency Discipline:** We achieved 10 distinct high-end interaction patterns without adding any new libraries (e.g. Three.js, GSAP). Framer Motion and Tailwind v4 are sufficient.
- **Routing Strategy:** The landing page now acts as the marketing surface (`/`), with CTA buttons routing the user to a dedicated `/play` route for the actual game loop (to be built next).

### The Tech Debt
- The "Enter Arena" CTA currently links to `/play`, which doesn't exist yet and will throw a 404 until we scaffold the game route.
- Graybox colors are hardcoded hexes in `globals.css`. Once the design system lands, these need to be swapped with the final palette.
- The `VideoSlot` is an empty placeholder that needs to be swapped with an actual HTML5 `<video>` tag once gameplay footage is recorded.

## 2026-04-27 - Arena HUD Landing Page Redesign

### The Change
- Reworked the landing page from generic graybox sections into a Cora-specific arena HUD concept.
- Updated `Hero`, `Navbar`, `TokenMarquee`, `HowItWorks`, `Features`, `VideoSlot`, `CtaBanner`, and `Footer` to emphasize live skill-wager match mechanics.
- Added global dark arena tokens, grid/scanline/pulse/orbit animations, wallet button styling, and a page-level cursor glow.
- Converted the empty video placeholder into an animated gameplay replay surface that shows timer, pot, question, answers, score rail, and match log.
- Fixed broken mojibake characters in landing/footer metadata paths and cleaned the socket hook lint issue in `useMatchSocket.ts`.

### The Reasoning
- The first graybox had modern Web3 effects, but they were not tied strongly enough to Cora's product identity.
- The redesign makes the first viewport immediately read as `CORA`, then carries the user through the actual product loop: connect wallet, lock stake, battle, settle.
- The visual direction avoids default purple Web3 language and uses a sharper arena palette with acid green, cyan, orange-red, and gold accents.
- Keeping the existing component boundaries preserved the graybox work while making each section more intentional and easier to iterate on.

### The Tech Debt
- `/play` is still not scaffolded, so landing CTAs continue to point at a future route.
- The gameplay replay is still a simulated UI rather than real captured gameplay or live match state.
- The visual system is still hardcoded in `globals.css`; it should be converted into final design tokens once the brand direction is approved.
- Production build was not completed in this session because the user chose to run it locally after lint passed.

## 2026-04-27 - Light Monochrome Cognitive Landing Revision

### The Change
- Fixed the hydration mismatch caused by `WalletMultiButton` rendering different server/client markup by rendering a stable placeholder until the hero mounts on the client.
- Added explicit relative positioning to Framer Motion scroll targets in `Hero`, `HowItWorks`, and `VideoSlot` to address scroll offset warnings.
- Switched the landing visual system from dark neon arena styling to a light monochrome warm-neutral base.
- Simplified the hero copy and match panel to feel cleaner, less money-coded, and more like a cognitive game surface.
- Reworked landing copy across ticker, flow, features, replay, CTA, and footer toward modern animal challengers, aptitude prompts, focus, pattern recognition, and score.

### The Reasoning
- Solana wallet adapter UI depends on browser wallet state, so it should not be server-rendered directly inside hydrated hero markup.
- The user clarified that the intended direction is modern, animal-themed, aptitude-test gaming with warm vibrant colors later, so monochrome structure is a better temporary base than neon wager-fi styling.
- Reducing `pot`, `escrow`, and token language keeps the page from reading like a financial product while the character/game identity is still forming.

### The Tech Debt
- The wallet button placeholder is intentionally minimal; a proper local wrapper component may be useful if wallet buttons appear in more places.
- Animal characters are still represented as text placeholders only. Final mascot art or generated assets should replace them later.
- The palette is intentionally monochrome and temporary until the warm vibrant brand pass is ready.
- Production build was left for the user to run locally, per request.

## 2026-04-27 - Hero Simplification to Name/Slogan + Cursor Interaction

### The Change
- Rebuilt `apps/web/src/components/landing/Hero.tsx` as a minimal hero with only the brand name (`CORA`) and a short slogan.
- Removed hero-specific cards, wallet CTA, status strips, and dense UI blocks from the hero itself.
- Kept interactivity by using cursor-tracked radial background layers driven by Framer Motion springs.

### The Reasoning
- The user requested a cleaner first section that communicates only name/slogan while preserving interactive cursor behavior.
- A minimal hero reduces visual noise and makes later mascot/color direction easier to apply without fighting existing UI complexity.

### The Tech Debt
- Hero no longer contains a top-of-page wallet action; if conversion drops, we may want to reintroduce a subtle CTA outside the hero.
- Cursor interaction is intentionally understated; intensity and blend mode may need tuning once final vibrant warm colors are introduced.

## 2026-04-27 - Hero Cursor Interaction Upgrade

### The Change
- Upgraded `apps/web/src/components/landing/Hero.tsx` cursor behavior from a simple glow into a layered interactive field.
- Added cursor-tracked conic light cone, crosshair lines, and a soft focus ring that follows the pointer.
- Added subtle motion-parallax on the hero title block (`rotateX`, `rotateY`, and positional shift) so `CORA` responds to cursor position while staying clean.

### The Reasoning
- The user requested something more interesting than hover glow while preserving a minimal hero with only name/slogan.
- A layered cursor field creates stronger "alive" feedback without reintroducing extra hero content or UI clutter.

### The Tech Debt
- Interaction complexity is now higher in one component; if this pattern is reused across sections, shared motion utilities may be worth extracting.
- Touch devices won't get the full pointer-driven effect, so we may later add a motion fallback that reacts to scroll or gyroscope.

## 2026-04-27 - Match Flow Correction from MASTER.md

### The Change
- Replaced the `HowItWorks` flow content in `apps/web/src/components/landing/HowItWorks.tsx` with the exact 4-phase architecture from `docs/MASTER.md`:
  - Matchmaking (Off-chain)
  - Escrow (On-chain, Transaction #1)
  - Battle (Off-chain, 3-round Heal/Attack card battle with GAT MCQ)
  - Settlement (On-chain, Transaction #2 with server signature verification and 97.5/2.5 split)
- Refactored the section layout to improve readability and ensure step 4 remains visible on shorter viewports.
- Updated supporting copy in `apps/web/src/components/landing/Features.tsx` and `apps/web/src/components/landing/VideoSlot.tsx` to align with the same match mechanics.

### The Reasoning
- The previous narrative drifted into a generalized "cognitive duel" and no longer reflected the actual MVP mechanism.
- `MASTER.md` is the source-of-truth spec, so the landing page needs to communicate the exact on-chain/off-chain boundaries and transaction model.
- Readability issues around the fourth step were caused by dense composition and clipping risk in the sticky layout.

### The Tech Debt
- The mechanic text is now accurate, but visual assets still use placeholder UI instead of final battle art.
- The match replay block remains a simulated preview and is not connected to real gameplay state yet.

## 2026-04-27 - Hero Interaction Simplified to Subtle Background Drift

### The Change
- Replaced the previous advanced hero cursor effects (crosshair, cone light, focus ring, title tilt) in `apps/web/src/components/landing/Hero.tsx`.
- Implemented a minimal cursor interaction where only the background layers drift slightly with pointer movement.
- Kept hero content unchanged as a clean brand-first block (`CORA` + short slogan).

### The Reasoning
- The previous interaction was visually busy for a minimal hero.
- A small parallax shift keeps the section alive while preserving readability and calm composition.

### The Tech Debt
- Parallax intensity is currently hand-tuned; it may need viewport-specific adjustment after final QA on very large monitors.

## 2026-04-27 - Landing Page Visual Upgrade (6-Priority Pass)

### The Change
- **Priority 1 â€” Color system:** Replaced the fully monochrome token set with a real two-accent palette. Introduced warm amber (`--amber: #d97706`) as the primary accent (CTAs, active states, highlights) and deep teal (`--teal: #0f766e`) as the secondary (on-chain phases, correct answers, HP bars). Added `--amber-glow`, `--teal-glow`, and `-dim` variants for shadows and background tints. Updated `globals.css` with new keyframes (`hpDrain`, `timerPulse`, `orbBreath`, `cardReveal`, `accentSlide`) and utility classes.
- **Priority 2 â€” Hero cursor orb (Option B):** Rebuilt `Hero.tsx` with two spring-tracked motion layers: a sharp amber radial orb (`mix-blend-multiply`) and a larger soft halo, both following cursor position via `useMotionValue`/`useSpring`/`useTransform` mapped to `vw`/`vh` CSS units. Added a staggered entrance sequence (kicker â†’ title â†’ subtitle â†’ CTA buttons) and a breathing scroll hint at the bottom. Introduced two CTA buttons: amber "Enter Arena" and ghost "How it works".
- **Priority 3 â€” HowItWorks cinematic single-pane:** Refactored from a 4-card vertical stack into a cross-dissolving single panel driven by `AnimatePresence mode="wait"`. Each of the 4 stages slides in/out as the user scrolls through the 300vh container. Step indicator dots (amber active, check for completed) replace the previous card list. Each panel is split left (content) / right (large stat display with colored background tint). Added animated pill tags with staggered entrance.
- **Priority 4 â€” VideoSlot animated mock UI:** Timer pulses in amber (`animate-timer-pulse`), HP bars drain with CSS keyframe animations (`animate-hp-drain`, `animate-hp-drain-2`), correct answer option highlighted in teal with glow shadow, match tape dots colored amber/teal/muted per event type, and a settlement footer row added to the sidebar.
- **Priority 5 â€” Navbar sliding pill indicator:** Replaced static hover color change with a Framer Motion `layoutId="nav-pill"` sliding background pill that moves between hovered links. CTA button switched to amber with amber glow shadow. Logo mark now uses amber text.
- **Priority 6 â€” Global appear-on-scroll:** Applied consistent `opacity: 0 â†’ 1 + y: 24 â†’ 0 + filter: blur(8px) â†’ blur(0)` entrance via `whileInView` to: `HowItWorks` header, `Features` header, `CtaBanner` heading and CTA, `Footer`. `TokenMarquee` event dots now cycle amber / teal / muted with a subtle box-shadow glow. `CursorGlow` upgraded from a 6%-opacity dark gradient to a two-layer amber field (600px ambient orb + sharp 4px dot at cursor) that is actually perceptible.

### The Reasoning
- The prior graybox was visually correct in structure but completely illegible in terms of hierarchy â€” accent, active, hover, and text were all the same near-black. Real color was the root fix everything else depended on.
- Amber was chosen over generic blue/purple because it reads as warm, skill-based, and competitive without the crypto-bro connotations of neon green or electric blue. Teal pairs cleanly as a "trust/on-chain" signal.
- The `useTransform` â†’ `vw`/`vh` pattern in the Hero orb avoids the pitfall of using percentage-based `left`/`top` with CSS `translate`, which caused the orb to be positioned relative to the parent rather than following cursor correctly.
- `AnimatePresence mode="wait"` in HowItWorks ensures the exit animation completes before the new stage enters, preventing two panels from being simultaneously visible.

### The Tech Debt
- The Hero orb maps cursor position to `vw`/`vh` units, which is accurate for full-viewport heroes but will drift if the hero section ever becomes non-full-height. A `getBoundingClientRect`-based pixel approach would be more robust long-term.
- `HowItWorks` step indicator buttons have an empty `onClick` handler; if we want manual navigation (click to jump to a step), the scroll position should be programmatically driven from `active`.
- HP bar drain animations are pure CSS with hardcoded `74%` / `61%` targets. Once real match data is available, these should be driven by actual game state.
- The `CursorGlow` small dot uses a fixed `h-4 w-4` size; on retina displays it may appear slightly large. A 2px dot with higher opacity might be cleaner.

## 2026-04-27 - Video Intro-to-Panel Zoom Transition

### The Change
- Rebuilt `apps/web/src/components/landing/VideoSlot.tsx` into a 2-phase scroll scene:
  - Phase A: Full-bleed thumbnail background + headline "Architecture, not hand-wavy claims."
  - Phase B: The same background visual zooms into the replay panel while the panel UI fades/scales in.
- Kept the replay UI and match tape content, but anchored them to the new cinematic transition timing.
- Updated `apps/web/src/components/landing/Features.tsx` heading to avoid duplicate phrase overlap with the new video intro.

### The Reasoning
- The user requested a clear visual continuity: intro statement first, then a zoom-in reveal into the video box rather than a hard section cut.
- Using the same background recipe for both the intro frame and panel underlay makes the transition read as one camera move.

### The Tech Debt
- The "thumbnail" background is still synthetic (gradient-based) and should be replaced with real gameplay thumbnail assets once available.
- Transition timing is tuned for current section heights; if surrounding sections change significantly, scroll breakpoints may need retuning.

## 2026-04-27 - Video Section Simplified to Demo Placeholder

### The Change
- Removed the full battle replay UI and match tape sidebar from `apps/web/src/components/landing/VideoSlot.tsx`.
- Replaced it with a single gray `aspect-video` placeholder box intended for demo video insertion.
- Updated intro copy from architecture wording to demo-video wording.
- Retuned intro fade timing so the intro line stays visible longer before fading out during scroll.

### The Reasoning
- User requested dropping battle replay visuals and keeping the section focused on a demo video slot.
- The previous intro headline disappeared too quickly, reducing readability and transition clarity.

### The Tech Debt
- Placeholder box is intentionally static and not wired to an actual video source yet.
- Final timing may still need minor tuning once real media is embedded.

## 2026-04-27 - Video Zoom Direction and Slot Size Correction

### The Change
- Adjusted `apps/web/src/components/landing/VideoSlot.tsx` zoom timing so the scene now reads as:
  - zoomed-in intro background
  - then zooming out into the demo slot
- Inverted animation scales (`introScale`, `boxScale`) to match that direction.
- Reduced demo slot width from `max-w-6xl` to `max-w-4xl` for better proportion.

### The Reasoning
- User feedback: transition felt backwards and the slot looked oversized.
- The corrected motion now matches the intended camera story and keeps the demo placeholder visually subordinate.

### The Tech Debt
- Scroll breakpoints are hand-tuned; they may still need small adjustments after device-level visual QA.

## 2026-04-27 - Core Systems Bento Flip Redesign

### The Change
- Rebuilt `apps/web/src/components/landing/Features.tsx` into a minimalist bento layout using asymmetric grid spans.
- Converted each system tile into a flip card:
  - Front side: minimal headline + short descriptor
  - Back side: detailed mechanism text
- Added hover flip interaction and click/tap toggle behavior so the detail side is still accessible on touch devices.

### The Reasoning
- User requested a more interesting composition (bento style) with minimalist-first presentation and information revealed on hover.
- The asymmetric grid improves visual rhythm compared to uniform cards while keeping the section concise.

### The Tech Debt
- Flip cards currently use per-card local interaction state in one component; if reused elsewhere, shared interaction utilities may reduce duplication.
- Card copy density may need refinement once final art/icon direction is locked.

## 2026-04-28 - Roster Heading Scroll Reveal + Card Entrance Polish

### The Change
- Updated `apps/web/src/components/landing/Features.tsx` so the heading text `Choose your cognitive champion.` has an explicit scroll-on-appear animation on the `h2` itself.
- Upgraded roster card entrance animation to a smoother reveal using deeper initial offset/blur plus slight scale-in and spring-based stagger timing.

### The Reasoning
- The user requested a clearer on-scroll reveal specifically for the heading line, not just the section wrapper.
- The previous card reveal worked but felt basic; spring-driven stagger and subtle scale-in make card arrival feel more intentional without changing layout or content.

### The Tech Debt
- Card entrance timing constants are currently hand-tuned (`stiffness`, `damping`, delay per index) and may still need minor per-device adjustment after visual QA.

## 2026-04-28 - How It Works Copy + Phase Layout Simplification

### The Change
- Updated the `HowItWorks` headline in `apps/web/src/components/landing/HowItWorks.tsx` from `Four phases. Two transactions.` to `4 phases, 2 on-chain transactions.`.
- Simplified each phase panel layout from a split two-column composition into a cleaner single-column content stack while keeping the same scroll-driven stage transition (`AnimatePresence mode="wait"`).
- Replaced dense animated point pills with a simpler bullet list style for per-phase details.

### The Reasoning
- The user requested less corny headline wording and a simpler phase presentation without losing the transition flow.
- A single-column phase layout improves readability and reduces visual noise while preserving the strong stage-to-stage animation behavior.

### The Tech Debt
- The stage indicator buttons still use a no-op `onClick`; if manual stage jumping is later needed, we should wire indicator clicks to scroll position.

## 2026-04-28 - How It Works Modern Panel Refinement

### The Change
- Refined `apps/web/src/components/landing/HowItWorks.tsx` phase card visuals into a more modern, unique panel style while preserving the existing scroll-driven `AnimatePresence` transition model.
- Replaced the generic minimal stack with a stronger premium hierarchy: accent-index tile, compact domain/status chips, subtle arena-grid texture, colored glow field, and structured metric/point blocks.
- Upgraded point reveals from plain list rendering to staggered motion cards for cleaner staged readability.

### The Reasoning
- The user clarified that "simplify" should mean cleaner and sharper, not plain/basic.
- The revised composition reduces clutter but keeps distinct visual character through controlled lighting, spacing, and information framing.
- Transition mechanics were intentionally left untouched so the good section-to-section motion behavior remains intact.

### The Tech Debt
- The stage indicator still uses `OK` as the completed marker for ASCII safety; we may switch back to a custom icon glyph once the final icon system is finalized.

## 2026-04-28 - Arena Preview Center-to-Left Scroll Transition

### The Change
- Updated `apps/web/src/components/landing/CtaBanner.tsx` so the headline `Think faster. Win sharper.` now appears centered first on scroll, then docks into the existing left-aligned position.
- Added scroll-driven reveal motion for the arena preview headline (opacity, blur clear, subtle rise, and horizontal slide) and delayed CTA reveal so the headline transition lands first.
- Kept existing banner styling, background effects, and CTA content intact.

### The Reasoning
- The user requested a specific narrative transition in the arena preview section: centered statement first, then left-positioned layout.
- A scroll-driven transform preserves the existing section composition while making the headline entrance feel more cinematic and intentional.

### The Tech Debt
- The center-to-left docking threshold is currently tuned with hardcoded progress values (`0.3`, `0.14-0.36`) and may need minor adjustment if section spacing changes.

## 2026-04-28 - Arena Preview Left-Only Scroll Reveal

### The Change
- Updated `apps/web/src/components/landing/CtaBanner.tsx` to remove the center-to-left docking behavior.
- Switched the arena preview headline to a direct left-aligned scroll-on-appear reveal.
- Renamed the CTA label from `Enter Prototype` to `Enter Arena`.

### The Reasoning
- The user requested a simpler behavior: reveal directly on the left without an intermediate centered state.
- The CTA wording needed to avoid `Enter Prototype`.

### The Tech Debt
- If we later want synchronized section-level scroll choreography again, we may reintroduce `useScroll`-driven transforms with cleaner shared motion utilities.

## 2026-04-28 - How It Works Frame + Meta Simplification Pass

### The Change
- Updated `apps/web/src/components/landing/HowItWorks.tsx` to remove the `Signal` label from phase meta and display only the value (`WebSocket`, `Tx #1`, `3 rounds`, `Tx #2`).
- Replaced the `01/02/03/04` index tile content in each phase card with an empty decorative placeholder block for future custom background elements.
- Applied a clipped-corner frame style to the phase panel (diagonal corner cuts + inner stroke) to move away from a formal rounded-rectangle card shape.

### The Reasoning
- The user requested cleaner value-only metadata, no numeric index text, and a more game-like frame treatment.
- A clipped-corner border preserves readability while giving the section a stronger game-fi character.

### The Tech Debt
- The clipped-corner shape is currently hardcoded via `clipPath` values (`15/16px` cuts); these may need slight tuning across very small viewports.

## 2026-04-28 - How It Works Number Marker Restore + Point Block Removal

### The Change
- Updated `apps/web/src/components/landing/HowItWorks.tsx` to restore the phase marker tile text as `#1` to `#4`.
- Removed the per-phase point list block (`Join queue`, `FIFO pairing`, etc.) from the phase panel body.

### The Reasoning
- The user preferred keeping the compact `#` phase marker and dropping the extra point chips/list for a cleaner panel.

### The Tech Debt
- The `stages` data still includes `points` arrays that are no longer rendered; we can remove them in a cleanup pass if they are not needed elsewhere.

## 2026-04-28 - Global Clipped Frame Style Rollout (Landing Rectangles)

### The Change
- Added reusable clipped-corner utilities in `apps/web/src/app/globals.css`: `.frame-cut` and `.frame-cut-sm` (with built-in inner stroke).
- Applied the same border/frame style to bordered rectangular/square surfaces across landing components:
  - `apps/web/src/components/landing/HowItWorks.tsx` (main phase panel, marker tile, stat box)
  - `apps/web/src/components/landing/Features.tsx` (character card shell, desktop side drawer)
  - `apps/web/src/components/landing/VideoSlot.tsx` (intro frame, demo panel shell, aspect-video slot box)
  - `apps/web/src/components/landing/Navbar.tsx` (logo square)
  - `apps/web/src/components/landing/Footer.tsx` (logo square)

### The Reasoning
- The user requested a consistent game-fi border language instead of default rounded/formal rectangles.
- Centralizing the frame style in global utilities keeps the look consistent and avoids repeated inline clip-path logic.

### The Tech Debt
- `.frame-cut` uses `clip-path` and a pseudo-element inner stroke, so very small cards may need a smaller cut size override if new compact components are added later.

## 2026-04-28 - Arena CTA Capsule Double-Border Restyle

### The Change
- Updated the arena CTA button in `apps/web/src/components/landing/CtaBanner.tsx` from a plain filled rounded bar into a capsule with layered styling.
- Kept the capsule shape, but added a subtle double-border treatment (outer border + inset inner border) and a light sweep overlay.
- Preserved CTA behavior, routing, and text (`Enter Arena`).

### The Reasoning
- The user requested a less basic rounded bar look while keeping the same capsule silhouette and a small double-border feel.
- Using pseudo-element borders keeps the style lightweight and local to the CTA without introducing new global tokens.

### The Tech Debt
- CTA overlay/border opacity values are currently hand-tuned; they may need slight adjustment after cross-device visual QA.

## 2026-04-28 - Navbar Capsule CTA Restyle + Fantasy Arrow Icon

### The Change
- Updated the navbar CTA in `apps/web/src/components/landing/Navbar.tsx` to match the new capsule double-border style used in the arena CTA (outer border + inset inner border + soft highlight sweep).
- Replaced the default directional chevron arrow with a more game/fantasy-style arrow glyph in the CTA icon.

### The Reasoning
- The user requested visual consistency between capsule CTAs and a more thematic icon language for the navbar action.
- Reusing the same layered capsule treatment keeps the UI cohesive while avoiding a plain rounded-bar look.

### The Tech Debt
- The fantasy arrow is currently an inline SVG path; if this icon style is reused across the app, it should be extracted to a shared icon component set.

## 2026-04-28 - Character Expand Drawer Stability Fix

### The Change
- Updated `apps/web/src/components/landing/Features.tsx` to fix broken/diagonal behavior when expanding character stats on tablet/desktop.
- Moved the clipped-corner frame class from the width-animated outer drawer container to a fixed-width inner panel layer.
- Kept the same visual frame style while preserving the existing expand/collapse interaction.

### The Reasoning
- Animating `width` on an element that also uses the clipped-corner `clip-path` frame can cause geometry artifacts and detached rendering.
- Separating animation container (outer) from framed panel (inner) stabilizes layout and prevents the blank/offset drawer effect.

### The Tech Debt
- The drawer still relies on hardcoded width (`300px`) and side offsets per index; if the roster layout changes significantly, these offsets may need retuning.

## 2026-04-28 - Navbar CTA Arrow Reverted to Standard

### The Change
- Updated `apps/web/src/components/landing/Navbar.tsx` to revert the CTA arrow icon from the fantasy-style glyph back to a standard right arrow.

### The Reasoning
- The user requested a normal arrow for the `Enter` CTA.

### The Tech Debt
- None introduced by this icon-only swap.

## 2026-04-28 - Hero CTA Removal

### The Change
- Removed the hero CTA button group (`Enter Arena` and `How it works`) from `apps/web/src/components/landing/Hero.tsx`.
- Kept all other hero content and interactions unchanged (name, slogan, cursor orb, scroll hint).

### The Reasoning
- The user requested removing CTA elements from the hero while preserving the rest of the section.

### The Tech Debt
- Hero now has no direct action path; conversion behavior should be observed after this UX change.

## 2026-04-28 - Landing Return-from-Navigation Stability Fix

### The Change
- Updated `apps/web/src/app/page.tsx` to reset homepage scroll position to top on mount and on BFCache restore (`pageshow` with `persisted`).
- Added a local `sceneKey` remount trigger for the landing `<main>` so scroll-driven Framer Motion sections reinitialize cleanly after returning to `/`.

### The Reasoning
- Returning to `/` from other routes could restore an in-between sticky-scroll state, making the landing look partially empty.
- Forcing a top reset + controlled remount prevents stale scroll-progress state from leaving sections in hidden transition frames.

### The Tech Debt
- This fix intentionally favors deterministic homepage reload behavior over native scroll restoration. If preserving previous scroll position on back is desired later, we should add route-specific restoration logic.

## 2026-04-28 - Landing Back-Navigation Hardening + Play Route Scaffold

### The Change
- Added a real `apps/web/src/app/play/page.tsx` route so CTA/navbar navigation no longer lands on a missing route.
- Hardened homepage recovery in `apps/web/src/app/page.tsx`:
  - set `window.history.scrollRestoration = "manual"` while on the landing page,
  - reset scroll + remount scene on mount, BFCache restore (`pageshow persisted`), and browser back/forward (`popstate`),
  - restore previous scroll restoration mode on cleanup.

### The Reasoning
- The route target previously did not exist, which could produce unstable return behavior when navigating back to `/`.
- Sticky scroll scenes (`HowItWorks`, `VideoSlot`) are sensitive to restored mid-scroll states; deterministic reset prevents partially blank in-between frames.

### The Tech Debt
- Current behavior prioritizes stability over preserving previous scroll position on `/`; if we later want native-style restoration, we should implement a controlled route-aware restoration strategy.

## 2026-04-28 - How It Works Point Label Cleanup

### The Change
- Updated `apps/web/src/components/landing/HowItWorks.tsx` to remove per-point index labels (`01`, `02`, `03`) inside each phase detail card.
- Kept the phase progression structure intact, including the top `#1-#4` flow indicators.

### The Reasoning
- The user wanted to keep stage progression numbering but remove numbered prefixes from the detail bullet items.
- This makes the detail cards read cleaner while preserving navigation context.

### The Tech Debt
- If we later reintroduce labels for accessibility/scannability, we should use semantic list styling or icon tokens rather than manual numeric text prefixes.

## 2026-04-28 - Pre-Push Landing Cleanup (Anchor + Dead Data)

### The Change
- Fixed landing navbar anchor mismatch in `apps/web/src/components/landing/Navbar.tsx` by changing `System` link target from `#features` to `#roster`.
- Removed now-unused `points` arrays from `apps/web/src/components/landing/HowItWorks.tsx` stage data to match current rendered UI.
- Validation run:
  - `npm run lint` passed.
  - `npm run build` still blocked by Windows file lock (`EPERM unlink` under `.next/build/chunks`).

### The Reasoning
- Broken in-page anchors are user-facing navigation defects and should be fixed before push.
- Keeping only rendered data in stage config reduces drift and confusion during future edits.

### The Tech Debt
- Production build verification is currently blocked by a locked `.next/build` artifact on this machine; close any process holding that folder and rerun build before final push.

## 2026-04-28 - Landing Log Consolidation Note

### The Change
- Added this consolidation note because landing-page entries became highly iterative and partially redundant across multiple passes.
- Kept all original dated entries intact (no history removed), and defined the effective scaffold baseline as the current code state in:
  - `apps/web/src/app/page.tsx`
  - `apps/web/src/components/landing/*`
  - `apps/web/src/app/play/page.tsx`

### The Reasoning
- The log captures real decision history, but repeated visual iteration can make handoff scanning harder.
- A single consolidation note improves readability for the next contributor without rewriting or collapsing date-based chronology.

### The Tech Debt
- If more rapid UI iteration happens, we should periodically add short consolidation checkpoints to prevent timeline noise.

## 2026-04-29 - Lobby / Matchmaking Queue Screen

### The Change
- Added Caprasimo and Gabarito Google Fonts via `next/font/google` in `apps/web/src/app/layout.tsx` and exposed them as `--font-caprasimo` / `--font-gabarito` CSS variables. These are the fonts specified in `docs/DESIGN.md`.
- Added three new CSS keyframes (`shimmer`, `vsRing`, `matIn`) and two utility classes (`.shimmer-bar`, `.lobby-bg`) to `apps/web/src/app/globals.css` for use by lobby components.
- Created `apps/web/src/app/lobby/page.tsx` â€” new `/lobby` route with server-side metadata.
- Created five new components under `apps/web/src/components/lobby/`:
  - `LobbyScreen.tsx` â€” orchestrator; owns phase state machine (`character-select â†’ waiting â†’ found`) and wallet gate (redirects to `/` if wallet is not connected).
  - `CharacterSelect.tsx` â€” Phase 1; 3-card pre-queue scientist picker (Alan Turing, Marie Curie, Isaac Newton) with animated stat bars, selection state, and a disabled-until-selected "Enter Queue" CTA.
  - `MatchmakingWaiting.tsx` â€” Phase 2; dual-pod layout with your player card, a ghost enemy pod with pulsing scan reticle, animated 3-segment progress bar with shimmer effect (~4.2s mock), and cycling flavor text. Transitions to Phase 3 on completion.
  - `OpponentFound.tsx` â€” Phase 3; enemy pod materialises with `matIn` scale+brightness animation, four VS burst rings fire on mount, countdown ticks 3â†’2â†’1â†’0 then routes to `/play?roomId=mock-room-001`.

### The Reasoning
- **Pre-queue character select** (like Clash Royale) was chosen over post-match-found select per team decision. This allows the matchmaking queue to be simpler â€” no per-player pick phase on the server side.
- **Scientist data lives in `LobbyScreen.tsx`** (exported as `SCIENTISTS` and `Scientist` type) so all three phase components import from a single source of truth, avoiding data drift.
- **`useRef` for stable callback** in `MatchmakingWaiting` instead of `useCallback(fn, [])` anti-pattern â€” avoids the `exhaustive-deps` lint warning while keeping the progress effect from re-mounting.
- **`AnimatePresence mode="wait"`** ensures exit animations complete before the next phase enters, preventing two panels from overlapping mid-transition.
- The **lobby background** (`lobby-bg`) uses `#1b2e26` (darker shade of DESIGN.md's `#274137`) to distinguish the dark game arena from the warm-light landing page, matching the "dark tactical pre-game lobby" intent.

### The Tech Debt
- The `MOCK_ROOM_ID = "mock-room-001"` in `OpponentFound.tsx` must be replaced with a real room ID returned by the Hono matchmaking API once the backend WebSocket gateway is live.
- The enemy scientist in Phase 3 is currently picked as the first scientist whose ID doesn't match the player's. Once the backend returns an opponent's selected scientist, this should be driven by server state.
- `SOL Arena Â· Devnet Â· $1.00 mock wager` labels are static text scattered across lobby components. When the Wager screen task lands, these should read from shared wager state (e.g. React context or URL params).
- Fonts use `display: "swap"` â€” on very slow connections there may be a FOUT. If this becomes an issue, switch to `display: "optional"` or preload the font files.
- `npm run lint` could not be verified via the command runner (Windows sandbox error). Manual code review was performed; run `npm run lint` before merging this branch.


## 2026-04-29 - Lobby Flow Polish (Light Theme + Match Agreement)

### The Change
- Updated lobby visuals from dark tactical styling to a light theme across setup, character select, waiting, and found screens.
- Locked the wager display to a fixed `$1.00` in the lobby setup screen (read-only; no user editing).
- Added gray fallback state for the center arena panel when no arena is selected.
- Fixed waiting-screen `Cancel` button placement so it no longer overlaps the heading line.
- Replaced auto-start behavior in the match-found step with an explicit `Agree To Match` button and a 15-second timeout fallback.

### The Reasoning
- The latest direction required visual consistency with the light landing aesthetic.
- Fixed wager input keeps the MVP flow deterministic while on-chain deposit wiring is still in progress.
- Explicit agreement before entering `/play` better represents the "confirm/sign intent" phase after matchmaking.

### The Tech Debt
- `Agree To Match` is currently a UI-only action and does not yet call wallet signing or on-chain deposit instructions.
- Timeout fallback currently routes users back to character selection; later behavior should be synchronized with backend matchmaking session state.


## 2026-04-29 - Play Route Battle Screen MVP (Game-Fi Layout)

### The Change
- Replaced `apps/web/src/app/play/page.tsx` scaffold content with a real battle screen renderer (`BattleScreen`).
- Added `apps/web/src/components/play/BattleScreen.tsx` with a full-screen arena-style layout: battlefield, base blocks, circular player/opponent placeholders, center-fanned card hand, and overlay modals.
- Implemented deterministic question selection from `data/questions/questions.json` using shared `Question` validation from `packages/shared-types/src/question.ts` and room-seeded shuffle logic.
- Set battle round length to 5 questions (selected from the larger question pool) and enforced a 10-second per-question timer to match backend timing.
- Implemented question popup modal flow (4 options), answer resolution states (`correct`, `wrong`, `timeout`), hidden enemy-answer behavior, and lightweight opponent attack feedback animation.
- Added end-of-match summary overlay with per-outcome counts and actions (`Back To Lobby`, `Play Again`).

### The Reasoning
- The previous `/play` route was a placeholder and did not match intended gameplay interaction.
- The visual direction needed to feel more game-like while still using available placeholder assets before final character/base art arrives.
- Keeping deterministic room-seeded selection aligns frontend behavior with multiplayer expectations (both players seeing the same question set/order).

### The Tech Debt
- Battle UI is currently React/CSS-driven; scene-level animation and combat presentation may later migrate to Phaser for richer in-arena motion.
- HP is currently displayed on base elements but not yet wired to real websocket game-state updates from the backend engine.
- Enemy actions are currently mock feedback (no answer reveal by design), pending direct integration with real room event streams.
- Summary is match-level only and does not yet include reward/settlement integration.

## 2026-04-29 - Play Socket Wiring (useMatchSocket Integration)

### The Change
- Refactored `apps/web/src/hooks/useMatchSocket.ts` to support full match-room integration requirements:
  - added required `address` param and socket URL query binding (`/match/:roomId?address=...`),
  - added `openCard` sender API,
  - added listeners/state for `cardCountdown`, `cardExpired`, and `scoreUpdate`,
  - split settlement result typing to `MatchResultPayload` (`settlementResult`) and anti-cheat invalidation (`matchInvalidated`),
  - kept existing `gameStateUpdate`, `damageEvent`, `phaseChange`, and `playCardResult` flows.
- Refactored `apps/web/src/components/play/BattleScreen.tsx` to consume server-driven battle state:
  - hand/cards now render from `gameState.hand` instead of local question mock resolution,
  - card interactions now call `openCard` and `playCard` through the socket hook,
  - question timer display follows server countdown events,
  - deposit phase overlay now sends `confirmDeposit` action,
  - match completion overlay now uses server settlement/invalidation events.
- Maintained game-fi battlefield composition (full-screen arena, centered fanned card hand, base blocks, circular placeholders) while replacing local-only battle progression logic.
- Validation run: `npm run lint` passed after aligning with strict hook rules.

### The Reasoning
- Backend and game-logic already expose authoritative room events; frontend should not remain local-simulated once socket flow is available.
- Enforcing `address` in the websocket URL is necessary because room join/reconnect identity is address-scoped in the backend room manager.
- Splitting settlement vs invalidation payloads keeps FE state handling type-safe and reflects real backend event semantics.

### The Tech Debt
- `confirmDeposit` currently sends a mock signature; this must be replaced with real Phantom transaction signing payloads when wager/deposit wiring lands.
- Current no-wallet local testing uses dev-preview fallback addresses/query overrides for socket identity. This must be removed or gated behind explicit dev mode once Phantom wallet sign-in/signing is fully wired.
- Battle outcomes displayed in FE are currently event-derived and UI-focused; full scoreboard/result canonicalization should rely on final backend match payloads during settlement screen implementation.
- Current `/play` still uses React/CSS presentation; if we adopt Phaser for in-arena animation, this socket adapter should be moved behind a shared battle store (e.g., Zustand) for renderer-agnostic state flow.

## 2026-04-29 - Play Runtime Stabilization (Import Path + Empty-Hand Fallback)

### The Change
- Updated `apps/web/src/app/play/page.tsx` to import `BattleScreen` via alias path (`@/components/play/BattleScreen`) instead of deep relative path.
- Updated `apps/web/src/components/play/BattleScreen.tsx` to render placeholder card slots when `gameState.hand` is empty so the arena does not appear blank during non-playing phases.
- Added address selection fallback flow for local testing: wallet address -> `?address=` query -> deterministic `dev-preview-<roomId>` fallback.
- Adjusted implementation to satisfy strict React hook purity/ref lint rules.
- Validation run: `npm run lint` passed.

### The Reasoning
- The module resolution error was intermittent during hot reload and path reconciliation; alias imports are more stable in this workspace.
- In websocket-driven battle flow, empty hand before `playing` is expected. Placeholder slots preserve visual continuity and make state transitions clearer.
- Deterministic fallback address keeps no-wallet testing possible without violating render purity constraints.

### The Tech Debt
- Deterministic fallback address (`dev-preview-<roomId>`) means two local tabs on the same room will collide unless distinct `?address=` values are provided. This remains temporary until Phantom-authenticated addresses are the default path.

## 2026-04-29 - Wallet Auth + Deposit Signing UI Wiring

### The Change
- Added reusable Phantom deposit-sign helper at `apps/web/src/lib/solana/signDepositIntent.ts`:
  - builds a memo transaction (`CORA_DEPOSIT_INTENT`) on Solana Devnet,
  - signs/sends via wallet adapter,
  - confirms transaction and returns signature,
  - normalizes common wallet/RPC error cases.
- Updated `apps/web/src/components/lobby/OpponentFound.tsx`:
  - replaced 15s `Agree To Match` action with `Sign Deposit` flow,
  - added signing state machine (`idle -> signing -> submitting -> success/error`),
  - added inline wallet connect button (`WalletMultiButton`) and error feedback,
  - routes to `/play` only after successful signature.
- Updated `apps/web/src/components/play/BattleScreen.tsx`:
  - removed default no-wallet identity path unless explicit env fallback is enabled,
  - added wallet-required gate UI for `/play`,
  - replaced deposit modal mock confirm with Phantom signing action using the shared helper,
  - added env-based deposit mode switch (`NEXT_PUBLIC_DEPOSIT_MODE=mock|phantom`).
- Updated wallet entry touchpoints:
  - `apps/web/src/components/landing/Navbar.tsx` now shows wallet connect UI and routes to `/lobby` when connected,
  - `apps/web/src/components/lobby/LobbySetup.tsx` now exposes wallet connect button directly in setup phase.
- Validation run: `npm.cmd run lint --workspace=web` passed.

### The Reasoning
- The 15-second post-match-found UI is the correct place to communicate and execute deposit signing before entering active battle.
- Extracting signing logic into a reusable helper avoids duplicated transaction code across lobby and play deposit surfaces.
- Wallet-first route behavior simplifies identity consistency with backend room joins (`address` as player identity).

### The Tech Debt
- Deposit signing currently uses memo-transaction intent as FE integration scaffolding; this must be swapped to real escrow instruction construction once `packages/solana-client` is implemented.
- Local no-wallet preview is now explicitly env-gated; full QA still needs dedicated wallet-connected test runs with two clients.
- Matchmaking room creation is still mock-driven in lobby flow (`mock-room-001`) and must be replaced with real `/match` queue wiring for full multiplayer deposit handshake validation.

## 2026-04-29 - Dedicated Connect Wallet Page (Pre-Lobby Gate)

### The Change
- Added a dedicated wallet-connect route:
  - `apps/web/src/app/connect/page.tsx`
  - `apps/web/src/components/connect/ConnectWalletScreen.tsx`
- Rewired landing CTAs to route through `/connect` before gameplay flow:
  - `apps/web/src/components/landing/Navbar.tsx` (`Enter` now goes to `/connect`)
  - `apps/web/src/components/landing/CtaBanner.tsx` (`Enter Arena` now goes to `/connect`)
- Removed direct wallet-connect control from the navbar so wallet login happens in a focused standalone page.
- Connect page supports optional `next` query (defaults to `/lobby`) and exposes `Continue` once connected.

### The Reasoning
- The user requested a dedicated wallet-login surface similar in intent to signing pages, rather than inline navbar auth.
- Routing through `/connect` creates a cleaner progression from landing CTA -> identity connection -> lobby/deposit flow.

### The Tech Debt
- Route guarding is still soft (UI flow-led); hard redirects from protected routes to `/connect` may still be added later for stricter access control.

## 2026-04-29 - Connect Page Simplification (Centered Sign-In Layout)

### The Change
- Simplified `apps/web/src/components/connect/ConnectWalletScreen.tsx` to a cleaner sign-in style:
  - reduced content density,
  - centered all key elements,
  - tightened copy to a straightforward wallet-login message,
  - preserved existing connect/continue behavior.
- Validation run: `npm.cmd run lint --workspace=web` passed.

### The Reasoning
- The user requested a minimal sign-in page feel with centered alignment and clear padding hierarchy.

### The Tech Debt
- None additional beyond existing connect-flow route-guard follow-up.

## 2026-04-30 - Play Error States + Settlement Confirmation Pass

### The Change
- Improved websocket diagnostics in `apps/web/src/hooks/useMatchSocket.ts`:
  - added exposed `socketUrl`,
  - added `lastSocketError`,
  - added `lastSocketCloseInfo` (close code/reason/clean flag),
  - added `reconnect()` trigger for UI retry.
- Extended `apps/web/src/lib/solana/signDepositIntent.ts`:
  - added finer wallet error mapping (`wallet_declined`, `insufficient_balance`, `rpc_error`),
  - extracted generic memo-sign flow,
  - added `signSettlementReleaseIntent()` for settlement confirmation UI.
- Upgraded `apps/web/src/components/play/BattleScreen.tsx`:
  - added server-connection error banner with endpoint visibility and retry action,
  - improved deposit error messaging (wallet declined / insufficient balance / generic failure),
  - added round-aware HUD/result display (`roundsWon`),
  - expanded result modal with winner + match ID details,
  - added fund release confirmation state machine (`idle/signing/submitting/success/error`) with signature/error feedback.
- Validation run:
  - `npm.cmd run lint --workspace=web` passed.

### The Reasoning
- Browser `WebSocket` error events are often opaque (`[object Event]`), so FE needs explicit close/error context to make runtime issues debuggable.
- Settlement/result UI previously stopped at winner text only; this pass aligns it with the required “winner display + fund release confirmation” branch scope.
- Multi-round backend changes introduced `roundsWon`, so surfacing rounds in the HUD/result keeps FE aligned with game state semantics.

### The Tech Debt
- Settlement confirmation currently signs memo intent, not the final escrow settlement instruction. This remains a temporary FE bridge until `packages/solana-client` provides full instruction builders.
- Result flow confirms release intent locally in UI; backend/on-chain release ack callbacks are still pending cross-role integration.

## 2026-04-30 - Web Env Template for Wallet/Socket Runtime Modes

### The Change
- Added `apps/web/.env.example` with documented runtime flags used by current FE flow:
  - `NEXT_PUBLIC_WS_URL`
  - `NEXT_PUBLIC_DEPOSIT_MODE`
  - `NEXT_PUBLIC_SETTLEMENT_MODE`
  - `NEXT_PUBLIC_ALLOW_DEV_ADDRESS_FALLBACK`

### The Reasoning
- The branch introduced multiple environment-driven behavior modes (mock vs phantom, fallback identity, websocket endpoint), so a checked-in template is needed for consistent local setup.

### The Tech Debt
- Values in `.env.example` are local-safe defaults. Team members still need per-environment overrides in `.env.local` for integration/staging.

## 2026-04-30 - Wallet Button Hydration Mismatch Fix

### The Change
- Added `apps/web/src/components/wallet/HydratedWalletButton.tsx` as a hydration-safe wrapper around wallet adapter button using `next/dynamic` with `ssr: false`.
- Replaced direct `WalletMultiButton` usage in:
  - `apps/web/src/components/connect/ConnectWalletScreen.tsx`
  - `apps/web/src/components/lobby/LobbySetup.tsx`
  - `apps/web/src/components/lobby/OpponentFound.tsx`
  - `apps/web/src/components/play/BattleScreen.tsx`
- Validation run:
  - `npm.cmd run lint --workspace=web` passed.

### The Reasoning
- `WalletMultiButton` can render different server/client markup due to wallet runtime state, causing hydration mismatch in Next.js app routes.
- Client-only dynamic rendering removes SSR markup drift while preserving the same UX and styles.

### The Tech Debt
- If we later need deeper wallet button customization, we should build a dedicated design-system wrapper around wallet adapter primitives, still keeping client-only render strategy.

## 2026-04-30 - Unified Top-Corner Runtime Alerts (Play)

### The Change
- Refactored `apps/web/src/components/play/BattleScreen.tsx` runtime feedback into a consistent fixed top-right alert stack.
- Unified these states into one visual system:
  - websocket/server connection issue (with `Retry` action),
  - deposit signing errors (with `Dismiss`),
  - settlement confirmation errors (with `Dismiss`).
- Removed scattered inline error text inside modal bodies and moved those messages into the shared alert stack so visibility is consistent even when overlays are open.
- Validation run:
  - `npm.cmd run lint --workspace=web` passed.

### The Reasoning
- User requested consistent banner placement and reported missing retry visibility.
- Fixed-position alert stack ensures critical runtime feedback remains visible across all play overlays.

### The Tech Debt
- Alert stack currently lives inside `BattleScreen`; if more routes need the same pattern, extract to shared UI component in `packages/ui` or `apps/web/src/components/ui`.

## 2026-04-30 - Alert Timer Bar + Manual Close Controls

### The Change
- Enhanced play runtime alerts to behave like timed toasts:
  - added auto-dismiss timers for transient warning alerts,
  - added a progress/drain bar under each alert card,
  - added top-right `X` close button on each alert.
- Kept socket/server alerts persistent by default (manual close + retry) while still using the same visual container.
- Added `@keyframes alertDrain` in `apps/web/src/app/globals.css`.
- Validation run:
  - `npm.cmd run lint --workspace=web` passed.

### The Reasoning
- User requested explicit “time shown” behavior and familiar close control pattern for error banners.
- Unified timer/close behavior improves consistency and keeps overlays readable during failure states.

### The Tech Debt
- Alert timings are currently hardcoded in `BattleScreen`; move to shared constants/config if additional screens adopt the same toast behavior.

## 2026-04-30 - Lobby Deposit Error Toast Consistency

### The Change
- Updated `apps/web/src/components/lobby/OpponentFound.tsx` to replace inline error text below the sign button with the same top-corner toast style used in play:
  - top-right fixed alert card,
  - `X` manual close,
  - timed auto-dismiss with progress/drain bar.
- Removed the old inline error paragraph under the deposit button.
- Validation run:
  - `npm.cmd run lint --workspace=web` passed.

### The Reasoning
- User requested consistent placement/behavior of runtime errors across signing and battle surfaces.
- Inline button-adjacent error text was easy to miss and visually inconsistent with the new alert system.

### The Tech Debt
- Alert style logic is duplicated between `OpponentFound` and `BattleScreen`; extract to shared component if we continue adding more alert surfaces.

## 2026-04-30 - Challenge Me Share Link v1 (UI + Deep-Link Prefill)

### The Change
- Added share-link utilities in `apps/web/src/lib/challenge/createChallengeLink.ts`:
  - `createChallengeLink()` to generate canonical challenge URLs to `/lobby` with `challenge`, `arena`, `token`, `wager`, and `ref` query params.
  - `createChallengeTweetIntent()` to open X share composer with the generated URL.
- Updated `apps/web/src/components/play/BattleScreen.tsx`:
  - added `Challenge Me` panel in match-complete modal with `Copy Link` and `Share On X` actions,
  - added short-lived inline share status feedback (copy success/failure and share-open confirmation),
  - exposed generated challenge link for manual copy fallback,
  - aligned deposit signing metadata with route context (`arena`/`token`/`wager`) instead of hardcoded values.
- Updated `apps/web/src/components/lobby/OpponentFound.tsx`:
  - forwarded `arena`, `token`, and `wager` query params when routing to `/play` so match result can build accurate challenge links.
- Updated `apps/web/src/components/lobby/LobbyScreen.tsx`:
  - read challenge query params on entry,
  - prefilled selected arena from challenge URL when valid,
  - added top-corner `Challenge Received` banner showing challenger and wager metadata.
- Validation run:
  - `npm.cmd run lint --workspace=web` passed.

### The Reasoning
- `MASTER.md` positions Challenge Me distribution as a core loop, so FE needs a usable v1 share path even before full Solana Actions/Blink backend endpoints are available.
- Deep-link prefill reduces setup friction for invited players by applying the arena context immediately on lobby load.
- Keeping share controls in the settlement modal places the action at the strongest engagement moment (right after match outcome).

### The Tech Debt
- This is a URL-based v1 and not full Blink protocol integration yet; backend still needs dedicated Solana Actions/Blink endpoints and metadata surfaces.
- Share copy/status feedback is local to `BattleScreen`; if challenge sharing appears in more routes, we should extract a shared share-action component.

## 2026-04-30 - Blink-Style Challenge Card Layout (Lobby + Post-Match)

### The Change
- Added reusable Blink-style challenge card UI in `apps/web/src/components/challenge/ChallengeShareCard.tsx`:
  - left identity pane (challenger profile placeholder, short wallet, status tag, short description),
  - right action pane (QR image from generated challenge URL + token/wager/arena quick facts),
  - shared `Copy Link` and `Share On X` actions with status feedback and manual link fallback.
- Upgraded post-match share section in `apps/web/src/components/play/BattleScreen.tsx` to use the new card:
  - dynamic outcome copy (`Winner` vs `Rematch`),
  - outcome-aware share text for X intent.
- Added pre-match share surface in `apps/web/src/components/lobby/LobbySetup.tsx`:
  - `Pre Challenge Me` card directly in lobby,
  - uses current selected arena + fixed wager + wallet reference for link generation,
  - supports copy/share actions before entering queue.
- Extended `apps/web/src/lib/challenge/createChallengeLink.ts`:
  - `createChallengeTweetIntent()` now accepts optional dynamic text.
- Validation run:
  - `npm.cmd run lint --workspace=web` passed.

### The Reasoning
- User requested a Blink-card-like share layout with QR + concise metadata, and confirmed challenge sharing should exist both pre-match (lobby) and post-match (result state).
- A reusable component keeps visual language consistent while allowing different copy contexts (`Open Challenge`, `Winner`, `Rematch`).

### The Tech Debt
- QR currently depends on an external generator URL; if we need offline reliability or stricter CSP, we should move to local QR rendering.
- Final avatar/character art is still placeholder and should be swapped once designer assets land.

## 2026-04-30 - Blink Share Trigger UX (Button -> Floating Card)

### The Change
- Refined challenge-share interaction in both pre-match and post-match flows to match requested behavior:
  - show a single `Blink Share` button first,
  - open the Blink-style challenge card as a floating modal overlay when clicked,
  - include explicit `Close` action on the floating panel.
- Updated `apps/web/src/components/lobby/LobbySetup.tsx`:
  - replaced always-visible pre-challenge card with a `Blink Share` trigger button,
  - disabled trigger until arena is selected,
  - renders `ChallengeShareCard` inside fixed overlay modal.
- Updated `apps/web/src/components/play/BattleScreen.tsx`:
  - replaced inline post-match card with `Blink Share` trigger,
  - renders floating challenge card modal above the result overlay,
  - modal visibility scoped to match-complete context.
- Validation run:
  - `npm.cmd run lint --workspace=web` passed.

### The Reasoning
- User requested lower visual noise and cleaner hierarchy where share UI is on demand, not always expanded.
- Modal-based reveal keeps the battle/result layout focused while still enabling rich QR/share actions.

### The Tech Debt
- Share modal layout is duplicated across lobby and play trigger points; if we add more share surfaces, extract a dedicated `ChallengeShareModal` wrapper.

## 2026-04-30 - Challenge JPG Export + Share Fallbacks + QR Layout Tuning

### The Change
- Added challenge card JPG renderer in `apps/web/src/lib/challenge/renderChallengeCardJpg.ts`:
  - canvas-based static poster rendering from challenge card metadata,
  - JPG blob export helper and deterministic filename generation.
- Updated `apps/web/src/components/challenge/ChallengeShareCard.tsx`:
  - added `Save As JPG` action button,
  - reduced QR size from large block to a smaller centered layout for better visual balance,
  - adjusted panel proportions for cleaner composition.
- Updated `apps/web/src/components/lobby/LobbySetup.tsx` and `apps/web/src/components/play/BattleScreen.tsx`:
  - wired `Save As JPG` to local file download,
  - upgraded `Share On X` to:
    - try native file share first when browser supports `navigator.share({ files })`,
    - otherwise open X intent and auto-download JPG so user can attach manually.
- Validation run:
  - `npm.cmd run lint --workspace=web` passed.

### The Reasoning
- User requested tweet-supportable media workflow and explicit image export, so FE now provides a practical path for both direct saving and sharing.
- X web intent does not support pre-attaching image files purely via URL params, so fallback UX was added to avoid blocking sharing.
- Smaller QR improves card hierarchy by keeping profile/copy and metadata readable at a glance.

### The Tech Debt
- Native file share with `navigator.share({ files })` is browser/platform-dependent; desktop web often falls back to intent + manual attach.
- Canvas render currently uses generic browser fonts; final typography should be refined once branded social templates are finalized.

## 2026-04-30 - JPG Export Font Fidelity Fix (Canvas Uses App Fonts)

### The Change
- Updated `apps/web/src/lib/challenge/renderChallengeCardJpg.ts` so canvas export uses the same app font families instead of hardcoded `Arial`.
- Added font-resolution/loading helpers:
  - read `--font-caprasimo` and `--font-gabarito` from root CSS variables (from `next/font` in layout),
  - wait for `document.fonts.ready`,
  - pre-load key font weights/sizes with `document.fonts.load(...)` before drawing text.
- Mapped canvas typography to these stacks for title, body, labels, and metadata text.
- Validation run:
  - `npm.cmd run lint --workspace=web` passed.

### The Reasoning
- User reported mismatch where downloaded JPG did not reflect in-app typography.
- Canvas text rendering does not automatically guarantee runtime web-font availability unless loaded and referenced explicitly.

### The Tech Debt
- If rendering happens extremely early in slow networks, first-attempt export may still race with remote font fetch depending on browser behavior; if this appears in QA, we should add retry/backoff on export click.

## 2026-04-30 - Force Direct X Share (Disable Native Share Prompt Path)

### The Change
- Updated `Share On X` handlers in:
  - `apps/web/src/components/lobby/LobbySetup.tsx`
  - `apps/web/src/components/play/BattleScreen.tsx`
- Removed `navigator.share(...)` branch to avoid OS/browser app chooser prompts.
- `Share On X` now always:
  - opens X intent directly in a new tab,
  - downloads generated JPG asset so user can attach it in composer.
- Added popup-blocked feedback when browser prevents opening X.
- Validation run:
  - `npm.cmd run lint --workspace=web` passed.

### The Reasoning
- User requested deterministic direct navigation to X instead of cross-app share sheet behavior.
- Keeping auto-download preserves media sharing workflow even though X web intent cannot auto-attach local files by URL alone.

### The Tech Debt
- X still requires manual image attach in web composer unless we implement authenticated media upload via X API/server integration.

## 2026-04-30 - Real Matchmaking Queue Wiring (API + Cancel + Timeout)

### The Change
- Added real matchmaking API client in `apps/web/src/lib/matchmaking/queueMatch.ts`:
  - calls `POST /match` with player `address`,
  - supports `AbortSignal` cancellation,
  - resolves API base from `NEXT_PUBLIC_API_URL` or derived `NEXT_PUBLIC_WS_URL` fallback.
- Documented optional `NEXT_PUBLIC_API_URL` in `apps/web/.env.example` for explicit HTTP backend routing when needed.
- Refactored lobby orchestration in `apps/web/src/components/lobby/LobbyScreen.tsx`:
  - replaced mock waiting->found transition with actual queue request lifecycle,
  - added queue states (`idle/searching/timeout/error`),
  - added cancellation via `AbortController`,
  - added 45s timeout handling,
  - added retry path (`Keep Searching`),
  - stores real `matchedRoomId` and passes it into found/deposit/play flow,
  - aborts pending queue request on unmount.
- Updated waiting UI in `apps/web/src/components/lobby/MatchmakingWaiting.tsx`:
  - removed fake auto-match timer,
  - now reflects real queue state,
  - shows retry CTA on timeout/error while keeping cancel action.
- Updated `apps/web/src/components/lobby/OpponentFound.tsx`:
  - accepts `roomId` prop,
  - uses real room ID for deposit signing and `/play` navigation,
  - removed hardcoded `mock-room-001` dependency in this flow.
- Validation run:
  - `npm.cmd run lint --workspace=web` passed.

### The Reasoning
- Backend already provides true matchmaking queueing (`POST /match`) and room socket routing, so FE should consume it directly instead of relying on mock room IDs.
- Without cancellation + timeout UX, queueing appears stuck when no opponent is available.

### The Tech Debt
- Queue cancellation currently relies on aborting the HTTP request; backend has no explicit dequeue endpoint yet.
- Timeout duration is hardcoded in FE (45s); move to shared config/env if PM tuning is expected.

## 2026-04-30 - Matchmaking Micro-Progress Animation Pass

### The Change
- Refined queueing animation behavior in `apps/web/src/components/lobby/MatchmakingWaiting.tsx`:
  - kept matchmaking in a stable “Finding your opponent” state while searching,
  - replaced binary/step-fill segment logic with independent looping progress per segment (`Finding Opponent`, `Verifying Wallet`, `Preparing Arena`),
  - each segment now runs its own offset/duration cycle via `requestAnimationFrame` for subtle continuous UX motion.
- Kept flavor text rotation active while searching.
- Validation run:
  - `npm.cmd run lint --workspace=web` passed.

### The Reasoning
- User requested non-jumping feedback where the screen remains in finding-opponent mode but still feels alive through small per-segment progress motion.
- Independent loops avoid the “hard complete then stop” look and better communicate ongoing queue work.

### The Tech Debt
- Loop durations/offsets are currently hardcoded in component; if motion tuning is expected across multiple screens, extract to shared animation config constants.

## 2026-04-30 - Staged Queue Animation Flow (Finding -> Verifying -> Preparing)

### The Change
- Refined matchmaking queue UX to follow staged loops exactly:
  - while waiting for an opponent: only `Finding Opponent` loops,
  - once matched: transition to `Verifying Wallet` loop,
  - then transition to `Preparing Arena` loop,
  - then continue to opponent-found/deposit screen.
- Updated `apps/web/src/components/lobby/MatchmakingWaiting.tsx`:
  - added `stage` prop (`finding | verifying | preparing`),
  - previous stages render as completed bars,
  - current stage renders looping progress only.
- Updated `apps/web/src/components/lobby/LobbyScreen.tsx`:
  - introduced matchmaking stage state management,
  - added timed post-match-found transition sequencing before moving to `found` phase,
  - added timer cleanup on cancel/unmount to prevent stale transitions.
- Validation run:
  - `npm.cmd run lint --workspace=web` passed.

### The Reasoning
- User requested that the three progress segments should not all loop arbitrarily; they should advance by matchmaking milestones with per-stage micro animation.

### The Tech Debt
- Stage transition timings are currently fixed constants in FE and not synchronized with backend milestone events yet.

## 2026-04-30 - Match Entry Polish (Timer/Rounds, Real Opponent Identity, No Double Deposit, Requeue Recovery)

### The Change
- Updated [LobbyScreen.tsx](/d:/projects/Cora/apps/web/src/components/lobby/LobbyScreen.tsx):
  - supports `resumeQueue=1` deep-link recovery,
  - preloads `arena` + `scientist` from query,
  - auto-resumes queue from character-select when returning from failed `/play` entry.
- Updated [OpponentFound.tsx](/d:/projects/Cora/apps/web/src/components/lobby/OpponentFound.tsx):
  - removed fake/static opponent scientist + mock wallet text,
  - pushes `/play` with `scientist` and pre-signed `depositSig` query params after successful signing.
- Updated [BattleScreen.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx):
  - added live match clock (`mm:ss`) from socket timer,
  - added round HUD (`Round X/3`) that starts at round 1 and advances from `roundsWon`,
  - removed question ID from question modal and post-match outcome list,
  - shows real opponent wallet address from live game state,
  - removed in-`/play` duplicate deposit modal,
  - auto-sends pre-signed deposit signature on `depositing` status,
  - added no-refresh recovery CTA (`Return And Requeue`) when room connection fails.
- Validation run:
  - `npm run lint` in `apps/web` passed.

### The Reasoning
- Team test feedback showed friction around duplicate deposit signing, missing match HUD context (time/round), mock-looking opponent info, and needing manual refresh after play-entry failure.
- Passing `depositSig` from lobby signing to `/play` keeps deposit signing in one place and removes redundant wallet prompts.
- Resume queue params (`resumeQueue`, `arena`, `scientist`) allow fast recovery paths without restarting browser state.

### The Tech Debt
- Opponent identity on the found screen is now neutral (non-mock) but still not full profile data; backend would need opponent metadata in matchmaking payload (or a pre-play room snapshot endpoint) for richer identity rendering before `/play`.
- Round HUD currently assumes best-of-3 (`2 rounds to win`) from current game logic constants; if this becomes configurable, FE should read it from shared config/event payload.

## 2026-05-01 - Integration Runtime Guards (Env Modes, /play Context Gate, Mode Banner)

### The Change
- Added runtime mode parser in [runtimeModes.ts](/d:/projects/Cora/apps/web/src/lib/config/runtimeModes.ts):
  - validates `NEXT_PUBLIC_DEPOSIT_MODE` and `NEXT_PUBLIC_SETTLEMENT_MODE` (`mock | phantom`),
  - validates `NEXT_PUBLIC_ALLOW_DEV_ADDRESS_FALLBACK` (`true | false`),
  - provides safe fallbacks with dev warnings for invalid values.
- Added shared integration notice UI in [IntegrationModeBanner.tsx](/d:/projects/Cora/apps/web/src/components/ui/IntegrationModeBanner.tsx).
- Updated [LobbyScreen.tsx](/d:/projects/Cora/apps/web/src/components/lobby/LobbyScreen.tsx):
  - reads runtime modes via helper,
  - shows Integration Mode banner when deposit or settlement is still in mock mode.
- Updated [BattleScreen.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx):
  - switched env reads to typed runtime config helper,
  - added strict `/play` context guard (requires `roomId`, `arena`, `token`, valid `wager`),
  - blocks ambiguous play entry and routes user back safely,
  - shows Integration Mode banner in both guard and normal play surfaces.
- Kept [apps/web/.env.example](/d:/projects/Cora/apps/web/.env.example) keys documented with explanations and empty values for local override safety.
- Validation run:
  - `npm run lint` in `apps/web` passed.

### The Reasoning
- E2E integration testing with Web3 should fail fast when route/session context is incomplete, instead of entering partial battle state.
- Runtime mode parsing centralizes env behavior and prevents silent misconfiguration from typos.
- Explicit in-app “integration mode” state helps QA align expectations while BE escrow/settlement wiring is still partial.

### The Tech Debt
- Integration banner is currently non-dismissible and global; if it becomes noisy, move to a compact status chip with tooltip.
- `/play` context guard currently enforces query params only; once shared match state storage exists, migrate guard to store/session source of truth.

## 2026-05-01 - Matchmaking To Game Sync Fixes (Found-Phase Gating + Round Source Alignment)

### The Change
- Updated [OpponentFound.tsx](/d:/projects/Cora/apps/web/src/components/lobby/OpponentFound.tsx):
  - replaced static `Matched Rival` with socket-backed opponent identity display (wallet + deterministic scientist profile selection),
  - added found-phase room socket usage via `useMatchSocket` so deposit confirmation is sent to backend from lobby found-phase,
  - changed play entry gating so FE routes to `/play` only when backend status is `playing` (both deposits confirmed),
  - added retryable connection warning card in found-phase when room socket drops.
- Updated [LobbyScreen.tsx](/d:/projects/Cora/apps/web/src/components/lobby/LobbyScreen.tsx):
  - passes full scientist roster into found-phase for opponent scientist presentation.
- Updated [BattleScreen.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx):
  - switched round HUD source from FE-derived `roundsWon` math to backend-provided `gameState.currentRound` and `gameState.roundsToWin`.
- Validation run:
  - `npm run lint` in `apps/web` passed.

### The Reasoning
- Team testing exposed a sync gap where one player could enter battle UI before the second player finished deposit confirmation.
- Backend already owns authoritative room status transitions (`depositing -> playing`), so FE should wait for that transition before routing.
- Round display desync was caused by FE-side inference; using server-emitted round fields keeps both players aligned.

### The Tech Debt
- Opponent scientist shown in found-phase is still a deterministic FE fallback derived from opponent address. True opponent-selected scientist should come from backend matchmaking/room metadata when available.
- Found-phase uses room socket directly now; if lobby socket responsibilities expand, we should extract this into a dedicated pre-play session hook to avoid duplicate flow logic.

## 2026-05-01 - Match Sync Reliability Pass (Winner Mapping + Phase HUD + Deposit Flow UX)

### The Change
- Updated [useMatchSocket.ts](/d:/projects/Cora/apps/web/src/hooks/useMatchSocket.ts):
  - hardened `matchResult` parsing to support two backend payload shapes currently emitted:
    - settlement payload (`winner`, `matchId`, `settlementSignature`, `serverPublicKey`)
    - summary payload (`winnerAddress`, `reason`, `finalScores`, `finalHealth`)
  - added separate `matchSummaryResult` state so winner derivation no longer depends on a single payload shape,
  - added socket event capture for `depositUnlocked` and `opponentFailedDeposit` timestamps.
- Updated [BattleScreen.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx):
  - winner/result text now resolves from settlement payload OR summary payload OR invalidation payload (in that order),
  - added a dedicated game phase badge near status (`Phase: Normal` / `Phase: Extra Point x2`),
  - added one-time top-corner toast when phase switches to `extra_point`.
- Updated [OpponentFound.tsx](/d:/projects/Cora/apps/web/src/components/lobby/OpponentFound.tsx):
  - keeps deposit countdown running after local sign (so signed players still time out/requeue if room does not advance),
  - reacts to `opponentFailedDeposit` by auto-returning to queue flow,
  - improved sign button helper text to explain disabled/waiting reasons (wallet not connected, socket issue, waiting opponent).
- Validation run:
  - `npm run lint` in `apps/web` passed.

### The Reasoning
- Team test sessions exposed two consistency gaps:
  - winner banner could show wrong outcome because backend currently emits multiple `matchResult` payload shapes,
  - phase transitions (`normal` -> `extra_point`) were not explicit in HUD/feedback.
- Deposit-phase UX needed clearer state signaling to reduce confusion around Phantom prompt timing and waiting behavior.

### The Tech Debt
- Opponent scientist identity remains a frontend fallback until backend adds `scientistId` in room/game payloads.
- Sequential deposit role semantics are partially backend-driven (`depositUnlocked`), but FE still lacks an explicit authoritative role field from backend for strict role-gated button enablement.

## 2026-05-01 - FE Deposit UX Lock (Temporary, No-BE-Role Fallback)

### The Change
- Updated [OpponentFound.tsx](/d:/projects/Cora/apps/web/src/components/lobby/OpponentFound.tsx) with a frontend-only deposit lock UX:
  - deterministic temporary lock on one side while waiting for `depositUnlocked`,
  - fallback auto-unlock after 5 seconds to prevent deadlock when FE role inference differs from backend role assignment,
  - lock reason surfaced in helper text (`Waiting for server unlock...`),
  - sign button disabled while temporary lock is active.
- Validation run:
  - `npm run lint` in `apps/web` passed.

### The Reasoning
- Backend sequential deposit is not fully hard-gated yet for early `playerB` submissions.
- FE lock provides immediate UX guidance and reduces accidental out-of-order signing during team testing.
- Fallback unlock keeps matches from stalling due to missing authoritative role field in current socket payloads.

### The Tech Debt
- This is a UX-level guard only; true enforcement must remain backend-side.
- Temporary role inference should be removed once backend sends authoritative role metadata for each player.

## 2026-05-01 - Found-Phase Lock Visual + Timeout Tuning

### The Change
- Updated [OpponentFound.tsx](/d:/projects/Cora/apps/web/src/components/lobby/OpponentFound.tsx):
  - lock-state sign button now uses an explicit gray background and muted text color (not text-only indicator),
  - extended found-phase signing timeout from 15s to 30s.
- Validation run:
  - `npm run lint` in `apps/web` passed.

### The Reasoning
- Team testing feedback requested clearer visual distinction for lock state to reduce confusion during sequential deposit wait.
- A 30s window is more forgiving for real-wallet interaction latency and teammate coordination during match entry.

### The Tech Debt
- Timeout value is still hardcoded in FE; once BE timing is finalized, move to shared config/contract to prevent drift.

## 2026-05-02 - Reusable Character Select Extraction (Flow-Agnostic Refactor)

### The Change
- Added a new shared character module:
  - [characterTypes.ts](/d:/projects/Cora/apps/web/src/components/character/characterTypes.ts)
  - [CharacterCard.tsx](/d:/projects/Cora/apps/web/src/components/character/CharacterCard.tsx)
  - [CharacterSelect.tsx](/d:/projects/Cora/apps/web/src/components/character/CharacterSelect.tsx)
- Refactored lobby character screen to consume the shared selector:
  - [apps/web/src/components/lobby/CharacterSelect.tsx](/d:/projects/Cora/apps/web/src/components/lobby/CharacterSelect.tsx)
- The shared selector is now controlled by props and supports:
  - `selectedCharacterId` + `onSelect(characterId)`
  - `locked` state
  - `disabled` state
  - selected visual badge
  - optional countdown slot / `deadlineMs`
  - optional opponent status slot / `opponentStatus`
- Validation run:
  - `npm run lint --workspace=web` passed.

### The Reasoning
- The team has not finalized whether character selection lives pre-queue or post-deposit. Extracting a reusable, controlled selector now keeps UI work reusable across both flow options.
- Decoupling selection UI from lobby orchestration prevents coupling to queue/deposit behavior and reduces rework when BE finalizes room phases.
- Building slot-based metadata surfaces (countdown/opponent status) gives us a single component that can cover both normal flow and future locked/timeout selection phases.

### The Tech Debt
- The current lobby still maps between `Scientist` (lobby-local type) and shared character option props; we should converge on a single shared character domain type once BE/shared-types contract is finalized.
- Countdown and opponent status are currently optional UI hooks only; they are not yet wired to authoritative backend events.
- Character selection remains visual/UI-level in this refactor; no gameplay stat integration is included yet.

## 2026-05-02 - Room Phase Shell + Shared Phase Labels (Flow-Agnostic Foundation)

### The Change
- Added reusable room phase type contract in [roomPhaseTypes.ts](/d:/projects/Cora/apps/web/src/components/room/roomPhaseTypes.ts):
  - `RoomPhase` union includes `setup`, `matchmaking`, `depositing`, `selecting_character`, `playing`, `finished`, `error`.
  - `ROOM_PHASE_LABELS` map centralizes default eyebrow/title/subtitle metadata per phase.
- Added reusable phase header in [RoomPhaseHeader.tsx](/d:/projects/Cora/apps/web/src/components/room/RoomPhaseHeader.tsx) with:
  - title/subtitle slots
  - status slot
  - optional right-side panel slot
- Added reusable phase wrapper in [RoomPhaseShell.tsx](/d:/projects/Cora/apps/web/src/components/room/RoomPhaseShell.tsx) with:
  - shared container/layout
  - header integration
  - footer slot
  - optional motion transition wrapper reusing existing lobby easing/timing profile
- Integrated shell into lobby character selection screen:
  - [apps/web/src/components/lobby/CharacterSelect.tsx](/d:/projects/Cora/apps/web/src/components/lobby/CharacterSelect.tsx)
  - kept existing behavior, only changed composition.
- Added local preview-only mocked `selecting_character` phase in lobby:
  - [apps/web/src/components/lobby/LobbyScreen.tsx](/d:/projects/Cora/apps/web/src/components/lobby/LobbyScreen.tsx)
  - enabled by query param `?previewPhase=selecting_character`.
- Validation run:
  - `npm run lint --workspace=web` passed.

### The Reasoning
- Flow order is still under team decision, so we need a phase-driven UI foundation that can mount either sequence without rewriting screen scaffolding.
- Centralizing phase labels removes repeated copy decisions across screens and gives FE/BE a clearer shared language for room states.
- Query-param preview gives quick local validation for a future `selecting_character` state while avoiding premature runtime wiring in production flow.

### The Tech Debt
- The preview phase is intentionally FE-only and not connected to backend room state; it should be removed or moved to a dedicated `/dev` surface once BE emits authoritative `selecting_character` status.
- `RoomPhase` currently lives in FE-only types; once backend/shared-types settles, we should align this with cross-team contracts to prevent terminology drift.

## 2026-05-02 - Character Select Header Duplication Fix (Post-Refactor)

### The Change
- Updated shared selector in [CharacterSelect.tsx](/d:/projects/Cora/apps/web/src/components/character/CharacterSelect.tsx):
  - added `showHeading?: boolean` prop (default `true`) to allow host screens to suppress internal heading rendering when wrapped by a phase shell.
- Updated lobby wrapper usage in [lobby/CharacterSelect.tsx](/d:/projects/Cora/apps/web/src/components/lobby/CharacterSelect.tsx):
  - passed `showHeading={false}` so the room phase header is the only heading source.
- Validation run:
  - `npm run lint --workspace=web` passed.

### The Reasoning
- After introducing `RoomPhaseShell`, the lobby character screen rendered two headings (`RoomPhaseHeader` + shared `CharacterSelect` heading). The new heading toggle keeps shared component portability while avoiding duplicate hierarchy in shell-based layouts.

### The Tech Debt
- Header ownership is now host-driven in shell compositions and component-driven in standalone compositions. We should document this pattern in UI component conventions to avoid future mixed-header regressions.

## 2026-05-02 - Deposit Panel Refactor (Character-Agnostic UI + Status Types)

### The Change
- Added reusable deposit status contract:
  - [depositTypes.ts](/d:/projects/Cora/apps/web/src/components/deposit/depositTypes.ts)
  - introduced `DepositStatus` union (`idle`, `wallet_required`, `signing`, `submitted`, `confirmed`, `waiting_opponent`, `opponent_failed`, `expired`, `error`).
- Added reusable deposit UI primitives:
  - [DepositStatusCard.tsx](/d:/projects/Cora/apps/web/src/components/deposit/DepositStatusCard.tsx)
  - [DepositPanel.tsx](/d:/projects/Cora/apps/web/src/components/deposit/DepositPanel.tsx)
- Refactored lobby found-phase deposit UI in [OpponentFound.tsx](/d:/projects/Cora/apps/web/src/components/lobby/OpponentFound.tsx):
  - replaced inline deposit block with `DepositPanel`.
  - mapped existing wallet/signing/socket states into shared `DepositStatus`.
  - wired retry and cancel action slots.
  - surfaced deposit signature via dedicated signature slot.
  - kept component fully unaware of character mechanics.
- Validation run:
  - `npm run lint --workspace=web` passed.

### The Reasoning
- Deposit UX is needed in multiple contexts and should not be tied to one lobby screen implementation.
- Moving status semantics into shared types reduces drift between “what state we are in” and “what UI we render.”
- Slot-based actions (`retry`, `cancel`, wallet slot, extra slot) let the host screen inject flow-specific controls while keeping the panel reusable.

### The Tech Debt
- `OpponentFound` currently maps local state to `DepositStatus`; once backend exposes stronger authoritative deposit state fields, this mapping should move to a shared adapter/helper.
- `/play` still contains settlement confirmation UI that follows a similar state pattern but is not yet migrated to shared deposit/transaction panel primitives.

## 2026-05-02 - Room Status Indicators + Character Select State Surfaces

### The Change
- Added reusable room status primitives:
  - [CountdownBar.tsx](/d:/projects/Cora/apps/web/src/components/room/CountdownBar.tsx)
  - [PlayerRoomStatus.tsx](/d:/projects/Cora/apps/web/src/components/room/PlayerRoomStatus.tsx)
  - [RoomStatusRail.tsx](/d:/projects/Cora/apps/web/src/components/room/RoomStatusRail.tsx)
- Added compact room badges and styling support for:
  - `Connected`, `Matched`, `Deposited`, `Selecting`, `Locked`, `Auto-assigned`, `Ready`
- Expanded shared character types in [characterTypes.ts](/d:/projects/Cora/apps/web/src/components/character/characterTypes.ts):
  - added `CharacterSelectionState` union
  - added `locked` to `OpponentCharacterStatus`
- Upgraded shared character components:
  - [CharacterCard.tsx](/d:/projects/Cora/apps/web/src/components/character/CharacterCard.tsx):
    - added `autoAssigned` badge path
    - added neutral default badge path
  - [CharacterSelect.tsx](/d:/projects/Cora/apps/web/src/components/character/CharacterSelect.tsx):
    - added selection state copy (`idle/selected/locked/auto_assigned/expired`)
    - integrated reusable countdown bar
    - added auto-pick helper copy
    - added default selection status rail with player/opponent status rows
    - added neutral default + auto-assigned character support
- Updated selecting-character preview in [LobbyScreen.tsx](/d:/projects/Cora/apps/web/src/components/lobby/LobbyScreen.tsx):
  - supports query-driven UI state previews:
    - `?previewPhase=selecting_character`
    - optional `previewSelectState=selected|locked|auto_assigned|expired`
    - optional `previewOpponentStatus=waiting|picked|locked|auto_assigned|hidden`
- Updated found/deposit screen in [OpponentFound.tsx](/d:/projects/Cora/apps/web/src/components/lobby/OpponentFound.tsx):
  - integrated `RoomStatusRail` with player/opponent deposit readiness rows.
- Validation run:
  - `npm run lint --workspace=web` passed.

### The Reasoning
- We need deterministic, flow-agnostic UI surfaces that allow QA and demo rehearsal without waiting on live opponent timing.
- Shared status/badge primitives make room progress legible to judges and testers while reducing duplicated screen-specific UI logic.
- Character state visuals were expanded as pure FE state presentation without introducing BE contract assumptions.

### The Tech Debt
- Badge state mapping in `OpponentFound` still derives from local FE heuristics. Once BE emits authoritative character/deposit readiness fields, these mappings should be replaced by contract-driven adapters.
- The default status rail inside shared `CharacterSelect` is useful for preview and scaffolding, but final product screens may want host-specific rails for tighter density and copy control.

## 2026-05-02 - Runtime Room/Play Hardening (State Guards + Failure Recovery)

### The Change
- Updated socket runtime state handling in [useMatchSocket.ts](/d:/projects/Cora/apps/web/src/hooks/useMatchSocket.ts):
  - added explicit `reconnecting` connection state,
  - improved reconnect lifecycle state transitions and issue reset behavior.
- Hardened lobby runtime guards in [LobbyScreen.tsx](/d:/projects/Cora/apps/web/src/components/lobby/LobbyScreen.tsx):
  - added phase-context recovery surface to prevent blank render when required room context is missing,
  - added wallet-disconnected warning while in `waiting`/`found` phases,
  - added session-based draft restore/persist (`arenaId` + `scientistId`) to reduce refresh damage during demo/testing.
- Hardened found/deposit runtime behavior in [OpponentFound.tsx](/d:/projects/Cora/apps/web/src/components/lobby/OpponentFound.tsx):
  - requires active socket connection before allowing deposit signing,
  - added reconnecting-specific helper copy and retry surfaces.
- Hardened play runtime failure UX in [BattleScreen.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx):
  - added reconnecting alert state,
  - added room-sync loading card after refresh/rejoin,
  - added explicit play-state gate (`room not in playing state yet`) with recovery actions,
  - improved opponent metadata fallback labels when payload is not yet available.
- Validation run:
  - `npm run lint --workspace=web` passed.

### The Reasoning
- We needed to avoid demo-breaking “silent” states (blank/ambiguous room surfaces) when refresh, socket instability, or partial route context occurs.
- Explicit reconnecting and play-state gating reduces confusion for judges/testers by turning hidden runtime transitions into clear UI states with recovery actions.
- Persisting lobby draft inputs keeps user intent (arena + character choice) across refresh so recovery is faster and less destructive.

### The Tech Debt
- Lobby draft persistence is FE-only session storage and not authoritative; long-term we should move to backend/session-backed room snapshots.
- Play-state gate currently relies on FE interpretation of `gameState.status`; if BE emits a dedicated room readiness field, we should switch to that source-of-truth.
- Opponent metadata fallback remains a temporary UI safeguard until backend guarantees richer opponent payload consistency at all pre-play/play phases.

## 2026-05-02 - Dev-Only Fallback Gating (Explicit Env Flags)

### The Change
- Extended runtime config in [runtimeModes.ts](/d:/projects/Cora/apps/web/src/lib/config/runtimeModes.ts):
  - added `allowDevCharacterFallback`,
  - added `allowDevRoomPreview`.
- Updated [OpponentFound.tsx](/d:/projects/Cora/apps/web/src/components/lobby/OpponentFound.tsx):
  - deterministic opponent scientist fallback now runs only when `NEXT_PUBLIC_ALLOW_DEV_CHARACTER_FALLBACK=true`.
- Updated [LobbyScreen.tsx](/d:/projects/Cora/apps/web/src/components/lobby/LobbyScreen.tsx):
  - `?previewPhase=selecting_character` rendering now requires `NEXT_PUBLIC_ALLOW_DEV_ROOM_PREVIEW=true`.
- Updated env documentation in [apps/web/.env.example](/d:/projects/Cora/apps/web/.env.example):
  - documented `NEXT_PUBLIC_ALLOW_DEV_CHARACTER_FALLBACK`,
  - documented `NEXT_PUBLIC_ALLOW_DEV_ROOM_PREVIEW`.
- Validation run:
  - `npm run lint --workspace=web` passed.

### The Reasoning
- Demo and judge-facing runs should not silently depend on synthetic FE fallbacks.
- Dev tooling (preview states, deterministic placeholders) is still useful, but must be opt-in and explicit.
- Centralizing these toggles in runtime config keeps behavior predictable across environments.

### The Tech Debt
- Opponent character remains non-authoritative until backend includes opponent character payload in pre-play room state.
- Dev-preview query params still share the lobby route; if they expand, we should move them into a dedicated `/dev` surface.

## 2026-05-02 - Flow-Safe Room State Preview Surface (/dev/room-states)

### The Change
- Added a dedicated local preview route:
  - [apps/web/src/app/dev/room-states/page.tsx](/d:/projects/Cora/apps/web/src/app/dev/room-states/page.tsx)
- Built a mock-driven room-state lab using existing reusable components:
  - `RoomPhaseShell`
  - shared `CharacterSelect`
  - shared `DepositPanel`
  - `RoomStatusRail`
- Included quick presets for both flow contexts:
  - Old flow style (`pre_queue`)
  - New flow style (`post_deposit`)
  - timeout auto-assign
  - locked/ready
- Added manual controls to switch:
  - room phase
  - selection state
  - opponent status
  - deposit status
  - countdown presence/value
- Added selection-state normalization in preview controls:
  - switching to `idle` clears `selectedCharacterId` and `autoAssignedCharacterId`
  - switching to `auto_assigned` clears selected id and ensures a default auto-assigned id exists
- Route respects the explicit dev flag:
  - shows disabled gate unless `NEXT_PUBLIC_ALLOW_DEV_ROOM_PREVIEW=true`.
- Validation run:
  - `npm run lint --workspace=web` passed.

### The Reasoning
- FE needed a stable UI test surface that does not depend on live opponents, socket timing, or unresolved flow-order decisions.
- Reusing extracted components verifies that recent refactors are truly flow-agnostic and portable.
- Presets plus manual controls support both quick regression checks and deeper UI-state QA before BE contracts are finalized.
- Selection normalization keeps manual test combinations semantically correct (`idle` no longer shows a stale selected character).

### The Tech Debt
- This surface is mock-only and does not validate backend contracts/events; once shared room-state payloads stabilize, we should add a contract-mock adapter layer.
- The preview route includes inline mock data; if more dev previews are added, centralizing mock fixtures would reduce duplication.
- This normalization currently lives in the dev preview page only; if we add more state labs, we should extract shared preview state helpers.

## 2026-05-02 - Landing Polish Pass (DESIGN.md Alignment + Scientist Roster Refactor)

### The Change
- Reworked global design tokens in [globals.css](/d:/projects/Cora/apps/web/src/app/globals.css):
  - added explicit `DESIGN.md` palette primitives (`#274137`, `#9db496`, `#cbe3c1`, `#f8d694`, `#ba6931`, `#6f3a28`),
  - remapped semantic landing/UI tokens to the new palette,
  - preserved backward-compatible `--amber` / `--teal` aliases to avoid breaking non-landing screens,
  - switched default body/UI typography to `Gabarito` and kept `Caprasimo` for display classes.
- Added reusable landing domain modules:
  - [content.ts](/d:/projects/Cora/apps/web/src/components/landing/content.ts)
  - [visuals.ts](/d:/projects/Cora/apps/web/src/components/landing/visuals.ts)
- Refactored landing sections to consume shared content/style helpers and match design direction:
  - [Hero.tsx](/d:/projects/Cora/apps/web/src/components/landing/Hero.tsx)
  - [Navbar.tsx](/d:/projects/Cora/apps/web/src/components/landing/Navbar.tsx)
  - [TokenMarquee.tsx](/d:/projects/Cora/apps/web/src/components/landing/TokenMarquee.tsx)
  - [HowItWorks.tsx](/d:/projects/Cora/apps/web/src/components/landing/HowItWorks.tsx)
  - [Features.tsx](/d:/projects/Cora/apps/web/src/components/landing/Features.tsx)
  - [VideoSlot.tsx](/d:/projects/Cora/apps/web/src/components/landing/VideoSlot.tsx)
  - [CtaBanner.tsx](/d:/projects/Cora/apps/web/src/components/landing/CtaBanner.tsx)
  - [Footer.tsx](/d:/projects/Cora/apps/web/src/components/landing/Footer.tsx)
  - [CursorGlow.tsx](/d:/projects/Cora/apps/web/src/components/landing/CursorGlow.tsx)
- Replaced animal roster copy/structure with the agreed scientist lineup:
  - Einstein
  - Marie Curie
  - Alan Turing
  - included scientist-specific base concepts (Relativity Lab, Radium Reactor, Cipher Engine).
- Preserved angular `frame-cut` component language while softening borders/shadows to match warm-vintage direction.
- Validation run:
  - `npm run lint --workspace=web` passed.

### The Reasoning
- `DESIGN.md` requires vintage-warm palette + explicit font pairing (`Caprasimo` headline/logo and `Gabarito` body/UI), so token and typography alignment needed to happen at global level first.
- Extracting landing copy/state into `content.ts` and accent mappings into `visuals.ts` reduces duplication and keeps future branch work (flow-order changes, scientist detail tuning, localized copy) low-risk and centralized.
- Keeping angular frames while softening border tone/shadows supports the desired contrast: cute chibi scientist identity inside a still-structured competitive arena shell.

### The Tech Debt
- Scientist visuals are still text/initial placeholders in landing cards. Once designer assets are available, these should be replaced with actual chibi portraits/illustrations.
- Landing roster/base descriptions are FE-side content constants only; when backend/shared contracts include canonical scientist/base metadata, this content should be sourced from shared-types or API payloads.
- Some non-landing surfaces still inherit legacy visual assumptions through compatibility aliases. After broader UI migration, we should retire alias tokens and use only semantic DESIGN.md tokens.

## 2026-05-02 - Landing Encoding Hotfix (UTF-8 Parse Failure)

### The Change
- Normalized landing and related style files to UTF-8 (no BOM) to resolve Next.js parser failure (`invalid utf-8 sequence`) triggered from [Footer.tsx](/d:/projects/Cora/apps/web/src/components/landing/Footer.tsx).
- Re-encoded the updated landing stack and shared landing modules:
  - [globals.css](/d:/projects/Cora/apps/web/src/app/globals.css)
  - [Hero.tsx](/d:/projects/Cora/apps/web/src/components/landing/Hero.tsx)
  - [Navbar.tsx](/d:/projects/Cora/apps/web/src/components/landing/Navbar.tsx)
  - [TokenMarquee.tsx](/d:/projects/Cora/apps/web/src/components/landing/TokenMarquee.tsx)
  - [HowItWorks.tsx](/d:/projects/Cora/apps/web/src/components/landing/HowItWorks.tsx)
  - [Features.tsx](/d:/projects/Cora/apps/web/src/components/landing/Features.tsx)
  - [VideoSlot.tsx](/d:/projects/Cora/apps/web/src/components/landing/VideoSlot.tsx)
  - [CtaBanner.tsx](/d:/projects/Cora/apps/web/src/components/landing/CtaBanner.tsx)
  - [Footer.tsx](/d:/projects/Cora/apps/web/src/components/landing/Footer.tsx)
  - [CursorGlow.tsx](/d:/projects/Cora/apps/web/src/components/landing/CursorGlow.tsx)
  - [content.ts](/d:/projects/Cora/apps/web/src/components/landing/content.ts)
  - [visuals.ts](/d:/projects/Cora/apps/web/src/components/landing/visuals.ts)
- Validation run:
  - `npm run lint --workspace=web` passed.

### The Reasoning
- The runtime error indicates source decoding failure before compilation. Re-encoding to UTF-8 restores parser compatibility and prevents cross-platform editor/CLI encoding drift.

### The Tech Debt
- The repo currently lacks an explicit encoding guardrail. Add `.editorconfig` and/or a pre-commit check to enforce UTF-8 on TS/TSX/CSS files.

## 2026-05-02 - Landing Multi-Vibe Color Pass (Divider-Deemphasis)

### The Change
- Kept landing composition divider-free in [page.tsx](/d:/projects/Cora/apps/web/src/app/page.tsx) (no section-divider coupling in the main flow).
- Reworked section atmospheres with distinct palette-driven backgrounds while preserving readability:
  - [Hero.tsx](/d:/projects/Cora/apps/web/src/components/landing/Hero.tsx): layered warm-cream/sage/clay radial + linear blend for intro identity.
  - [TokenMarquee.tsx](/d:/projects/Cora/apps/web/src/components/landing/TokenMarquee.tsx): white card-like ticker lane with subtle side-tinted radial wash and centered marquee track.
  - [HowItWorks.tsx](/d:/projects/Cora/apps/web/src/components/landing/HowItWorks.tsx): structured sage-leaning gradient scene plus soft ambient blobs.
  - [Features.tsx](/d:/projects/Cora/apps/web/src/components/landing/Features.tsx): warm clay/cream spotlight treatment to differentiate roster zone.
  - [VideoSlot.tsx](/d:/projects/Cora/apps/web/src/components/landing/VideoSlot.tsx): cooler green-to-cream cinematic field to separate replay section tone.
- Added centered marquee keyframes/utilities in [globals.css](/d:/projects/Cora/apps/web/src/app/globals.css):
  - `@keyframes marqueeCentered`
  - `.animate-marquee-centered`
- Validation run:
  - `npm run lint --workspace=web` passed.

### The Reasoning
- The previous landing read as visually flat because large sections shared nearly identical base surfaces.
- Assigning each section a unique but related color atmosphere creates stronger narrative rhythm without abandoning the approved warm-vintage system.
- Keeping transitions implicit via background contrast (instead of decorative dividers) better matches the requested “different vibes” direction.

### The Tech Debt
- Gradient recipes are still inline per section; if this style direction stabilizes, we should extract them into reusable semantic theme tokens (e.g., `--landing-hero-bg`, `--landing-flow-bg`) for easier iteration.
- Marquee centering assumes current ticker density; if content count/width changes heavily, motion duration and phase may need re-tuning.

## 2026-05-03 - Landing Palette Accent Expansion (3 Surgical Additions from DESIGN.md Palettes)

### The Change
- Added `## Additional Accent Tokens` section to `docs/DESIGN.md` documenting which colors were pulled from which palette and why.
- Added 3 new CSS primitive tokens to `apps/web/src/app/globals.css`:
  - `--tone-dark: #121919` (near-black from Palette 2)
  - `--tone-teal: #3c5c5f` (dark teal from Palette 1)
  - `--tone-ecru: #e0ddaa` (warm ecru from Palette 3)
- Swapped `--accent-secondary` from `var(--tone-sage)` → `var(--tone-teal)` and updated all derived secondary tokens (`-light`, `-dim`, `-glow`). The `--teal` backward-compat alias chain updates automatically.
- Added `--color-surface-highlight: var(--tone-ecru)` to the `@theme inline` block as a new named surface token.
- Fixed `--color-accent-2-fg` from `#274137` → `#fffaf0` (ecru/white is readable on dark teal; forest green was not).
- Updated `apps/web/src/components/landing/CtaBanner.tsx` dark section gradient from `#274137 → #6f3a28` to `#121919 → #274137` — gives the only dark section on the landing a true near-black anchor.
- Updated `apps/web/src/components/landing/Features.tsx` scientist card portrait area from `--color-surface-alt` to `--color-surface-highlight` (ecru) for a vintage-academic feel.

### The Reasoning
- `--accent-secondary` (sage `#9db496`) was too low-saturation and low-contrast to carry active accent weight on cream/parchment backgrounds. The on-chain phase markers (Escrow, Settlement) looked muted — exactly the opposite of "authoritative blockchain transaction". Dark teal `#3c5c5f` is still clearly within the DESIGN.md palette family but has real visual presence.
- The CtaBanner was the only dark section on the landing, but its gradient (`forest → bark`) used two warm-similar tones at similar brightness. Stepping to near-black creates a stronger contrast rhythm — the eye needs a genuine dark rest beat after the warm-cream scroll.
- Ecru `#e0ddaa` on the scientist card portrait areas adds the olive-warm quality that reads as "aged academic paper" — appropriate for historical scientist characters — without disturbing the rest of the card layout.
- All 3 additions stayed 100% within DESIGN.md palette source material, so no rogue hex values were introduced.

### The Tech Debt
- `--tone-sage` is still defined as a primitive token and still used as a background tint in Hero, HowItWorks, Features, and TokenMarquee (radial blobs, ambient washes). This is correct and intentional — sage as a background tint is fine. Only its role as an active accent was replaced.
- The `--teal` alias now resolves to dark teal instead of sage. Non-landing screens that reference `--teal` directly should be audited to confirm the darker value still reads correctly in their context.
- `--color-surface-highlight` is currently only applied in `Features.tsx`; if ecru surfaces are used elsewhere, we should document the token's intended usage scope to prevent misapplication on components where it would clash.

## 2026-05-03 - Landing Section Color Temperature Pass (Warm vs Green Coherence)

### The Change
- **Hero** (`Hero.tsx`): Pushed bg fully warm (`#fdf6e4 → #f8e9ca → #f2ddb0`), removed the sage green radial blob, kept clay orbs only. Added `text-[var(--tone-bark)]` to section so headings/copy inherit warm dark brown, not forest green.
- **HowItWorks** (`HowItWorks.tsx`): Flipped bg from mixed warm-green to fully green (`#deebd8 → #d0e5ca → #c4dfc0`). Replaced the bark blob with a forest blob. Forest green `--foreground` text now reads at home on a green section. Updated phase card surface to `#f0f6ee` (mint-white) and green-toned shadow so it lifts cleanly off the green background without looking stark.
- **Features** (`Features.tsx`): Pushed bg to more purely golden-warm (`#faebd4 → #f8e4c0 → #f5d9a0`), removed sage green radial. Added `text-[var(--tone-bark)]` to section. Updated border to clay-toned `rgba(186,105,49,0.2)`.
- **Footer** (`Footer.tsx`): Added `text-[var(--tone-bark)]` — Footer sits on warm parchment bg `--background`; bark text is coherent there.
- VideoSlot and Navbar were left unchanged — VideoSlot already leans green-cool; Navbar is transparent initially and transitions naturally.

### The Reasoning
- `--foreground` (`#274137`, forest green) is a cool-hued dark. On warm orange-cream backgrounds (`#f8e8c7`, `#f3dfbb`) it creates a temperature conflict — the eye reads it as a mismatch because green and orange sit on opposite sides of the color wheel.
- The fix is not to change the global `--foreground` (that would break other screens), but to assign each landing section a dominant temperature and override text only where needed:
  - **Green sections**: let forest green text be the natural foreground — it's coherent.
  - **Warm sections**: override to `--tone-bark` (`#6f3a28`) which is a warm dark brown — harmonious with cream/golden bgs and still high-contrast.
- This creates a clear scroll rhythm: warm → neutral (marquee) → green → warm → green-cool (videoslot) → dark (ctabanner) — each beat feels intentional.

### The Tech Debt
- `text-[var(--tone-bark)]` overrides are applied at the section level, which means any child that does not explicitly set a color will inherit bark. This is intentional but should be documented so future component additions inside warm sections don't need to manually re-apply `--foreground`.
- HowItWorks phase card surface is now a hardcoded `#f0f6ee` instead of a token. If the section bg ever changes, this may need manual retuning. Extracting a `--color-surface-green` token would be cleaner long-term.

## 2026-05-03 - Landing Dark Theme Pivot + Palette Accent Typography

### The Change
- **`globals.css`**: Flipped `--background` from warm parchment `#fbf4df` → near-black forest `#0f1a14`. `--foreground` from forest green `#274137` → warm white `#f4f0e6`. Updated all `@theme inline` surface/border/muted tokens for dark context (`--color-surface: #172318`, `--color-surface-alt: #1d2d23`, `--color-surface-highlight: #1a2a1c`, `--color-border: rgba(157,180,150,0.22)`, `--color-muted: #8fa897`). Also fixed `--color-gold` to use `--tone-cream` (gold reads on dark, clay doesn't). Fixed `.arena-grid` lines from dark forest rgba to light mint rgba (were invisible on dark bg). Dimmed `.frame-cut::after` inner border from 72% to 28% opacity.
- **`Hero.tsx`**: Dark forest bg gradient. Removed bark text override. Fixed orb `mixBlendMode` from `multiply` (darkens) → `screen` (glows on dark). Added `<span className="text-[var(--tone-cream)]">` around scientist names in subtitle.
- **`TokenMarquee.tsx`**: Dark bg `#111d17`. Edge fades changed from `from-white` → `from-[#111d17]`. Border opacity reduced.
- **`HowItWorks.tsx`**: Dark forest bg. Dark card surface via `var(--color-surface)`. Added `<span className="text-[var(--tone-mint)]">` around "2 on-chain transactions." in h2.
- **`Features.tsx`**: Dark bark-tinted bg. Removed bark text override. Added `<span className="text-[var(--tone-cream)]">` around "chibi scientist." in h2.
- **`VideoSlot.tsx`**: Dark bg. `thumbnailBackground` base changed to dark `rgba(15,26,20,0.9)`. Intro and panel overlay changed from white washes to dark washes.
- **`CtaBanner.tsx`**: Deepened to `#080c09 → #0f1a14`. Text updated to `#f4f0e6`. Already had cream accent on "Battle sharper." — preserved.
- **`Footer.tsx`**: Removed bark text override — foreground is now warm white globally.

### The Reasoning
- The root issue was color temperature clash (green text on orange bg). Multiple partial fixes (per-section text overrides) were tried first but each created new issues. The cleanest resolution is a dark base where the palette colors become accent glow elements against dark rather than conflicting dominants on light.
- On a dark bg, the DESIGN.md palette becomes vivid typography accents: `--tone-cream` (#f8d694, golden) for warm key nouns, `--tone-mint` (#cbe3c1, mint) for on-chain/blockchain moments. This is the exact pattern requested (white base text, palette colors for accent words).
- `mixBlendMode: multiply` on the Hero orb was correct for light backgrounds (it darkens into the cream). On dark backgrounds it makes the orb invisible (darkening into near-black). `screen` blend mode adds light, making the clay orb glow properly on dark.
- The lobby/play screens use their own explicit dark bg classes (`lobby-bg`, inline dark gradients) and were not affected by the `--background` change.

### The Tech Debt
- The global `--background` change affects all routes that rely on it without explicit bg overrides. The `/connect` page and any future simple pages should be checked to confirm they look correct on dark.
- Accent word spans (`<span>` with color class) are now inline in component JSX. If copy changes, these spans need manual updates. Extracting copy with accent markup into `content.ts` would keep copy and formatting together.
- `--tone-cream` is now used as both a CSS variable AND hardcoded as `"var(--tone-cream)"` in inline CtaBanner style. These should be consolidated if a theming utility layer is added later.



---

## 2026-05-03 — Landing Page Redesign: Collectible Game-Site Direction

### The Change

Full art-direction overhaul of the landing page. Shifted from dark Web3/dev dashboard aesthetic to a warm, collectible battle-game splash page inspired by Axie/Pixelmon-style landing pages.

**Files touched:**

- **`globals.css`**: Added warm-section CSS tokens (`--warm-bg`, `--warm-surface`, `--warm-border`, `--warm-text`, `--warm-muted`, `--warm-card-shadow`). Added `.game-card` (rounded, thick-bordered collectible card), `.btn-game` / `.btn-game-primary` / `.btn-game-secondary` (chunky game buttons with offset shadows), `.paper-grain` (subtle noise texture for warm sections). Added `floatCard`, `sparkle`, `slowSpin`, `driftX` keyframes and corresponding animation utility classes.
- **`content.ts`**: Added `emoji` and `baseEmoji` fields to `ScientistProfile` for placeholder visuals. Rewrote all `LANDING_STAGES` copy to be battle-narrative ("Enter the Queue", "Lock Your Wager", "Battle Begins", "Victor Takes All"). Changed domain labels from "Off-chain"/"On-chain" to "Arena"/"Blockchain". Updated ticker items.
- **`Hero.tsx`**: Complete rewrite. Cinematic centered game-poster hero with: slow-spinning oversized CORA emblem background, scattered science doodle emojis, sparkle dots, floating collectible mini-cards (one per scientist with avatar, archetype badge, HP bar), vignette layers, preserved cursor-following orb, game-oriented copy ("A collectible battle game of brilliant minds" / "Collect scientists. Break their bases. Outsmart the arena."), chunky `btn-game` CTAs ("Enter Arena" + "Meet the Minds"). Removed arena-grid from hero.
- **`Features.tsx`**: Moved to warm cream surface (`--warm-bg`) with `paper-grain` texture and dot pattern. Cards use `.game-card` instead of `.frame-cut`. Portrait area now has CSS chibi placeholder (emoji avatar in circular frame + coat body shape + base object icon + rarity badge + archetype badge + HP bar). Dark bark text on cream. Drawer mechanic preserved with warm-toned styling.
- **`HowItWorks.tsx`**: Moved to warm cream surface with paper-grain. Copy changed to "How battles unfold" / "Pick your mind. Predict the move. Shatter the base." Stage card uses `.game-card` style with rounded step indicators. Removed arena-grid from interior. Sticky scroll-progress preserved.
- **`VideoSlot.tsx`**: Stays dark (arena/demo moment). Copy updated: "Demo Video" → "Watch the duel flow", added play button icon, stronger placeholder text ("Arena gameplay coming soon"). Arena-grid kept here.
- **`CtaBanner.tsx`**: Stays dark. Copy updated: "Think warmer. Battle sharper." → "Enter the arena of impossible minds." Added subcopy. Added floating decorative mini-cards on right side. Uses `btn-game` button. Arena-grid kept.
- **`Footer.tsx`**: Fixed broken `©` encoding (mojibake `�` → `©`).
- **`Navbar.tsx`**: Nav labels updated: "Flow"→"Minds", "Roster"→"How It Works", "Replay"→"Arena". Order changed to match new section order.
- **`page.tsx`**: Section order changed: Features (roster) now comes before HowItWorks (battle flow).

### The Reasoning

- **Section rhythm**: The old page was almost entirely dark green with white text. The new rhythm is: cinematic dark hero → warm cream roster → warm cream battle explainer → dark arena demo → dark CTA. This creates visual breathing room and makes the warm palette from DESIGN.md actually visible.
- **Art direction**: Without final character illustrations, we used CSS-based placeholder visuals (emoji avatars, shaped silhouettes, rarity/archetype badges, HP bars, floating mini-cards, science doodles, sparkles). These create the right compositional structure so real art can be swapped in later.
- **Game-card vs frame-cut**: `.frame-cut` (clipped HUD corners) stays for dark/battle sections (VideoSlot, arena UI). Warm sections use `.game-card` (rounded, thick borders, cartoon offset shadow) which feels more collectible/game-like.
- **Copy shift**: Replaced developer-facing language ("Solana Devnet", "Match Architecture", "4 phases, 2 on-chain transactions") with player-facing language ("A collectible battle game", "How battles unfold", "Pick your mind"). Blockchain details remain but are secondary.
- **Preserved**: Fonts (Caprasimo + Gabarito), palette tokens, cursor orb, scroll-progress mechanic, drawer expand, entrance animations, TokenMarquee.

### The Tech Debt

- **Placeholder art**: All character visuals are emoji/CSS shapes. Need to swap with real illustrated chibi art when available. The `emoji` and `baseEmoji` fields in `ScientistProfile` can be replaced with image URLs.
- **FloatingCard positions**: Hard-coded absolute positions for hero floating cards. May need responsive tuning at unusual viewport sizes.
- **Warm/dark transitions**: The seam between warm sections (Features/HowItWorks) and dark sections (TokenMarquee above, VideoSlot below) could benefit from gradient transition strips if the hard color shift feels too abrupt.
- **paper-grain SVG**: Using inline SVG data URL for noise texture. If performance is a concern on low-end devices, this could be replaced with a static PNG or removed.

---

## 2026-05-03 — Navbar Polish: High-Blur Glassmorphism

### The Change
Updated the navbar to handle the new section-based color transitions (Dark Hero → Warm Roster) more smoothly.

- **`Navbar.tsx`**: Increased backdrop blur from standard `xl` to a heavy `28px` (custom inline style). Switched the scrolled background from a near-solid forest green to a semi-transparent dark tint (`rgba(10,18,14,0.55)`). Forced all nav text (logo and links) to white with a subtle drop shadow (`text-shadow`) to maintain legibility regardless of the background color behind the blur.

### The Reasoning
- Standard backdrop blur was insufficient to mask the high-contrast transition when moving from the dark Hero to the light-cream Features section.
- Permanent white text with a shadow prevents the need for complex "scroll-aware" text color switching logic. The semi-transparent dark tint behind the white text ensures it pops even when over the warm parchment backgrounds.

### The Tech Debt
- **Inline Styles**: Used inline styles for `backdropFilter` and `textShadow` for rapid iteration. These should eventually be moved to `globals.css` as utility classes (e.g., `.glass-heavy`) to keep the component clean.

## 2026-05-03 - Hero Token Hints, Copy Tightening & CTA Cleanup

### The Change
- Added `WagerToken` type and `WAGER_TOKENS` constant to `apps/web/src/components/landing/content.ts` — SOL (`#9945FF`) and BONK (`#F7931A`) as initial entries.
- Patched `apps/web/src/components/landing/Hero.tsx` to import `WAGER_TOKENS` and render a token pill strip in the hero. Each pill is a glassy rounded capsule styled with inline `borderColor`, `background`, and `boxShadow` derived from the token's brand color, with a subtle hover scale effect.
- Changed the hero token label from “Wager with” to “Arena tokens” so the token hint feels more game-native and less finance/gambling-coded.
- Removed the main `Enter Arena` and `Meet the Minds` CTA buttons from `apps/web/src/components/landing/Hero.tsx` to keep the hero closer to a cinematic game splash screen.
- Tightened the hero copy to reduce repetition and make it feel more premium:
  - Eyebrow: “A collectible battle game of brilliant minds”
  - Title: “CORA”
  - Tagline: “Collect scientists. Break bases. Outsmart rivals.”
  - Supporting line: “Pick your mind. Predict the move. Shatter the base.”
- Updated the Navbar CTA button in `apps/web/src/components/landing/Navbar.tsx` to use the `.btn-game-primary` class so the main app entry point still has the established chunky game-button styling, while keeping a smaller padding profile.

### The Reasoning
- The hero should act more like a game-fi splash screen / world reveal than a SaaS conversion block. Removing the large hero CTAs keeps focus on the title, fantasy, floating cards, and token elements.
- Token hints still answer “what tokens are available?” without turning the hero into a finance dashboard or overloading it with competing actions.
- “Arena tokens” fits the game-world language better than “Wager with,” while still making SOL and BONK visible near the first impression.
- The single Navbar CTA now acts as the main entry point to the application, reducing hero clutter while preserving a clear path to enter.
- Token data lives in `content.ts` alongside other landing data, keeping it as the single source of truth. Adding a new token later is a one-line array push.
- Inline style for token brand colors avoids extending the Tailwind config for two hex values; the pattern stays consistent with how existing accent glows are handled in other hero layers.

### The Tech Debt
- Token icons are emoji/Unicode glyphs (`◎` for SOL, `🐶` for BONK). Replace with proper SVG token logos once assets are available.
- Only SOL and BONK are wired; any new token the backend accepts should be reflected here simultaneously to avoid UI/backend drift.
- The Navbar CTA overrides padding locally using Tailwind classes (`!px-5 !py-2 !text-sm`) because `.btn-game` is intrinsically quite large. If we use this smaller button variant often, extract a `.btn-game-sm` utility.

## 2026-05-03 - Token Marquee Infinite Scroll Fix

### The Change
- Fixed infinite scrolling in `apps/web/src/components/landing/TokenMarquee.tsx`.
- Changed the animation class from `.animate-marquee-centered` back to `.animate-marquee` (which transforms `translateX(0)` to `translateX(-50%)`).
- Removed `justify-center` from the track's parent container to allow standard left-aligned overflow.

### The Reasoning
- The `animate-marquee-centered` approach (translating from `-25%` to `-75%`) was prone to visual jumping or right-side starvation when coupled with `justify-center` flex alignment, depending on the viewport width and total element width.
- Standard left-aligned `animate-marquee` (`0` to `-50%` over 4 copies of content) is the canonical way to achieve a seamless, jumping-free infinite scroll.

### The Tech Debt
- The marquee speed is hardcoded to 34s in `globals.css`. If we add significantly more tokens in the future, the track width will increase, which would cause the apparent scroll speed to increase. We may need to dynamically calculate duration based on item count later.

## 2026-05-03 - CtaBanner Floating Cards Include Turing

### The Change
- Updated `apps/web/src/components/landing/CtaBanner.tsx` to display all scientists from the `LANDING_SCIENTISTS` array instead of slicing to the first two.
- Mapped a third rotation value (`2deg`) for the newly added third floating card.

### The Reasoning
- The user requested the third scientist (Alan Turing) to be visible alongside Einstein and Marie Curie in the floating cards decoration block.

### The Tech Debt
- The rotation mapping `i === 0 ? "4deg" : i === 1 ? "-3deg" : "2deg"` is hardcoded for exactly 3 items. If more scientists are added in the future, a generic function or looping sequence for `--float-rot` will be needed.

## 2026-05-03 - Connect Wallet Screen Dark Cinematic Redesign

### The Change
- Refactored `apps/web/src/components/connect/ConnectWalletScreen.tsx` to match the landing page's dark cinematic arena aesthetic.
- Replaced the light background grid with a deep gradient (`from-[#121919] to-[#0a0f0c]`), a dark `.arena-grid`, depth vignette, and ambient radial glows (`--tone-clay`, `--tone-teal`, `--tone-sage`).
- Added animated background elements: a faint, oversized "C" emblem, floating emoji cards (🧪, 🧬, 🔬, ⚔️) using `.animate-float-card`, and floating sparkle orbs using `.animate-sparkle`.
- Redesigned the centered wallet connection panel into a dark game-card style using a thick `var(--tone-bark)` border, dark background (`#172318`), shadow drop, and an inner accent frame. Added a subtle `.animate-orb-breath` glow behind the panel.
- Updated the copy to fit the game lore ("Arena Access", "Enter the Arena", "Wallet synced: ...", "Enter Lobby").
- Changed the typography to use `--font-caprasimo` and `--font-gabarito`. Connected status uses `font-mono`.
- Styled the "Continue" link using the `.btn-game .btn-game-primary` chunky button style.

### The Reasoning
- The user wanted the wallet connection screen to feel like an "arena gate" screen that matches the rest of the dark landing page direction, rather than a generic SaaS auth page or a light-themed placeholder.
- Incorporating existing CSS tokens (`--tone-bark`, `--tone-clay`, `--tone-teal`, `.arena-grid`, `.animate-float-card`) ensured the new design is cohesive with the landing page without requiring new global utility classes.
- Maintaining the `"use client"` and existing `useWallet` hook dependencies ensured that the functional logic was untouched while the visual layer received a massive upgrade.

### The Tech Debt
- The decorative emoji elements and floating cards are still using hardcoded strings/emojis. They should be swapped out with actual collectible card assets when the final art direction is available.
- Ambient glow positions and floating card positions are hardcoded using absolute percentages, which might require adjustments on extremely wide or narrow viewports.

## 2026-05-03 - Lobby Screens Visual Redesign

### The Change
- Refactored the entire `LobbyScreen.tsx` flow (`LobbySetup`, `CharacterSelect`, `MatchmakingWaiting`, `OpponentFound`) to adopt a dark cinematic arena aesthetic.
- Replaced light grid backgrounds with deep gradients (`from-[#121919] to-[#0a0f0c]`), radial glow orbs, and floating emoji card decorations.
- Updated all inner layout panels to dark `game-card` and `frame-cut` styles using `var(--tone-bark)`, `var(--tone-clay)`, and `var(--color-surface)`.
- Restyled matchmaking UI (waiting and found) to visually emphasize a VS fighting game aesthetic, complete with shimmer bars and dropping shadows.
- Styled unselected arena tabs with `saturate-50 opacity-60` to retain their accent color while remaining distinctly inactive.

### The Reasoning
- The lobby flow needed to match the dark cinematic aesthetic of the landing page and the newly redesigned `ConnectWalletScreen`.
- A pure CSS/Tailwind visual pass ensures all complex matchmaking and wallet logic remains intact while dramatically improving the user experience and visual hierarchy.

### The Tech Debt
- The hardcoded float positions for emojis are repeated across `ConnectWalletScreen` and `LobbyScreen`. They should ideally be abstracted into a unified `FloatingArenaDecorations` component.

## 2026-05-03 - Lobby Screens Warm Vintage Redesign Pivot

### The Change
- Pivoted the `LobbyScreen` shell from a deep cinematic dark gradient to a warm parchment dominant theme (`var(--warm-bg)`) with a dark radial vignette around the outer edges.
- Refactored `LobbySetup` to merge the arena selection list and preview board into a single, cohesive game-card container.
- Switched the text colors in `RoomPhaseHeader` from cold/dark themes to warm/bark tones.
- Transitioned `MatchmakingWaiting` and `OpponentFound` cards to warm surfaces (`var(--warm-surface)`) with dark `var(--tone-bark)` and `var(--tone-clay)` borders.
- Re-styled the alert toasts, error fallback screens, and deposit context cards to match the vintage warm layout rather than dark HUD.

### The Reasoning
- The fully dark shell felt too empty and disconnected from the vintage collectible warmth seen on the landing page's HowItWorks section.
- Moving to a game-board composition makes the UI feel like an actual physical collectible table.

## 2026-05-04 - Pre-Match Lobby Surface Separation Pass

### The Change
- Updated `apps/web/src/components/lobby/LobbySetup.tsx` to remove translucent beige layering and enforce clear panel hierarchy:
  - Left arena selector is now a parchment gradient panel (`#fff8e8 -> #f3e6c9`) with stronger right-side separation.
  - Token cards now use dedicated inactive/active gradients (`#fffaf0 -> #efe3c8` and `#fff1cf -> #f8d694`).
  - Selected token state now includes stronger border, raised shadow, accent glow, and explicit checkmark.
  - Header wallet/wager chips were restyled to dark forest + bark framing for consistency.
  - Right arena board background is now stable and dark (`#10231b/#18392d/#0d1a14`) and no longer uses `selectedArena.previewBg` as full panel background.
  - Arena colors are now used only as accents (icon circles, glow, borders) rather than full-surface swaps.
- Updated `apps/web/src/components/lobby/LobbyScreen.tsx` to strengthen overall shell separation:
  - Page background moved to a darker vignetted warm-forest treatment, clearly distinct from the lobby modal.
  - Decorative background elements were reduced to low-opacity ambient orbs (no boxed decorative icon tiles).

### The Reasoning
- The main issue was not global muddiness, but insufficient surface contrast where page shell, modal, side panel, and token cards all sat on near-identical beige values.
- Locking the right board to a premium dark surface preserves visual stability and prevents BONK selection from washing out the board.
- Dedicated token-card states make selection obvious at a glance and align with the game-lobby interaction model rather than dashboard controls.

### The Tech Debt
- The left-panel token icon placeholders are still text glyphs; once official SOL/BONK assets are available, these should become consistent icon components.
- Some decorative blur/spotlight values are hardcoded and may benefit from extraction into shared theme tokens if similar lobby variants are added.
## 2026-05-04 - Deposit Signing Unlock Fix for Opponent (Player 2) in Lobby

### The Change
- Updated [OpponentFound.tsx](/d:/projects/Cora/apps/web/src/components/lobby/OpponentFound.tsx) to remove the frontend-only temporary signing lock that inferred signing order from lexicographically sorted wallet addresses.
- Removed `useMemo`-based `deterministicPrimaryAddress` role inference and related lock controls:
  - `requiresTemporaryUnlock`
  - `isUxSignLocked`
  - `uxLockExpired` state + timeout effect
- Simplified `canAttemptSign` so deposit signing is gated only by real runtime conditions:
  - wallet connected
  - websocket connected
  - not currently signing/waiting
  - not already signed
- Removed the `"Waiting for server unlock..."` helper-text branch that depended on the deleted UX lock state.

### The Reasoning
- The previous lock used a client-side wallet sort heuristic to decide who signs first, which is not authoritative and can diverge from backend room role assignment (`playerA` / `playerB`).
- In mismatch cases, the UI could disable Player 2 even after Player 1 had signed, creating a deadlock-feeling flow despite backend being ready to accept the deposit confirmation.
- Using only actual connection/signing state on the frontend avoids false-negative lockouts and aligns behavior with server-driven state transitions.

### The Tech Debt
- Frontend still does not receive an explicit authoritative "you are playerA/playerB and currently allowed to sign" flag from backend state payloads.
- If strict sequential deposit enforcement is required in the future, the lock should be server-authoritative (role/permission in payload) rather than inferred on client.

## 2026-05-04 - Enable Real Solana Transactions for Deposit

### The Change
- Refactored `apps/web/src/lib/solana/signDepositIntent.ts` to actually invoke the backend at `POST /api/actions/challenge`.
- Removed dummy `MEMO` string compilation for `deposit_wager`.
- Fed `tokenMint` and `wagerAmount` dynamically to the backend from the client logic.

### The Reasoning
- **Mock Deprecation:** Clicking "Sign Deposit" in the frontend merely fired an arbitrary MEMO transaction, so no `wager_deposit` or `initialize_match` was executed on the blockchain! To properly integrate the CORA smart contract into the workflow, real Solana instructions provided by the server needed to be requested, signed, and broadcasted via the local wallet.

### The Tech Debt
- **Network Fees & Latency:** Real interactions mean users have to face actual blockhash/RPC latencies, which inherently introduce new possible friction scenarios. `signDepositIntent` includes minor retry handling, but a comprehensive polling/retry UI state might be needed for poor connections.

## 2026-05-04 - Fix Buffer Type for Solana Memo TransactionInstruction

### The Change
- Updated [apps/web/src/lib/solana/signDepositIntent.ts](/d:/projects/Cora/apps/web/src/lib/solana/signDepositIntent.ts) in `signMemoIntent`.
- Replaced memo instruction payload from `new TextEncoder().encode(memoMessage)` to `Buffer.from(memoMessage, "utf8")`.

### The Reasoning
- `TransactionInstruction.data` in the current Solana SDK typing expects a `Buffer`-compatible payload in this build configuration.
- `TextEncoder().encode(...)` returns `Uint8Array`, which triggered a TypeScript incompatibility during `next build`.
- Using `Buffer.from` preserves exact byte content while satisfying the expected instruction data type.

### The Tech Debt
- Build is now blocked by a separate pre-render error on `/lobby` (`useSearchParams` missing Suspense boundary), unrelated to this type fix.

## 2026-05-04 - Reapply Suspense Boundaries for connect/lobby/play Pages

### The Change
- Updated [apps/web/src/app/connect/page.tsx](/d:/projects/Cora/apps/web/src/app/connect/page.tsx) to wrap `ConnectWalletScreen` in `Suspense`.
- Updated [apps/web/src/app/lobby/page.tsx](/d:/projects/Cora/apps/web/src/app/lobby/page.tsx) to wrap `LobbyScreen` in `Suspense`.
- Updated [apps/web/src/app/play/page.tsx](/d:/projects/Cora/apps/web/src/app/play/page.tsx) to wrap `BattleScreen` in `Suspense`.

### The Reasoning
- These screens use `useSearchParams()` and must be rendered under a Suspense boundary when prerender/export runs in Next App Router.
- Missing boundaries caused repeated `missing-suspense-with-csr-bailout` failures beginning at `/connect`.
- Applying wrappers at route page boundaries keeps each fix isolated and avoids changing component internals.

### The Tech Debt
- Local build verification is currently blocked by Windows filesystem lock/permission errors in `.next` (`EPERM` unlink on chunk files).
- We should standardize a local clean-build workflow that ensures Node/Next processes are stopped before deleting `.next`.

## 2026-05-04 - Character Draft Screen Redesign (Roster-Focused + Dev Toggle)

### The Change
- Reworked [CharacterSelect.tsx](/d:/projects/Cora/apps/web/src/components/character/CharacterSelect.tsx) to remove dashboard-style meta blocks from default player view and make the roster grid the centerpiece.
- Added a compact helper row and a `Dev Mode` toggle that gates debug-only data panels (selection state, opponent status, room status rail, and countdown).
- Rebuilt [CharacterCard.tsx](/d:/projects/Cora/apps/web/src/components/character/CharacterCard.tsx) into a collectible roster-card layout:
  - square portrait block with placeholder expression cue
  - stronger selected/active visual treatment (border, glow, lift)
  - base + role/supporting lines
  - compact stat presentation (short rows + mini inline meters + specialty chip)
  - full-width selection state footer (`Selected`, `Auto-assigned`, `Locked In`, etc.)
- Updated [RoomPhaseHeader.tsx](/d:/projects/Cora/apps/web/src/components/room/RoomPhaseHeader.tsx) with a high-contrast framed header surface to improve readability of `Setup` / `Draft Your Scientist` / supporting copy on dark lobby backgrounds.
- Kept existing flow controls in place (Back button, arena/token/wallet chips, Enter Queue CTA) via existing shell slots.

### The Reasoning
- The old top metadata cards pulled attention away from the primary draft action and made the screen feel like a dashboard.
- Moving non-essential state to a toggle keeps the default experience premium and player-focused while preserving QA/debug visibility.
- Character cards now follow a game-roster hierarchy instead of a generic data-card pattern, with selection feedback strong enough to feel decisively chosen.
- Compact stats preserve quick scanability without bloating card height or dominating vertical space.
- A dedicated contrast-backed heading container fixes title legibility immediately and aligns with the vintage arena art direction.

### The Tech Debt
- Portrait expression states are still placeholder UI cues (initial + micro-face element). Replace with real square portraits and selected-expression variants once art assets are available.
- Specialty metadata is partially sourced from `@shared/characterStats`; characters missing a shared specialty currently fall back to `Generalist` in UI.
- Dev Mode state is local UI state only; if persistent QA toggles are needed, we should wire query-param or localStorage sync.

## 2026-05-04 - Draft Dev Mode Toggle Availability Adjustment

### The Change
- Updated [CharacterSelect.tsx](/d:/projects/Cora/apps/web/src/components/character/CharacterSelect.tsx) so the `Dev Mode` toggle is always available in draft UI, even when countdown/opponent metadata is absent.
- Added a debug-panel fallback line (`No countdown/opponent sync metadata in this phase.`) for pre-queue contexts.

### The Reasoning
- QA still needs access to selection/room debug panels in the normal character-select phase, not only in timed room-preview states.

### The Tech Debt
- If we introduce role-based dev tooling, this toggle should be gated behind environment or permission controls.

## 2026-05-04 - Character Draft Screen Minor Layout Refinement Pass

### The Change
- Updated [apps/web/src/components/lobby/CharacterSelect.tsx](/d:/projects/Cora/apps/web/src/components/lobby/CharacterSelect.tsx):
  - Repositioned `Back` into the same top-right chip row (`arena`, `wager`, `wallet`) to remove the detached floating feel.
  - Tightened chip/button vertical padding and CTA size.
  - Applied `className="h-[100svh] overflow-hidden py-3 md:py-4"` on `RoomPhaseShell` usage for this screen to keep the full draft composition inside one desktop viewport.
- Updated [apps/web/src/components/room/RoomPhaseHeader.tsx](/d:/projects/Cora/apps/web/src/components/room/RoomPhaseHeader.tsx):
  - Removed the boxed heading panel treatment (no bordered/background card).
  - Kept readability via typography and text-shadow only.
  - Reduced header spacing and font sizing slightly for tighter vertical rhythm.
- Updated [apps/web/src/components/character/CharacterSelect.tsx](/d:/projects/Cora/apps/web/src/components/character/CharacterSelect.tsx):
  - Reduced spacing between helper row, debug block, and card grid.
  - Tightened card grid gap from `gap-4` to `gap-3`.
- Updated [apps/web/src/components/character/CharacterCard.tsx](/d:/projects/Cora/apps/web/src/components/character/CharacterCard.tsx):
  - Reduced card min height (`350px` -> `292px`).
  - Reduced portrait max size and compressed internal spacing/typography/chips/footer height.
  - Preserved the same visual language and selection-state cues.

### The Reasoning
- The previous pass solved hierarchy direction, but the screen still felt vertically heavy and pushed CTA visibility below the fold.
- Keeping Back inside the same right-column control cluster makes the header composition feel intentional and aligned.
- Removing the heading box follows the requested integrated composition while preserving contrast.

### The Tech Debt
- `h-[100svh] overflow-hidden` is intentionally scoped to this screen and viewport fit goal. If card count/metadata grows, we may need responsive fallback behavior for smaller desktop heights.
- CTA/chip density is tuned for this draft screen specifically; if design tokens for compact HUD controls are introduced, this should be normalized into shared size variants.

## 2026-05-04 - Character Card Micro-Polish (Pill Stats + Role Styling)

### The Change
- Updated [apps/web/src/components/character/CharacterCard.tsx](/d:/projects/Cora/apps/web/src/components/character/CharacterCard.tsx) to replace long bar-style stat rows with compact trait pills.
- Kept existing stat data and labels, now rendered as lightweight chips (e.g. `LOGIC 92`, `COMPUTATION 88`) in a wrapped pill group.
- Replaced raw role text (`Role: ...`) with a styled metadata chip (`Sequence Specialist`) and kept multiplier as a compact companion chip (`x1.5`).
- Preserved all existing card structure and interaction states (portrait, selected state, status footer).

### The Reasoning
- Bar meters still read as RPG/dashboard UI and carried unnecessary visual weight for this collectible roster card direction.
- Pill-based stat traits improve scan speed while reducing visual bloat and preserving data clarity.
- Role metadata now feels integrated into the card system rather than plain label-value text.

### The Tech Debt
- Stat labels are currently rendered in full uppercase text; if longer labels are introduced later, we may want tokenized short labels or controlled wrapping rules.

## 2026-05-04 - Character Draft Layout Balance Pass (Upper Section Breathing Room)

### The Change
- Updated [apps/web/src/components/lobby/CharacterSelect.tsx](/d:/projects/Cora/apps/web/src/components/lobby/CharacterSelect.tsx):
  - Increased top-biased shell padding for this phase (`pt-5/6`, `pb-3/4`) while keeping viewport-locked layout.
  - Added a small wrapper margin above the roster section (`mt-2 md:mt-3`) so cards sit lower.
- Updated [apps/web/src/components/room/RoomPhaseHeader.tsx](/d:/projects/Cora/apps/web/src/components/room/RoomPhaseHeader.tsx):
  - Increased heading block breathing room via slightly larger bottom margin and larger title/subtitle vertical spacing.
- Updated [apps/web/src/components/character/CharacterSelect.tsx](/d:/projects/Cora/apps/web/src/components/character/CharacterSelect.tsx):
  - Increased spacing under the `Roster / Selected` row (`mb-5`).
  - Increased spacing below the optional Dev Mode panel (`mb-5`) for balanced separation before the card grid.

### The Reasoning
- After card compaction, the composition looked top-tight and bottom-light. Increasing only upper-layout spacing restores visual balance without re-inflating cards.

### The Tech Debt
- Header spacing is shared through `RoomPhaseHeader`; if another phase later needs denser layout, we may introduce a compact header variant prop.

## 2026-05-04 - Character Card Action-Row Spacing Micro-Adjustment

### The Change
- Updated [apps/web/src/components/character/CharacterCard.tsx](/d:/projects/Cora/apps/web/src/components/character/CharacterCard.tsx) to add a small separation above the bottom action row (`Tap to Select` / `Selected`).
- Kept existing card structure and sizing by wrapping the action row with `mt-auto pt-2`, then rendering the original action chip inside.

### The Reasoning
- The action row felt visually cramped against the stat pills. This adds breathing room without reintroducing bulk or changing card content hierarchy.

### The Tech Debt
- Spacing is currently local to this component. If other selectable cards adopt similar bottom action treatments, we may want a shared spacing token/utility.

## 2026-05-04 - Draft Header Reading-Flow Refinement (Back Button Left)

### The Change
- Updated [apps/web/src/components/lobby/CharacterSelect.tsx](/d:/projects/Cora/apps/web/src/components/lobby/CharacterSelect.tsx):
  - Moved `Back` out of the top-right chip cluster.
  - Added a lightweight left-aligned `Back` control above the heading flow.
  - Kept top-right area focused on contextual chips (arena / wager / wallet).
- Extended shared room header plumbing to support pre-heading navigation content:
  - [apps/web/src/components/room/RoomPhaseHeader.tsx](/d:/projects/Cora/apps/web/src/components/room/RoomPhaseHeader.tsx): added optional `preHeadingSlot` rendered above eyebrow/title/subtitle.
  - [apps/web/src/components/room/RoomPhaseShell.tsx](/d:/projects/Cora/apps/web/src/components/room/RoomPhaseShell.tsx): passed through optional `preHeadingSlot` prop.

### The Reasoning
- `Back` is navigation, so placing it at the start of the content sequence improves reading order and reduces visual competition with status chips.
- The right column now reads as purely contextual state, while navigation starts the left-column flow.

### The Tech Debt
- `preHeadingSlot` is now available for other phases; if reused heavily, we may want a dedicated nav-style variant token to standardize button appearance across screens.

## 2026-05-05 - Draft Header Micro-Spacing Tweak (Back vs SETUP)

### The Change
- Updated [apps/web/src/components/room/RoomPhaseHeader.tsx](/d:/projects/Cora/apps/web/src/components/room/RoomPhaseHeader.tsx) to increase spacing below the `preHeadingSlot` container (`mb-2` -> `mb-3`).
- This creates a slightly clearer separation between the left-side `Back` navigation control and the `SETUP` eyebrow.

### The Reasoning
- `Back` should read as navigation preceding page content, not as a label attached to the heading block.

### The Tech Debt
- Spacing value is shared for any future usage of `preHeadingSlot`; if other screens require denser nav/header spacing, we may introduce a per-screen spacing override.

## 2026-05-05 - MatchmakingWaiting Dark Arena Visual Redesign

### The Change
- Refactored [apps/web/src/components/lobby/MatchmakingWaiting.tsx](/d:/projects/Cora/apps/web/src/components/lobby/MatchmakingWaiting.tsx) visual styling to match dark arena direction:
  - Player and opponent cards moved from warm/light surfaces to dark forest-glass gradients.
  - Added subtle radial highlight overlays and deeper shadows for cinematic depth.
  - Upgraded center `VS` composition with a circular accent ring/orb treatment.
  - Improved title/subtitle readability in searching/error/timeout states using cream/gold foreground colors.
  - Updated segment labels and bar track backgrounds to dark-compatible contrast while preserving accent fill.
  - Updated flavor text color to mint for legibility on dark background.
- Kept CTA/actions (`Cancel`, `Keep Searching`) and layout structure intact.

### The Reasoning
- Prior light-surface cards visually clashed with the dark arena shell and weakened matchmaking tension.
- This pass aligns the waiting screen with the newer game-like mood: dark surfaces, cream text, clay/gold accents, and stronger versus framing.

### The Tech Debt
- Visual tokens are still mostly inline in this component. If we standardize a dark-panel system for all room phases, these styles should be extracted into shared classes/tokens.
- Failure-state title color currently shares one gold-readable treatment for both timeout and error; future UX may want distinct semantic tones if error taxonomy expands.

### Guardrails Kept
- Matchmaking progress logic, stage timing, and bar animation behavior were not changed.

## 2026-05-05 - MatchmakingWaiting Versus-Card Refinement (Square Placeholders + Clean VS)

### The Change
- Updated [apps/web/src/components/lobby/MatchmakingWaiting.tsx](/d:/projects/Cora/apps/web/src/components/lobby/MatchmakingWaiting.tsx) matchup row styling:
  - Added square portrait placeholder block to the **player** card (left side) and kept horizontal card structure.
  - Added matching square placeholder block to the **opponent** card while scanning (left side), with `Scanning` + `Unknown` content on the right.
  - Switched matchup cards to warm parchment surfaces with bark/clay framing for stronger contrast against dark arena shell.
  - Removed the circular `VS` container and replaced it with clean centered `VS` typography with subtle glow/shadow only.
  - Added lightweight `YOU` chip on player card metadata area.
- Kept top-right cancel, arena/wager label, title/subtitle, progress bars, and retry behavior in place.

### The Reasoning
- The matchup section now reads as an intentional versus composition instead of two plain text blocks.
- Square placeholders make the layout ready for future portrait/icon assets while preserving current scanning state.
- Warm cards increase focal contrast and keep cohesion with CORA�s parchment/vintage style without looking like generic white dashboards.

### The Tech Debt
- Opponent card currently always renders unknown/scanning placeholder in this component�s current states; when a matched-opponent payload is wired here, we should feed portrait/name/base into the same left-icon/right-info horizontal template without changing structure.

### Guardrails Kept
- Matchmaking progress logic and bar animation behavior were not changed.

## 2026-05-05 - MatchmakingWaiting Opponent-State Layout Refinement

### The Change
- Updated [apps/web/src/components/lobby/MatchmakingWaiting.tsx](/d:/projects/Cora/apps/web/src/components/lobby/MatchmakingWaiting.tsx) opponent card behavior with explicit state-based layouts:
  - **Unknown/searching state**: dark centered placeholder card (`SCANNING` + `Unknown`) with optional centered square placeholder block.
  - **Matched-opponent state (future-ready)**: warm horizontal card matching player composition (square portrait on left, opponent info on right).
- Added optional props to support matched rendering without breaking current call sites:
  - `opponentScientist?: Scientist | null`
  - `opponentWalletAddress?: string`
- Kept `VS` as clean centered typography (no circular container).

### The Reasoning
- The horizontal icon-left/text-right pattern is ideal for actual profile cards, but looked awkward when the opponent is unknown.
- Centered dark placeholder communicates temporary searching state more clearly and avoids off-center visual weight.
- Warm horizontal card on match provides a clear visual transition from searching to found opponent.

### The Tech Debt
- Matched opponent data is not yet wired from current waiting-phase parent flow, so the matched branch is prepared but not currently activated in normal waiting route.

### Guardrails Kept
- Matchmaking progress logic and bar animation behavior were not changed.

## 2026-05-05 - MatchmakingWaiting Final Opponent-State Polish

### The Change
- Updated [apps/web/src/components/lobby/MatchmakingWaiting.tsx](/d:/projects/Cora/apps/web/src/components/lobby/MatchmakingWaiting.tsx) unknown/matched opponent rendering behavior:
  - **Unknown/searching state**: removed the square `?` placeholder block; card now shows centered `SCANNING` + `Unknown` only on dark surface.
  - **Matched state (future-ready branch)**: preserved warm horizontal portrait-left/info-right structure so it mirrors player-card pattern.

### The Reasoning
- Unknown state should feel minimal and temporary, not like a partially-rendered profile card.
- Portrait placeholder should appear only when a real opponent exists, which creates clearer state transition and stronger visual symmetry.

### The Tech Debt
- Matched-opponent branch is ready but depends on parent flow wiring of `opponentScientist` / `opponentWalletAddress` for runtime activation.

### Guardrails Kept
- Matchmaking progress logic and progress bar animation behavior were not changed.

## 2026-05-05 - MatchmakingWaiting TS Narrowing Fix (Matched Opponent Branch)

### The Change
- Updated [apps/web/src/components/lobby/MatchmakingWaiting.tsx](/d:/projects/Cora/apps/web/src/components/lobby/MatchmakingWaiting.tsx) to fix TypeScript nullability warnings in the matched-opponent JSX branch.
- Replaced `hasMatchedOpponent` boolean check with a concrete narrowed variable:
  - `const matchedOpponent = opponentScientist ?? null`
  - branch now uses `matchedOpponent ? (...) : (...)`
  - matched branch reads `matchedOpponent.*` fields.

### The Reasoning
- Boolean coercion on optional values does not always provide sufficient narrowing for TS in JSX paths. Using a nullable local with direct truthy check guarantees safe narrowing.

### The Tech Debt
- None significant; this is a local type-safety cleanup and keeps behavior unchanged.

## 2026-05-05 - OpponentFound Versus-Screen Redesign (Post-Match Deposit Phase)

### The Change
- Refactored [apps/web/src/components/lobby/OpponentFound.tsx](/d:/projects/Cora/apps/web/src/components/lobby/OpponentFound.tsx) to match the newer matchmaking versus-screen style while preserving signing/socket flow.
- Updated header/content hierarchy to player-facing match-confirmation copy:
  - Eyebrow: `{arena.label} � $${wagerUsd} {arena.token}`
  - Title: `Rival Locked`
  - Subtitle: `Sign the deposit before the timer expires.`
- Rebuilt versus row into warm horizontal matchup cards over dark arena shell:
  - Player and opponent cards now use square portrait placeholders on the left and info content on the right.
  - Added `YOU` / `RIVAL` chips for clear side identity.
  - Kept simple centered `VS` text with glow/shadow and no circular container.
  - Opponent card remains revealed/matched style even when scientist fallback is not yet synced (`Rival Synced` + fallback base text), per requested behavior.
- Moved `RoomStatusRail` behind a local player-facing visibility toggle:
  - Hidden by default.
  - Toggle label switches between `Show Room Status` / `Hide Room Status`.
  - Not labeled as dev mode.
- Elevated deposit action area by wrapping existing `DepositPanel` in a dark integrated action container so the signing step is visually central.
- Kept error alert behavior and dismiss/timer logic, while refreshing alert surface to a cohesive warm treatment.

### The Reasoning
- This phase should read as direct continuation of matchmaking: rival confirmed, immediate deposit action.
- Warm versus cards provide strong focal contrast against dark arena backgrounds and align with updated matchmaking language.
- Always-visible room status read as debug infrastructure; collapsing it by default keeps the player flow clean while retaining access when needed.

### The Tech Debt
- `DepositPanel` internal visual tokens remain shared/global and still include lighter defaults; this pass integrates it via wrapper styling rather than deep component theming.
- If this versus-card pattern is reused across multiple phases, extracting a shared matchup-card component will reduce style duplication.

### Guardrails Kept
- No changes to deposit signing logic, socket behavior, reconnect flow, redirect flow, countdown logic, status/hint helpers, or badge generation.

## 2026-05-05 - Play/Battle Screen Arena Visual Refactor (UI + FE-only Combat FX)

### The Change
- Refactored [BattleScreen.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx) visual layer to align `/play` with the updated lobby/draft/matchmaking/opponent-found direction:
  - Switched shell/background from light grid to dark cinematic arena gradient.
  - Updated headers/chips/alerts/guard panels to dark-compatible cream/gold palette.
  - Replaced circular `You` / `Enemy` placeholders with **4:5 character placeholders** (left player, right opponent) using character-based gradient fallback visuals.
  - Replaced tall base bars with **1:1 base placeholders** per side, including base HP labels.
  - Preserved bottom card hand flow but re-skinned cards to warm collectible surfaces.
- Added FE-only battle presentation state in [BattleScreen.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx):
  - `characterActionSide`
  - `projectile`
  - `playerBaseFx` / `opponentBaseFx`
- Added FE-only placeholder projectile animation driven by existing `lastDamageEvent` (no backend protocol changes):
  - attacker pose pulse
  - projectile travel (attack/heal variant)
  - target base hit/heal pulse
  - local cleanup timers
- Kept active question modal, settlement modal, and share overlay behavior intact while updating visual surfaces to match new arena style.
- Updated shared room UI surfaces for dark coherence:
  - [CountdownBar.tsx](/d:/projects/Cora/apps/web/src/components/room/CountdownBar.tsx)
  - [PlayerRoomStatus.tsx](/d:/projects/Cora/apps/web/src/components/room/PlayerRoomStatus.tsx)
  - [RoomStatusRail.tsx](/d:/projects/Cora/apps/web/src/components/room/RoomStatusRail.tsx)

### The Reasoning
- The previous `/play` surface diverged from the rest of the updated flow and looked like a legacy light dashboard.
- Character/base placeholders needed explicit future-friendly framing (4:5 and 1:1) so art/pose systems can be swapped in later without structural rework.
- FE-only projectile/pose/base FX creates combat readability immediately while keeping server/game loop semantics unchanged.

### The Tech Debt
- Projectile travel currently uses coarse anchored coordinates (UI placeholder pass). Once final stage layout/asset anchors are fixed, this should move to measured DOM anchor coordinates for precision.
- Character/base visuals are still placeholder glyph/gradient assets; replace with final art and state-specific sprites/poses when available.
- Shared room status components are now dark-biased; if any warm-surface contexts require old look, introduce variant props/tokens instead of one-size styling.

### Guardrails Kept
- No changes to `useMatchSocket` semantics, gameplay scoring, answer flow, settlement flow, countdown source logic, route/query handling, or backend message contracts.

## 2026-05-05 - Challenge Share Card Final Polish (Light Collectible Pass)

### The Change
- Restyled [apps/web/src/components/challenge/ChallengeShareCard.tsx](/d:/projects/Cora/apps/web/src/components/challenge/ChallengeShareCard.tsx) into a light collectible challenge-ticket composition:
  - premium light cream/stone framed surface
  - strong two-zone layout (hero/editorial left + utility/QR right)
  - square challenger portrait placeholder (replacing generic circular avatar)
  - cleaner hierarchy for title, challenger identity, status chip, and description
  - utility panel with QR + token/wager/arena metadata rows
  - action buttons preserved (`Copy Link`, `Save As JPG`, `Share On X`) with light premium framed styling
  - link + notice handling unchanged
- Updated [apps/web/src/lib/challenge/renderChallengeCardJpg.ts](/d:/projects/Cora/apps/web/src/lib/challenge/renderChallengeCardJpg.ts) to visually match the new light collectible design in canvas export:
  - light premium framed background
  - editorial hero zone and utility zone
  - square challenger placeholder badge
  - clearer challenge hierarchy + status chip
  - QR + metadata ticket block
  - polished link strip
- Kept [apps/web/src/lib/challenge/createChallengeLink.ts](/d:/projects/Cora/apps/web/src/lib/challenge/createChallengeLink.ts) unchanged functionally.

### The Reasoning
- The share card should read like a premium collectible pass/challenge ticket rather than a dashboard widget.
- Light editorial styling differentiates challenge sharing from dark arena gameplay while keeping CORA identity coherent.
- Updating both preview and JPG renderer together prevents style drift between what users see and what they download/share.

### The Tech Debt
- Canvas export and in-app preview are aligned stylistically, but not pixel-identical. If strict design parity is required later, we should centralize layout tokens and dimensions used by both renderers.
- QR rendering still depends on remote QR image generation; if offline/resilience is needed, we should embed a local QR generation fallback.

## 2026-05-05 - Real-Only E2E Flow + CharacterId WS Wiring (FE)

### The Change
- Removed FE mock-mode pathways and integration-mode banner plumbing from the web app:
  - Deleted [apps/web/src/components/ui/IntegrationModeBanner.tsx](/d:/projects/Cora/apps/web/src/components/ui/IntegrationModeBanner.tsx)
  - Simplified [apps/web/src/lib/config/runtimeModes.ts](/d:/projects/Cora/apps/web/src/lib/config/runtimeModes.ts) to only retain `allowDevRoomPreview`.
  - Removed mock/deposit mode env documentation from [apps/web/.env.example](/d:/projects/Cora/apps/web/.env.example).
- Forced real settlement confirmation path in [apps/web/src/components/play/BattleScreen.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx):
  - removed `settlementMode === "mock"` branch and mock signature generation.
  - release confirmation now always follows Phantom signing flow.
- Removed wallet/address dev fallback in battle flow:
  - [BattleScreen.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx) now requires connected wallet address only.
- Wired FE-selected character ID to backend room join:
  - Extended [apps/web/src/hooks/useMatchSocket.ts](/d:/projects/Cora/apps/web/src/hooks/useMatchSocket.ts) to send `characterId` query param on WS connect.
  - Passed `characterId` from [apps/web/src/components/lobby/OpponentFound.tsx](/d:/projects/Cora/apps/web/src/components/lobby/OpponentFound.tsx) and [apps/web/src/components/play/BattleScreen.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx).
- Aligned roster IDs/names with shared-types (`einstein`) and removed Newton leftovers:
  - Updated [apps/web/src/components/lobby/LobbyScreen.tsx](/d:/projects/Cora/apps/web/src/components/lobby/LobbyScreen.tsx)
  - Updated [apps/web/src/app/dev/room-states/page.tsx](/d:/projects/Cora/apps/web/src/app/dev/room-states/page.tsx)
  - Updated battle visual mapping in [BattleScreen.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx) to use Einstein path only.
- Replaced opponent character deterministic fallback with backend-authoritative mapping in [OpponentFound.tsx](/d:/projects/Cora/apps/web/src/components/lobby/OpponentFound.tsx) by resolving from `gameState.opponent.characterId`.

### The Reasoning
- BE flow (per `DEVLOG-BE.md`) is now sequential-deposit + WS authoritative state; FE must stop short-circuiting via mock modes and must pass `characterId` on WS join so backend `playerMeta.characterId` is correct.
- Keeping mock toggles in FE created drift against BE E2E readiness and caused confusing mixed behavior (real deposit with mock settlement).
- Using backend-provided opponent character metadata ensures UI reflects true room state instead of deterministic local placeholders.

### The Tech Debt
- `next build` validation is currently blocked locally by locked `.next` artifacts (`EPERM`/access denied on unlink/remove), likely due to an external process holding handles. `npm run lint` passes.
- `allowDevRoomPreview` remains in runtime config for internal UI preview scenarios; if full prod-hardening is desired, this can be removed in a follow-up.

## 2026-05-05 - Battle Settlement UI Switched to Backend-Authoritative Mode

### The Change
- Refactored [apps/web/src/components/play/BattleScreen.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx) to remove client-side settlement confirmation flow.
- Deleted FE-only settlement release state and actions:
  - removed `releaseState`, `releaseError`, `releaseSignature`
  - removed `onConfirmFundRelease()` and `getReleaseButtonLabel()`
  - removed settlement warning alert path derived from `releaseError`
- Removed client memo-sign settlement dependency usage in battle screen:
  - removed `useConnection` usage
  - removed `signSettlementReleaseIntent` usage
- Replaced "Fund Release Confirmation" card with backend-authoritative settlement card:
  - displays server-origin `settlementSignature` and `serverPublicKey` from `matchResult` payload when available
  - otherwise shows waiting message for server settlement payload

### The Reasoning
- Backend already owns settlement orchestration and signature emission (server oracle flow), so FE should present backend state rather than trigger a second client settlement intent.
- This avoids duplicate/conflicting settlement semantics and aligns FE with BE E2E contract while keeping services decoupled.

### The Tech Debt
- FE still cannot show definitive on-chain settlement transaction signature because current WS payload does not include tx hash. If product wants this, BE needs to expose settlement tx id in an event/payload and FE can render it.

## 2026-05-05 - FE Alignment Follow-up: Room Status + MatchFound Passive Support

### The Change
- Updated [apps/web/src/components/play/BattleScreen.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx) to align active-play gating with current backend room statuses:
  - removed explicit `settling` branch from status label mapping
  - changed `isPlayStateReady` to depend on `playing` or match-complete signals instead of `settling`
- Extended [apps/web/src/hooks/useMatchSocket.ts](/d:/projects/Cora/apps/web/src/hooks/useMatchSocket.ts) with passive server queue-assignment event support:
  - added `lastMatchFound` state
  - handles both `matchFound` and `matchFoundWaiting` message types for compatibility
  - returns `lastMatchFound` to consumers
- Integrated non-breaking `matchFound` awareness in [apps/web/src/components/lobby/OpponentFound.tsx](/d:/projects/Cora/apps/web/src/components/lobby/OpponentFound.tsx):
  - derives `reassignedRoomId` from socket event when server announces a different room
  - surfaces this via deposit helper text (no forced navigation, no hard interrupt)

### The Reasoning
- Backend currently transitions `depositing -> playing -> finished`; FE no longer treats `settling` as a required active phase.
- Backend can emit `matchFound` in requeue paths; FE now records that event so UI can stay in sync without coupling to backend internals or direct function calls.
- Chosen UX is intentionally passive to avoid breaking existing flow while still exposing authoritative server signals.

### The Tech Debt
- `matchFound` signals are currently surfaced as guidance text only. If product wants automatic room handoff, FE will need an explicit navigation/resume policy agreed with BE contract semantics.

## 2026-05-05 - FE Sync: Settling Status + /match Forward Compatibility (No BE edits)

### The Change
- Updated [apps/web/src/components/play/BattleScreen.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx):
  - added explicit `settling` status label in `getStatusLabel`
  - updated play-state readiness gate to treat `settling` as an active ready state
  - relaxed hard guard that previously required `arena/token/wager` query params; now only `roomId` is mandatory (allows backend-authoritative context evolution)
- Updated [apps/web/src/lib/matchmaking/queueMatch.ts](/d:/projects/Cora/apps/web/src/lib/matchmaking/queueMatch.ts):
  - request now supports optional `tokenMint` / `wagerAmount` payload fields
  - response parser now supports optional `tokenMint` / `wagerAmount` / `roomType` fields while preserving backward compatibility with `{ roomId }`
- Updated [apps/web/src/components/lobby/LobbyScreen.tsx](/d:/projects/Cora/apps/web/src/components/lobby/LobbyScreen.tsx):
  - sends optional `tokenMint` to `/match` from selected arena token symbol

### The Reasoning
- BE/game flow now uses `settling` in shared contract, so FE battle status/gating should not treat it as unknown/terminal too early.
- `/match` contract may evolve to include richer room context; FE now tolerates enriched responses and can pass optional token context without breaking existing BE behavior.
- Keeping `roomId` as the only hard `/play` requirement reduces brittle FE dependence on URL-carried context as backend state becomes authoritative.

### The Tech Debt
- Optional `/match` fields are currently parsed but not yet fully consumed end-to-end in FE routing/state (future enhancement once BE contract is finalized for public room context).

## 2026-05-05 - Deposit Signing UI Restyle for Dark Arena Integration

### The Change
- Restyled [apps/web/src/components/deposit/DepositPanel.tsx](/d:/projects/Cora/apps/web/src/components/deposit/DepositPanel.tsx) with dark-arena-compatible visuals while preserving all existing props and behavior.
  - Heading chip now uses cream/gold-on-dark treatment instead of muted dashboard green.
  - Subtitle shifted to muted cream for dark-surface readability.
  - Primary action button restyled to chunky game-button treatment:
    - enabled: clay/bark gradient + cream text + stronger shadow/highlight
    - disabled: muted forest gradient + reduced opacity/readability preserved
  - `disabled={!canPrimaryAction}` behavior unchanged.
- Restyled [apps/web/src/components/deposit/DepositStatusCard.tsx](/d:/projects/Cora/apps/web/src/components/deposit/DepositStatusCard.tsx):
  - Replaced light card background with dark forest gradient surface.
  - Updated border/shadow/inset/highlight to warm arena console style.
  - Updated text hierarchy colors:
    - status label: gold accent
    - helper text: muted mint/cream
    - countdown: strong gold with shadow
    - signature: secondary muted mint in subtle inset strip
  - Kept all slot behavior (`walletSlot`, `retrySlot`, `cancelSlot`) and spacing support intact.

### The Reasoning
- Opponent-found/matchmaking UI moved to dark arena styling; shared deposit components still looked like legacy white dashboard blocks and broke visual continuity.
- This pass unifies the deposit signing area with arena visuals without touching functional logic or parent integration.

### The Tech Debt
- Shared deposit components are now dark-default. If future light-theme contexts reuse them, a variant/theming prop may be needed instead of per-page overrides.

## 2026-05-05 - FE First Pass: History + Wallet Inspect Foundation (Backend-Stub Ready)

### The Change
- Added backend-facing history client and normalized frontend types:
  - [apps/web/src/lib/history/historyApi.ts](/d:/projects/Cora/apps/web/src/lib/history/historyApi.ts)
  - [apps/web/src/lib/history/historyTypes.ts](/d:/projects/Cora/apps/web/src/lib/history/historyTypes.ts)
- Added reusable history / wallet-inspect UI primitives:
  - [apps/web/src/components/history/HistoryButton.tsx](/d:/projects/Cora/apps/web/src/components/history/HistoryButton.tsx)
  - [apps/web/src/components/history/HistoryDrawer.tsx](/d:/projects/Cora/apps/web/src/components/history/HistoryDrawer.tsx)
  - [apps/web/src/components/history/WalletInspectButton.tsx](/d:/projects/Cora/apps/web/src/components/history/WalletInspectButton.tsx)
  - [apps/web/src/components/history/WalletInspectPanel.tsx](/d:/projects/Cora/apps/web/src/components/history/WalletInspectPanel.tsx)
- Added arena playability hook (advisory-first):
  - [apps/web/src/hooks/useWalletArenaPlayability.ts](/d:/projects/Cora/apps/web/src/hooks/useWalletArenaPlayability.ts)
- Integrated primary history access in room-phase shell usage:
  - Updated [apps/web/src/components/lobby/CharacterSelect.tsx](/d:/projects/Cora/apps/web/src/components/lobby/CharacterSelect.tsx) to render `HistoryButton` via `rightPanelSlot` and open shared `HistoryDrawer`.
  - Updated [apps/web/src/components/lobby/LobbyScreen.tsx](/d:/projects/Cora/apps/web/src/components/lobby/LobbyScreen.tsx) to pass `walletConnected` into `CharacterSelect`.
- Integrated wallet inspect shortcuts + advisory playability + history access in pre-battle deposit phase:
  - Updated [apps/web/src/components/lobby/OpponentFound.tsx](/d:/projects/Cora/apps/web/src/components/lobby/OpponentFound.tsx).
- Integrated settlement-modal history action and wallet inspect shortcuts in battle screen:
  - Updated [apps/web/src/components/play/BattleScreen.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx).
- Validation:
  - `npm run lint --workspace apps/web` passes.

### The Reasoning
- FE calls backend endpoints only (`/api/history/...`) and never calls GoldRush directly, matching architecture boundaries before BE integration is live.
- The new UI contracts are backend-normalized and player-facing (`History`, `Wallet Inspect`, `Arena playable`), avoiding raw provider payload exposure.
- Playability is advisory-first by design: UI surfaces readiness (`Playable`, `Needs token`, `Unable to inspect`) without hard-blocking flow during backend maturation.
- Shared components keep styling consistent with the existing arena/parchment/clay visual language and prevent one-off explorer-like UI.

### The Tech Debt
- `historyApi.ts` currently relies on fallback behavior (`NEXT_PUBLIC_HISTORY_FALLBACK_MODE`) until BE endpoints are fully implemented and normalized.
- `WalletPlayability.reliable` semantics are provisional; once BE finalizes trust signals, FE should tighten blocking/allowance behavior if required.
- History views are currently scoped to arena/wallet lists; once BE exposes richer match identifiers and explorer links, FE can add direct per-match detail focus and deep links.

## 2026-05-05 - Wallet Inspect Chip Relocated to Lobby Setup (Arena Select)

### The Change
- Moved the advisory wallet-inspection indicator from character selection to the first lobby phase (`Choose Your Arena`):
  - Removed playability chip usage from [apps/web/src/components/lobby/CharacterSelect.tsx](/d:/projects/Cora/apps/web/src/components/lobby/CharacterSelect.tsx).
  - Added token-aware balance/inspect chip in [apps/web/src/components/lobby/LobbySetup.tsx](/d:/projects/Cora/apps/web/src/components/lobby/LobbySetup.tsx) using `useWalletArenaPlayability`.
- Chip now follows selected arena token context:
  - SOL selected -> `SOL Balance: ...`
  - BONK selected -> `BONK Balance: ...`
- Updated [apps/web/src/components/lobby/LobbyScreen.tsx](/d:/projects/Cora/apps/web/src/components/lobby/LobbyScreen.tsx) to stop passing the now-removed `walletConnected` prop to `CharacterSelect`.
- Validation: `npm run lint --workspace apps/web` passes.

### The Reasoning
- Arena-readiness/balance feedback is more useful at token selection time than at character selection.
- This keeps phase intent clean: arena viability in setup phase, character decisions in draft phase.

### The Tech Debt
- Balance values remain dependent on backend playability normalization; until BE endpoint is live/reliable, chip may show `Inspecting...` / `Unavailable` / `--` fallback states.

## 2026-05-06 - Play Screen Character Sprite Wiring (stay/action)

### The Change
- Updated [apps/web/src/components/play/BattleScreen.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx) to render character art assets from `public/assets/characters/{scientistId}/{state}.png` directly inside the existing 4:5 portrait slots.
- Added sprite state resolution for /play portraits:
  - maps backend/shared CharacterState to sprite state (stay or action)
  - preserves local action pulse behavior by forcing action during damage animation windows.
- Switched portrait rendering from initials-only placeholders to next/image with fallback:
  - if sprite exists, render image
  - if sprite missing or fails to load, fallback to previous initial-letter placeholder so gameplay UI does not break.
- Kept all gameplay logic untouched (socket contract, damage logic, cards, settlement, history).
- Validation: `npm.cmd run lint --workspace apps/web` passes.

### The Reasoning
- FE needed to consume designer-delivered scientist assets in /play without changing backend contracts.
- Using shared-type-compatible states (stay, action) keeps naming and runtime behavior aligned across FE/BE.
- Graceful fallback avoids runtime breakage while asset delivery is still in progress.

### The Tech Debt
- Current repository assets include turing and curie states, but einstein sprite files are not present yet; Einstein currently renders fallback initials until those files are added.
- We currently support the shipped states (stay, action) only. If future character states (angry, happy) get dedicated art, we should extend the mapping and asset set.

## 2026-05-07 - Landing Features Uses Basic Scientist Pose Assets

### The Change
- Updated [apps/web/src/components/landing/Features.tsx](/d:/projects/Cora/apps/web/src/components/landing/Features.tsx) to render scientist portrait art from `public/assets/characters/{scientistId}/basic.png` inside the existing 4:5 portrait panel.
- Added `next/image` rendering for the basic pose with `fill + object-cover` so the new art consistently fits the current card ratio.
- Preserved a safe fallback: if a basic image is missing or fails to load, the previous placeholder portrait (emoji + silhouette) still renders.
- Kept existing overlays, badges, and HP strip layered above the image so current visual hierarchy remains intact.
- Validation: `npm.cmd run lint --workspace apps/web` passes.

### The Reasoning
- The designer shipped basic poses and these are the best source for static landing cards, while action/stay assets remain gameplay-focused in `/play`.
- Reusing the current 4:5 frame avoids layout churn and keeps card composition stable across all scientists.
- Fallback behavior ensures the roster section does not regress when an asset is delayed or renamed.

### The Tech Debt
- `basic.png` naming/path is currently convention-based. If art versioning grows, we should centralize scientist asset metadata in one shared map instead of deriving paths inline.
- Overlay intensity is slightly stronger with real art than placeholder mode; we may want a quick polish pass once final color grading for all portraits is locked.

## 2026-05-07 - Landing Features Portrait Cleanup (Unobstructed Character Art)

### The Change
- Updated [apps/web/src/components/landing/Features.tsx](/d:/projects/Cora/apps/web/src/components/landing/Features.tsx) to remove portrait-overlay elements that were covering character art.
- Removed in-portrait center overlays:
  - base emoji marker
  - base label text
- Removed in-portrait bottom HP bar strip.
- Reduced portrait color-wash opacity when real art is present so the character remains clearly visible.
- Moved base context to the card body (`Base: ...`) so information is retained without overlapping the illustration.
- Validation: `npm.cmd run lint --workspace apps/web` passes.

### The Reasoning
- The new basic pose assets are now the primary visual focus of each roster card.
- Overlay UI on top of portraits created readability and composition conflicts (especially around face and lower body).
- Keeping metadata in the body preserves information hierarchy while respecting the artwork.

### The Tech Debt
- If we later need dynamic HP visualization on landing cards, it should be rendered outside portrait bounds (for example as a compact row in card body) rather than layered on the image.

## 2026-05-07 - Features Expand Stats Aligned to Shared Character Definitions

### The Change
- Updated [apps/web/src/components/landing/Features.tsx](/d:/projects/Cora/apps/web/src/components/landing/Features.tsx) to drive expanded `View Stats` content from [packages/shared-types/src/characterStats.ts](/d:/projects/Cora/packages/shared-types/src/characterStats.ts) instead of hardcoded landing profile stat bars.
- Added shared-data integration in landing features:
  - imports `CHARACTER_DEFS` and `QuestionCategory`
  - maps canonical specialty category labels (`sequence`, `logical`, `math`) for display
- Refined click-expand (mobile + desktop drawer) stats UI to show gameplay-accurate combat intel:
  - Specialty category
  - Specialty bonus percent
  - Base correct power (`1.0x`)
  - Specialty power (`1.5x`)
  - Specialty + extra point max (`3.0x`)
- Updated progress bar math to normalize multiplier values against max stack (`3.0x`) so visual bars are consistent and comparable.
- Validation: `npm.cmd run lint --workspace apps/web` passes.

### The Reasoning
- `characterStats.ts` is the canonical gameplay source for character specialties and multipliers; landing expand stats should reflect those same mechanics.
- This removes drift between marketing/landing representation and actual match behavior.
- The refined drawer now communicates meaningful, game-accurate stats when users click `View Stats`.

### The Tech Debt
- Landing profile `stats` fields in `content.ts` are still present for narrative profile metadata, but no longer drive expandable combat bars. If not needed elsewhere, we can deprecate or repurpose them in a cleanup pass.

## 2026-05-07 - Features Outer Card Narration and Pills Aligned to Shared Stats

### The Change
- Updated [apps/web/src/components/landing/Features.tsx](/d:/projects/Cora/apps/web/src/components/landing/Features.tsx) to make outer (collapsed) card narration and top pills derive from [packages/shared-types/src/characterStats.ts](/d:/projects/Cora/packages/shared-types/src/characterStats.ts).
- Replaced static/marketing pill values with stat-driven pills:
  - left pill now reflects specialty role derived from category (`Mathematician`, `Logician`, `Pattern Runner`)
  - right pill now shows canonical specialty bonus (`+50% Bonus` from multiplier)
- Replaced outer short narration with stat-aligned summary text generated from specialty category + multiplier (for consistency with gameplay rules).
- Removed the previous static rarity label dependency from this card layer.
- Validation: `npm.cmd run lint --workspace apps/web` passes.

### The Reasoning
- The user asked for outer card narration/pills to match character stats; shared character definitions are the authoritative source.
- This keeps first-glance roster information aligned with actual gameplay mechanics rather than thematic-only labels.

### The Tech Debt
- Role and narration strings are currently generated with simple conditional helpers in `Features.tsx`. If this language is reused across pages, it should be centralized into a shared presentational mapping utility.

## 2026-05-07 - Dedicated /history Route + Informational GoldRush UX Scope

### The Change
- Added a dedicated history route at [apps/web/src/app/history/page.tsx](/d:/projects/Cora/apps/web/src/app/history/page.tsx) and new view component [apps/web/src/components/history/HistoryView.tsx](/d:/projects/Cora/apps/web/src/components/history/HistoryView.tsx).
- Implemented `HistoryView` as a non-blocking, informational page that reads query params (`scope`, `arena`, `token`, optional `address`) and fetches data via existing FE adapters:
  - `getArenaHistory`
  - `getWalletHistory`
- Updated [apps/web/src/components/history/HistoryButton.tsx](/d:/projects/Cora/apps/web/src/components/history/HistoryButton.tsx) to support both click-handler mode and link mode (`href`) so existing screens can route directly to `/history`.
- Rewired character-select history access to route mode:
  - [apps/web/src/components/lobby/CharacterSelect.tsx](/d:/projects/Cora/apps/web/src/components/lobby/CharacterSelect.tsx) now links to `/history?...` and removes local drawer-fetch state.
- Reduced non-arena wallet inspect surface:
  - [apps/web/src/components/lobby/OpponentFound.tsx](/d:/projects/Cora/apps/web/src/components/lobby/OpponentFound.tsx): removed inline wallet inspect modal/buttons and local history drawer state; uses `/history` route entry.
  - [apps/web/src/components/play/BattleScreen.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx): removed wallet inspect modal/buttons and local history drawer state; `View History` now links to `/history?...`.
- Validation: `npm.cmd run lint --workspace apps/web` passes.

### The Reasoning
- The user requested a dedicated `/history` view and clarified GoldRush should remain informational-only.
- Routing to a full page avoids repeating fetch + modal logic in multiple phases and keeps gameplay screens focused.
- Removing wallet-inspect actions from opponent/battle phases aligns UX to the intended scope: balance readiness is relevant in arena selection, not throughout the full match flow.

### The Tech Debt
- History data quality still depends on backend stub coverage for `/api/history/*`; UI reflects availability but does not yet annotate mock-vs-indexed provenance explicitly per item.
- `HistoryView` currently uses lightweight in-component query/state handling; if filtering/sorting grows, we should promote this into shared hooks for easier reuse and cache behavior consistency.

## 2026-05-07 - History UI & Header Placement Consolidation

### The Change
- Finalized the history experience as a player-facing records surface across:
  - [apps/web/src/components/history/HistoryView.tsx](/d:/projects/Cora/apps/web/src/components/history/HistoryView.tsx)
  - [apps/web/src/components/history/HistoryDrawer.tsx](/d:/projects/Cora/apps/web/src/components/history/HistoryDrawer.tsx)
  - [apps/web/src/components/history/WalletInspectPanel.tsx](/d:/projects/Cora/apps/web/src/components/history/WalletInspectPanel.tsx)
- Consolidated history UX updates in one pass:
  - removed internal-facing disclaimer copy
  - switched to player-facing records language
  - refined result-first receipt hierarchy (result/status/opponent/wager/signature)
  - improved chip consistency and visual emphasis
  - added subtle transition polish for history state/content changes
- Finalized history entry-point placement in [apps/web/src/components/lobby/LobbySetup.tsx](/d:/projects/Cora/apps/web/src/components/lobby/LobbySetup.tsx):
  - moved history access from character-select to arena setup
  - grouped header as left wallet, middle wager+balance, right history
  - aligned balance/history visuals with the existing header pill language
- Removed history action from character-select phase in [apps/web/src/components/lobby/CharacterSelect.tsx](/d:/projects/Cora/apps/web/src/components/lobby/CharacterSelect.tsx).
- Validation: `npm.cmd run lint --workspace apps/web` passes.

### The Reasoning
- History should feel like part of the game product, not backend diagnostics.
- Arena setup is the highest-context moment for history lookup (token decision + balance + prior records).
- Consolidating these small iterations into one coherent pass improves handoff readability.

### The Tech Debt
- History visuals and motion timing remain component-local; if reused across additional pages, we should extract shared tokens/primitives for chips, receipts, and transition timing.
- Header chip styling in `LobbySetup` remains local composition; future header variants may benefit from a shared layout primitive.




## 2026-05-07 - Battle Character Asset Presentation Polish (Facing, Action Pop, Frame Removal)

### The Change
- Updated [apps/web/src/components/play/BattleScreen.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx) character presentation layer only:
  - **Opponent facing direction:** mirrored opponent sprite horizontally (`scaleX`) so opponent visually faces left; player remains facing right.
  - **Action micro-animation:** added lightweight pop/bounce when sprite enters `action` state using Framer Motion animation controls (`scale` + `y` sequence).
  - **Frame removal:** removed visible rectangular portrait frame/background treatment around both characters (no border/background/overlay frame), while preserving existing absolute positioning and scene layout.
  - adjusted sprite fit to `object-contain` for cleaner direct-in-scene character rendering.
- No changes to gameplay logic, socket flow, projectile logic, base logic, or scoring.
- Validation: `npm.cmd run lint --workspace apps/web` passes.

### The Reasoning
- Opponent mirroring improves combat readability by making characters face each other.
- A short action pop increases perceived responsiveness for attack/heal events without adding heavy effects.
- Removing portrait frames aligns character assets with a more in-scene presentation and reduces UI-box feel.

### The Tech Debt
- Action micro-animation timing is currently local in `BattleScreen.tsx`; if we add more character-state motion across screens, we should centralize motion timing tokens/utilities.

## 2026-05-07 - Battle Result Modal Restyle (Player-First + Collapsible Settlement Details)

### The Change
- Restyled the match-complete modal in [apps/web/src/components/play/BattleScreen.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx) to match the dark arena + warm card direction with:
  - stronger dark backdrop overlay
  - premium parchment card treatment
  - large centered Caprasimo result title (`You Win` / `You Lose` / `Match Invalidated`)
  - Gabarito subtitle copy (`Victory secured.`, `Rival took this round.`, `Match invalidated.`)
- Reduced default visible content to player-facing summary only:
  - settlement status chip (`Settled`, `Pending`, `Invalidated`)
  - rounds score (`Your Rounds`, `Opponent Rounds`)
  - compact outcome stats (`Correct`, `Timeout`, `Wrong`)
  - optional shortened winner line when context is useful
- Removed technical settlement/debug content from the default surface (match id, full authority block, server pubkey/signature, backend explanation).
- Added a local UI toggle in the same component:
  - `Show Settlement Details` / `Hide Settlement Details`
  - when expanded, reveals match id, server pubkey, settlement signature, and backend settlement text/waiting status.
- Reordered result actions to improve hierarchy:
  - primary style: `Blink Share`, `Back To Lobby`
  - secondary style: `View History`
- Cleaned dead code by removing now-unused outcome color/label helper functions after removing default turn-history rendering from this modal.
- Validation: `npm.cmd run lint --workspace apps/web` passes.

### The Reasoning
- The previous modal mixed game UX and settlement internals, which made the result moment feel like an operations panel.
- This refactor keeps the end-of-match state celebratory and readable by default, while still preserving access to technical data on demand.
- Keeping all data wiring intact but changing only layout/copy/toggle behavior satisfies the requirement to avoid logic and routing regressions.

### The Tech Debt
- Modal visual tokens (overlay/card/button/chip styles) are still component-local in `BattleScreen.tsx`; if result surfaces expand to other screens, we should extract shared style primitives.
- The details panel currently uses plain text blocks; if settlement diagnostics become a recurring UX need, a shared key-value diagnostics component would improve consistency.

## 2026-05-07 - OpponentFound History Entry-Point Removal

### The Change
- Updated [apps/web/src/components/lobby/OpponentFound.tsx](/d:/projects/Cora/apps/web/src/components/lobby/OpponentFound.tsx) to remove history entry points from the opponent-found phase only.
- Removed `HistoryButton` import and removed `historyHref` constant (unused after UI removal).
- Removed top-row history button while keeping:
  - playability chip
  - `Show Room Status` / `Hide Room Status` toggle
- Removed bottom `Open Full History` link block.
- Kept all match-flow behavior unchanged: deposit signing, socket reconnection, status rail, timeout/cancel flow, and routing to battle.
- Validation: `npm.cmd run lint --workspace apps/web` passes.

### The Reasoning
- Opponent-found should stay focused on immediate match flow (rival locked -> sign deposit -> enter battle).
- History access is now treated as app-level navigation rather than a repeated action in every match phase.

### The Tech Debt
- If product later needs contextual history during deposit phases, we should reintroduce it through a centralized phase-navigation policy instead of per-screen ad hoc links.

## 2026-05-07 - Battle Hand + Question Popup Rounded Placeholder Polish

### The Change
- Updated only visual styling in [apps/web/src/components/play/BattleScreen.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx) for:
  - bottom battle hand cards
  - active question popup shell
  - answer option buttons
- Battle hand cards:
  - replaced sharp `frame-cut` card appearance with rounded placeholder cards
  - preserved existing fan layout/transforms, click behavior, disabled behavior, and active card highlighting
  - removed visible `card.type` / `locked` text from card face
  - kept a simple center `?` mark and added subtle placeholder texture layers
  - tuned disabled/locked cards to look intentionally inactive rather than broken
- Active question popup:
  - replaced old sharp modal shell with a rounded warm panel
  - kept dark overlay and all question/timer/answer logic unchanged
- Answer option buttons:
  - replaced sharp panels with rounded chunky button cards in the same warm style direction
  - kept existing `onAnswer`, disabled, and lock behavior unchanged
- Validation: `npm.cmd run lint --workspace apps/web` passes.

### The Reasoning
- These elements were still visually anchored to the older sharp-frame style and felt out of place against the newer rounded battle UI.
- This pass introduces temporary rounded placeholders that are easier to swap later when final designer card assets land.

### The Tech Debt
- Card/popup placeholder textures and color treatments are currently inline style values in `BattleScreen.tsx`; these should become shared tokens/primitives if reused across more battle surfaces.
- Final art integration will likely replace most placeholder layers, so a follow-up cleanup pass should remove any temporary decorative styling that becomes redundant.

## 2026-05-08 - Battle Room Gate Banners Converted To Blocking Overlay Modal

### The Change
- Updated room gate presentation in [apps/web/src/components/play/BattleScreen.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx) from inline banners to a centered blocking overlay modal.
- Removed inline rendering above the arena for:
  - `isRoomStateLoading`
  - `shouldShowPlayStateGate`
- Added a unified fixed overlay gate (`showRoomGateModal`) with dark low-opacity backdrop and centered panel so the arena stays in place.
- Modal copy now follows requested wording:
  - syncing: `Syncing Room State` + `Rejoining battle room after refresh. Waiting for server snapshot.`
  - non-playing: `Waiting For Battle` (when status is `waiting`) or `Room Locked` + `Current room status: ${getStatusLabel(status)}.`
- Preserved gate actions:
  - `Retry Room` (only when socket has issue)
  - `Return And Requeue`
- Kept socket/gameplay logic and state checks unchanged (presentation-only refactor).
- Validation: `npm.cmd run lint --workspace apps/web` passes.

### The Reasoning
- Inline gate banners were affecting document flow and pushing the battle arena down, which made the screen feel broken.
- A fixed overlay preserves scene layout while still blocking interaction and communicating room state clearly.

### The Tech Debt
- This gate modal styling is local to `BattleScreen.tsx`; if similar blocking gates are needed elsewhere, we should extract a shared modal-gate primitive.
- There is still a separate `Unable to enter battle room` inline banner path; if we want full consistency, that path can be unified into the same overlay pattern in a follow-up pass.

## 2026-05-08 - OpponentFound Deposit Action Hierarchy Polish

### The Change
- Polished deposit action presentation for `OpponentFound` flow using:
  - [apps/web/src/components/deposit/DepositPanel.tsx](/d:/projects/Cora/apps/web/src/components/deposit/DepositPanel.tsx)
  - [apps/web/src/components/deposit/DepositStatusCard.tsx](/d:/projects/Cora/apps/web/src/components/deposit/DepositStatusCard.tsx)
  - [apps/web/src/components/lobby/OpponentFound.tsx](/d:/projects/Cora/apps/web/src/components/lobby/OpponentFound.tsx)
- Centered secondary action group in `DepositStatusCard` so `retrySlot` + `cancelSlot` are always centered together, and `Cancel Match` stays centered when alone.
- Reduced secondary action visual weight in `OpponentFound` by shrinking `Retry Connection` and `Cancel Match` padding/size (`px-3 py-1.5 text-[10px] shadow-sm`).
- Updated `DepositPanel` primary action button to the shared chunky primary game button family (`btn-game btn-game-primary`) with larger dominant CTA sizing and muted disabled styling in the same family.
- Kept all behavior intact: signing, retry, cancel, deposit status logic, and slot wiring unchanged.
- Validation: `npm.cmd run lint --workspace apps/web` passes.

### The Reasoning
- The previous secondary actions looked too prominent and defaulted left alignment, which weakened the action hierarchy.
- Centering secondary actions and reducing their scale creates a clear primary-first flow while preserving utility access.
- Using the shared primary button family aligns deposit CTA visuals with established game CTAs like queue entry.

### The Tech Debt
- Slot-provided action sizing is still caller-controlled; if more screens reuse this pattern, we should standardize secondary-action size tokens at the deposit component level.
- Deposit CTA variant choices are now class-driven but still local to `DepositPanel`; a future button-variant utility could reduce repeated CTA class decisions across flows.

## 2026-05-08 - Matchmaking Deposit UX Role Gating + Mystery Rival + Play Character Source Lock

### The Change
- Updated matchmaking handoff and deposit UX flow across:
  - [apps/web/src/lib/matchmaking/queueMatch.ts](/d:/projects/Cora/apps/web/src/lib/matchmaking/queueMatch.ts)
  - [apps/web/src/components/lobby/LobbyScreen.tsx](/d:/projects/Cora/apps/web/src/components/lobby/LobbyScreen.tsx)
  - [apps/web/src/components/lobby/OpponentFound.tsx](/d:/projects/Cora/apps/web/src/components/lobby/OpponentFound.tsx)
  - [apps/web/src/lib/solana/signDepositIntent.ts](/d:/projects/Cora/apps/web/src/lib/solana/signDepositIntent.ts)
  - [apps/web/src/hooks/useMatchSocket.ts](/d:/projects/Cora/apps/web/src/hooks/useMatchSocket.ts)
  - [apps/web/src/components/play/BattleScreen.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx)
- `/match` role propagation:
  - extended `queueMatch` response typing to include optional `role` (`playerA`/`playerB`)
  - stored role in `LobbyScreen` (`matchedRole`) and passed it into `OpponentFound` as `matchRole`
- Player B deposit lock + unlock behavior in `OpponentFound`:
  - disabled sign action for Player B until `depositUnlocked` is received
  - removed websocket-connection-state requirement from sign button enablement (wallet + role gate + signing state now control gating)
  - preserved `confirmDeposit` emission only after socket is `connected`
  - added Player B helper copy while locked: `Waiting for Player A to deposit first.`
  - on `depositUnlocked` for Player B, reset visible countdown to fresh 30s and show unlock copy: `Player A deposited � your turn.`
  - paused countdown/auto-timeout while Player B is locked pre-unlock
- Opponent identity privacy in `OpponentFound`:
  - replaced rival portrait/name/base with mystery state (`?`, `Mystery Rival`, `Character hidden until battle`)
  - kept opponent wallet/address visible
- `/play` character source hardening:
  - `BattleScreen` now sources player character from server `gameState.player.characterId` only (no FE query fallback)
  - `BattleScreen` websocket join no longer sends `characterId`
  - `useMatchSocket` now only appends `characterId` query when explicitly provided (removed default `einstein` fallback)
- Added lightweight debug logs to distinguish failure stage:
  - deposit click gating context in `OpponentFound`
  - backend transaction fetch start/failure/receipt in `signDepositIntent`
  - pre-`wallet.sendTransaction` log in `signDepositIntent`
- Validation: `npm.cmd run lint --workspace apps/web` passes.

### The Reasoning
- Role-aware deposit gating is needed so Player B cannot sign before backend unlock and receives clear, deterministic UX state transitions.
- Decoupling sign-button enablement from transient socket reconnects avoids false-negative UX blocks while still preserving server confirmation sequencing.
- Hiding rival character in deposit phase prevents premature identity reveal and aligns reveal timing with battle entry.
- Removing FE character fallback in `/play` avoids stale local character assumptions after reconnect and makes server state authoritative.

### The Tech Debt
- Role fallback currently combines `/match` response with websocket `matchFound` payload; if backend role source-of-truth changes, this should be centralized in one shared match-session model.
- Deposit unlock UX messaging is component-local; if reused in other phases, we should extract a small role/deposit-state presentation helper.
- Logging is intentionally lightweight and ad hoc; if we formalize telemetry, these should be routed through a structured frontend observability layer.

## 2026-05-08 - Gameplay/Deposit UX Follow-Up Polish (Role Lock, Card Type Fallback, Result Transition)

### The Change
- Applied focused frontend polish across:
  - [apps/web/src/components/lobby/OpponentFound.tsx](/d:/projects/Cora/apps/web/src/components/lobby/OpponentFound.tsx)
  - [apps/web/src/components/play/BattleScreen.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx)
- OpponentFound deposit UX follow-up:
  - preserved role-based Player B lock behavior and non-draining pre-unlock state
  - updated Player B unlock copy to: `Player A deposited. Your turn to sign.`
  - updated debug click log payload to include requested fields: `role`, `depositUnlockedAt`, `playerBLocked`, `countdownSeconds`, `canAttemptSign`
  - retained reconnect-tolerant signing gate (signing not blocked solely by transient websocket reconnect)
- Opponent identity copy polish:
  - replaced `Mystery Rival` with `Your Rival`
  - replaced subcopy with neutral: `Character revealed when battle starts.`
  - kept `?` portrait placeholder and wallet/address visibility
- Temporary card type visibility fallback during play:
  - added simple readable hand-card label chips showing `Attack` or `Heal` on each playable card in battle hand
  - kept existing card layout/interaction intact
- Match result popup transition polish:
  - wrapped result overlay in `AnimatePresence`
  - added smooth fade for backdrop and subtle y/scale entrance/exit animation for result card using Framer Motion
  - no changes to settlement/routing/share logic
- Validation: `npm.cmd run lint --workspace apps/web` passes.

### The Reasoning
- This pass fixes remaining UX rough edges without touching backend, queue, or settlement systems.
- Temporary card type text restores tactical readability until final art treatment lands.
- Motion polish removes abrupt result popup appearance while keeping match flow responsive.

### The Tech Debt
- Player-role reliability remains dependent on role propagation source; if `/match` role availability changes across environments, role-origin handling should be centralized into one explicit match-session contract.
- Temporary card type chips are intentionally stopgap UI and should be replaced once final card art/type indicators are delivered.
- Result modal motion values are local constants; if more overlays adopt similar behavior, motion tokens should be shared.

## 2026-05-08 - Gameplay Feedback Notification Pass + Deposit Waiting State Polish

### The Change
- Updated gameplay feedback presentation in [apps/web/src/components/play/BattleScreen.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx):
  - Removed inline post-action feedback text above hand cards.
  - Added a compact, upper-middle, non-blocking game notification system (`pointer-events-none`) with subtle motion.
  - Routed post-action feedback into notifications:
    - attack result (`Attack landed: -X HP` when available)
    - heal result (`Healed: +X HP` when available)
    - no-damage states (`No damage this turn.`)
  - Routed Extra Point phase change into the same upper-middle notification style (`Extra Point - every move matters.`).
  - Kept existing projectile/base-hit animations and interaction flow unchanged.
- Removed `View History` action from the win/lose result popup in [BattleScreen.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx) only.
- Polished deposit waiting states in [apps/web/src/components/lobby/OpponentFound.tsx](/d:/projects/Cora/apps/web/src/components/lobby/OpponentFound.tsx):
  - Player A countdown now stops after signing (`signingState === waiting`) and shows clear waiting copy (`Deposit signed. Waiting for Player B.`).
  - Player B remains locked/passive pre-unlock (`Waiting for Player A to deposit first.`) with no draining countdown.
  - Player B unlock copy remains explicit (`Player A deposited. Your turn to sign.`).
  - Countdown visibility now uses explicit derived state (`shouldShowCountdown`) rather than always showing after mount.
- Validation: `npm.cmd run lint --workspace apps/web` passes.

### The Reasoning
- Inline action text near hand cards was competing with play controls and looked disconnected from the game feedback style.
- A single upper-middle, non-blocking notification lane improves readability for both action outcomes and phase changes without obstructing card play.
- Deposit-phase copy and countdown visibility now better communicate who is waiting on whom, reducing confusion during Player A/Player B sequencing.

### The Tech Debt
- Notification copy/timing is still local to `BattleScreen`; if other gameplay screens need similar UX, this should become a shared game-notification primitive.
- Deposit waiting-state messaging logic is still component-local in `OpponentFound`; if additional deposit phases/screens are added, message derivation should be centralized.

## 2026-05-08 - Match Lifecycle UX Polish (/play Presence, Cancel/Surrender Semantics, Result States)

### The Change
- Updated [apps/web/src/components/play/BattleScreen.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx):
  - removed remaining `/play` requeue assumptions (`resumeQueue` URL construction and `Return And Requeue` actions)
  - replaced old `/play` recovery navigation with clean `/lobby` return paths only
  - upgraded current-player recovery copy/action to:
    - title/copy: `You were disconnected` + `Your match is still active. Rejoin to continue.`
    - action: `Rejoin Room` (same-room socket reconnect)
  - integrated backend lifecycle events into play UX:
    - consumes `lastRoomCancelled` and maps reason-specific user copy:
      - `player_cancelled` -> `Match cancelled`
      - `deposit_timeout` -> `Deposit timed out`
      - `disconnect` -> `Match cancelled before battle start`
    - consumes presence state (`presenceUpdate` and `player/opponent.isConnected`) for non-blocking opponent status:
      - transient notices: `Opponent disconnected` / `Opponent reconnected`
      - persistent opponent chip: `Connected` / `Away`
  - added cancel vs surrender action semantics on `/play`:
    - pre-commit (`waiting`/`depositing`): `Cancel Match` (sends `cancelMatch`)
    - committed/active (`playing`/`settling`): `Surrender`
  - replaced prompt-style surrender with explicit confirmation modal:
    - title: `Surrender match?`
    - body: `Surrendering means you forfeit this match. Your rival will receive the wager after settlement. You will return to lobby.`
    - actions: `Keep Playing` and `Surrender`
  - expanded result presentation to support non-winner assumptions safely:
    - `You Win` / `You Lose`
    - `Draw`
    - `You Surrendered`
    - `Opponent Surrendered`
    - cancellation result text via `roomCancelled` reasons
  - preserved existing animation/result structure and gameplay card flow.
- Updated [apps/web/src/components/lobby/OpponentFound.tsx](/d:/projects/Cora/apps/web/src/components/lobby/OpponentFound.tsx):
  - added friendly `roomCancelled` reason mapping messages before lobby return
  - removed immediate post-click forced timeout on cancel; now waits for backend cancellation signal path
  - updated stale `Returning to queue` language to `Returning to lobby` for deposit-failure context.
- Validation: `npm.cmd run lint --workspace apps/web` passes.

### The Reasoning
- `/play` should no longer imply auto-requeue behavior in wagered and recoverable match states.
- Presence-aware UX prevents confusion when an opponent disconnects while a connected player remains in an active room.
- Explicit cancel-vs-surrender wording aligns player intent with lifecycle phase and backend semantics.
- Result rendering must tolerate `winnerAddress: null` and lifecycle-terminal outcomes beyond simple win/lose.

### The Tech Debt
- Presence UX still depends on event timing between `presenceUpdate` and `gameStateUpdate`; if backend emits richer phase-aware presence metadata, the FE can further simplify conditions.
- Cancellation is now clearly rendered, but lobby-level post-cancel handoff remains distributed across component-local timers and callbacks.
- `/lobby` still retains legacy `resumeQueue` handling for compatibility; now that `/play` stopped emitting it, a future cleanup pass can remove that branch if no other flows depend on it.
## 2026-05-08 - Disconnect Overlay UX (Manual Rejoin + Optional Surrender)

### The Change
- Updated [apps/web/src/components/play/BattleScreen.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx) reconnect UX for current-player disconnect during active/recoverable match:
  - added a full-screen blocking overlay in the same frame-cut visual style as existing battle overlays
  - title/body copy now:
    - `You were disconnected`
    - `Your match is still active. Rejoin to continue, or surrender to end the match.`
  - removed inline disconnect-state frame usage for this flow
  - suppressed top-right disconnect/reconnecting socket alerts while the full-screen disconnect overlay is active
  - removed auto-rejoin behavior from this disconnect UX path; reconnect is now user-triggered only
  - added explicit dual CTA behavior:
    - `Rejoin Room` -> calls `reconnect()` for same-room recovery
    - `Surrender` -> uses existing surrender intent flow, including reconnect-then-submit handling when disconnected
  - no countdown timer, no auto-dismiss, no auto-win/forfeit countdown added in FE
- Validation: `npm run lint` in `apps/web` passes.

### The Reasoning
- In a recoverable wagered match, disconnect should be explicit and player-controlled, not hidden in toasts or auto-retry side effects.
- A blocking overlay with clear actions reduces ambiguity about whether the room is still active and what the player can do next.
- Reusing existing surrender semantics keeps settlement ownership on backend lifecycle events rather than FE assumptions.

### The Tech Debt
- Reconnect/surrender intent orchestration is still component-local state in `BattleScreen`; if additional play surfaces share this behavior, it should be extracted into a dedicated match-recovery controller hook.
- Socket alert suppression is context-specific (`showDisconnectedOverlay`) and may need consolidation if other modal-priority states are introduced.

## 2026-05-08 - Character Expressions (Happy Preview + Battle Reaction Bubbles)

### The Change
- Updated [apps/web/src/components/character/CharacterCard.tsx](/d:/projects/Cora/apps/web/src/components/character/CharacterCard.tsx):
  - added expression portrait support for selection UI using `/assets/characters/{characterId}/exp/happy.png`
  - renders `happy` expression for selected or previewed cards (hover/focus preview)
  - keeps existing fallback initial rendering when expression asset is unavailable
- Updated [apps/web/src/components/character/CharacterSelect.tsx](/d:/projects/Cora/apps/web/src/components/character/CharacterSelect.tsx):
  - explicitly passes `previewExpression="happy"` into `CharacterCard`
- Updated [apps/web/src/components/play/BattleScreen.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx):
  - added battle reaction bubble UI near each character (left for player, right for rival)
  - bubble content is expression image assets from `/assets/characters/{characterId}/exp/{expression}.png`
  - added temporary reaction state with override behavior and auto-hide timers
  - wired reactions to existing match events/state only:
    - `happy` on local correct answer via `lastPlayResult.correct`
    - `hurt` on damaged target via `lastDamageEvent` attack damage
    - `confident` when `currentCorrectStreak >= 3` for player/opponent
  - intentionally uses `currentCorrectStreak` (not `longestCorrectStreak`) for FE reaction logic

### The Reasoning
- Expression assets are 1:1 and separate from combat pose assets (`stay/action/basic` 4:5), so expression rendering is isolated to `/exp` and mapped per use-case.
- Character selection now previews the intended expression style without changing gameplay sprites.
- Battle reactions are event-driven, brief, and non-blocking to preserve gameplay readability while providing emotional feedback.
- `currentCorrectStreak` represents live, player-facing momentum and is the correct source for confidence reactions.

### The Tech Debt
- Reaction trigger logic lives in `BattleScreen`; if additional battle surfaces need the same behavior, this should be extracted into a shared reaction hook/controller.
- Rival `happy` currently depends on available FE event context and can be expanded later if backend emits an explicit per-player correctness stream to both clients.
- Expression fallback behavior is per-component; a shared character-asset resolver utility could reduce duplication across lobby/play surfaces.

## 2026-05-08 - Character Select Expression State (Idle Default, Happy on Selected)

### The Change
- Updated [apps/web/src/components/character/CharacterCard.tsx](/d:/projects/Cora/apps/web/src/components/character/CharacterCard.tsx):
  - removed hover/focus-driven expression switching
  - expression rendering is now strictly selection-state based:
    - unselected card -> `/assets/characters/{characterId}/exp/idle.png`
    - selected card -> `/assets/characters/{characterId}/exp/happy.png`
  - preserved fallback initial rendering when expression asset is unavailable
- Kept [apps/web/src/components/character/CharacterSelect.tsx](/d:/projects/Cora/apps/web/src/components/character/CharacterSelect.tsx) selected-expression contract (`previewExpression="happy"`) unchanged.

### The Reasoning
- Selection intent should be explicit and stable; hover-based swaps can feel noisy and imply a state change that has not actually happened.
- `idle` as default and `happy` as selected gives a clean, readable visual cue for locked-in user intent.

### The Tech Debt
- Expression state mapping for select cards is still component-local; if multiple screens require the same selected/unselected expression policy, this should move into a shared character-expression helper.

## 2026-05-08 - Character Card Selection Bounce (Select <-> Deselect)

### The Change
- Updated [apps/web/src/components/character/CharacterCard.tsx](/d:/projects/Cora/apps/web/src/components/character/CharacterCard.tsx):
  - added a subtle bounce animation when selection state changes in either direction:
    - `not selected -> selected`
    - `selected -> not selected`
  - implemented via `framer-motion` animation controls with short keyframe-based `y/scale` motion
  - preserved existing hover lift and visual selection styling
  - switched expression error handling to a per-asset failure map to avoid effect-driven state resets and keep lint clean

### The Reasoning
- A small bounce gives immediate feedback that selection state actually changed, without introducing distracting motion.
- Animation controls provide explicit state-transition motion while keeping mount and hover behavior stable.
- Per-asset failure tracking keeps idle/happy expression swapping resilient when one asset is missing.

### The Tech Debt
- Selection bounce timing/curve is currently hardcoded in the card component; if we add similar transitions elsewhere, we should centralize motion tokens.

## 2026-05-08 - Card Hover Softening + Portrait-Only Selection Bounce

### The Change
- Updated [apps/web/src/components/character/CharacterCard.tsx](/d:/projects/Cora/apps/web/src/components/character/CharacterCard.tsx):
  - softened card hover lift to be less aggressive
  - moved select/deselect bounce animation from the full card container to the portrait block only
  - portrait now performs a subtle `y/scale` bounce on both transitions:
    - unselected -> selected
    - selected -> unselected
  - card keeps stable selection offset while avoiding large full-card motion

### The Reasoning
- Full-card bounce plus strong hover made interaction feel overly jumpy.
- Limiting bounce to the image area preserves responsiveness while keeping the overall layout calm.

### The Tech Debt
- Motion values are currently inline in `CharacterCard`; if we continue tuning interaction feel across components, shared motion tokens would reduce drift.

## 2026-05-08 - Character Card Cleanup (Remove Focused Badge + Dot/Line Marker)

### The Change
- Updated [apps/web/src/components/character/CharacterCard.tsx](/d:/projects/Cora/apps/web/src/components/character/CharacterCard.tsx):
  - removed the `Focused` label badge from selected portraits
  - removed the bottom dot/line indicator strip inside the portrait frame
  - preserved all selection, expression, and animation behavior otherwise

### The Reasoning
- These extra markers added visual noise and duplicated selection signals already conveyed by border/background/status treatments.
- Cleaner portrait framing improves readability of expression art.

### The Tech Debt
- Selection state is currently communicated by multiple visual channels; a future design pass could codify a minimal, shared state-token set for all character cards.

## 2026-05-08 - Battle Emote Reposition + Size Increase

### The Change
- Updated [apps/web/src/components/play/BattleScreen.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx):
  - moved player reaction emote to the right side of the player identity block (`You / Score / Address`)
  - moved rival reaction emote to the left side of the rival identity block (`Rival / Connected / Address / Score`)
  - removed old mid-arena absolute emote anchors
  - significantly increased emote bubble size from small overlays to large header-side bubbles (`96px` mobile, `112px` desktop)
  - preserved existing reaction timing, animation, and event triggers

### The Reasoning
- Emotes now sit exactly with the identity metadata the user reads first, which improves clarity and avoids visual competition with center combat sprites.
- Larger size improves readability of 1:1 expression art.

### The Tech Debt
- Player/rival emote bubble markup is duplicated in the header row; this can be extracted into a shared reaction bubble component if we keep iterating on style/behavior.

## 2026-05-08 - Battle Reaction Polish (Preload + Speech Bubble + Arena Attachment + Softer Timing)

### The Change
- Updated [apps/web/src/components/play/BattleScreen.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx):
  - added expression asset preloading for both active characters using a lightweight helper (`new window.Image()`), covering:
    - `happy`
    - `confident`
    - `hurt`
  - preloading runs when `playerCharacterId`/`opponentCharacterId` are available and does not block gameplay
  - increased default reaction display duration from `1200ms` to `1900ms`
  - replaced reaction visual from portrait-card look to a compact speech-bubble style:
    - warm cream bubble surface
    - stronger border/shadow
    - visible directional tail toward character
  - moved reaction bubbles from the header/name row back into the arena, anchored near each character sprite:
    - player bubble on character side-left
    - opponent bubble on character side-right
  - softened reaction motion to feel less abrupt:
    - pop-in with small bounce
    - gentler fade-out
  - kept all existing trigger logic unchanged (`happy`, `hurt`, `confident`) and no socket/gameplay behavior changes

### The Reasoning
- Preloading eliminates first-show image lag and makes reactions feel immediate.
- Speech-bubble styling communicates "reaction" better than square card framing.
- Arena-anchored placement reconnects the expression to the character action context.
- Slightly longer lifetime and softer transitions improve readability without clutter.

### The Tech Debt
- Reaction bubble markup exists twice (player/opponent variants); this can be extracted into a small shared render helper/component if more variants are added.
- Position offsets are tuned constants; a future responsive pass could derive offsets from measured sprite bounds for tighter device consistency.

## 2026-05-08 - Opponent Found Player Expression (Happy)

### The Change
- Updated [apps/web/src/components/lobby/OpponentFound.tsx](/d:/projects/Cora/apps/web/src/components/lobby/OpponentFound.tsx):
  - player-selected character portrait in the "Opponent Found" panel now renders:
    - `/assets/characters/{myScientist.id}/exp/happy.png`
  - added `next/image` rendering for the player portrait with graceful fallback to existing initial glyph if asset fails
  - opponent portrait remains unchanged as `?` (hidden identity behavior preserved)

### The Reasoning
- The player�s own selected scientist can be shown with expressive art before battle starts, while opponent identity remains intentionally concealed.

### The Tech Debt
- Expression asset resolution is component-local in `OpponentFound`; if more pre-battle surfaces need this behavior, a shared character portrait resolver helper would reduce duplication.

## 2026-05-08 - Battle Projectile Asset Wiring (Attacker-Based, Turing Variants, Heal Skip)

### The Change
- Updated [apps/web/src/components/play/BattleScreen.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx):
  - replaced placeholder projectile visual with character projectile assets
  - added projectile source resolver:
    - Einstein/Curie/others: `/assets/characters/{characterId}/projectile.png`
    - Turing: random per spawn between:
      - `/assets/characters/turing/projectile_0.png`
      - `/assets/characters/turing/projectile_1.png`
  - projectile asset is now selected from the attacker character (`playerCharacterId` or `opponentCharacterId` based on event side)
  - heal events no longer spawn projectile visuals
    - heal base FX and heal-related reaction behavior remain intact
  - removed framed projectile container/box styling
  - added subtle warm/gold radial glow behind projectile for dark-scene readability
  - added projectile asset failure tracking (`failedProjectileSprites`) and fallback rendering (glow + glyph) when image load fails

### The Reasoning
- Projectile visuals should match the active attacker identity to improve combat readability and character personality.
- Turing�s randomized binary projectile variants add variety while preserving deterministic gameplay logic.
- Heal should remain a non-projectile feedback channel, so visuals align with intended semantics.
- A free-floating asset with soft glow feels integrated into battle motion and avoids UI-card framing artifacts.

### The Tech Debt
- Projectile glow and motion constants are inline; if we introduce more VFX types, these should move to shared visual tokens/helpers.
- Projectile asset preloading is not yet centralized; if first-hit latency appears on slower devices, a shared preload pass can be added for projectile paths similar to expression preloading.

## 2026-05-08 - Real Base Asset Integration in Battle Arena

### The Change
- Updated [apps/web/src/components/play/BattleScreen.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx) to replace square base placeholders with real base art:
  - player base now resolves from player character ID
  - opponent base now resolves from opponent character ID
  - base source rules:
    - Einstein player: `/assets/characters/einstein/projectile_left.png`
    - Einstein opponent: `/assets/characters/einstein/projectile_right.png`
    - Curie/Turing (and non-Einstein fallback): `/assets/characters/{characterId}/projectile.png`
- Preserved correct orientation behavior:
  - Einstein bases are never flipped
  - opponent Curie/Turing bases are horizontally flipped
- Added large, grounded base placement on the arena floor with outside-edge cropping:
  - player base cropped off left edge
  - opponent base cropped off right edge
  - base wrappers use preserved aspect ratio (`1700 / 1269`) and `object-contain`
- Added compact mirrored HP bars near each base:
  - label `Base`
  - fill based on HP percentage
  - numeric display (`{hp} / 100`)
- Kept and upgraded base FX mapping on new base wrappers:
  - hit: shake + warm red flash/glow
  - heal: mint glow pulse
- Added base-asset failure fallback:
  - tracks failed base image paths
  - falls back to existing glyph placeholder if base art fails to load

### The Reasoning
- Real base art needed to feel like anchored arena objects rather than UI placeholders.
- Matching baseline and controlled edge cropping make the base read as large environment geometry tied to each side.
- Mirrored HP bars preserve quick readability while reducing UI clutter from old standalone text blocks.

### The Tech Debt
- Base position offsets are tuned constants; a future responsive tuning pass may be needed for edge devices and unusual viewport heights.
- Base max HP is displayed as `/100` in FE; if backend later provides dynamic max-base-health, the bar denominator should be sourced from state.

## 2026-05-08 - Base Asset Path Correction + Layer/Presentation Fixes

### The Change
- Updated [apps/web/src/components/play/BattleScreen.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx):
  - corrected base asset resolver to use real base files:
    - Einstein player: `/assets/characters/einstein/base_left.png`
    - Einstein opponent: `/assets/characters/einstein/base_right.png`
    - others: `/assets/characters/{characterId}/base.png`
  - removed `projectile*` naming from base path logic
- Tightened arena layer ordering:
  - base wrappers moved to lowest layer (`z-0`)
  - character sprites explicitly above base (`z-[6]`)
  - projectile above sprites (`z-[12]`)
  - base HP bars above base (`z-[9]`)
- Preserved presentation rules:
  - no box/background/border/rounded card when base image loads
  - fallback placeholder only when base image fails
  - same baseline alignment, aspect ratio `1700 / 1269`, and outer-edge cropping remain intact

### The Reasoning
- Base art was incorrectly mapped to projectile filenames; this blocked real base visuals.
- Explicit z-index ordering removes ambiguity and ensures bases stay in the arena background while still allowing readable HP overlays.

### The Tech Debt
- Asset extension selection is still hardcoded to `.png`; if future character packs mix formats, a resolver map or manifest will be safer.

## 2026-05-08 - Base Presentation Tuning (HP Above Base + Smaller Scale + Shared Ground Line)

### The Change
- Updated [apps/web/src/components/play/BattleScreen.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx):
  - moved Base HP UI to sit directly above each base asset by anchoring it to each base wrapper
  - reduced base render footprint for better proportion with current character scale:
    - from `w-[clamp(280px,37vw,560px)]`
    - to `w-[clamp(220px,31vw,430px)]`
  - kept base aspect ratio unchanged (`1700 / 1269`) and existing asset sources
  - aligned base and character to the same floor plane by anchoring both to `bottom-[16%]`
  - preserved base background behavior:
    - no box/panel when base image loads
    - fallback placeholder still only on load failure
  - preserved cropping, hit/heal base FX, and Einstein-specific base handling

### The Reasoning
- HP context reads more naturally when tied to and floating above each base instead of feeling detached.
- Smaller base scale better matches the reduced character size and improves visual balance.
- Shared bottom anchoring reinforces the same-ground illusion between base and character.

### The Tech Debt
- Ground and offset values are still tuned constants; we may need a per-breakpoint calibration pass for very short/mobile viewports.

## 2026-05-08 - Base Repositioning Without Downscale (Cards Separation + Stable HP Layer)

### The Change
- Updated [apps/web/src/components/play/BattleScreen.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx):
  - restored base render size (removed prior downscale):
    - back to `w-[clamp(280px,37vw,560px)]`
    - restored matching `sizes` hint (`280px/560px`)
  - moved base and character pair upward together to preserve shared ground alignment while clearing hand cards:
    - base wrappers and character wrappers now both anchored at `bottom-[22%]`
  - detached HP UI from base crop/wrapper:
    - moved player/opponent base HP bars into independent arena overlay layers
    - HP bars remain stable/readable even with base edge cropping
- Preserved existing behavior:
  - base assets and aspect ratio unchanged
  - base behind character
  - no UI panel/box on successful base image
  - crop behavior retained
  - Einstein left/right handling retained
  - hit/heal base FX retained

### The Reasoning
- User feedback indicated scale was acceptable; visual conflict was positional.
- Raising the base+character ground line together keeps floor-plane coherence while protecting foreground card space.
- Decoupling HP bars from base wrappers avoids clipping and keeps health info consistently visible.

### The Tech Debt
- Bottom and HP overlay offsets are still hand-tuned constants; we should revisit with viewport-specific tokens if additional responsive edge cases appear.

## 2026-05-08 - Battle Arena Vertical Layout Reset

### The Change
- Updated [apps/web/src/components/play/BattleScreen.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx):
  - split the arena into a dedicated scene region and a separate bottom hand-card tray
  - reduced base visual dominance and kept base assets as background scene props with preserved aspect ratio
  - kept character and base bottoms on the same visual ground line while preventing overlap with the card tray
  - moved base HP bars into stable top-left/top-right arena UI positions, detached from base art cropping
  - compacted player/rival metadata into inline You/Rival, score pill, rounds pill, and address rows
  - kept rival connection state in the top status chip row instead of inside arena metadata

### The Reasoning
- The previous composition tried to solve card collision with shared absolute offsets, which made bases, characters, HP bars, and hand cards compete for the same vertical space.
- Separating scene and hand tray layout gives the cards a guaranteed bottom zone while letting the arena read as a stage again.
- HP is gameplay UI, not part of the base asset, so it now sits in predictable overlay positions independent of base image crop and scale.

### The Tech Debt
- Base/character ground offsets remain tuned constants; a future responsive QA pass should validate very short mobile viewports and unusual aspect ratios.
- Full npm run lint is still blocked by an existing react-hooks/set-state-in-effect issue in apps/web/src/components/lobby/OpponentFound.tsx; targeted ESLint for BattleScreen.tsx passes.

## 2026-05-08 - Battle Screen Single-Viewport Fit

### The Change
- Updated [apps/web/src/components/play/BattleScreen.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx):
  - changed the battle page shell from padded min-height to fixed 100svh height with hidden overflow
  - tightened top status chips, section padding, arena gaps, and player metadata spacing
  - made the arena scene flex within available height instead of enforcing large fixed minimum heights
  - reduced base, character, and hand-card clamp sizes so the full battle composition fits without page scroll

### The Reasoning
- The prior split between scene and hand tray fixed overlap, but fixed min-heights plus page padding made the total composition taller than the viewport.
- Treating the battle screen as a bounded viewport layout keeps the room header, arena, characters, bases, HP bars, and hand cards visible as one screen.

### The Tech Debt
- This is tuned for the current battle UI density; very short landscape/mobile viewports may still need a dedicated compact breakpoint if the top status row wraps heavily.

## 2026-05-08 - Battle Arena Edge-to-Edge Scene

### The Change
- Updated [apps/web/src/components/play/BattleScreen.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx):
  - removed horizontal padding from the arena frame itself
  - kept horizontal padding only on the compact player metadata row and hand-card tray
  - let the scene layer, including cropped base art, run edge-to-edge inside the arena border

### The Reasoning
- The base crop was visually separated from the arena border because the absolute scene was positioned inside the section padding box.
- Moving padding to UI rows preserves readable HUD spacing while allowing background scene props to crop against the actual arena frame.

### The Tech Debt
- Edge-to-edge scene art now depends more on base crop offsets; future character packs with different base silhouettes may need per-character positioning tokens.

## 2026-05-08 - Battle Rival Metadata Mirror Order

### The Change
- Updated [apps/web/src/components/play/BattleScreen.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx):
  - changed the right-aligned rival metadata order from `Rival · Score · Rounds` to `Score · Rounds · Rival`
  - left player metadata order unchanged as `You · Score · Rounds`

### The Reasoning
- The rival block is right-aligned, so placing the name at the outer edge makes the mirrored HUD read more naturally.

### The Tech Debt
- Metadata markup remains duplicated between player and rival rows; if this HUD keeps changing, a small metadata-row helper could reduce drift.

## 2026-05-08 - Battle Question Panel Above Hand

### The Change
- Updated [apps/web/src/components/play/BattleScreen.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx):
  - removed the full-screen active-card question overlay
  - rendered the active question as a compact panel directly above the hand cards in the bottom tray
  - kept the existing active card, countdown, answer lock, and `onAnswer` behavior unchanged
  - preserved the active selected card visual while other hand cards remain disabled during answering

### The Reasoning
- The question belongs to the hand-card interaction and should not block the arena scene.
- Placing it above the cards keeps the player focused on the current choice while preserving visibility of bases, characters, projectiles, and reactions.

### The Tech Debt
- The inline question panel is compact and clamps long question text; if future prompts become much longer, we may need a dedicated expanded/read-more state that still avoids blocking the arena.

## 2026-05-08 - Battle Question Panel Layering

### The Change
- Updated [apps/web/src/components/play/BattleScreen.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx):
  - changed the active question panel from an in-flow hand-tray element to an absolute overlay layer above the cards
  - preserved the same countdown, answer buttons, active-card state, and answer-locking behavior
  - kept a compact hand prompt in the tray so the hand row height stays stable while answering

### The Reasoning
- The previous inline question panel avoided blocking the arena, but it still pushed the arena scene upward because it participated in layout.
- Anchoring the panel above the cards as a layer keeps the top HUD and arena composition stable while preserving proximity to the card interaction.

### The Tech Debt
- The question overlay uses a tuned `bottom: calc(100% + 0.35rem)` anchor; if card tray height changes substantially, this offset may need a small adjustment.

## 2026-05-08 - Battle Question Overlay On Card Layer

### The Change
- Updated [apps/web/src/components/play/BattleScreen.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx):
  - moved the active question panel from above the card tray to the same bottom layer as the cards
  - anchored the panel over the hand row so it covers the cards while answering instead of floating above them
  - preserved the existing question, timer, and answer behavior

### The Reasoning
- The intended interaction is that selecting a card transforms the hand layer into the answer surface, not that the question becomes a separate layer above the hand.
- Keeping the panel on the card layer avoids pushing arena layout and keeps the interaction spatially tied to the chosen card.

### The Tech Debt
- The overlay currently covers the hand row as a single panel; if we want a more literal card-transform animation later, the selected card could expand into this panel using shared layout motion.

## 2026-05-08 - Battle Answer Feedback Persistence

### The Change
- Updated [apps/web/src/components/play/BattleScreen.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx):
  - added selected-answer feedback state for the active question panel
  - kept the question panel visible briefly after play result resolution so it does not disappear before attack/heal feedback finishes
  - colors only the selected option: green when the chosen answer is correct, brown/red when the chosen answer is incorrect
  - preserved non-disclosure behavior by not marking or revealing the correct answer when the selected answer is wrong
  - kept active card/question data in a local snapshot so the panel can persist even if hand state updates during resolution

### The Reasoning
- The result feedback should bridge the UI choice and the resulting combat action; clearing the panel immediately made the interaction feel abrupt.
- Showing feedback only on the selected option confirms the player's choice outcome without exposing the correct answer.

### The Tech Debt
- The feedback duration is a tuned constant (`ANSWER_FEEDBACK_DISPLAY_MS = 1200`); if backend animation timings change, this should be aligned with a more explicit combat-resolution signal.

## 2026-05-08 - Darker Correct Answer Green

### The Change
- Updated [apps/web/src/components/play/BattleScreen.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx):
  - darkened the selected-correct answer highlight to a deeper existing arena green gradient
  - adjusted selected-correct label and text color for contrast on the darker fill
  - left incorrect and neutral answer styling unchanged

### The Reasoning
- The previous correct-answer highlight was too light and felt disconnected from the arena palette.
- A deeper green keeps the success signal clear while matching existing in-game green tones.

### The Tech Debt
- Answer feedback colors are inline in the component; if we continue tuning battle UI states, these should move into shared color tokens.
## 2026-05-08 - BattleScreen Refactor (View Extraction)

### The Change
- Updated [apps/web/src/components/play/BattleScreen.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx):
  - kept socket state/effects/gameplay handlers in this file
  - replaced large inline UI chunks with extracted component usage
  - switched challenge-link derivation from `useMemo` to direct derivation (same behavior, cleaner lint outcome)
- Added [apps/web/src/components/play/BattleScreenGateStates.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreenGateStates.tsx):
  - extracted "Match Context Missing" and "Wallet Required" screens
- Added [apps/web/src/components/play/BattleScreenStatusLayer.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreenStatusLayer.tsx):
  - extracted alert stack and top notice banner
- Added [apps/web/src/components/play/BattleScreenOverlays.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreenOverlays.tsx):
  - extracted room/disconnect/question/surrender/result/share overlays

### The Reasoning
- `BattleScreen.tsx` had become too large to iterate on safely from FE side.
- Separating presentation-heavy sections from gameplay/state logic reduces cognitive load and makes UI-only edits much faster.
- Overlay extraction also makes modal flows easier to test and tweak independently.

### The Tech Debt
- The central battle arena section (header + character stage + card hand) is still large and can be extracted next into focused presentational components.
- A few prop groups passed to overlay/status components are broad; introducing view-model objects by domain (room state, settlement state, share state) would further simplify contracts.

## 2026-05-08 - BattleScreen Overlay Type Fix (challengeLink nullable)

### The Change
- Updated [apps/web/src/components/play/BattleScreenOverlays.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreenOverlays.tsx):
  - changed `challengeLink` prop type from `string` to `string | null` to match `createChallengeLink()` return type and `ChallengeShareCard` contract.

### The Reasoning
- `createChallengeLink` intentionally returns `null` when origin is unavailable.
- Keeping overlay prop strict to `string` caused Next/TS build failure when passing nullable link.
- Nullable typing aligns all layers without changing runtime behavior.

### The Tech Debt
- None introduced. Types are now consistent across link creator, overlay, and share card.

## 2026-05-08 - BattleScreen Refactor Follow-up (Inline Overlay Re-consolidation)

### The Change
- Updated [apps/web/src/components/play/BattleScreen.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx):
  - removed large inline overlay JSX block that had been reintroduced during conflict resolution
  - restored usage of [BattleScreenOverlays.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreenOverlays.tsx) as the single overlay render path
  - removed an unused `playerAddressLabel` derived value

### The Reasoning
- Consolidating overlays back into the extracted component keeps `BattleScreen.tsx` focused on gameplay state/effects and avoids duplicated UI paths.
- It also reduces merge-conflict surface area significantly for future FE iterations.

### The Tech Debt
- The core arena section (header + character stage + hand + inline answer tray) is still the largest remaining block and can be extracted next.

## 2026-05-08 - BattleScreen Question UI De-duplication

### The Change
- Updated [apps/web/src/components/play/BattleScreenOverlays.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreenOverlays.tsx):
  - removed the question modal overlay render path (`activeCard && status === "playing" && !isMatchComplete`)
  - removed now-unused question modal props (`activeCard`, `status`, `displaySecondsLeft`, `answerLocked`, `onAnswer`)
- Updated [apps/web/src/components/play/BattleScreen.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx):
  - removed those question-modal props from `<BattleScreenOverlays />` callsite

### The Reasoning
- The in-arena question panel is already present; the overlay modal created duplicate question UI and degraded UX.
- Keeping only one question surface matches intended play flow and reduces visual noise.

### The Tech Debt
- None added. This removes duplicated rendering paths.

## 2026-05-08 - Battle Notice Reposition + Emphasis Upgrade

### The Change
- Updated [apps/web/src/components/play/BattleScreen.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx):
  - moved transient battle notifications (`gameNotice`) into the main battle arena layout, directly below the top score/VS divider line
  - replaced the previous minimal top overlay look with a stronger in-arena event banner that includes:
    - tone-based label (`Battle Update` for phase events, `Combat Update` for combat events)
    - clearer contrast, border, and shadow treatment per tone
    - preserved enter/exit motion timing and existing notice lifecycle behavior
- Updated [apps/web/src/components/play/BattleScreenStatusLayer.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreenStatusLayer.tsx):
  - removed `gameNotice` rendering from the fixed status layer
  - kept socket/system alert stack behavior unchanged
  - removed no-longer-needed notice prop/types tied to that layer

### The Reasoning
- The user feedback was that notifications felt underwhelming and visually detached by appearing as a fixed line-level banner.
- Placing the notice under the battle header keeps it in the player focus zone and ties feedback to the duel stage.
- Separating concerns (alerts in status layer, battle event notices in arena layout) makes future UI tuning safer and clearer.

### The Tech Debt
- Notice colors and copy labels are still inline in `BattleScreen.tsx`; if notification variants expand, we should extract a small shared token map/helper.
- Timing (`2100ms`) is still a fixed constant and may need harmonization with future combat animation durations.

## 2026-05-09 - Battle Notice Vertical Nudge (Higher, Still Centered)

### The Change
- Updated [apps/web/src/components/play/BattleScreen.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx):
  - moved the in-arena notification banner higher by adjusting its absolute anchor from `top-2` to `top-[-2rem]`
  - kept horizontal centering and existing below-divider placement behavior

### The Reasoning
- The banner looked too low relative to the battle stage; this tweak lifts it closer to the base/combat visual level while preserving the same centered emphasis.

### The Tech Debt
- Vertical placement still depends on tuned offsets combined with scene container padding (`pt-[4.25rem]`); if we continue iterating this area, a dedicated banner anchor container would reduce offset coupling.

## 2026-05-09 - Round Change Winner Notification (Logic-Only)

### The Change
- Updated [apps/web/src/components/play/BattleScreen.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx):
  - added round progression tracking ref (`previousRoundsWonRef`) for player and rival round wins
  - added a new effect that listens to `playerRoundsWon` / `opponentRoundsWon` changes
  - triggers existing battle notice pipeline on round win changes:
    - `Round winner: You`
    - `Round winner: Your rival`
- Kept presentation/layout untouched (no UI structure/style changes).

### The Reasoning
- Round outcomes are already represented by `roundsWon` counters, so this is the safest source-of-truth to detect when a round result is finalized.
- Reusing `showGameNotice` preserves current notification timing/animation behavior with minimal risk.

### The Tech Debt
- If backend later introduces explicit per-round winner events, this derived approach should be switched to event-driven notices to avoid any edge cases around reconnect snapshots.

## 2026-05-09 - Longer Round-Winner Notification Duration

### The Change
- Updated [apps/web/src/components/play/BattleScreen.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx):
  - extended `showGameNotice` to accept optional `durationMs` (default remains `2100ms`)
  - kept all existing callers unchanged by relying on the default duration
  - set round-winner notices to a longer display time:
    - `Round winner: You` -> `3200ms`
    - `Round winner: Your rival` -> `3200ms`

### The Reasoning
- Round-result context is more important than transient hit/heal feedback, so it should remain visible a bit longer for readability.
- Using an optional duration parameter avoids UI changes and preserves current behavior for other notice types.

### The Tech Debt
- Notice durations are still hardcoded at call sites; if we keep tuning cadence, we should centralize durations in named constants.

## 2026-05-09 - Settlement Overlay Winner/Loser Emoji Bubbles

### The Change
- Updated [apps/web/src/components/play/BattleScreen.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx):
  - added `settlementEmojiMood` derivation from existing match outcome states
  - maps winner/loser mood for relevant outcomes:
    - `You Win` / `Opponent Surrendered`: player `confident`, rival `hurt`
    - `You Lose` / `You Surrendered`: player `hurt`, rival `confident`
  - passes `settlementEmojiMood` into the overlays component
- Updated [apps/web/src/components/play/BattleScreenOverlays.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreenOverlays.tsx):
  - added `settlementEmojiMood` prop typing and handling
  - inserted a new row under settlement title/subtitle:
    - `[You bubble emoji] [Your Rival bubble emoji]`
  - used chat-bubble-like cards with small directional tails
  - emoji mapping:
    - confident -> `??`
    - hurt -> `??`

### The Reasoning
- The user wanted clearer emotional feedback tied to result outcomes without restructuring the rest of the settlement panel.
- Deriving mood in `BattleScreen` keeps business/outcome logic centralized and keeps overlays mostly presentational.

### The Tech Debt
- Emoji mapping and bubble styling are currently inline in the overlay component; if more expression variants are added, these should move to a shared presentational helper.

## 2026-05-09 - Settlement Overlay Uses Character Expression Assets (Left/Right Anchored)

### The Change
- Updated [apps/web/src/components/play/BattleScreen.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx):
  - added `settlementExpressionSrc` derived from selected character IDs and winner/loser mood (`confident` / `hurt`)
  - passed `settlementExpressionSrc` into `BattleScreenOverlays`
- Updated [apps/web/src/components/play/BattleScreenOverlays.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreenOverlays.tsx):
  - replaced text emoji output with actual character expression images (`next/image`) inside the existing chat-bubble shapes
  - added per-image fallback handling (`failedExpressionSprites`) if an expression sprite is missing
  - changed result-expression row alignment from centered pair to full-width anchored layout:
    - `You` bubble sticks to left
    - `Your Rival` bubble sticks to right

### The Reasoning
- User requested real expression assets from selected characters rather than generic emoji symbols.
- Keeping mood derivation in `BattleScreen` ensures result logic remains centralized while overlays stay presentational.
- Left/right anchoring preserves side identity and reads closer to battle perspective.

### The Tech Debt
- Expression failure fallback currently shows mood text labels; if any character packs ship incomplete `exp/` sets, we may want dedicated fallback portraits.

## 2026-05-09 - Fix TS Declaration Order for Settlement Expression Sources

### The Change
- Updated [apps/web/src/components/play/BattleScreen.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx):
  - moved `settlementExpressionSrc` derivation to below `playerCharacterId` and `opponentCharacterId` declarations
  - resolved block-scoped variable usage-before-declaration errors for both character IDs

### The Reasoning
- `settlementExpressionSrc` depends on character IDs; deriving it before those constants caused TypeScript compile errors.
- Reordering keeps behavior identical while restoring valid declaration flow.

### The Tech Debt
- None introduced.

## 2026-05-09 - Lobby Restore Fetch Hardening + Unselected Arena Null Image

### The Change
- Updated [apps/web/src/lib/matchmaking/queueMatch.ts](/d:/projects/Cora/apps/web/src/lib/matchmaking/queueMatch.ts):
  - wrapped `getActiveMatchForAddress` fetch in a network-failure guard
  - when fetch fails for non-abort reasons, it now returns `{ inRoom: false }` instead of throwing
- Updated [apps/web/src/components/lobby/LobbySetup.tsx](/d:/projects/Cora/apps/web/src/components/lobby/LobbySetup.tsx):
  - defaulted arena preview background to `/assets/arena/null.png` when no arena is selected
  - always renders the arena image layer so unselected state shows the null image explicitly
- Ran lint verification for edited files:
  - `npm run lint -- src/components/lobby/LobbySetup.tsx src/lib/matchmaking/queueMatch.ts`

### The Reasoning
- Active room restore is best-effort and should not surface noisy fetch exceptions when API is temporarily unreachable.
- Returning `inRoom: false` for network misses preserves flow consistency: no active room means lobby stays in normal setup/select state.
- The UI already contains a null arena asset, so using it as the default unselected background keeps visual state explicit and avoids empty background ambiguity.

### The Tech Debt
- `getActiveMatchForAddress` now treats network errors as "not in room"; if strict connectivity diagnostics are needed later, we should add structured telemetry separate from user-facing flow control.

## 2026-05-09 - Lobby Arena Background Crossfade Stabilization

### The Change
- Updated [apps/web/src/components/lobby/LobbySetup.tsx](/d:/projects/Cora/apps/web/src/components/lobby/LobbySetup.tsx):
  - added deterministic arena-image preloading for `null`, `SOL`, and `BONK` backgrounds
  - replaced direct one-layer background swap behavior with a two-layer crossfade model:
    - base layer uses `displayedArenaImageUrl`
    - incoming layer fades in only after the new image is confirmed loaded/decoded
  - committed next background only after fade duration, reducing visible snap/jank
  - adjusted implementation to satisfy `react-hooks/set-state-in-effect` by deriving incoming URL from render state and only mutating load-state from async image callbacks
- Verified with lint:
  - `npm run lint -- src/components/lobby/LobbySetup.tsx`

### The Reasoning
- Occasional `SOL <-> BONK` rough transitions were caused by late image decode/cache misses while CSS `backgroundImage` URL changed immediately.
- Decoupling "selected image" from "displayed image" lets us wait for the next asset to be ready and then fade it in reliably.
- Keeping updates async-callback driven avoids extra synchronous render loops and aligns with current React lint guidance.

### The Tech Debt
- Crossfade timing is currently hardcoded (`320ms`); if we tune animation cadence globally, this duration should move into shared motion constants.

## 2026-05-09 - Arena Dynamic Subtitle Update

### The Change
- Updated the subtitle text below "Choose Your Arena" in `apps/web/src/components/lobby/LobbySetup.tsx` to dynamically show the selected arena token (e.g. `Selected: SOL Arena`).
- Maintained the instructional fallback text when no arena is selected.

### The Reasoning
- To provide clearer user feedback on which arena is currently selected, in alignment with user requests.
- Kept the change minimal and isolated without altering the broader lobby flow or background behavior.

### The Tech Debt
- None added.

## 2026-05-09 - Align Wallet Connecting UI and Blink Share Button

### The Change
- Grouped the wallet connecting UI and Blink Share button inside a single bottom row flex container using `justify-between` in `apps/web/src/components/lobby/LobbySetup.tsx`.
- Removed their separate margin-top values and added a shared `mt-4` to prevent vertical stacking and vertical scrollbars.

### The Reasoning
- To resolve a layout issue where the wallet UI and Blink Share button were misaligned vertically, causing page overflow and scrolling when the wallet prompt appeared.
- By placing them in a shared flex row, they act as a paired bottom action bar, preserving existing styling while fixing the layout bounds.

### The Tech Debt
- None added.

## 2026-05-09 - Polish Arena Selection Icons

### The Change
- Replaced the hardcoded text-based characters (`\u25ce` and `\u{1F436}`) in the `LobbySetup.tsx` arena card with clean, standard SVG icons using a new internal `ArenaIcon` component.
- The SOL arena now displays a clean geometric Solana logo SVG, and the BONK arena uses a matching styled dog-paw SVG.
- Both icons dynamically map to the appropriate card color states depending on whether they are active or inactive.

### The Reasoning
- Addressed visual inconsistency where SOL was unreadable as a faint text character and BONK appeared as a heavily-styled emoji sticker.
- Ensures both tokens share the same visual language, bounding box, and fill behavior, conforming to the intended premium game UI style.

### The Tech Debt
- The `ArenaIcon` component lives locally in `LobbySetup.tsx`. If these SVGs are needed elsewhere, they should be extracted to a shared icon set within `packages/ui` or `components/ui`.

## 2026-05-09 - Arena Selection Card Color Polish

### The Change
- Updated the active selection state background for the SOL arena card in `LobbySetup.tsx` to use a light green gradient (`linear-gradient(180deg, #eef6ec 0%, #d2e2cd 100%)`).
- Kept the BONK arena card's active background as the warm yellow gradient (`linear-gradient(180deg, #fff1cf 0%, #f8d694 100%)`).

### The Reasoning
- Addressed user feedback requesting a light green fill for the selected SOL button instead of yellow, ensuring better alignment with SOL's designated sage-green color palette (`#9db496`) while preserving BONK's yellow identity.

### The Tech Debt
- The gradients are still defined inline in the `style` prop of the button. Eventually, these specific token-mapped gradients should be added directly to the `ARENAS` data structure in `LobbyScreen.tsx` for cleaner component code.

## 2026-05-09 - Polish Scientist Selection Screen Layout

### The Change
- Added a `showLabels` prop (default `true`) to `apps/web/src/components/character/CharacterSelect.tsx` to allow hiding the "Roster", status line, and "Dev Mode" toggle row.
- Updated `apps/web/src/components/lobby/CharacterSelect.tsx` to pass `showLabels={false}`, removing the redundant UI elements from the lobby phase.
- Removed the Back button from the `preHeadingSlot` of the `RoomPhaseShell`.
- Reintroduced the Back button as a secondary game button (`btn-game-secondary`) positioned right-aligned directly above the character selection grid.

### The Reasoning
- Addressed visual clutter in the lobby by hiding unnecessary character select labels (like dev mode and roster).
- Repositioned the Back button to better match the visual hierarchy of the lobby flow, placing it directly above the action area rather than floating above the main screen header.

### The Tech Debt
- Added an additional prop `showLabels` to the already dense `CharacterSelectProps` in the shared component. As more context-specific visibility toggles are added, it may be worth refactoring this component into a compound component pattern.

## 2026-05-09 - Align Scientist Selection Header with Back Button

### The Change
- Added a `hideTitleBlock` prop to `RoomPhaseShell` and `RoomPhaseHeader` to conditionally hide the left-aligned title block while preserving the status slots.
- Re-implemented the header text (`Setup`, `Choose Your Scientist`, `Choose the mind that will defend your base in the arena.`) manually inside the `CharacterSelect.tsx` screen, placing it in the same flex row as the Back button directly above the scientist cards.

### The Reasoning
- Addressed user feedback stating that the screen header floated too high above the card selection area.
- Grouping the header and the Back button into a single visual band provides better vertical alignment and brings the context closer to the user's focus (the character grid).

### The Tech Debt
- Re-implementing the header block manually bypasses the automatic text handling from `ROOM_PHASE_LABELS`. If this layout pattern becomes standard, `RoomPhaseShell` should be updated to support rendering the header block inline with the children instead of relying on `hideTitleBlock`.

## 2026-05-09 - Rebalance Scientist Selection Header

### The Change
- Removed the `statusSlot` from the `RoomPhaseShell` configuration in `apps/web/src/components/lobby/CharacterSelect.tsx`.
- Moved the status chips (arena label, wager, and wallet address) into the custom header row, rendering them directly above the Back button.

### The Reasoning
- Addressed visual imbalance where the top-right status chips floated too high above the custom header block.
- Moving the status chips into the custom header block ensures the entire top area reads as a single, cohesive band, anchoring the UI directly above the scientist card grid.

### The Tech Debt
- Moving the `statusSlot` contents entirely into the children removes the last piece of content from the `RoomPhaseHeader` for this phase. In the future, this lobby screen may warrant its own bespoke shell layout rather than forcing `RoomPhaseShell` to render completely empty headers.

## 2026-05-09 - Polish Scientist Selection Vertical Spacing

### The Change
- Increased the internal vertical spacing of the header block inside `CharacterSelect.tsx` (e.g. `mt-3`, `leading-relaxed`).
- Increased the gap between the header block and the scientist cards to `mb-8 md:mb-10`.
- Moved the `Enter Queue` button out of the `RoomPhaseShell`'s `footerSlot` and placed it directly after the `CharacterSelectPanel` in the main children area with `mt-6 md:mt-8`.

### The Reasoning
- Addressed visual compression at the top of the screen by providing the header elements more breathing room before the card grid begins.
- Moving the `Enter Queue` button out of `footerSlot` prevents it from being pinned to the absolute bottom of the `100svh` viewport. This anchors the button visually to the card selection section and eliminates the awkward empty gap that was previously separating them.

### The Tech Debt
- None added. The layout relies on flexbox flow as intended, allowing the empty space to collect safely below the content instead of awkwardly separating the UI.

## 2026-05-09 - Restructure Scientist Selection Header Layout

### The Change
- Extracted the status pills (`SOL Arena`, wager, wallet) out of the main header row into their own independent utility row at the very top of `CharacterSelect.tsx`.
- Reconfigured the main header row to contain only the text block on the left and the Back button on the right.
- Changed the vertical alignment of the main header row to `items-center`, anchoring the Back button vertically to the title text rather than allowing it to be pushed downward.

### The Reasoning
- Addressed layout feedback where the Back button was visually misaligned, feeling closer to the scientist cards than to the header itself.
- Separating the purely informational status pills from the navigation/header row establishes a clearer visual hierarchy and prevents awkward flexbox stacking on the right side.

### The Tech Debt
- None. This is a standard structural refinement utilizing existing Tailwind utilities.

## 2026-05-09 - Adjust Scientist Selection Pill Padding

### The Change
- Restored the use of `statusSlot` in `RoomPhaseShell` within `CharacterSelect.tsx` for rendering the arena/wager/wallet pills.
- Removed the inline pill row that was nested directly inside the custom header container (`children`).

### The Reasoning
- Addressed user feedback regarding excessive top padding above the pill row. 
- By moving the pills back into `statusSlot`, they are rendered inside `RoomPhaseHeader`, perfectly matching the CSS container spacing (`pt-5 md:pt-6`) of the prior `LobbySetup` screen. This ensures a 1:1 visual continuity for the top-right utility elements across both phases.

### The Tech Debt
- None. This reverts a previous structural hack and utilizes the native shell slots properly.

## 2026-05-09 - Remove Fake Stats from Character Cards

### The Change
- Completely removed the mock `stats` arrays (e.g., `Logic 92`, `Computation 88`) from `LobbyScreen.tsx` and `app/dev/room-states/page.tsx` character data.
- Removed the `CharacterStat` type and the `stats` field from the `CharacterOption` interface in `characterTypes.ts`.
- Removed the rendering block in `CharacterCard.tsx` that mapped over and displayed the fake numeric stat chips.
- Renamed Albert Einstein's base to `The Relativity Room` and Marie Curie's base to `The Radium Reactor` to align better with their actual gameplay specialties (`math` and `logical`, respectively) and avoid misleading players with physics/chemistry imagery.

### The Reasoning
- Addressed a misleading discrepancy where the display-facing flavor stats on the character cards did not align with the actual gameplay specialty categories (`sequence`, `logical`, `math`) defined in `packages/shared-types/src/characterStats.ts`.
- Instead of inventing new fake numbers for the real categories, the fake numeric chips were removed entirely to keep the UI clean and strictly aligned with the single source of truth. The real specialty and multiplier (e.g., `Logical Specialist`, `x1.5`) are still displayed dynamically by `CharacterCard.tsx`.

### The Tech Debt
- Removed technical debt by eliminating the need to maintain mock `stats` arrays. The character cards now rely purely on the actual backend `CHARACTER_DEFS` mapping to display specialty and multiplier info.

## 2026-05-09 - Matchmaking Expression Imagery & Bug Fix

### The Change
- Fixed an iterable crash in `LobbyScreen.tsx` where `.stats` was still being destructured from the `characterOptions` memo, even though the field was removed.
- Added the selected character's `idle.png` expression image to the "You" and "Opponent" portrait slots in `MatchmakingWaiting.tsx`.
- Included an image loading fallback mechanism in `MatchmakingWaiting.tsx` that reverts to the character's initial if the expression image fails to load.

### The Reasoning
- Addressed an oversight from the fake stats removal where a spread operation on the undefined `stats` array caused a client-side crash.
- Replaced the text-based initials in the matchmaking waiting screen with the character's full 2D idle expressions, matching the aesthetic fidelity established in the character selection cards.

### The Tech Debt
- None. This aligns the matchmaking waiting UI with the asset loading patterns used elsewhere in the application.

## 2026-05-09 - Arena Background in BattleScreen

### The Change
- Added dynamic arena background rendering to `BattleScreen.tsx`.
- Mapped `arenaId` param to specific image assets (SOL or BONK).
- Included fallback behavior for missing or failed images using the existing green/radial background.
- Layered dark overlays for UI readability.

### The Reasoning
- Extends the lobby arena choice visually into the battle phase while keeping gameplay UI legible and undisturbed.

### The Tech Debt
- The arena images are loaded synchronously during render and fade in natively. If more arenas are added, dynamic preload strategies might be necessary.

## 2026-05-09 - Settlement Overlay Polish (Compact Stats, Emote Focus, Payout Copy)

### The Change
- Updated [`apps/web/src/components/play/BattleScreenOverlays.tsx`](d:/projects/Cora/apps/web/src/components/play/BattleScreenOverlays.tsx) to rebalance the finished/settlement modal layout:
- Replaced large stat boxes with a compact chip-based summary row (`Rounds`, `Correct`, `Timeout`, `Wrong`) to reduce vertical footprint.
- Enlarged the settlement emote portraits substantially and centered them as the visual focal point while keeping `YOU` and `YOUR RIVAL` labels.
- Added outcome-aware payout/result copy block near the title, with stronger highlight styling for winning outcomes.
- Made title/subtitle spacing resilient for short and long settlement titles using clamped title sizing, max-width constraints, and balanced wrapping.
- Added a new derived display prop in [`apps/web/src/components/play/BattleScreen.tsx`](d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx): `settlementOutcomeKind`, then passed it into `BattleScreenOverlays`.

### The Reasoning
- The previous grid-based stat cards dominated the modal height and competed with the emotional result moment; compact chips keep the data visible but secondary.
- Emote expressions are the strongest emotional signal at battle end, so increasing their size and visual weight improves clarity and delight.
- Payout relevance is highest on wins/surrenders; adding explicit, state-aware copy improves comprehension without touching settlement logic.
- Using an explicit derived outcome prop avoids brittle string parsing on `settlementText`, so variant titles (including long cancellation/invalidated states) can change safely.
- Payout text is deliberately conservative: it references available token/wager context and avoids inventing an exact payout amount.

### The Tech Debt
- `settlementOutcomeKind` currently lives as a local derived string in `BattleScreen.tsx`. If other screens need the same semantics, consider introducing a shared `deriveSettlementOutcomeKind(...)` helper to prevent drift.
- `wagerUsd` parsing assumes a numeric-like string (as currently supplied). If upstream formatting changes, a dedicated formatter utility would make this safer and reusable.

## 2026-05-09 - End-Game Defeated Base Transition Before Settlement Overlay

### The Change
- Updated [`apps/web/src/components/play/BattleScreen.tsx`](d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx) to add a local visual-only end-game transition phase before the settlement modal appears.
- Introduced short transition states:
- `showSettlementOverlay` to gate settlement popup visibility without changing real match completion logic.
- `endgameDefeatedSide` (`player` | `opponent` | `null`) to target only the losing/surrendering side.
- `endgameBaseFadeActive` to trigger quick loser-base fade/dissolve timing.
- Added a keyed end-game sequence (with timer cleanup) that:
- identifies defeated side from `settlementOutcomeKind`,
- triggers hit/hurt beat,
- starts base fade on that side only,
- then reveals settlement overlay after ~1080ms.
- Draw/cancelled/invalidated/pending paths skip base fade and use a short neutral delay.
- Forced defeated-side `hurt` reaction display while transition runs so it remains visible until the popup appears.
- Updated base rendering to fade/sink only the defeated base (no full-screen fade, no winner base fade).
- Updated [`apps/web/src/components/play/BattleScreenOverlays.tsx`](d:/projects/Cora/apps/web/src/components/play/BattleScreenOverlays.tsx) to accept `showSettlementOverlay` and render the settlement popup/share modal only when the transition gate opens.

### The Reasoning
- The match-complete state should stay truthful immediately for gameplay/network logic, while the visual transition should be presentation-only.
- Isolating the defeated-side animation avoids unintended global fade behavior and preserves battle readability.
- A short, punchy timing window (~1.08s) delivers impact without making result flow feel sluggish.
- Explicit timer cleanup prevents stale animation state when remounting/resetting or when rapid state changes occur.

### The Tech Debt
- End-game timing constants are local in `BattleScreen.tsx`; if additional cinematic beats are added later, this should move into a dedicated transition config/helper for consistency.
- The defeated-base dissolve uses lightweight opacity/transform transitions; if art-direction asks for richer FX, consider a reusable shader/particle layer component.

## 2026-05-09 - Settlement Overlay Follow-up Polish (Consolidated)

### The Change
- Consolidated several small follow-up tweaks in [`apps/web/src/components/play/BattleScreenOverlays.tsx`](d:/projects/Cora/apps/web/src/components/play/BattleScreenOverlays.tsx):
- Moved `Show Settlement Details` below `Blink Share` and `Back To Lobby`, centered.
- Kept details panel behavior but relocated it under the new toggle position.
- Removed subtitle rendering (including `Victory secured.` style line).
- Removed the white framed stats wrapper while keeping compact stat chips.
- Updated win payout copy to use net formula `wagerUsd * 2 * 0.975`.
- Finalized direct payout copy format: `You win the $X wager in SOL/BONK.`
- Switched settlement CTAs to shared button system (`btn-game` variants).
- Reduced CTA width/footprint and changed layout to centered compact row.
- Applied green visual treatment to `Back To Lobby`.

### The Reasoning
- These were iterative UI micro-adjustments to improve hierarchy, reduce modal clutter, and align settlement CTAs/copy with the rest of the app.
- Consolidating the notes keeps the devlog readable while preserving intent and final-state decisions.

### The Tech Debt
- `settlementSubtitle` remains in the prop contract but is no longer rendered.
- Win payout formula and green `Back To Lobby` styling are currently UI-local. If reused, extract shared helper/class.

## 2026-05-09 - FE-Only Destroyed Base End-Game Effect

### The Change
- Enhanced end-of-match visual sequencing in [`apps/web/src/components/play/BattleScreen.tsx`](d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx) with a frontend-only destroyed-base beat before settlement popup reveal.
- Added short phased end-game visual states and timings for:
- impact flash,
- crack reveal,
- smoke/debris particle reveal,
- loser-base fade/sink progression,
- popup reveal gating via existing `showSettlementOverlay`.
- Reused existing base shake pathway (`playerBaseFx` / `opponentBaseFx` with `hit`) for the punchy shake stage.
- Added defeated-base-only overlays (no new image assets):
- red radial impact flash,
- crack/damage line overlays,
- animated smoke/debris particle puffs,
- ground dust haze,
- stronger or softer fade/sink based on standard defeat vs surrender outcome.
- Kept forced `hurt` expression behavior until settlement popup appears.
- Preserved neutral behavior for draw/cancelled/invalidated (no destroyed-base effect, short neutral delay only).

### The Reasoning
- This gives a clear final impact moment for the losing side while keeping all authoritative match/settlement logic unchanged.
- Effects are scoped to the defeated base container only, ensuring the winning base and full-screen scene remain stable.
- Soft-mode handling for surrender outcomes keeps visual tone appropriate while still signaling defeat.

### The Tech Debt
- Destroyed overlays (crack line geometry and particle tuning) are handcrafted inline in `BattleScreen.tsx`; if reused later, they should be extracted into a dedicated reusable effect component.
- End-game visual timing constants are currently local and manually coordinated; if more cinematic variants are added, centralizing timing profiles would reduce drift.

## 2026-05-09 - Longer Destroyed-Base Beat + Winner Confident End Emote

### The Change
- Updated end-game timing in [`apps/web/src/components/play/BattleScreen.tsx`](d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx) to make the destroyed-base sequence feel more rewarding before settlement popup appears.
- Increased total end-game transition duration from `1080ms` to `1320ms`.
- Delayed fade and smoke beat slightly to better pace impact -> crack -> debris -> sink.
- Added forced winner `confident` end-state reaction during the same pre-popup window, mirroring the forced loser `hurt` behavior.
- Winner/loser forced reactions now both hold until settlement popup is shown for clear-loser outcomes.

### The Reasoning
- The previous timing felt too quick for the visual achievement moment after a win.
- Showing both emotional states (`confident` winner and `hurt` loser) creates clearer end-match readability and stronger payoff.

### The Tech Debt
- End-game timing remains hardcoded constants in `BattleScreen.tsx`; if more variants are requested, timing profiles should be centralized.

## 2026-05-09 - Extend Destroyed-Base End Sequence to 2.5s (Active FX)

### The Change
- Updated end-match timing in [`apps/web/src/components/play/BattleScreen.tsx`](d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx) to a `2500ms` total transition.
- Retimed effect phases so added duration is filled by active visuals:
- impact/crack/smoke reveal delays pushed later,
- loser-base fade/sink transition extended,
- smoke/debris particle motion curves significantly extended with multi-stage opacity/position keyframes.

### The Reasoning
- Matches request for a longer accomplishment beat without dead air, by extending visual activity rather than just delaying popup timing.

### The Tech Debt
- End-game phase timing is still tuned by local constants and inline keyframes; a dedicated transition profile object would simplify future balancing.

## 2026-05-09 — OpponentFound: Cancel Match & Retry Connection Fixes

**Branch:** `fe/fix/opponentfound-bug`

### The Change
- **`apps/web/src/components/lobby/OpponentFound.tsx`** — two targeted patches:
  1. **Cancel Match button**: removed the `cancelMatch` WebSocket send + async "Cancelling..." wait. The button now calls `onTimeout()` directly, immediately routing the user back to character select. `cancelMatch` was removed from the `useMatchSocket` destructure (dead code cleanup).
  2. **Retry Connection button**: replaced the bare `reconnect()` call with a full `onRetryConnection()` handler that sets `isRetryingConnection` state. While the socket is reconnecting, the button shows "Retrying..." and is disabled. A new `useEffect` detects when `connectionState` settles out of `reconnecting`; if it lands on `error`/`disconnected`, `retryConnectionFailed` is set. The `extraSlot` connection banner then turns red with a "Couldn't connect" heading and an explicit message to cancel back to lobby, persisting until the next retry or cancel.

### The Reasoning
- The old cancel flow was broken: `cancelMatch` is sent over the socket, but if the socket was in an error/disconnected state (the exact scenario where you'd want to cancel), the send was a no-op and the button locked on "Cancelling..." forever.
- Re-queueing the innocent player was deliberately removed to avoid ghost players. The room deposit timeout is the correct authoritative cancel mechanism on the backend.
- The retry button previously gave zero feedback on outcome — a silent failure if reconnect didn't work. The new state machine makes the failure explicit and keeps the "cancel to lobby" escape hatch visible.

### Tech Debt
- `cancelMatch` message handler on the backend (`RoomManager.handleMessage`) is now dead from the frontend side. It's safe to leave it for now but can be cleaned up if confirmed no other path sends it.
- If a "polite cancel" that immediately notifies the opponent is needed later, it should go through a dedicated HTTP endpoint (not the deposit socket) with proper room lifecycle handling.

## 2026-05-09 — OpponentFound: UX Refinements for Connection Drops and Cancel Guard

**Branch:** `fe/fix/opponentfound-bug`

### The Change
- **Cancel Button Guard**: Added `cancelFiredRef` to prevent multiple rapid clicks on the "Cancel Match" button from firing `onTimeout()` multiple times before the React component unmounts. The button now immediately changes its label to "Leaving..." and visually disables upon first click.
- **Connection Issue Toast**: Replaced the inline `extraSlot` connection failure panel with a fixed, top-center toast banner (`connectionIssueBannerVisible`) that auto-dismisses after 6 seconds. The toast explicitly displays the WebSocket close code (e.g., `1006`) and reason if available.
- **Context-Aware Hints**: Updated `getDepositHint()` and `getPrimaryButtonLabel()` to reflect socket disconnection states when waiting for the opponent to deposit. Instead of a generic "Waiting for Player A...", the UI now explicitly indicates "Connection issue while waiting" or "Disconnected...".

### The Reasoning
- **Cancel Guard**: React state updates are asynchronous, meaning rapid clicks on "Cancel Match" could bypass the previous `isCancellingMatch` guard before the UI had a chance to lock out further interactions. A synchronous `useRef` provides an immediate lock.
- **Connection Issue Toast**: The top-center toast banner pattern matches the other critical alerts (e.g., Phantom taking too long, opponent failed to deposit) and provides a more consistent visual hierarchy than an inline panel.
- **Context-Aware Hints**: The user shouldn't be left wondering why the opponent is taking so long to deposit if the underlying issue is actually a dropped socket connection. Surfacing this state directly in the primary action button and hint text improves clarity.

### Tech Debt
- The `alertDrain` animation duration for the new toast banner is hardcoded to 6000ms in the inline style, matching the `setTimeout` duration. This could be centralized into a shared constant if more timed toasts are introduced.

## 2026-05-09 — OpponentFound: Removed Room Status Pill

**Branch:** `fe/fix/opponentfound-bug`

### The Change
- **Removed Room Status UI**: Completely removed the "Show Room Status" button and its expandable `RoomStatusRail` from `OpponentFound.tsx`. 
- **Code Cleanup**: Removed the local `showRoomStatus` state, `getPlayerBadges()`, and `getOpponentBadges()` helper functions. Dropped the now-unused `RoomStatusRail` and `RoomStatusBadge` imports.
- **Layout Adjustment**: Centered the remaining `playabilityLabel` pill (e.g., "Devnet · SOL Arena") to balance the layout after removing the trailing button.

### The Reasoning
- **Streamlined UX**: The Room Status Rail exposed low-level connection states ("matched", "deposited", "ready") that were redundant and overly technical for this phase. The new connection error toasts and primary button hints (added in the previous pass) provide all the necessary contextual feedback in a much more direct and user-friendly way.

### Tech Debt
- None introduced by this removal. The underlying `RoomStatusRail` component remains available in the codebase if needed elsewhere in the future.

## 2026-05-09 — OpponentFound: Removed Playability Pill

**Branch:** `fe/fix/opponentfound-bug`

### The Change
- **Removed Playability Pill**: Completely removed the `playabilityLabel` pill and its wrapping container from `OpponentFound.tsx`.
- **Logic Cleanup**: Removed the `useWalletArenaPlayability` hook call and its import.
- **Top Alignment**: The arena information (`{arena.label} · ${wagerUsd} {arena.token}`) is now the very top element on the page.

### The Reasoning
- **UI Simplification**: The playability pill was redundant in the Rival Locked screen as the user had already verified their eligibility during the lobby/queue phase. Removing it makes the arena and wagering details the focal point at the top of the hierarchy.

### Tech Debt
- None.

## 2026-05-09 - OpponentFound Deposit UI Stability and Banner Guard

### The Change
- Updated [OpponentFound.tsx](/d:/projects/Cora/apps/web/src/components/lobby/OpponentFound.tsx) to lock the screen to `h-[100svh] overflow-hidden`, suppress the connection issue banner on cold mount until the socket has connected at least once, hide retry while the socket is actively reconnecting, and hide cancel while signing is in progress or waiting on confirmation.
- Updated [DepositStatusCard.tsx](/d:/projects/Cora/apps/web/src/components/deposit/DepositStatusCard.tsx) to reserve a fixed `min-h-[140px]` content area beneath the helper/timer so signature, wallet, and action rows appear inside pre-allocated space instead of growing the card and pushing the page.
- Verified [DepositPanel.tsx](/d:/projects/Cora/apps/web/src/components/deposit/DepositPanel.tsx) did not need structural changes once the reserved-space behavior was localized to the status card.

### The Reasoning
- The opponent-found screen now behaves like a locked viewport rather than a document that grows as late UI elements appear, which prevents scrollbars and layout jumps during signing-state transitions.
- The initial socket state begins as `disconnected`, so the banner needed a "has connected once" guard to distinguish a real drop from the first handshake.
- Retry and cancel visibility now follow the actionable states more closely: reconnecting is already communicated by the primary CTA, and cancel should not compete with active signing or waiting states.

### The Tech Debt
- The reserved `140px` card content height is tuned for the current signature/wallet/action stack. If those rows gain more vertical content later, the reserved height should be revisited instead of letting the card grow again.

## 2026-05-09 - Deposit UI Layout Regression Follow-up

### The Change
- Updated [DepositStatusCard.tsx](/d:/projects/Cora/apps/web/src/components/deposit/DepositStatusCard.tsx) to remove the inner reserved slot stack (`min-h` plus `justify-end`) and instead give the card shell a fixed `h-[220px]` footprint with `overflow-hidden`.
- Updated [OpponentFound.tsx](/d:/projects/Cora/apps/web/src/components/lobby/OpponentFound.tsx) to replace the hard-clipped `h-[100svh] overflow-hidden` wrapper with `min-h-[100svh] overflow-y-auto` so the primary CTA is never cut off on shorter screens.

### The Reasoning
- Reserving space inside the slot stack prevented layout growth, but it also created an obvious dead zone between the countdown and the revealed controls. Moving the fixed footprint to the card wrapper keeps the card stable without pushing the dynamic rows away from the timer.
- The screen should prefer a locked-feeling layout, but clipping the bottom action button is worse than allowing limited vertical scroll on small viewports. `overflow-y-auto` keeps the default experience intact while preserving access to all controls.

### The Tech Debt
- The fixed card height is still a tuned visual constant. If helper copy or action density increases later, we should revisit the shell height rather than reintroducing inner spacer blocks.

## 2026-05-09 - OpponentFound Flex Column Layout Correction

### The Change
- Updated [DepositStatusCard.tsx](/d:/projects/Cora/apps/web/src/components/deposit/DepositStatusCard.tsx) to remove the fixed `h-[220px]` shell height and return the card to natural height.
- Updated [DepositPanel.tsx](/d:/projects/Cora/apps/web/src/components/deposit/DepositPanel.tsx) to replace the root `mt-8` spacing with `pt-3`, allowing the parent layout to control the vertical rhythm.
- Updated [OpponentFound.tsx](/d:/projects/Cora/apps/web/src/components/lobby/OpponentFound.tsx) to use a true `h-[100svh]` flex-column shell with non-shrinking header and VS sections, plus a bottom-aligned `flex-1` deposit region that owns the remaining space and becomes scrollable only when needed.

### The Reasoning
- The bottom gap in the Player B waiting state came from the fixed deposit card height, not from the slot content itself, so the correct fix was to remove that shell constraint entirely.
- The page-level persistent scroll came from treating the whole screen like a document flow. Moving to a fixed-height flex column lets the title and matchup cards keep their natural space while the deposit section absorbs whatever space remains.
- Removing the panel-level top margin prevents nested spacing from pushing the primary action button below the fold on shorter viewports.

### The Tech Debt
- The opponent-found layout now depends on the deposit region being the only flexible vertical section. If more large blocks are added above it later, we should preserve that contract instead of reintroducing global page scrolling.

## 2026-05-09 - OpponentFound Cancel Match Room Exit Signal

### The Change
- Updated [OpponentFound.tsx](/d:/projects/Cora/apps/web/src/components/lobby/OpponentFound.tsx) to call `cancelMatch()` from `useMatchSocket` inside `onCancelMatch()` before the immediate `onTimeout()` handoff.
- Increased the deposit section spacing in [OpponentFound.tsx](/d:/projects/Cora/apps/web/src/components/lobby/OpponentFound.tsx) from `mt-8` to `mt-12` to restore separation between the VS cards and the deposit panel.

### The Reasoning
- The UI was leaving the opponent-found screen immediately, but the room itself was not being told to close, so Player B could appear to hang in a "Leaving..." state until the backend timeout path eventually cancelled the room. Emitting `cancelMatch()` keeps the instant UI transition while still notifying the server right away.
- The spacing change is intentionally local to the deposit wrapper so the current flex-column layout keeps its behavior without reintroducing extra panel-level offsets.

### The Tech Debt
- `OpponentFound.tsx` now depends on the socket hook exposing a cancellation action. If room-leave semantics ever get renamed or split between soft leave and hard cancel flows, this screen should consume a more explicitly named API to avoid ambiguity.

## 2026-05-09 - BattleScreen Disconnected Overlay Recovery UX

### The Change
- Updated [BattleScreen.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx) to preserve `canSurrenderByState` across transient disconnect renders by tracking the last committed match phase and resetting that latch once the match completes.
- Added `isDeviceOffline` derivation in [BattleScreen.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx) and passed it into [BattleScreenOverlays.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreenOverlays.tsx).
- Updated the disconnected overlay in [BattleScreenOverlays.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreenOverlays.tsx) so offline users no longer fire `onReconnect`; they now see a `No Internet Connection` CTA, mobile devices can jump to `app-settings:`, desktop users get a reconnect hint, and all users get a subtle `Abandon match and return to lobby` escape hatch.
- Verified the two touched files with `npx eslint src/components/play/BattleScreen.tsx src/components/play/BattleScreenOverlays.tsx`.

### The Reasoning
- Disconnecting was temporarily nulling `gameState`, which made the UI think the match had fallen back to `waiting` and incorrectly hid surrender even when the room had already been committed.
- Distinguishing true device-offline state from a recoverable socket disconnect avoids presenting a `Rejoin Room` action that is guaranteed to fail silently.
- The disconnected overlay stays on `/play` because the live match still belongs there; the missing piece was a safe exit path, not a route change.

### The Tech Debt
- The committed-state latch intentionally uses a narrowly scoped lint exception because the requested ref-backed persistence pattern conflicts with the local React refs rule; if this pattern spreads, we should extract a shared render-safe helper or revisit the lint policy.
- `app-settings:` is a best-effort mobile shortcut and may vary by platform/browser shell, so broader native deep-link handling may be needed later if mobile reconnection support expands.

## 2026-05-09 - MLBB-Style Active Match Banner Flow for Disconnections

### The Change
- Updated [BattleScreen.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx) to add an `isRejoining` UI state, wrap reconnect attempts with a loading state, and persist a live-match snapshot to `localStorage` when the disconnected overlay's `Return to Lobby` link is used.
- Updated [BattleScreenOverlays.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreenOverlays.tsx) so the disconnected overlay now:
- shows `Rejoining Room...` while reconnect is in flight,
- disables the reconnect button during that state,
- replaces the old offline-disconnected surrender action with a non-interactive `Connect to Surrender` button,
- routes the muted `Return to Lobby` link through the active-room preservation handler,
- keeps settlement and room-gate lobby exits on the normal clear-state path.
- Updated [LobbyScreen.tsx](/d:/projects/Cora/apps/web/src/components/lobby/LobbyScreen.tsx) to normalize active-room snapshots, surface a top-of-lobby active-match banner for live `playing` rooms, and add an in-lobby surrender flow:
- `Rejoin Match` pushes back to `/play` with the stored room/arena/token/wager info and clears the key,
- `Surrender Match` opens a confirmation modal, mounts a one-shot socket bridge, waits up to 10 seconds for connection, then sends `surrender()` without routing to `/play`,
- success/failure toasts are shown and the stored live-room key is cleared at the end of that flow.
- Verified the three touched UI files with `npx eslint src/components/play/BattleScreen.tsx src/components/play/BattleScreenOverlays.tsx src/components/lobby/LobbyScreen.tsx`.

### The Reasoning
- The disconnected overlay should no longer pretend it can finish surrender locally while offline; the MLBB/PUBG pattern is to let the lobby own "you still have a live match" recovery.
- Persisting the active room on manual lobby exit gives the user a real escape hatch from `/play` while still preserving a clear way back into the match.
- The lobby now distinguishes between pre-battle room recovery (`depositing` / found-room flows) and true live-match recovery (`playing`), so we keep existing deposit recovery behavior while giving active matches a dedicated banner treatment.
- The one-shot surrender bridge reuses the existing socket hook contract instead of inventing a second low-level WebSocket path, which keeps the change UI-scoped and avoids touching hook internals.

### The Tech Debt
- The active-match banner currently lives inside `LobbyScreen.tsx`; if this pattern expands to other routes, it should move into a shared recovery/banner component.
- Lobby-side surrender submission still has no explicit server acknowledgement event to wait on, so `Surrender submitted` currently means "socket connected and surrender message sent" rather than confirmed backend acceptance.
- The persisted snapshot schema now carries compatibility fields (`walletAddress` plus `address`, `token` plus `arenaToken`) to bridge older lobby recovery paths and the new battle-return path. If the format settles, we should consolidate it into one shared typed helper/module.

## 2026-05-09 - Lobby Coming-Soon Arena Slot for MEW

### The Change
- Updated [LobbySetup.tsx](/d:/projects/Cora/apps/web/src/components/lobby/LobbySetup.tsx) to add a visible disabled `MEW` arena card below BONK plus a second disabled `and more to come` card using the same muted styling language.
- Wired in the existing `/assets/arena/mew.png` path so the setup screen can support a MEW-specific arena image if a coming-soon selection state is ever passed down.
- Updated the main lobby CTA in [LobbySetup.tsx](/d:/projects/Cora/apps/web/src/components/lobby/LobbySetup.tsx) to switch to a disabled gray `Coming Soon` label for a `mew` coming-soon state while leaving normal SOL and BONK play flow intact.

### The Reasoning
- Keeping MEW outside the playable `arenas` prop preserves the current matchmaking and selection flow for SOL and BONK while still making the roadmap visible in the arena picker.
- The CTA guard is defensive: today the MEW card itself does not select anything, but if upstream state ever points at `mew`, the primary action still refuses progression and presents the correct coming-soon message.
- Reusing the same disabled visual language for `MEW` and `and more to come` makes it obvious these are future arenas rather than broken interactions.

### The Tech Debt
- `LobbySetup.tsx` now knows about a hard-coded coming-soon arena id (`mew`). If more teaser arenas are added, we should likely move arena rendering to a single typed config that can represent both playable and disabled entries.

## 2026-05-09 - Lobby MEW Selection and BONK CTA Lock

### The Change
- Updated [LobbySetup.tsx](/d:/projects/Cora/apps/web/src/components/lobby/LobbySetup.tsx) so the `MEW` card is now clickable/selectable, shows selected-state styling, and swaps the right-side panel into a `MEW Arena` display using `/assets/arena/mew.png`.
- Locked the main `Pick Scientist` CTA for both `BONK` and `MEW`, changing the button label to `Coming Soon` and preventing `onPlay` from firing for either arena.
- Removed the `Coming Soon` copy from the `MEW` card itself while keeping the separate disabled `and more to come` card underneath it.

### The Reasoning
- This keeps the arena picker exploratory and interactive while making the gating happen where it matters most: the progression CTA.
- Treating `BONK` and `MEW` as coming-soon arenas at the CTA layer preserves the existing upstream arena list contract and avoids forcing lobby/matchmaking changes for non-playable tokens.
- Adding a local display model for `MEW` lets the setup panel show coherent selected-state copy and imagery even though `MEW` is not yet part of the playable `ARENAS` array in the parent screen.

### The Tech Debt
- `LobbySetup.tsx` now has mixed knowledge of playable arenas from props and teaser arenas declared locally. If more non-playable arenas are added, we should centralize this into one shared arena config with an explicit availability flag.

## 2026-05-09 - MEW Arena Visual Pass

### The Change
- Updated [LobbySetup.tsx](/d:/projects/Cora/apps/web/src/components/lobby/LobbySetup.tsx) so the `MEW` arena icon now renders as a cat instead of reusing the generic token glyph.
- Restyled the `MEW` card so its unselected state uses the same warm card treatment as the other arena options, while the icon medallion uses the requested blue tone `#85A1A5`.
- Added the requested selected-state palette for `MEW`: blue background `#85A1A5`, blue outline `#3C5C5F`, and matching blue-toned highlight/shadow treatment.

### The Reasoning
- The earlier muted-gray treatment made `MEW` read as disabled at the card level, which conflicted with the newer requirement that it should still be clickable/selectable.
- Giving `MEW` its own cat silhouette helps the card read as a distinct token/arena instead of a temporary placeholder.
- Keeping the unselected card warm while only shifting the selected state to blue preserves consistency with the rest of the lobby list and makes the active choice stand out more clearly.

### The Tech Debt
- The `MEW` card styling is still bespoke inside `LobbySetup.tsx`; if more arena-specific themes arrive, we should move these visual tokens into shared config rather than branching inline.

## 2026-05-09 - MEW Selected-State Gradient Tuning

### The Change
- Updated the selected `MEW` card in [LobbySetup.tsx](/d:/projects/Cora/apps/web/src/components/lobby/LobbySetup.tsx) so its outline now uses `#85A1A5` to match the requested selected-state color.
- Reworked the selected `MEW` background from a flatter blue fill to a more dimensional blue gradient while keeping the same overall tone family.

### The Reasoning
- Matching the outline to the primary selected color makes the card feel cleaner and less split between two different blue accents.
- Using a gradient instead of a flatter fill keeps the `MEW` selected state visually consistent with the other arena cards, which already use layered, beveled-looking surfaces.

### The Tech Debt
- The `MEW` visual tuning remains hand-authored inline in `LobbySetup.tsx`; if we keep iterating on per-arena themes, a shared tokenized styling layer would be easier to maintain.

## 2026-05-09: MEW Arena UI Polish
- **The Change**: Polished the MEW arena selection UI in `LobbySetup.tsx`. Simplified the MEW SVG icon to a silhouette and updated the selection button's background circle. Also fixed a TypeScript error by adding the missing `frame` property to the `mewArena` object.
- **The Reasoning**: Improved icon abstraction and UI consistency. The `frame` property fix was required due to a recent update in the `Arena` type definition.
- **The Tech Debt**: None.

## 2026-05-09 - Lobby ER Recovery Guardrails

### The Change
- Updated [LobbyScreen.tsx](/d:/projects/Cora/apps/web/src/components/lobby/LobbyScreen.tsx) to defer stale `depositing` room recovery behind a new `pendingErRecovery` state instead of immediately reopening the found-room flow from `cora:active-room`.
- Added a full-screen "Confirming your match..." recovery screen that polls ER state every 2 seconds, auto-redirects to `/play` once the match becomes `playing`, and falls back to lobby setup with a toast after the room disappears, finishes, or fails confirmation repeatedly.
- Added `erSettling` polling for the existing missing-context fallback card so its reset buttons stay disabled with an animated settling indicator while ER still reports the room as `depositing`.

### The Reasoning
- The broken loop came from trusting stale local storage before fresh ER state was available, so the safest fix was to gate that recovery path until the backend confirms whether the room is still live.
- Keeping the user on an intermediate confirmation screen avoids bouncing them into `phase="found"` with incomplete hydrated context, which is what produced the "Match room context missing" dead end.
- Locking the fallback-card buttons during active settlement preserves an escape hatch once ER resolves, without letting the user trigger state resets that would immediately be overwritten by the same stale snapshot.

### The Tech Debt
- The lobby now has two ER-related polling paths: one for recovery interception and one for the missing-context fallback lock. If this flow expands further, we should consider centralizing ER recovery/status polling into a dedicated hook to reduce duplication and edge-case drift.

## 2026-05-10 - Match Session Folder Naming

### The Change
- Moved the match-session helper into [matchSession.ts](/d:/projects/Cora/apps/web/src/lib/session/matchSession.ts) under a lowercase `session` lib folder, matching the surrounding folder-plus-descriptive-file convention.

### The Reasoning
- Keeping the helper in a one-word lowercase folder avoids a special-case `matchSession` directory while preserving a clear helper filename.

### The Tech Debt
- None for this move; backend wallet-authenticated websocket joins and on-chain deposit verification remain the real security work after this FE guardrail.

## 2026-05-10 - Play Route Match Session Guard

### The Change
- Added [matchSession.ts](/d:/projects/Cora/apps/web/src/lib/session/matchSession.ts) to centralize lobby draft state, active match session state, and tab-scoped deposit intent signatures.
- Updated [LobbyScreen.tsx](/d:/projects/Cora/apps/web/src/components/lobby/LobbyScreen.tsx) and [OpponentFound.tsx](/d:/projects/Cora/apps/web/src/components/lobby/OpponentFound.tsx) to write active match sessions before entering `/play`, keep rejoin sessions intact, and stop putting token, wager, address, or deposit signatures into play URLs.
- Updated [BattleScreen.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx) so `/play` only opens the match socket when the stored active match session matches the URL `roomId` and the connected wallet, and so deposit confirmation is read from tab session storage instead of query params.

### The Reasoning
- This is frontend hardening only: URL params are now treated as routing/display hints, while room identity, wallet address, wager display, token display, and deposit signature source come from the local session created by the real lobby/deposit flow.
- Blocking socket connection until the local session and wallet match reduces casual spoofing through copied or edited `/play` links without changing the existing backend protocol.

### The Tech Debt
- This does not replace backend security. The API still needs wallet-authenticated websocket joins and on-chain verification of `confirmDeposit` signatures before the match can be considered production-safe against custom clients.

## 2026-05-09 - Lobby Deposit Flow Regression Guard

### The Change
- Tightened the `pendingErRecovery` trigger in [LobbyScreen.tsx](/d:/projects/Cora/apps/web/src/components/lobby/LobbyScreen.tsx) so stale `depositing` snapshots are only treated as ER-recovery when they are read from `phase === "setup"`.
- Added a small safety-valve effect that clears `pendingErRecovery` if the lobby legitimately transitions into `phase === "found"`, ensuring the normal `OpponentFound` deposit UI stays visible.

### The Reasoning
- The previous ER guardrail fix correctly protected the “back from battle while settling” case, but it was too broad: the normal fresh match-found flow also writes a `depositing` snapshot, so later effect runs mistook that for recovery and hid the deposit screen.
- Restricting the intercept to the actual lobby landing phase preserves the original loop fix while restoring the intended live deposit experience for newly matched players.

### The Tech Debt
- The recovery-vs-live-flow distinction still depends on a mix of `phase` state and local-storage snapshot status. If more recovery paths are added, we should consider recording an explicit snapshot origin or recovery mode to make this branching less implicit.

## 2026-05-09 - Deposit Failure UX Hardening

### The Change
- Updated [OpponentFound.tsx](/d:/projects/Cora/apps/web/src/components/lobby/OpponentFound.tsx) so the deposit countdown now pauses while Phantom is open, deposit signing errors are classified into user-facing messages, and a new `insufficientFunds` state drives retry copy plus longer-lived insufficient-balance feedback.
- Updated [depositTypes.ts](/d:/projects/Cora/apps/web/src/components/deposit/depositTypes.ts) to add the new `insufficient_funds` status metadata consumed by the existing deposit status UI.

### The Reasoning
- Players were losing deposit time while the wallet approval modal was open, so treating `signing` like the existing waiting states prevents Phantom latency from burning the match window.
- Solana simulation and Phantom rejection errors are too raw for players, so the caller now translates common wallet, network, expiry, and insufficient-funds failures into concise guidance while capping unknown fallbacks.
- Keeping insufficient-balance state separate from generic signing errors lets the status card and primary CTA explain the actual next step: top up and retry.

### The Tech Debt
- Error classification is still substring-based inside `OpponentFound.tsx`; if more wallet providers or on-chain programs join the flow, we should consider centralizing these mappings in a shared Solana UX error helper.

## 2026-05-09 - Deposit Preflight Recovery And Typed Error Routing

### The Change
- Updated [signDepositIntent.ts](/d:/projects/Cora/apps/web/src/lib/solana/signDepositIntent.ts) so deposit signing no longer skips preflight, stops retrying failed sends, and inspects wallet error logs to preserve `insufficient_balance` and RPC-style failures through `DepositIntentError`.
- Updated [OpponentFound.tsx](/d:/projects/Cora/apps/web/src/components/lobby/OpponentFound.tsx) to consume `DepositIntentError.code` directly, add a 45-second wallet-signing timeout safety net, and treat timeout plus typed insufficient-balance failures as the existing insufficient-funds UI state.

### The Reasoning
- The broken UX came from bypassing simulation: empty-wallet deposits sat in `signing` until on-chain confirmation failed, which hid the real cause and left the timer paused for far too long.
- Reading `SendTransactionError.logs` inside the signer keeps the error typed at the source, which is more reliable than trying to reconstruct wallet intent from raw strings in the React layer.
- Keeping a local timeout in the UI protects against wallet adapters that abandon the signing promise without resolving, so the player gets control back instead of silently hanging until the room expires.

### The Tech Debt
- The timeout heuristic currently treats `signing_timeout` as likely insufficient funds because that is the most harmful silent-failure case we know about. If we start seeing more timeout causes in production, we should split that into its own status or collect wallet-specific telemetry before tightening the UX copy further.

## 2026-05-09 - Deposit Insufficient-Balance Copy Unification

### The Change
- Updated [signDepositIntent.ts](/d:/projects/Cora/apps/web/src/lib/solana/signDepositIntent.ts) so failed `/api/actions/challenge` responses now classify backend insufficient-balance signals, including HTTP `402` and balance/fund wording in `error`, `message`, `reason`, or `code`, as `DepositIntentError("insufficient_balance", "Insufficient Balance")`.
- Updated [OpponentFound.tsx](/d:/projects/Cora/apps/web/src/components/lobby/OpponentFound.tsx) so both typed and fallback insufficient-balance detection now surface the exact user-facing message `Insufficient Balance` while preserving the existing `insufficientFunds` status behavior.

### The Reasoning
- The deposit UI already had the right state transition for insufficient funds, but some backend and fallback error paths still leaked into generic retry copy or "unexpected" messaging.
- Normalizing the copy at both the signer boundary and the React fallback layer gives us one stable message regardless of whether the failure comes from backend transaction construction, Solana preflight, or raw wallet error text.

### The Tech Debt
- Backend insufficient-balance detection is still keyword-based because the action endpoint does not yet expose a dedicated structured error enum. If that endpoint grows a stable machine-readable code, we should prefer that over substring matching.

## 2026-05-09 - Deposit Pre-Send Simulation Guard

### The Change
- Updated [signDepositIntent.ts](/d:/projects/Cora/apps/web/src/lib/solana/signDepositIntent.ts) so deposit transactions are simulated immediately after setting `recentBlockhash` and `feePayer`, before calling `wallet.sendTransaction`.
- Preserved existing `DepositIntentError` instances inside `mapWalletError`, and added simulation-side insufficient-balance detection that promotes matching simulation failures to `DepositIntentError("insufficient_balance", "Insufficient Balance")` before the wallet adapter can collapse them into `WalletSendTransactionError: Unexpected error`.

### The Reasoning
- The latest failure report showed the real insufficient-balance signal was happening at `wallet.sendTransaction`, which meant the backend guard was too early and the wallet adapter was too lossy.
- Simulating the fully prepared transaction ourselves lets us inspect both `simulation.value.err` and `simulation.value.logs` while they still contain the useful Solana failure details, so we can fail fast with the same typed insufficient-balance path the UI already understands.

### The Tech Debt
- Simulation-side insufficient-balance detection is still string-based across logs and serialized error payloads. If we later standardize the transaction program errors we expect here, we should tighten this into a smaller helper with explicit structured cases instead of broad keyword matching.

## 2026-05-09 - Phantom Opening Timer Badge

### The Change
- Updated [DepositStatusCard.tsx](/d:/projects/Cora/apps/web/src/components/deposit/DepositStatusCard.tsx) and [DepositPanel.tsx](/d:/projects/Cora/apps/web/src/components/deposit/DepositPanel.tsx) to support an optional countdown-area slot rendered directly under the timer.
- Updated [OpponentFound.tsx](/d:/projects/Cora/apps/web/src/components/lobby/OpponentFound.tsx) to show a pill-style `Opening Phantom...` badge beneath the frozen countdown while `signingState === "signing"`.

### The Reasoning
- Once the timer began freezing during wallet signing, there was no immediate visual cue telling players that the pause was intentional and that Phantom was being opened.
- Placing the badge directly under the countdown keeps the explanation attached to the paused timer itself, which is clearer than repurposing the broader helper text or adding another top-level banner.

### The Tech Debt
- The countdown slot is intentionally generic, but it is still a one-off prop path through the deposit components. If we add more timer-adjacent states later, it may be worth consolidating this into a dedicated countdown presentation component.

## 2026-05-10 - Layered Landing Hero Artwork

### The Change
- Rebuilt [Hero.tsx](/d:/projects/Cora/apps/web/src/components/landing/Hero.tsx) around the designer-provided layered room artwork, replacing the placeholder doodles, floating cards, cursor orb, and token badges.
- Added a reusable `HERO_LAYERS` configuration plus `HeroLayer` renderer with staged entrances, spring-smoothed pointer parallax, subtle scene tilt, reduced-motion handling, and smaller motion intensity on coarse/mobile pointers.

### The Reasoning
- The hero now uses the original 4096 x 2589 canvas ratio so every transparent PNG layer shares one aligned stage and preserves the designer composition.
- Keeping movement strengths in layer config makes the depth model readable: the stable base barely moves, heavy bookcases stay restrained, and foreground objects/drawer carry the strongest but still subtle parallax.
- Next `Image` is used inside motion wrappers so we keep optimized image loading while Framer Motion owns the 3D and pointer-following transforms.

### The Tech Debt
- The assets currently live under `apps/web/public/assets/landing`, so the component serves them from `/assets/landing/...` instead of the originally requested `/landing/...`. If the asset folder is moved later, update `HERO_ASSET_ROOT` rather than every layer entry.

## 2026-05-10 - In-Scene Hero Title Layering

### The Change
- Updated [Hero.tsx](/d:/projects/Cora/apps/web/src/components/landing/Hero.tsx) so the landing hero title is now a configured text layer inside the artwork stack rather than a separate heading block above the scene.
- Removed the extra eyebrow copy, subtitle copy, and scroll indicator, and reordered the depth stack so `CORA` sits between `bookcase_2` and `bookcase_1` with its own entrance timing and parallax strength.

### The Reasoning
- Treating the title as just another layer keeps the composition faithful to the designer scene and creates the intended “embedded in the environment” feel instead of a conventional marketing hero layout.
- Keeping text and image layers in the same reusable config makes the depth order, timing, and motion relationships explicit, which should make future composition tuning much less brittle.

### The Tech Debt
- The exact title placement is currently tuned with percentage positioning inside the shared 4096 x 2589 stage. If the designer revises the artwork crop or safe area, we should retune that anchor with final visual QA rather than assuming the current percentage will remain perfect.

## 2026-05-10 - Static Base And Vertical Hero Parallax

### The Change
- Updated [Hero.tsx](/d:/projects/Cora/apps/web/src/components/landing/Hero.tsx) so `base.png` is no longer part of the animated layer stack and is instead rendered as the section background, while the remaining scene layers now preload before their entrance sequence begins.
- Refactored the hero interaction from tilt-plus-XY parallax to Pixelmon-style vertical-only parallax, removed the navbar offset from the hero canvas, and made the scene wrapper full-height so the table and drawer can live inside the initial viewport under the fixed nav.
- Updated [Navbar.tsx](/d:/projects/Cora/apps/web/src/components/landing/Navbar.tsx) to keep its non-scrolled state explicitly transparent while preserving the existing solid-on-scroll behavior and frame-cut brand styling.

### The Reasoning
- Making the base room art completely static gives the scene a stable camera anchor, which helps the layered bookcases, title, table, and foreground details feel like depth within one illustration instead of separate floating objects.
- Waiting for all PNG layers to load before starting the staggered animation avoids the uneven “pop-in while decoding” look and makes the back-to-front settling sequence feel more intentional.
- Vertical-only movement is a better fit for this environment art than full tilt because it preserves the room perspective and feels calmer, especially once the hero starts at `y = 0` behind the navbar.

### The Tech Debt
- The section now uses `background-size: cover` for the static base while the moving PNG layers still rely on shared absolute positioning. If final visual QA shows mismatch between the covered backdrop and the contained overlays at extreme aspect ratios, we may need one more composition pass to tighten their scaling relationship.

## 2026-05-10 - Full-Bleed Hero Canvas And Counter-Parallax

### The Change
- Updated [Hero.tsx](/d:/projects/Cora/apps/web/src/components/landing/Hero.tsx) so the layered scene canvas is now full-bleed at `100svh` with no horizontal page padding or max-width cap, allowing the artwork to fill the viewport edge to edge.
- Restored `bookcase_3` as the backmost animated layer, added an `isBackground` flag for image-layer fit behavior, and changed image rendering from `fill` + shared `object-contain` to explicit absolute sizing with `cover` for background shelves and bottom-anchored `contain` for table/drawer/object layers.
- Reworked the parallax math to use both `pointerX` and `pointerY` with counter-motion by depth, so background layers drift opposite the cursor, the title moves gently, and foreground layers follow the cursor for a stronger window-like depth effect.

### The Reasoning
- The previous capped canvas and centered layout were constraining the artwork too much, which made the scene feel like a framed component rather than a full landing-page environment.
- Splitting background and foreground fit rules fixes the scaling problem where wide shelf layers could shrink awkwardly while the lower scene pieces still need to stay visually anchored to the floor line.
- Counter-parallax creates a more convincing sense of depth than same-direction drift because it lets the room feel spatial without reintroducing the tilt behavior we intentionally removed.

### The Tech Debt
- The hero now depends more heavily on manual per-layer fit conventions (`isBackground` vs foreground defaults). If more layer types or special crops are added later, we may want to promote this into a slightly richer layer positioning schema instead of relying on a binary background flag.

## 2026-05-10 - Hero Targeted Layer Fixes

### The Change
- Updated [Hero.tsx](/d:/projects/Cora/apps/web/src/components/landing/Hero.tsx) to stop applying horizontal parallax to the in-scene `CORA` title while keeping its lighter vertical motion.
- Adjusted `bookcase_3` to render at `depth: 1` so it no longer disappears behind the static section background.
- Changed all animated image layers to use `object-fit: contain`, with background shelves centered and foreground pieces bottom-anchored, removing the previous `cover` cropping on the shelf layers.

### The Reasoning
- The title clipping bug came from giving the text layer a nonzero X-direction during the initial spring state, which could shift it sideways before settling.
- `bookcase_3` was effectively competing with the section background when rendered at `zIndex: 0`, so raising it one layer restores it as the first visible animated shelf plane.
- The bookcase assets behave more like transparent composition layers than true viewport-filling backgrounds, so `contain` preserves their intended framing better than `cover`.

### The Tech Debt
- Depth numbers now matter for both rendering order and parallax direction rules. If we keep iterating on this scene, it may be worth separating visual stack order from motion grouping so tiny depth fixes do not also carry interaction semantics.

## 2026-05-10 - Full-Cover Layered Hero Stage

### The Change
- Updated [Hero.tsx](/d:/projects/Cora/apps/web/src/components/landing/Hero.tsx) so `base.png` is part of the same `HERO_LAYERS` stack as the rest of the room artwork and every image layer renders with `fill`, `object-cover`, and shared center positioning.
- Removed the constrained flex/content wrapper and decorative gradient blocks from the hero, leaving a full-viewport absolute stage with subtle pointer tilt and parallax.
- Mirrored the landing PNGs into [apps/web/public/landing](/d:/projects/Cora/apps/web/public/landing) so the runtime paths resolve as `/landing/base.png`, `/landing/bookcase_3.png`, `/landing/bookcase_2.png`, `/landing/bookcase_1.png`, `/landing/table.png`, `/landing/drawer.png`, and `/landing/objects.png`.

### The Reasoning
- The previous split between a covered section background and contained overlay images made the transparent layers scale differently, so the room composition looked boxed-in and misaligned.
- Rendering every layer against one absolute viewport-cover stage keeps the designer canvas aligned while allowing the drawer and foreground objects to crop naturally at the hero edge.
- Keeping the `CORA` title between `bookcase_2` and `bookcase_1` preserves the in-scene framing while using a smaller clamp and higher anchor so it remains readable.

### The Tech Debt
- The `/assets/landing` copies are still present in the public folder. Once no code references them, we can remove that duplicate asset path after confirming nothing outside the landing hero depends on it.

## 2026-05-10 - Ratio-Preserved Hero Stage

### The Change
- Updated [Hero.tsx](/d:/projects/Cora/apps/web/src/components/landing/Hero.tsx) so the landing artwork now renders inside a `4096 / 2589` aspect-ratio stage that is `120svh` tall instead of covering a `100svh` viewport directly.
- Changed the layered PNG rendering from `object-cover` to `object-contain`, removed the per-layer inset overscan, and adjusted the in-scene `CORA` title to `top-[39%]` with a slightly smaller responsive clamp.

### The Reasoning
- The exported designer layers all share the same full-canvas dimensions, so preserving that canvas ratio and containing each layer keeps the composition aligned without aggressively cropping the top wall or enlarging the bookcases.
- Letting the hero be taller than one viewport gives the table and drawer room to sit low while keeping the intended empty wall space visible above the shelves.
- Keeping parallax on the layer wrappers preserves the subtle Pixelmon-like depth while the sizing model now belongs to the shared stage instead of each individual image.

### The Tech Debt
- The current stage is tuned to `120svh`. If final visual QA on very wide or very short screens still feels too cropped or too roomy, the next adjustment should be the stage height/width formula rather than switching the layer images back to cover.

## 2026-05-10 - Designer Canvas Hero Replacement

### The Change
- Replaced [Hero.tsx](/d:/projects/Cora/apps/web/src/components/landing/Hero.tsx) with a clean layered scene that uses only `bookcase_3`, `bookcase_2`, the in-scene `CORA` title, `bookcase_1`, `table`, `drawer`, and `objects`.
- Changed the hero stage to `w-screen` with `aspect-[4096/2589]`, letting the artwork height follow the designer canvas instead of forcing a fixed `100svh` or `120svh` crop.
- Added staged entrance animation, subtle pointer-following parallax per layer, and a gentle whole-stage 3D tilt while preserving reduced-motion behavior.

### The Reasoning
- The designer exports share one 4096 x 2589 canvas, so every layer now fills the same absolute stage with `object-contain` and centered positioning to preserve alignment without cropping.
- Removing `base.png`, old marketing copy, and scroll affordances keeps the hero focused on the provided composition and the single embedded `CORA` title.
- The motion config keeps depth readable by giving farther shelves smaller movement and foreground objects slightly stronger drift without making the scene feel gimmicky.

### The Tech Debt
- Final visual QA should still confirm the title's exact overlap with `bookcase_1` across common viewport widths, since that placement depends on the designer layer artwork rather than layout text flow.

## 2026-05-10 - Static Hero Base And Counter Motion

### The Change
- Updated [Hero.tsx](/d:/projects/Cora/apps/web/src/components/landing/Hero.tsx) to restore `/landing/base.png` as the backmost hero layer while keeping it static with `movement: 0`.
- Added an explicit per-layer `direction` value so back layers and front layers drift in opposing directions during pointer hover.

### The Reasoning
- The base art should behave like the fixed room plate, giving the parallax layers a stable visual anchor instead of moving with the scene.
- Opposing layer motion creates clearer depth than same-direction drift: the rear bookcases can slide one way while the foreground furniture and objects slide the other.

### The Tech Debt
- The exact direction strengths are still design-tunable. If the scene feels too elastic in QA, reduce the foreground `direction` magnitude before changing the shared pointer spring.

## 2026-05-10 - Static Base Isolation And Hero Overscan

### The Change
- Updated [Hero.tsx](/d:/projects/Cora/apps/web/src/components/landing/Hero.tsx) so `base.png` now renders outside the hover-reactive layer stack instead of living inside the same moving scene wrappers.
- Added a small shared image overscan to the landing hero PNG layers so subtle hover parallax does not expose dark empty edges around the artwork.
- Increased the in-scene `CORA` title clamp so the outer letters sit more noticeably behind the bookshelf framing.

### The Reasoning
- The base looked like it was moving because it was still inside the stage that received hover tilt, even though its own per-layer movement was zero.
- A tiny scale-up is the cleanest way to preserve the full-canvas composition feel while buying enough bleed to hide edge gaps during motion.
- Making the title a little larger helps the shelf overlap read intentionally, so the word feels embedded in the scene rather than merely layered over it.

### The Tech Debt
- The overscan and title scale are both intentionally conservative tuning knobs. If the scene still shows edges or the shelf overlap feels off on certain viewports, the next pass should adjust those two values together before changing the broader layer layout.

## 2026-05-10 - Landing Asset Path Cleanup

### The Change
- Updated [Hero.tsx](/d:/projects/Cora/apps/web/src/components/landing/Hero.tsx) to load the layered hero artwork from `/assets/landing/...` instead of `/landing/...`.
- Removed the duplicate [apps/web/public/landing](/d:/projects/Cora/apps/web/public/landing) directory so `apps/web/public/assets/landing` is now the single source of truth for the room exports.

### The Reasoning
- In a Next app, `/assets/landing/...` maps directly to `apps/web/public/assets/landing/...`, so keeping only that directory makes the runtime path and filesystem layout line up cleanly.
- The duplicate folder existed because the earlier hero implementation was switched to `/landing/...` runtime paths and the files were mirrored to match; that duplication is no longer necessary.

### The Tech Debt
- Older hero notes in this devlog still mention the temporary `/landing/...` mirroring step from earlier iterations. They remain historically true, but the current implementation now uses `/assets/landing/...`.

## 2026-05-10 - Hero Layer Type Narrowing Fix

### The Change
- Updated [Hero.tsx](/d:/projects/Cora/apps/web/src/components/landing/Hero.tsx) to add an `isImageLayer` type guard and use it when resolving the static base layer and preload image source list.

### The Reasoning
- `HeroLayer` is a text-or-image union, and the editor was correctly warning that `src` does not exist on text layers. Making the image narrowing explicit keeps the config flexible without papering over the type system.

### The Tech Debt
- The hero layer config is still a fairly compact union living in one file. If we keep extending the scene schema, it may be worth extracting the layer types and helpers so the rendering logic stays easy to scan.

## 2026-05-11 - Hero Loading Expression Overlay

### The Change
- Added [LandingIntroLoader.tsx](/d:/projects/Cora/apps/web/src/components/landing/LandingIntroLoader.tsx) as a dedicated full-viewport intro screen that renders before the landing page itself.
- Added [heroAssets.ts](/d:/projects/Cora/apps/web/src/components/landing/heroAssets.ts) to share the landing preload source list and scientist idle-expression asset helper.
- Updated [page.tsx](/d:/projects/Cora/apps/web/src/app/page.tsx) to hold back the navbar, hero, and rest of the landing page until the intro loader finishes.
- Updated [page.tsx](/d:/projects/Cora/apps/web/src/app/page.tsx) again to mount the navbar on a short follow-up timer after the hero begins revealing, instead of only delaying the navbar animation.
- Simplified [Hero.tsx](/d:/projects/Cora/apps/web/src/components/landing/Hero.tsx) so it only handles the room scene entrance now that asset preloading and the intro screen live outside it.
- The intro uses each scientist's idle expression art as the sole loading indicator, with a subtle staggered bounce and a 1.5 second minimum hold.
- Updated [Navbar.tsx](/d:/projects/Cora/apps/web/src/components/landing/Navbar.tsx) to use a fade-and-deblur entrance instead of a vertical slide, avoiding the fixed-nav top-position flash on mount.

### The Reasoning
- The hero-box loader was never truly centered in the viewport because it still lived inside the hero's aspect-ratio stage rather than owning the whole screen.
- Rendering the intro first at the page level prevents the navbar and other landing chrome from appearing before the entrance beat has completed.
- Mounting the navbar later at the page level works better than a Framer delay on the nav itself, because the nav is truly absent during the hero's first frames instead of existing offscreen and then animating in.
- Reusing the real scientist expression assets keeps the wait state grounded in the game's visual language instead of falling back to generic UI loading patterns.
- Letting the hero reveal start before the navbar mounts keeps the first frame from feeling crowded and lets the room establish itself before navigation competes for attention.
- For a fixed navbar, a pure opacity/blur reveal is more reliable than animating vertical position on first mount, because there is no one-frame snap between the browser's pinned layout position and Framer's transform state.

### The Tech Debt
- The landing intro currently blocks the entire page until its preload list resolves. If we later add heavier media to the first viewport, we may want a more selective preload strategy so the entrance beat stays crisp.
## 2026-05-10 - MagicBlock UI Enhancement Layer

### The Change
- Added [magicblockUi.ts](/d:/projects/Cora/apps/web/src/lib/magicblock/magicblockUi.ts) to translate MagicBlock/ER lifecycle states into player-facing badge labels, short copy, progress values, and pulse behavior for deposit and settlement surfaces.
- Updated [DepositPanel.tsx](/d:/projects/Cora/apps/web/src/components/deposit/DepositPanel.tsx) with an optional `statusStripSlot`, then wired [OpponentFound.tsx](/d:/projects/Cora/apps/web/src/components/lobby/OpponentFound.tsx) to render a compact `Fast Arena` / `Standard Arena` status strip inside the existing deposit panel.
- Updated [BattleScreen.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx) and [BattleScreenOverlays.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreenOverlays.tsx) to show the same style of support strip inside the existing settlement result overlay without changing the primary outcome copy.

### The Reasoning
- We wanted to support MagicBlock delays as a presentation enhancement, not as a separate screen or layout branch. Keeping the enhancement inside existing deposit and settlement slots avoids layout jumps and keeps fallback to standard mode feeling intentional.
- The result overlay keeps player-centered copy like `You Win` / `You Lose`, while the new strip explains what the arena/proof layer is doing underneath. This protects the emotional result moment while still making ER settlement progress legible.
- Centralizing the ER-to-UI mapping keeps raw lifecycle labels such as `creating`, `delegating`, and `committing` out of component markup and makes it easier to tune copy later.

### The Tech Debt
- The status strips are currently local JSX in `OpponentFound` and `BattleScreenOverlays`; if more screens need the same treatment, extract a shared `ArenaStatusStrip` component.
- Production build verification was blocked by a local `.next` file lock (`EPERM unlink ... .next/build/chunks/...`) after Google Fonts access was allowed. Lint and TypeScript checks passed, but the build should be rerun after clearing the locked build artifact or stopping the process holding it.

## 2026-05-10 - MagicBlock Enhancement Timing And Fallback Result Copy

### The Change
- Updated [OpponentFound.tsx](/d:/projects/Cora/apps/web/src/components/lobby/OpponentFound.tsx) so the arena/proof status strip only appears after the player has signed and the room has an actual preparation signal (`erStatus`, `playing`, or `settling`). Player A waiting for Player B and Player B waiting for unlock now stay on the normal deposit UI.
- Updated [BattleScreen.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx) so `server_error` fallback match results are classified as finalized standard fallback instead of unresolved pending settlement.
- Updated [BattleScreenOverlays.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreenOverlays.tsx) so `server_error` outcomes show clear fallback payout copy instead of `Settlement is still being finalized`.

### The Reasoning
- The MagicBlock strip should communicate post-deposit loading, not appear as a default decoration from the start of the opponent-found screen.
- When ER card play fails and the backend emits local `server_error` finalization, the FE receives a terminal `matchResult` without a settlement authorization. Treating that as `Pending` made a completed fallback path look stuck.
- Forcing the settlement support UI into standard mode on `server_error` prevents stale pre-fallback `gameState.erEnabled` / `erStatus` snapshots from briefly showing a MagicBlock proof state after fallback has already won.

### The Tech Debt
- The FE still depends on `server_error` as the fallback signal. If the backend later emits a more specific ER fallback reason or status enum, the settlement copy should switch to that structured signal.

## 2026-05-10 - Player-B MagicBlock Loading Color Timing

### The Change
- Updated [OpponentFound.tsx](/d:/projects/Cora/apps/web/src/components/lobby/OpponentFound.tsx) so the MagicBlock status strip can show an orange `Fast Arena` loading state immediately after Player B signs the second deposit.
- Kept the green state tied to the existing server-provided preparation signal (`erStatus` / `playing` / `settling`), so the strip now visually moves from local post-deposit loading to server-confirmed fast-arena readiness.

### The Reasoning
- The frontend cannot infer Player B completion from Player A's side without a new backend event, but Player B's client knows it was unlocked and just signed. Using that local fact lets us show the intended yellow/orange loading phase without touching backend code.
- Keeping Player A on the normal waiting UI avoids pretending both deposits are done before the frontend has a reliable signal.

### The Tech Debt
- This is intentionally asymmetric until the backend emits a dedicated `bothDeposited` / `erSetupStarted` event or broadcasts ER lifecycle changes during setup. If that signal becomes available later, Player A can show the same orange loading phase too.

## 2026-05-10 - Shared Post-Sign Fast Arena Loading State

### The Change
- Updated [OpponentFound.tsx](/d:/projects/Cora/apps/web/src/components/lobby/OpponentFound.tsx) so both players now see the Fast Arena strip after their own deposit signature is captured.
- Player A sees an orange `Fast Arena queued` state while waiting for Player B's wager, and Player B sees an orange `Syncing MagicBlock` state after signing the second deposit.
- Existing server-provided `erStatus` / `playing` / `settling` signals still drive the green ready state when the room snapshot catches up.

### The Reasoning
- This keeps the UX fair: both players get an immediate post-sign loading state without requiring backend changes.
- Player A cannot know from frontend-only state that Player B has signed, so the copy stays honest by saying the fast arena is queued rather than claiming setup has started.

### The Tech Debt
- The orange-to-green transition is still partly local/optimistic because the frontend does not receive a dedicated `bothDeposited` or `erSetupStarted` event. If backend events are added later, this can become fully authoritative for both players.

## 2026-05-10 - Settlement Overlay Pending Bar Simplification

### The Change
- Removed the arena/proof support strip from [BattleScreenOverlays.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreenOverlays.tsx) so settlement results no longer show internal copy like `Standard Arena`, `Result secured`, or `Match outcome is finalized`.
- Added a slim bottom shimmer bar to the settlement overlay only when `settlementStatus === "Pending"`.
- Removed now-unused settlement support prop plumbing from [BattleScreen.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx).

### The Reasoning
- The settlement result overlay should stay outcome-focused. Showing standard/proof state text inside the card felt too implementation-facing and competed with the actual result.
- Pending still needs motion feedback, but a bottom loading rail is enough to communicate that the app is waiting without adding more copy or shifting the layout.

### The Tech Debt
- The bottom rail currently keys off the display string `Pending`. If settlement states become richer later, this should switch to a boolean derived in `BattleScreen` instead of comparing UI copy.

## 2026-05-10 - Settlement Fallback Copy Softening

### The Change
- Updated [BattleScreenOverlays.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreenOverlays.tsx) so `server_error` fallback copy now reads `Match closed safely. No winner payout was awarded`.

### The Reasoning
- The previous wording (`Standard fallback finalized`) sounded too implementation-facing for a player result overlay.
- The new copy keeps the important payout expectation clear while sounding more like product language and less like a backend state.

### The Tech Debt
- `server_error` still covers multiple fallback causes. If backend eventually distinguishes ER failure, refund-gated draw, or settlement-service issues, these should get more specific result copy.

## 2026-05-10 - Settlement Review Copy For ER Failure

### The Change
- Updated [BattleScreen.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx) so `server_error` match results show a `Review` settlement status instead of `Finalized`.
- Updated [BattleScreenOverlays.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreenOverlays.tsx) so ER failure fallback copy says `Match closed safely. Wager resolution is pending review`.
- Softened the standard loss payout line from `No winner payout was awarded to you for this match` to `Rival secured the wager for this match`.

### The Reasoning
- The MagicBlock failure log shows local `server_error` finalization after a delegated ER transaction failure, not the normal winner-payout settlement path.
- The UI should not imply the match had no winner or that players had no reason to play. It should communicate that the room was closed safely and wager handling needs a review/resolution path.

### The Tech Debt
- This remains frontend wording over a broad backend `server_error` reason. A dedicated escrow review/refund/winner-settlement status would let the UI be more precise later.

## 2026-05-10 - Opponent Found Green Loading Rail

### The Change
- Updated [OpponentFound.tsx](/d:/projects/Cora/apps/web/src/components/lobby/OpponentFound.tsx) so confirmed green MagicBlock states use a continuous full-width loading rail instead of a fixed progress width.

### The Reasoning
- Once the UI turns green, the player should read it as server-confirmed Fast Arena preparation, not as a precise percentage countdown. The moving rail keeps the wait feeling alive without implying exact backend progress.

### The Tech Debt
- Orange local states still use optimistic progress values because the frontend does not receive authoritative phase progress before the server snapshot catches up.

## 2026-05-10 - Endgame Notice And Processing Rails

### The Change
- Updated [OpponentFound.tsx](/d:/projects/Cora/apps/web/src/components/lobby/OpponentFound.tsx) so both orange post-sign Fast Arena states use a full-width left-to-right infinite loading rail.
- Updated [BattleScreen.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx) so terminal results show as a small in-game battle notice while cards are locked and the base destruction/result sequence resolves.
- Updated the card helper text to say `Match locked. Resolving final sequence.` when a terminal result has arrived.

### The Reasoning
- Orange should communicate active processing for both players, not a static/progress estimate.
- The final win/loss overlay should be the only big result popup. The earlier match-finished moment now reads as an in-game transition while the base animation completes.

### The Tech Debt
- The endgame notice reuses the existing battle notice layer. If more transition states are added, that notice model may need explicit variants instead of overloading the `phase` tone.

## 2026-05-10 - Match Finished Notice Gate

### The Change
- Updated [BattleScreen.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx) so raw `status === "finished"` no longer opens the large settlement/result overlay by itself.
- Generic finished state now stays in the in-game notice bar as `Match finished. Cards locked while result syncs.`
- The large result overlay is reserved for resolved outcomes from `settlementResult`, `matchResult`, invalidation, or room cancellation.

### The Reasoning
- `Match Finished` is a transition state, not an emotional result. Keeping it in the battle notice bar avoids showing two similar popup moments before the base-destroyed sequence and final result.

### The Tech Debt
- This still depends on the existing socket result payloads arriving after `finished`. If backend ever emits a dedicated `result_syncing` status, the FE should key the notice from that explicit state.

## 2026-05-10 - Endgame Base Notice Removal

### The Change
- Updated [BattleScreen.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx) so resolved endgame/base-destruction sequences no longer show `Final impact registered. Cards locked while the base resolves.`
- Kept the generic `Match finished. Cards locked while result syncs.` notice only for unresolved raw `finished` status.

### The Reasoning
- The base destruction animation is already the transition moment. Removing extra copy lets the final result popup land cleaner.

### The Tech Debt
- If the result-sync delay becomes long, we may want a quieter visual-only lock indicator instead of text.

## 2026-05-10 - Terminal Card Lock Tightening

### The Change
- Updated [BattleScreen.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx) so answer clicks are ignored once `isMatchComplete` is true.
- Marked answer options disabled during match completion using the derived terminal lock state.
- Removed the active-card glow from hand cards during terminal lock so the played card no longer looks interactable while the result sequence resolves.

### The Reasoning
- Hand cards were technically disabled by `isMatchComplete`, but the active card could still look selected/available because active styling overrode the locked opacity.
- The open answer panel already unmounts on match completion, but guarding `onAnswer` closes the small race window between terminal socket updates and React render.

### The Tech Debt
- If we add a dedicated “locked card” visual later, replace the generic disabled opacity with a clearer final-turn lock treatment.

## 2026-05-10 - Blink Challenge Creator Path And Temporary Browser Link

### The Change
- Added [privateChallenge.ts](/d:/projects/Cora/apps/web/src/lib/matchmaking/privateChallenge.ts) for the FE private-match contract: create challenge, confirm creator funding, poll challenge status, resolve API base URL, and derive a temporary web challenge URL.
- Added [signBackendTransaction.ts](/d:/projects/Cora/apps/web/src/lib/solana/signBackendTransaction.ts) so the creator can sign the backend-provided `create_open_challenge` transaction before calling `/match/private/confirm`.
- Added creator/challenger Blink UI pieces: [BlinkChallengePanel.tsx](/d:/projects/Cora/apps/web/src/components/challenge/BlinkChallengePanel.tsx), [BlinkRoomJoiner.tsx](/d:/projects/Cora/apps/web/src/components/challenge/BlinkRoomJoiner.tsx), [BlinkChallengeAccept.tsx](/d:/projects/Cora/apps/web/src/components/challenge/BlinkChallengeAccept.tsx), and [page.tsx](/d:/projects/Cora/apps/web/src/app/challenge/[roomId]/page.tsx).
- Updated [LobbyScreen.tsx](/d:/projects/Cora/apps/web/src/components/lobby/LobbyScreen.tsx), [LobbySetup.tsx](/d:/projects/Cora/apps/web/src/components/lobby/LobbySetup.tsx), and [matchSession.ts](/d:/projects/Cora/apps/web/src/lib/session/matchSession.ts) so active Blink challenges are persisted, normal queueing is blocked while a creator challenge is live, challenge status is polled, and the creator auto-joins when a rival accepts.
- The creator panel now exposes both `Copy Blink URL` and `Copy Browser Link`: the Blink URL remains the primary share target for Blink-supported apps, while the browser link is a temporary direct route to `/challenge/:roomId`.

### The Reasoning
- Backend now owns the true Blink escrow transaction flow, so FE should sign and confirm the backend-provided transaction instead of inventing or changing API behavior.
- A creator with an unresolved Blink challenge must be kept out of normal matchmaking to avoid a shared-link accept racing against a regular queue match.
- The Blink URL and browser challenge page are not currently the same thing: opening the raw Blink URL in a normal browser returns the backend action payload unless backend later adds browser redirect/content negotiation. Keeping two explicit copy actions is the honest temporary UX while preserving the desired future direction.

### The Tech Debt
- Backend should eventually redirect normal browser requests from the Blink action URL to the FE `/challenge/:roomId` page so the product can return to a single canonical share link.
- The browser accept page currently relies on challenge room lookup and default FE arena/scientist context because the backend Blink URL does not carry frontend presentation metadata.
- Active Blink challenge cleanup is local for terminal states; if backend adds richer cancellation/expiry events, the lobby can switch from polling to a more authoritative push-driven state.

## 2026-05-10 - Blink Share Actions Consolidated Into Card

### The Change
- Updated [ChallengeShareCard.tsx](/d:/projects/Cora/apps/web/src/components/challenge/ChallengeShareCard.tsx) to support an optional secondary copy action.
- Updated [BlinkChallengePanel.tsx](/d:/projects/Cora/apps/web/src/components/challenge/BlinkChallengePanel.tsx) so the top active-challenge banner is informational only.
- Moved the temporary browser-link copy action into the share card alongside `Copy Blink URL`, `Save As JPG`, and `Share On X`.
- Replaced the framed `Close` control with a plain corner `x` to keep the overlay chrome quieter.

### The Reasoning
- The previous overlay duplicated CTAs between the banner and card, making the hierarchy noisy.
- Keeping all share/export actions in the card makes the banner read as status context and the card read as the action surface.
- A lightweight `x` is enough for dismissing the panel and avoids competing with the share actions.

### The Tech Debt
- The card now has two explicit copy actions because the raw Blink URL and temporary browser accept URL are still separate. Once backend browser redirect support lands, the secondary browser-copy action should be removed.

## 2026-05-10 - Blink Acceptance Notification And Challenger Page Polish

### The Change
- Updated [BlinkRoomJoiner.tsx](/d:/projects/Cora/apps/web/src/components/challenge/BlinkRoomJoiner.tsx) with a compact notification variant that still mounts the match socket and sends creator `confirmDeposit`.
- Updated [LobbyScreen.tsx](/d:/projects/Cora/apps/web/src/components/lobby/LobbyScreen.tsx) so creator-side `Rival Accepted` no longer replaces the whole lobby; it appears as a notification while presence confirmation runs in the background.
- Updated [BlinkChallengeAccept.tsx](/d:/projects/Cora/apps/web/src/components/challenge/BlinkChallengeAccept.tsx) so the challenger page shows arena, token, and `$1.00` wager copy, uses the green page background with a light content section, and makes `Back To Lobby` readable with dark text.
- Updated [BlinkRoomJoiner.tsx](/d:/projects/Cora/apps/web/src/components/challenge/BlinkRoomJoiner.tsx) so socket close `1008` with `Room not found or already finished` is treated as a terminal closed-room state: local active match state is cleared, retry is hidden, and `Back To Lobby` is always available.
- Reused the shared `btn-game btn-game-secondary` style for the challenger page `Back To Lobby` action so it matches the primary accept button system, with local matching text/border color overrides for readability on the light panel.
- Normalized the wrapped SOL mint display to `SOL` on the challenger page while keeping the raw mint for signing/API calls.
- Changed creator-side Blink acceptance sequencing so `Rival Accepted` is a passive notification first; clicking `View Challenge` opens the full `Confirming your match...` screen and mounts the websocket confirmer.
- Updated [BlinkRoomJoiner.tsx](/d:/projects/Cora/apps/web/src/components/challenge/BlinkRoomJoiner.tsx) and [BlinkChallengeAccept.tsx](/d:/projects/Cora/apps/web/src/components/challenge/BlinkChallengeAccept.tsx) so the challenger sends its accepted transaction signature through the existing `confirmDeposit` websocket event after signing.

### The Reasoning
- `Rival Accepted` is a transient state, not a full page destination. The FE still needs the socket mounted to confirm creator presence, but the user should not feel trapped on an interstitial if the backend takes time to advance the room to `playing`.
- Challenger-side challenge details should match the lobby product framing: token arena plus fixed `$1.00` wager, not raw base-unit wording.
- Display should use player-facing token symbols instead of raw mint addresses; signing still needs the backend-provided mint value.
- The previous back button inherited light text against a light section, so the button needed local contrast styling instead of the generic dark-surface button class.
- Expired private rooms can disappear before the challenger reconnects, and retrying that socket cannot succeed. FE should surface that as a closed challenge and let the player leave cleanly.
- Reusing the shared button classes keeps the action row visually consistent, while local color overrides avoid the washed-out white-on-light button state.
- The previous creator flow stacked a notification and the recovery/confirming page because the background joiner wrote an active `depositing` match session. The new flow avoids that automatic write until the user intentionally opens the confirming screen.
- Current backend hydration marks both private-room players deposited, but `joinRoom` overwrites the joining player's `hasDeposited` flag back to `false`. Sending the challenger signature over the already-supported socket event is a frontend-side compatibility fix so both player metas become deposited and the room can transition to `playing`.

### The Tech Debt
- If the creator notification remains visible forever after `confirmDeposit`, FE has done its part and is waiting for the backend/socket to emit a `playing` game state or equivalent room-ready event. A dedicated private-challenge presence/ready event would make this transition easier to diagnose.
- Terminal socket-close detection is still based on close code/reason text. If the backend adds a structured close reason or REST status for accepted-but-expired rooms, switch to that instead of parsing text.
- Backend should preserve hydrated private-room `hasDeposited: true` metadata on websocket join instead of requiring FE to re-confirm the challenger deposit signature after `accept_challenge`.

## 2026-05-10 - Blink Character Gate Before Websocket Join

### The Change
- Added [BlinkCharacterGate.tsx](/d:/projects/Cora/apps/web/src/components/challenge/BlinkCharacterGate.tsx), a shared Blink-only post-deposit character selection surface built on the existing character roster component.
- Updated [LobbyScreen.tsx](/d:/projects/Cora/apps/web/src/components/lobby/LobbyScreen.tsx) so creator-side `View Challenge` opens character selection first, then mounts [BlinkRoomJoiner.tsx](/d:/projects/Cora/apps/web/src/components/challenge/BlinkRoomJoiner.tsx) only after `Confirm Scientist`.
- Updated [BlinkChallengeAccept.tsx](/d:/projects/Cora/apps/web/src/components/challenge/BlinkChallengeAccept.tsx) so challengers see the same character gate after accepting/signing the Blink challenge and before joining the websocket room.
- Passed the selected character ID into the existing `useMatchSocket` join URL via `BlinkRoomJoiner`, so the backend receives the picked scientist through the currently-supported `characterId` query parameter.
- Adjusted the challenger accept action row so `Back To Lobby` sits directly to the left of the right-aligned `Accept & Lock Wager` button.

### The Reasoning
- Backend does not currently expose a real post-deposit `selecting_character` phase or character-lock websocket event for Blink rooms.
- Delaying websocket join is the FE-only way to support `deposit -> select character -> play` without backend changes, because backend reads the character from the websocket join request before the engine initializes.
- This keeps normal matchmaking unchanged while giving Blink matches a scientist pick step instead of silently defaulting both players to Einstein.

### The Tech Debt
- If a user refreshes after accepting a Blink challenge but before joining, FE can only re-confirm through websocket if the accepted signature is still available in session storage. Backend preserving hydrated private-room deposit metadata would make this more robust.
- A proper backend character-lock phase would allow both players to connect first, show opponent selection state, enforce a timer, and auto-assign characters server-side.

## 2026-05-10 - Blink Character Gate CTA And Surrender Confirmation

### The Change
- Updated [BlinkCharacterGate.tsx](/d:/projects/Cora/apps/web/src/components/challenge/BlinkCharacterGate.tsx) so all scientist cards are neutral `Tap To Select` choices, with no Einstein `Balanced Default` label in the Blink post-deposit flow.
- Moved the Blink gate action row below the scientist roster so the page reads as `choose first, then confirm`.
- Replaced the gate `Back` action with `Surrender`, guarded by a confirmation popup that warns the wager is already locked.
- Added [BlinkSurrenderBridge.tsx](/d:/projects/Cora/apps/web/src/components/challenge/BlinkSurrenderBridge.tsx), a frontend-only bridge that connects to the existing match websocket, replays the stored deposit confirmation signature when available, sends the existing `surrender` event, and clears local match state.
- Wired creator-side surrender from [LobbyScreen.tsx](/d:/projects/Cora/apps/web/src/components/lobby/LobbyScreen.tsx) and challenger-side surrender from [BlinkChallengeAccept.tsx](/d:/projects/Cora/apps/web/src/components/challenge/BlinkChallengeAccept.tsx).

### The Reasoning
- After deposit, leaving is no longer a harmless navigation event. The UI should say `Surrender` and require confirmation because the backend treats that as forfeiting the locked wager.
- Blink still delays websocket join until after character selection, so surrender from the character gate needs a tiny temporary socket bridge rather than changing backend APIs.
- Removing the neutral default label prevents the Blink flow from nudging players back toward Einstein after we added explicit character selection.

### The Tech Debt
- The bridge currently treats successful websocket submission/terminal close as enough to clear local state, matching the existing active-match surrender behavior. A dedicated backend private-challenge surrender endpoint or acknowledgement event would make this more authoritative.

## 2026-05-10 - Blink Pre-Character Recovery Escape

### The Change
- Updated [BlinkChallengeAccept.tsx](/d:/projects/Cora/apps/web/src/components/challenge/BlinkChallengeAccept.tsx) so accepting a Blink challenge stores only the deposit signature before character selection, not a generic active match session.
- Added [clearActiveMatchRoomSession](/d:/projects/Cora/apps/web/src/lib/session/matchSession.ts) so FE can clear stale active-room localStorage without deleting the accepted Blink deposit signature from sessionStorage.
- Updated [LobbyScreen.tsx](/d:/projects/Cora/apps/web/src/components/lobby/LobbyScreen.tsx) so `private + depositing` active rooms are treated as Blink pre-character rooms instead of normal escrow-settlement recovery.
- Creator recovery now reopens the Blink accepted path when the active private room matches the locally stored Blink challenge.
- Challenger recovery now routes back to `/challenge/:roomId` so the player can pick a scientist and join through the Blink flow.
- Added a `Back To Lobby` escape button to the generic `Escrow resolver is settling` screen for stale local recovery cases.

### The Reasoning
- The previous challenger accept flow wrote `status: depositing` into the generic active-room store before the Blink websocket had joined. If the player hit browser back before choosing a scientist, lobby recovery interpreted that stale local marker as a normal match settlement and got stuck waiting.
- Blink pre-character state is not equivalent to normal ER settlement. It needs to return to the Blink challenge path, preserving the deposit signature so websocket `confirmDeposit` can still be replayed later.

### The Tech Debt
- This is still a frontend classification fix based on `roomType: private` and `status: depositing`. A backend-owned Blink room phase like `awaiting_character` would make recovery clearer and remove the need for FE inference.

## 2026-05-10 - Blink Character Gate Label Cleanup

### The Change
- Updated [BlinkCharacterGate.tsx](/d:/projects/Cora/apps/web/src/components/challenge/BlinkCharacterGate.tsx) to hide the reusable roster/status pills in the Blink post-deposit character picker.
- Restyled the `Surrender` button with the same readable light-panel secondary treatment used by `Back To Lobby` on the challenge accept page.

### The Reasoning
- The Blink page already has enough heading/subtitle context, so the extra `Roster` and `Pick your scientist to continue` pills were redundant visual noise.
- The shared secondary button style defaults to light text, which becomes unreadable on the cream Blink card without local color overrides.

### The Tech Debt
- These local button overrides should eventually become a named light-surface secondary button variant if more light-card flows need the same treatment.

## 2026-05-10 - Compact Blink Character Cards

### The Change
- Added a `compactCards` option to [CharacterSelect.tsx](/d:/projects/Cora/apps/web/src/components/character/CharacterSelect.tsx) and [CharacterCard.tsx](/d:/projects/Cora/apps/web/src/components/character/CharacterCard.tsx).
- Enabled compact cards in [BlinkCharacterGate.tsx](/d:/projects/Cora/apps/web/src/components/challenge/BlinkCharacterGate.tsx), reducing card min-height, portrait size, and the internal gap above each card CTA.
- Pulled the Blink gate action row closer to the roster.

### The Reasoning
- The shared character card uses `mt-auto` to create a roomy draft-card layout, but on the Blink cream panel that left too much empty vertical space between character details and `Tap To Select`.
- A prop keeps the tighter Blink treatment local instead of changing normal matchmaking character select.

### The Tech Debt
- If more compact selection surfaces appear, the card sizing should move from a boolean prop to a named density variant.

## 2026-05-10 - Blink Character Card Stretch Removal

### The Change
- Updated compact mode in [CharacterSelect.tsx](/d:/projects/Cora/apps/web/src/components/character/CharacterSelect.tsx) so Blink character cards no longer stretch vertically to fill the parent panel.
- Compact mode now removes the selector/grid `flex-1` stretch and aligns cards to the top of the grid.

### The Reasoning
- The remaining bottom gap was caused by the grid stretching each card row, not by internal card spacing.
- Blink character selection should be allowed to produce a shorter overall section instead of forcing draft cards to fill the available cream-panel height.

### The Tech Debt
- The compact layout is still a boolean mode. If the character selector accumulates more layout variants, replace it with explicit density/layout tokens.

## 2026-05-10 - Blink Character Panel Height Shrink

### The Change
- Updated [BlinkCharacterGate.tsx](/d:/projects/Cora/apps/web/src/components/challenge/BlinkCharacterGate.tsx) to remove the forced viewport-height minimum from the cream character selection panel.

### The Reasoning
- After compacting the character cards, the remaining lower gap came from the outer panel still being forced to nearly full screen height.
- The Blink character selection surface is allowed to be shorter overall, so the panel should wrap its content instead of reserving empty vertical space.

### The Tech Debt
- If we need more precise vertical rhythm across Blink pages, define shared panel sizing tokens instead of per-component height overrides.

## 2026-05-10 - Blink Character Gate Vertical Centering

### The Change
- Updated [BlinkCharacterGate.tsx](/d:/projects/Cora/apps/web/src/components/challenge/BlinkCharacterGate.tsx) so the full character selection section is vertically centered within the viewport instead of sitting at the top.

### The Reasoning
- Once the Blink panel height was reduced, the remaining layout issue was placement rather than size. The screen reads better when the compact cream panel is framed in the middle of the dark background.

### The Tech Debt
- If Blink gets more page states with different heights, it may be worth standardizing per-state vertical alignment rules instead of setting them one component at a time.

## 2026-05-10 - Blink Refresh And Surrender Recovery Corrections

### The Change
- Updated [LobbyScreen.tsx](/d:/projects/Cora/apps/web/src/components/lobby/LobbyScreen.tsx) so creator-side Blink status polling no longer demotes an in-progress room recovery back into the lower-priority notification state.
- Added presentation-aware Blink recovery in the lobby: creator-side private `depositing` rooms now resume directly into `Confirming your match...` when a scientist was already locked, otherwise they reopen character select.
- Prevented the floating `Rival Accepted` notification from stacking on top of the Blink character gate.
- Updated [BlinkChallengeAccept.tsx](/d:/projects/Cora/apps/web/src/components/challenge/BlinkChallengeAccept.tsx) so challenger-side resume only happens when real local accepted context still exists, using the stored deposit signature instead of only `opponentWallet` ownership.
- Added render-time recovery from the stored active match snapshot on the challenge page, so a challenger refresh after already locking a scientist resumes straight back into the joiner instead of dropping to character select.

### The Reasoning
- Two FE recovery rules were fighting each other. Lobby refresh recovery could correctly detect a creator still in a private `depositing` room, but the Blink status poll would immediately reopen the weaker notification state and kick the creator back out of the join flow.
- Challenger recovery was too optimistic: if the backend row still said the wallet had accepted the Blink, FE would reopen the character gate even after local surrender/cleanup had already cleared the real resume context.

### The Tech Debt
- FE still infers Blink recovery mode from a mix of local storage, websocket stage, and backend room/challenge status. A backend-owned private-room phase model would remove a lot of this recovery branching.

## 2026-05-11 - Challenger Post-Deposit Character Gate Unlock

### The Change
- Updated [BlinkChallengeAccept.tsx](/d:/projects/Cora/apps/web/src/components/challenge/BlinkChallengeAccept.tsx) so challenger-side character selection unlocks immediately after the local accept/deposit signature succeeds, without waiting for the challenge row to rehydrate `opponentWallet` first.

### The Reasoning
- The previous FE gate required both local accepted state and backend-refreshed `opponentWallet` ownership, which created a race: after deposit the challenger had already accepted locally, but the UI could still stay stuck on the accept screen until challenge polling caught up.

### The Tech Debt
- FE still depends on a mix of local accepted context and backend challenge status for progression. A dedicated backend Blink phase for `accepted_waiting_character` would make the transition less implicit.

## 2026-05-11 - Blink Share Link Cleanup After Backend Redirect

### The Change
- Updated [BlinkChallengePanel.tsx](/d:/projects/Cora/apps/web/src/components/challenge/BlinkChallengePanel.tsx) so the active Blink overlay now treats the Blink URL as the single canonical share link again.
- Removed the temporary browser-link warning copy and the secondary `Copy Browser Link` action from the Blink share card.

### The Reasoning
- Backend now redirects normal browser requests from the Blink URL to the challenge page, so FE no longer needs to present a separate browser fallback link in the primary share surface.
- Returning to one canonical link simplifies the creator UX and matches the original product intent.

### The Tech Debt
- `webChallengeUrl` still exists in the stored Blink session shape for compatibility with older FE state. If no other recovery flow needs it, that field can be retired in a later cleanup pass.

## 2026-05-11 - Creator Browser Notification For Blink Acceptance

### The Change
- Updated [LobbyScreen.tsx](/d:/projects/Cora/apps/web/src/components/lobby/LobbyScreen.tsx) so creator-side Blink flows now support two notification layers when a rival accepts:
- the existing in-lobby `Rival Accepted` notification card
- a browser notification fired once per accepted room when Notification permission is granted
- Blink challenge creation now requests browser notification permission opportunistically when supported and still in the browser’s `default` permission state.
- Clicking the browser notification focuses the tab and opens the creator challenge flow directly.

### The Reasoning
- Creator acceptance is exactly the kind of event that benefits from an OS/browser-level heads-up because the user may have tabbed away while waiting for a rival.
- Keeping the in-lobby notice as well preserves the immediate on-page affordance for users who are already in the app.

### The Tech Debt
- Permission is requested from the create-challenge flow, which is a reasonable user-gesture moment but still a lightweight implementation. If product wants more explicit notification UX later, this should become a dedicated opt-in setting.

## 2026-05-11 - Blink Creator Acceptance Banner Restyle

### The Change
- Updated the creator-side `Rival Accepted` in-lobby notification in [LobbyScreen.tsx](/d:/projects/Cora/apps/web/src/components/lobby/LobbyScreen.tsx) to use the same full-width top-banner styling family as the existing `You have an active match` banner.
- Kept the Blink creator flow passive at this stage: the banner is informational first, and `View Challenge` is still the explicit action that opens character select and confirmation.

### The Reasoning
- The smaller floating card made Blink acceptance feel like a side alert, while this state is important enough to deserve the same visual weight as other active-match recovery states.
- Matching the active-match banner style also reinforces the intended flow: notify first, then let the creator opt into the challenge confirmation path.

### The Tech Debt
- There are now multiple top-of-screen banner variants in the lobby. If more room states accumulate, these should likely converge on a shared banner component with variant props.

## 2026-05-11 - Blink Notification Permission Opt-In

### The Change
- Updated [LobbyScreen.tsx](/d:/projects/Cora/apps/web/src/components/lobby/LobbyScreen.tsx) to remove the automatic browser notification permission prompt from Blink challenge creation.
- Added explicit notification-permission state in the lobby and passed it into [BlinkChallengePanel.tsx](/d:/projects/Cora/apps/web/src/components/challenge/BlinkChallengePanel.tsx).
- Added an `Enable Notifications` button in the active Blink challenge panel so creators can opt in manually while waiting for a rival.

### The Reasoning
- Automatic browser permission prompts are noisy and easy to reject reflexively. This Blink flow benefits more from an explicit in-context opt-in where the user understands why the permission is being requested.
- The creator still gets both systems after opting in: the in-lobby `Rival Accepted` banner and the browser notification.

### The Tech Debt
- The panel currently only surfaces the explicit opt-in button while permission is still `default`. If product wants richer notification controls later, this should evolve into a fuller preference state rather than a one-shot prompt button.

## 2026-05-11 - Blink Notification Button Styling

### The Change
- Updated [BlinkChallengePanel.tsx](/d:/projects/Cora/apps/web/src/components/challenge/BlinkChallengePanel.tsx) so the `Enable Notifications` control uses the same small utility-button visual language as the Blink share actions.
- Moved the button below the helper copy instead of placing it inline beside the text.

### The Reasoning
- The notification permission action is a secondary utility control, not a primary CTA. Matching the smaller share-button styling keeps the panel hierarchy calmer.
- Stacking it below the explanation makes the copy easier to scan and avoids crowding the banner area.

### The Tech Debt
- The notification opt-in styling is now locally duplicated from the share-card utility buttons. If more small utility actions appear across Blink surfaces, extract a shared button variant.

## 2026-05-11 - Blink Share Card Identity Cleanup

### The Change
- Updated [ChallengeShareCard.tsx](/d:/projects/Cora/apps/web/src/components/challenge/ChallengeShareCard.tsx) to remove the fake player-profile block from the challenge card while still showing the wallet address.
- Updated [BlinkChallengePanel.tsx](/d:/projects/Cora/apps/web/src/components/challenge/BlinkChallengePanel.tsx) to replace the static `CORA Blink Challenge` headline with a deterministic per-room taunt line chosen from a small message set.
- Updated [renderChallengeCardJpg.ts](/d:/projects/Cora/apps/web/src/lib/challenge/renderChallengeCardJpg.ts) so exported JPGs match the new wallet-first, no-profile layout.
- Updated the existing post-match challenge-share flow in [BattleScreen.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx) and [BattleScreenOverlays.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreenOverlays.tsx) to match the shared card API cleanup.

### The Reasoning
- We do not currently have real player profile data in this flow, so showing a boxed initial and the label `You` makes the card feel fake.
- The wallet is still useful identity context, so it remains visible as the real anchor.
- A taunt headline gives the Blink share card more personality than static product branding while staying stable for the same room.

### The Tech Debt
- The taunt list is hardcoded locally in the Blink panel. If product wants broader brand voice control later, this should move into shared content/config.

## 2026-05-10 - Fix Blink challenge terminal-state loop

### The Change
- Updated [BlinkChallengeAccept.tsx](/d:/projects/Cora/apps/web/src/components/challenge/BlinkChallengeAccept.tsx) to detect terminal statuses (`FORFEITED`, `EXPIRED`, `COMPLETED`) and clear stale local session state (`cora:active-room`, `cora:active-deposit-intent`).
- Replaced the plain `<a>` tag for "Back To Lobby" in [BlinkChallengeAccept.tsx](/d:/projects/Cora/apps/web/src/components/challenge/BlinkChallengeAccept.tsx) with a button that explicitly clears local state before navigating.
- Updated [LobbyScreen.tsx](/d:/projects/Cora/apps/web/src/components/lobby/LobbyScreen.tsx) recovery logic to check for terminal match statuses and clear stale recovery state instead of redirecting the challenger back to the challenge page.
- Added a "Challenge Closed" UI state to [BlinkChallengeAccept.tsx](/d:/projects/Cora/apps/web/src/components/challenge/BlinkChallengeAccept.tsx) for terminal challenges.

### The Reasoning
- Challengers were getting stuck on the challenge accept screen or redirected back to it even after a challenge was forfeited or expired because the frontend wasn't consistently clearing local recovery state or checking the challenge status during lobby recovery.
- A plain link doesn't allow for the necessary side effects (clearing local storage) before navigation.

### The Tech Debt
- Terminal status strings are duplicated across `BlinkChallengeAccept.tsx` and `LobbyScreen.tsx`. These should eventually be centralized in a shared constants file or type definition.

## 2026-05-11 - Landing roster copy aligned with character specialties

**The Change:** Updated [apps/web/src/components/landing/content.ts](/d:/projects/Cora/apps/web/src/components/landing/content.ts) so the scientist names and copy match the real character definitions in `packages/shared-types/src/characterStats.ts`. Removed invented mechanics like shields, healing, named abilities, and attack-card amplification from the landing roster text.

**The Reasoning:** The shared character stats file is the gameplay source of truth. The landing page should still feel flavorful, but it should only describe supported concepts: specialty category, 1.5x specialty multiplier, and the existing extra-point stacking behavior.

**The Tech Debt:** `content.ts` still duplicates some character presentation data that could drift again later. A follow-up could derive more of this landing copy directly from shared character metadata or add a stricter content contract around allowed mechanic claims.

## 2026-05-11 - How-it-works stage markers use character expressions

**The Change:** Updated [apps/web/src/components/landing/HowItWorks.tsx](/d:/projects/Cora/apps/web/src/components/landing/HowItWorks.tsx) to replace the numeric and completed-state markers with character `happy` expression portraits. Steps 1-3 now use Turing, Curie, and Einstein, and step 4 renders a compact three-character triangle cluster. The stage card badge now mirrors the same active marker.

**The Reasoning:** Character portraits make the progression feel more connected to the roster and give the section a stronger in-world identity than generic numbers and checkmarks. Reusing the existing `happy` expression assets keeps the visual language consistent with other parts of the app.

**The Tech Debt:** The stage-to-character mapping is currently local to `HowItWorks.tsx`. If we want the landing flow to stay centrally configurable, that mapping should move into landing content metadata.

## 2026-05-11 - How-it-works rail restored to numeric active steps

**The Change:** Refined [apps/web/src/components/landing/HowItWorks.tsx](/d:/projects/Cora/apps/web/src/components/landing/HowItWorks.tsx) so the top progress rail now keeps numeric `1-4` markers for current and upcoming steps, and only completed steps swap to character portraits. The three-character triangle remains only inside the active stage card for step 4.

**The Reasoning:** This restores the clearer scan pattern from the original progress rail while still using character art as the visual reward for completed steps. It also avoids overloading the top rail with the step-4 triangle cluster.

**The Tech Debt:** The rail marker and card marker now have intentionally different behaviors. If we keep iterating on this section, it may be worth formalizing those two display modes behind a shared marker config instead of branching inline.

## 2026-05-11 - CTA floating cards use idle portraits

**The Change:** Updated [apps/web/src/components/landing/CtaBanner.tsx](/d:/projects/Cora/apps/web/src/components/landing/CtaBanner.tsx) so the floating character cards now render each scientist's `idle` expression asset instead of the emoji inside a circular badge. Removed the extra secondary emoji line, leaving each floating card as portrait plus name.

**The Reasoning:** The CTA section already leans on character presence, so using the real portrait assets makes the floating cards feel more integrated with the game world than decorative emoji. Removing the duplicate emoji also simplifies the composition and keeps the eye on the character art.

**The Tech Debt:** `CtaBanner.tsx` now has its own small asset helper for idle portraits. If more landing sections keep reusing the same expression asset paths, we should centralize those helpers in shared landing utilities.

## 2026-05-11 - CTA background reuses dim hero scene assets

**The Change:** Updated [apps/web/src/components/landing/CtaBanner.tsx](/d:/projects/Cora/apps/web/src/components/landing/CtaBanner.tsx) to reuse right-side landing hero art as a low-opacity CTA background layer. Added dimmed `bookcase_3` and `objects` scene assets behind the floating cards, and switched the floating portrait helper to the shared `getScientistIdleExpressionSrc` utility from `heroAssets.ts`.

**The Reasoning:** Reusing the landing hero scene keeps the CTA visually connected to the rest of the page without overpowering the call-to-action. Keeping the art right-aligned and very low opacity preserves contrast for the copy while adding texture to the dark section.

**The Tech Debt:** The CTA now chooses a subset of hero scene layers inline. If we keep reusing the landing environment in multiple sections, we may want a shared scene-fragment config instead of selecting individual asset files in each component.

## 2026-05-11 - CTA background composition rebalanced

**The Change:** Refined [apps/web/src/components/landing/CtaBanner.tsx](/d:/projects/Cora/apps/web/src/components/landing/CtaBanner.tsx) so `objects.png` now sits dimly on the left side of the CTA background, while `bookcase_3.png` is enlarged and anchored more prominently on the right.

**The Reasoning:** Separating the two layers gives the background a nicer spread and keeps the larger structural silhouette on the right where it can frame the floating cards without stacking every asset in the same zone.

**The Tech Debt:** The CTA background layout is now hand-tuned with percentage positioning. If we keep iterating on this scene treatment, it may be worth extracting these art-direction values into named constants or shared landing scene presets.

## 2026-05-11 - CTA objects moved to far-left corner

**The Change:** Refined [apps/web/src/components/landing/CtaBanner.tsx](/d:/projects/Cora/apps/web/src/components/landing/CtaBanner.tsx) so `objects.png` now sits at the far-left bottom corner of the full CTA banner, on the green gradient itself, instead of inside the right-side hero-scene wrapper.

**The Reasoning:** This better matches the intended composition: the objects act as a subtle counterweight on the opposite edge of the section, while the bookcase remains the dominant right-side backdrop.

**The Tech Debt:** The left-corner placement is still tuned with section-relative percentages. If this CTA gets more responsive art direction later, these placements may need breakpoint-specific presets instead of one shared value set.

## 2026-05-11 - CTA right-side objects enlarged

**The Change:** Refined [apps/web/src/components/landing/CtaBanner.tsx](/d:/projects/Cora/apps/web/src/components/landing/CtaBanner.tsx) so the larger `objects.png` layer now lives on the right side of the CTA again, while keeping the bigger footprint from the previous size adjustment. The bookcase remains the primary right-edge backdrop behind it.

**The Reasoning:** This keeps the stronger object scale that read well, while aligning the composition with the preferred direction of concentrating the scene dressing on the right rather than splitting it across the banner.

**The Tech Debt:** The right-side object and bookcase layers now overlap through hand-tuned percentages. If we keep polishing this art direction, it may be worth extracting a shared CTA scene layout config instead of adjusting individual absolute positions inline.

## 2026-05-11 - CTA right-side objects scaled up further

**The Change:** Increased the size of the right-side `objects.png` layer in [apps/web/src/components/landing/CtaBanner.tsx](/d:/projects/Cora/apps/web/src/components/landing/CtaBanner.tsx) again by expanding its width, height, minimum width, and responsive image sizing.

**The Reasoning:** The previous right-side version had the correct placement but still read a little too quietly. Scaling it further makes the scene layer more legible without changing the overall CTA structure.

**The Tech Debt:** The object scale is still managed with manual percentages and minimum widths. If we continue tuning this art direction, a shared set of responsive scene tokens would be easier to maintain than repeated inline values.

## 2026-05-11 - Blink Share Card Layout + Copy Refresh

### The Change
- Refactored [ChallengeShareCard.tsx](/d:/projects/Cora/apps/web/src/components/challenge/ChallengeShareCard.tsx) so the generated card surface is separated from the share-action buttons and helper/link text.
- Updated [BlinkChallengePanel.tsx](/d:/projects/Cora/apps/web/src/components/challenge/BlinkChallengePanel.tsx) to move the browser-support sentence above the share card, use the fixed lobby headline `Do you think you can beat me?`, and reuse the selected scientist expression plus low-opacity landing `objects.png` art in both the panel and the JPG export.
- Updated [renderChallengeCardJpg.ts](/d:/projects/Cora/apps/web/src/lib/challenge/renderChallengeCardJpg.ts) so exported Blink/share JPGs match the new card composition with a portrait block, cleaner title alignment, and subtle hero-scene texture.
- Updated [BattleScreen.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx) and [BattleScreenOverlays.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreenOverlays.tsx) so post-match Blink share cards now use result-aware copy (`I just won against ...` / rematch fallback) and reuse the player scientist expression artwork.

### The Reasoning
- The helper sentence about browser/app support is UI guidance, not part of the share artifact, so it belongs outside the generated card.
- Separating the pure card from the controls keeps the on-screen layout closer to the exported JPG and gives the share surface cleaner hierarchy.
- Reusing existing landing assets and character expression art makes the Blink card feel grounded in the same visual world instead of reading like a plain utilitarian export.

### The Tech Debt
- Share-card art direction is still assembled inline from asset paths (`objects.png` and character expression routes). If more share surfaces or variants appear, this should move into a shared share-card theme/config layer.
- The post-match share title now has a win/rematch split, but the copy rules are still local to `BattleScreen.tsx`. If product iterates more on social/share tone, centralize the messaging.

## 2026-05-11 - Share Match Flow + Explicit Blink Confirmation

### The Change
- Added [createBlinkChallengeSession.ts](/d:/projects/Cora/apps/web/src/lib/challenge/createBlinkChallengeSession.ts) to centralize the FE-only private Blink creation flow (create room, sign funding tx, confirm room, normalize session snapshot).
- Updated [LobbyScreen.tsx](/d:/projects/Cora/apps/web/src/components/lobby/LobbyScreen.tsx) so `Create Blink Challenge` no longer opens Phantom immediately. It now opens an explicit confirmation modal showing arena, wager, and current scientist before the wallet step.
- Added [MatchResultShareCard.tsx](/d:/projects/Cora/apps/web/src/components/play/MatchResultShareCard.tsx) and [renderMatchResultCardPng.ts](/d:/projects/Cora/apps/web/src/lib/challenge/renderMatchResultCardPng.ts) for the new finished-match poster flow.
- Updated [BattleScreen.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx) and [BattleScreenOverlays.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreenOverlays.tsx) so the result overlay button is now `Share Match`, opening a modal with:
  - regular result-poster PNG export
  - Blink rematch creation with the same explicit confirmation step before Phantom
  - post-create Blink sharing using the canonical Blink URL
- Updated finished-match copy so win and loss share titles now use:
  - `I just won against ...`
  - `Matched against ... but this is not the end.`

### The Reasoning
- Opening Phantom as the very first response to a button click felt abrupt and confusing in both the lobby and result flow. The confirmation layer makes the wallet step feel intentional.
- Splitting result sharing into a regular poster path and a Blink rematch path keeps the finished overlay easier to understand than forcing everything through one Blink-specific action.
- Centralizing Blink creation logic reduces the chance of lobby and post-match flows drifting apart in behavior.

### The Tech Debt
- The lobby and result confirmation modals currently share behavior but not a shared component yet. If we keep iterating on Blink confirmations, extract a reusable confirm surface.
- The result poster PNG renderer is separate from the on-screen React card and could visually drift over time if one is edited without the other.

## 2026-05-11 - Hero hover parallax smoothed

**The Change:** Refined the hover motion in [apps/web/src/components/landing/Hero.tsx](/d:/projects/Cora/apps/web/src/components/landing/Hero.tsx) by softening the pointer-response curve around center, reducing vertical drift, and slowing the spring slightly for a smoother settle.

**The Reasoning:** The original hover reacted a bit too linearly and felt twitchy near the resting position. Adding a gentler center response keeps the parallax alive while making the scene feel more intentional and less awkward.

**The Tech Debt:** The hover feel is still tuned with inline motion constants. If we keep iterating on landing interactions, we may want shared motion tokens for parallax intensity and spring behavior.

## 2026-05-11 - Hero scene lighting added

**The Change:** Added two non-interactive lighting overlays in [apps/web/src/components/landing/Hero.tsx](/d:/projects/Cora/apps/web/src/components/landing/Hero.tsx): a soft warm radial highlight through the middle-upper scene and a subtle dimming/vignette gradient above the interactive layers.

**The Reasoning:** The hero art had good structure but still read a little flat overall. Layering a restrained highlight and shadow pass gives the composition more depth and focus without changing the existing artwork or layout.

**The Tech Debt:** The lighting balance is still hard-coded in inline gradient values. If we keep art-directing the landing hero, those values may be better expressed as named scene tokens so they are easier to tune together.

## 2026-05-11 - Hero hover parallax amplified

**The Change:** Removed the pointer-following glow experiment from [apps/web/src/components/landing/Hero.tsx](/d:/projects/Cora/apps/web/src/components/landing/Hero.tsx) and increased the existing hover parallax by expanding the transform range and tightening the spring response.

**The Reasoning:** The glow was the wrong direction for the interaction, and the previous parallax pass still felt too restrained. Pushing the layer travel further while keeping the eased response makes the hover read more clearly without changing the scene composition.

**The Tech Debt:** The stronger hover still depends on hand-tuned transform multipliers and spring values. If we keep iterating on hero motion, these interaction settings would be easier to maintain as shared landing motion tokens.

## 2026-05-11 - Share Match Blink Flow Simplified

### The Change
- Updated [BattleScreenOverlays.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreenOverlays.tsx) so the result modal no longer detours through a separate Blink confirmation popup.
- The `Create Blink` action now starts directly from the first share modal, locks while busy, and shows an inline `Opening Phantom...` status chip modeled after [OpponentFound.tsx](/d:/projects/Cora/apps/web/src/components/lobby/OpponentFound.tsx).
- Updated [MatchResultShareCard.tsx](/d:/projects/Cora/apps/web/src/components/play/MatchResultShareCard.tsx) so the win/loss headline is slightly smaller and can span the card width instead of being constrained to a narrow column.

### The Reasoning
- The extra confirmation layer added friction without adding much clarity in the post-match flow, especially since opening `Share Match` is already an intentional action.
- Keeping the user on the same modal while Phantom opens gives better continuity and makes the wallet handoff feel less abrupt.
- Letting the headline run wider makes longer result copy feel more like a poster headline and less like a cramped text block.

### The Tech Debt
- The Phantom loading pill styling is still duplicated between lobby and battle flows. If we reuse it again, it should become a shared status primitive.
- The result-card React layout changed, but the exported poster renderer should stay in sync if we continue iterating on the headline art direction.

## 2026-05-11 - Blink Popup Close Button Restyled

### The Change
- Updated the share/Blink modal close button in [BattleScreenOverlays.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreenOverlays.tsx) to use the same `btn-game btn-game-secondary` visual treatment and border/shadow color styling as the `Back To Lobby` button in [BlinkChallengeAccept.tsx](/d:/projects/Cora/apps/web/src/components/challenge/BlinkChallengeAccept.tsx).

### The Reasoning
- The tiny frame-cut close control looked visually disconnected from the rest of the Blink flow. Matching the established secondary CTA style makes the popup feel more intentional and consistent.

### The Tech Debt
- This style is still copied inline between components. If more Blink/lobby controls need to share this exact variant, it should become a named button preset or shared wrapper.

## 2026-05-11 - Blink Confirm Cancel Button Corrected

### The Change
- Reverted the top-right share modal `Close` control in [BattleScreenOverlays.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreenOverlays.tsx) back to its compact frame-cut styling.
- Updated the `Cancel` button inside the `Create Blink challenge?` confirmation popup in [LobbyScreen.tsx](/d:/projects/Cora/apps/web/src/components/lobby/LobbyScreen.tsx) to match the `Back To Lobby` secondary button styling from [BlinkChallengeAccept.tsx](/d:/projects/Cora/apps/web/src/components/challenge/BlinkChallengeAccept.tsx).

### The Reasoning
- The styling request applied to the confirmation popup action, not the modal chrome. Keeping the small corner close button and upgrading the popup’s main cancel CTA preserves hierarchy while matching the intended Blink pattern.

### The Tech Debt
- The same secondary button colors and shadow are now repeated again across Blink-related surfaces. If this remains the preferred pattern, it should be promoted into a shared variant.

## 2026-05-11 - Blink Card Portrait Removed

### The Change
- Updated [ChallengeShareCard.tsx](/d:/projects/Cora/apps/web/src/components/challenge/ChallengeShareCard.tsx) to support hiding the character portrait block while keeping the rest of the card layout intact.
- Updated [BlinkChallengePanel.tsx](/d:/projects/Cora/apps/web/src/components/challenge/BlinkChallengePanel.tsx) so the `Do you think you can beat me?` Blink card no longer renders the character square.
- Updated [renderChallengeCardJpg.ts](/d:/projects/Cora/apps/web/src/lib/challenge/renderChallengeCardJpg.ts) so saved JPG exports from that Blink panel also omit the portrait and rebalance the text block width.

### The Reasoning
- The portrait square was adding visual weight without adding much value on this specific Blink card. Removing it gives the headline and challenge metadata more room and makes the composition cleaner.

### The Tech Debt
- The shared challenge-card component now has a mode switch for portrait visibility. If more layout variants appear, we may want a more explicit variant API instead of accumulating booleans.

## 2026-05-11 - Challenge Card Object Overlay Removed

### The Change
- Removed the decorative `objects.png` overlay from the shared Blink/challenge card in [ChallengeShareCard.tsx](/d:/projects/Cora/apps/web/src/components/challenge/ChallengeShareCard.tsx).
- Removed the same overlay from JPG exports in [renderChallengeCardJpg.ts](/d:/projects/Cora/apps/web/src/lib/challenge/renderChallengeCardJpg.ts).
- Cleared the now-unused overlay prop plumbing from [BlinkChallengePanel.tsx](/d:/projects/Cora/apps/web/src/components/challenge/BlinkChallengePanel.tsx), [BattleScreenOverlays.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreenOverlays.tsx), and [BattleScreen.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx).

### The Reasoning
- The overlay was adding visual noise and competing with the headline/content on the card. Removing it keeps the card cleaner and more focused.

### The Tech Debt
- The share-card presentation is still controlled by a handful of optional layout switches. If we keep iterating on multiple card looks, a small variant system would be cleaner than continuing to trim props ad hoc.

## 2026-05-11 - Wallet Pill + JPG Layout Sync

### The Change
- Updated [ChallengeShareCard.tsx](/d:/projects/Cora/apps/web/src/components/challenge/ChallengeShareCard.tsx) so the shortened wallet address now sits inside the same pill as the `WALLET` label instead of rendering as a separate line underneath.
- Updated [renderChallengeCardJpg.ts](/d:/projects/Cora/apps/web/src/lib/challenge/renderChallengeCardJpg.ts) so the exported challenge JPG matches the revised layout:
  - dynamic title line counting
  - a deeper no-portrait title allowance
  - wallet address rendered inside the wallet pill
  - follow-on spacing derived from the title height rather than fixed old coordinates

### The Reasoning
- The split wallet treatment made the card feel unfinished and visually disconnected. Keeping the label and value in one pill reads more like a single metadata chip.
- The JPG renderer was still following the earlier fixed layout assumptions, which is why the save/export version broke after the card composition changed.

### The Tech Debt
- The on-screen card and JPG renderer are closer again, but they still duplicate layout logic in two places. If we keep iterating on these share cards, we should consider a shared layout config to reduce drift.

## 2026-05-11 - JPG No-Portrait Layout Tightened

### The Change
- Refined the no-portrait Blink JPG export in [renderChallengeCardJpg.ts](/d:/projects/Cora/apps/web/src/lib/challenge/renderChallengeCardJpg.ts) by narrowing the title text width, slightly reducing the headline size/line spacing, and fitting the right-column metric values before drawing.

### The Reasoning
- The export was still reading like the older wide layout after the portrait removal, which made the headline and stat column feel off compared with the on-screen card. Tightening those constraints brings the saved JPG back toward the intended composition.

### The Tech Debt
- The JPG renderer still relies on hand-tuned pixel geometry for each variant. If we keep adjusting these cards, we should centralize the layout constants instead of retuning them inline.

## 2026-05-11 - Challenge JPG Alignment Corrections

### The Change
- Updated [renderChallengeCardJpg.ts](/d:/projects/Cora/apps/web/src/lib/challenge/renderChallengeCardJpg.ts) so portrait-mode text only uses the shifted `textStartX` when the portrait image actually loads successfully.
- Increased the portrait-mode title wrapping allowance to three lines and tuned line spacing so `Do you think you can beat me!` no longer truncates prematurely.
- Standardized pill text baseline handling with `middle` alignment for the status and wallet pills, then reset back to `alphabetic` after the pill block.
- Right-aligned the metric values inside the `TOKEN` / `WAGER` / `ARENA` boxes using the box geometry instead of a hardcoded absolute x position.

### The Reasoning
- The renderer was still mixing older fixed offsets with newer layout variants, which caused the title, wallet pill, and right-side metrics to drift out of alignment in exported JPGs.

### The Tech Debt
- The export renderer now has more explicit alignment state management (`textBaseline` / `textAlign` resets), but it is still a hand-built canvas layout. A shared layout abstraction would make future visual changes less fragile.

## 2026-05-11 - Landing navbar brand replaced with logo image

### The Change
- Updated [Navbar.tsx](/d:/projects/Cora/apps/web/src/components/landing/Navbar.tsx) so the landing-page brand now renders only [landscape_white.png](/d:/projects/Cora/apps/web/public/assets/logo/landscape_white.png) via `next/image`.
- Removed the old boxed `C` mark and separate `CORA` wordmark text from the navbar brand link.

### The Reasoning
- The user added a finished horizontal logo asset and wanted the navbar to use that single brand image instead of the previous temporary badge-plus-text treatment.
- Rendering the full mark directly keeps the header closer to the intended brand presentation and avoids duplicating branding with separate icon/text elements.

### The Tech Debt
- The navbar logo height is currently tuned inline for the existing header spacing. If the final brand system introduces alternate marks or breakpoint-specific lockups, this sizing may need to move into shared brand constants.

## 2026-05-11 - Browser tab icon replaced with rounded brand icon

### The Change
- Added [icon.png](/d:/projects/Cora/apps/web/src/app/icon.png) as the app router browser icon asset, generated from [apps/web/public/assets/logo/icon.png](/d:/projects/Cora/apps/web/public/assets/logo/icon.png).
- Applied rounded corners directly into the generated PNG so the browser tab icon displays with softened corners instead of a sharp square.

### The Reasoning
- The project was still falling back to the default browser icon path, so adding an app-level `icon.png` gives Next.js a brand-specific tab icon source.
- Favicons cannot be styled with CSS `border-radius`, so the corner radius needed to be baked into the image itself.

### The Tech Debt
- [favicon.ico](/d:/projects/Cora/apps/web/src/app/favicon.ico) still exists alongside the new PNG icon, which can make browser caching behavior harder to reason about during local verification.
- The rounded icon asset is currently a generated derivative with fixed radius values. If brand guidelines change, it would be better to standardize favicon exports from a documented source asset pipeline.

## 2026-05-12 - Battle hand cards switched to illustration art

### The Change
- Updated [BattleScreen.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx) so playable hand cards now render the new [heal.png](/d:/projects/Cora/apps/web/public/assets/cards/heal.png) and [attack.png](/d:/projects/Cora/apps/web/public/assets/cards/attack.png) assets directly inside the existing card shell.
- Removed the overlaid `Heal` / `Attack` label chip and the centered `?` glyph from real cards so no text sits on top of the illustration art.

### The Reasoning
- The new card backs already communicate the card type visually, so keeping text on top would fight the artwork and make the cards feel busier than intended.
- Reusing the existing card button shell preserved current selection, hover, disabled, and spacing behavior while letting the illustrations become the visible card face.

### The Tech Debt
- The battle screen now maps card types directly to local art paths. If more card types or variants are introduced later, this should move into a shared card-asset config instead of growing inline in the screen component.
- Placeholder empty slots still use the older generic card shell treatment. If the hand UI gets a broader visual pass, those placeholders may need a matching empty-state design.

## 2026-05-12 - Lobby hero copy readability increased

### The Change
- Updated [LobbySetup.tsx](/d:/projects/Cora/apps/web/src/components/lobby/LobbySetup.tsx) to add stronger text-shadow styling to the `Pre-Match Lobby`, `Choose Your Arena`, and `Selected: ...` copy in the arena selection hero block.

### The Reasoning
- Those lines sit over atmospheric background art and gradients, so the previous light shadow treatment could get washed out depending on the selected arena and viewport. Giving the title and supporting copy slightly stronger shadows improves readability without changing the typography itself.

### The Tech Debt
- The shadow values are still inline on individual text elements. If more lobby/hero copy needs the same treatment, it would be cleaner to promote these to shared utility classes or named text styles.

## 2026-05-12 - Battle card type backgrounds color-matched

### The Change
- Updated [BattleScreen.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx) so illustrated hand cards now use `#738b6c` as the heal card background and `#8a5633` as the attack card background.

### The Reasoning
- Even with dedicated card art, giving each card type a distinct shell color makes heal and attack easier to differentiate at a glance and helps the illustration feel grounded in a matching frame.

### The Tech Debt
- These card colors are still defined locally in the battle screen. If card visuals continue to evolve, the type-to-color mapping should likely live beside shared card asset/config data rather than staying inline in the screen component.

## 2026-05-12 - Arena background refresh unblocked

### The Change
- Updated [LobbySetup.tsx](/d:/projects/Cora/apps/web/src/components/lobby/LobbySetup.tsx) so the lobby arena backgrounds now request `null.png`, `sol.png`, `bonk.png`, and `mew.png` with a versioned query suffix.
- Updated [BattleScreen.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx) so in-match arena backgrounds also use versioned arena asset URLs and now include the missing `mew` image mapping.

### The Reasoning
- The arena images were being loaded from stable public paths, so replacing the files at the same URLs could leave the old artwork visible due to browser caching.
- The battle screen also only handled `sol` and `bonk`, which meant `mew` could never resolve to its own background there.

### The Tech Debt
- The cache-busting suffix is a manual version string in each component. If arena art changes frequently, this should move into a shared asset-version helper or a more centralized asset manifest to avoid drift.

## 2026-05-12 - Battle arena image query-string rollback

### The Change
- Updated [BattleScreen.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx) to remove the arena-image query-string suffix from the in-match `<Image>` sources while keeping the `mew` arena mapping.

### The Reasoning
- The battle scene uses Next.js `<Image>`, and local image URLs with a search string were rejected by the current image configuration (`images.localPatterns`), causing a runtime error. The lobby cache-busting fix was still valid because that surface uses CSS `background-image` rather than `<Image>`.

### The Tech Debt
- Arena cache-busting is now handled differently in lobby and battle surfaces. If we want consistent asset-refresh behavior across both, we should either update Next image config to allow these local query strings or centralize arena rendering around one approach.

## 2026-05-12 - Battle card-pick prompt restyled

### The Change
- Updated [BattleScreen.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx) so the `Pick a card from your hand.` helper now renders as a centered pill-style HUD prompt during the playable card-selection state.

### The Reasoning
- The previous plain helper line was functionally clear but visually weak compared with the rest of the battle interface. Promoting the card-pick state into a styled prompt makes the next action easier to notice and keeps the HUD feeling more intentional.

### The Tech Debt
- The prompt styling is currently embedded inline in the battle screen and branches on UI state locally. If more battle helper prompts get richer treatments, this should likely become a shared battle status/prompt primitive instead of growing ad hoc.

## 2026-05-12 - Battle prompt spacing relaxed

### The Change
- Updated [BattleScreen.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx) to add a little more bottom margin under the card-pick prompt above the hand row.

### The Reasoning
- After styling the prompt as a pill, the spacing underneath felt a bit tight against the cards. A small margin increase gives the prompt room to breathe and keeps the lower HUD from feeling cramped.

### The Tech Debt
- Prompt spacing is still tuned inline in the battle screen. If this HUD keeps evolving, vertical rhythm values should probably be normalized into shared spacing tokens or a small battle layout config.

## 2026-05-12 - Battle hand cards given hover motion

### The Change
- Updated [BattleScreen.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx) so enabled hand cards now animate upward slightly and scale up a touch on hover.

### The Reasoning
- The battle hand already had a strong visual layout, but the cards still felt a bit static. A small hover lift makes the cards read as interactive choices without disrupting the fanned composition or the active-card state.

### The Tech Debt
- The hover motion is still authored inline on the button class list. If the hand interaction language keeps growing, it may be worth extracting a shared card-interaction style so hover, active, and disabled motion stay coordinated.

## 2026-05-12 - Battle arena background scaled down

### The Change
- Updated [BattleScreen.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx) so the in-match arena background now uses a scaled-down `object-contain` presentation instead of the previous `object-cover` fill behavior.

### The Reasoning
- The arena layer was effectively zoomed in by the cover behavior, which cropped too much of the refreshed art. Scaling it down lets more of the arena illustration read inside the battle scene.

### The Tech Debt
- Arena framing is still hand-tuned in the battle screen. Different arena images may eventually want slightly different crop/scale behavior, so a per-arena presentation config may be cleaner than one shared value.

## 2026-05-12 - Battle arena background widened with mirrored side fills

### The Change
- Updated [BattleScreen.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx) so the in-match arena backdrop now renders as three copies of the arena art: a centered original plus mirrored left and right side fills.

### The Reasoning
- The previous scaled-down single image showed more of the art, but it left too much empty width. Using mirrored side fills lets the arena span from left to right while preserving a more readable center composition than the original cropped cover treatment.

### The Tech Debt
- The three-panel arena spread is still tuned with hardcoded widths and offsets inside the battle screen. If arena backdrops keep evolving, those composition values should move into shared presentation config and may need per-arena tuning.

## 2026-05-12 - Battle arena triptych vertically aligned

### The Change
- Updated [BattleScreen.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx) so the three arena background copies now render inside one shared centered row with the same height, keeping the left, center, and right images aligned vertically.

### The Reasoning
- The earlier mirrored side-fill version used separate absolute boxes, which let the three copies drift visually even though they shared the same source art. Anchoring them to one common alignment container keeps the triptych reading as one intentional spread.

### The Tech Debt
- The arena triptych is still manually composed with hardcoded widths and overlap offsets. If we keep iterating on this scene treatment, those values should move into a shared arena presentation config and may still need per-arena tuning.

## 2026-05-12 - Battle screen switched to wide arena assets

### The Change
- Updated [BattleScreen.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx) so the in-match arena backdrop now uses `sol_wide.png`, `bonk_wide.png`, and `mew_wide.png`.
- Removed the temporary mirrored triptych treatment and returned the battle backdrop to a single full-scene arena image.

### The Reasoning
- The new `3840x1080` wide arena assets are specifically shaped for the battle scene, so the earlier workaround of duplicating the original arena art across three panels is no longer needed.
- Keeping the lobby on the original arena assets while switching only the battle screen to the wide variants matches the intended separation of responsibilities between those two surfaces.

### The Tech Debt
- Battle and lobby now intentionally use different arena asset variants. If arena art direction keeps evolving, we may want a shared arena asset manifest so each surface can declare which variant it uses without hardcoding filenames inline.

## 2026-05-12 - Lobby hero text shadow strengthened

### The Change
- Updated [LobbySetup.tsx](/d:/projects/Cora/apps/web/src/components/lobby/LobbySetup.tsx) to strengthen the text-shadow treatment on `Pre-Match Lobby`, `Choose Your Arena`, and the supporting `Pick SOL, BONK, or MEW, lock the wager, then draft your scientist.` line.

### The Reasoning
- The earlier shadow pass was still too subtle against the updated arena art, especially on the fallback supporting sentence. Increasing the shadow depth makes the hero copy more readable without changing the copy, layout, or color palette.

### The Tech Debt
- These shadow values are still hand-tuned inline on each text element. If the lobby hero continues evolving, it would be cleaner to centralize this as a shared text treatment rather than repeating literal shadow values.

## 2026-05-12 - Lobby hero text shadow increased again

### The Change
- Updated [LobbySetup.tsx](/d:/projects/Cora/apps/web/src/components/lobby/LobbySetup.tsx) to deepen the text-shadow values again on the same lobby hero copy stack for stronger separation from the background art.

### The Reasoning
- After the first shadow pass, the copy was still getting lost in brighter areas of the arena image. Increasing both blur and opacity gives the text a firmer silhouette without adding a visible backing panel.

### The Tech Debt
- The lobby hero readability fix is still being tuned by stacking stronger inline shadow values. If this area keeps needing adjustment, a dedicated backdrop treatment or reusable text style may be more maintainable than continuing to deepen shadows manually.

## 2026-05-12 - MEW selected coin background matched to card gradient

### The Change
- Updated [LobbySetup.tsx](/d:/projects/Cora/apps/web/src/components/lobby/LobbySetup.tsx) so the MEW coin/circle uses the same selected-state gradient as the MEW selected card background, instead of always using the preview background.

### The Reasoning
- BONK already reads more cohesive because its selected coin treatment feels visually tied to its selected card surface. Matching the MEW coin to the same selected gradient gives that option the same unified feel.

### The Tech Debt
- Selected-state gradients are still repeated inline between the card shell and inner coin treatment. If more arena-specific styling tweaks appear, these values should probably live in shared arena presentation data rather than being duplicated in component logic.

## 2026-05-12 - SOL arena icon shifted to green tones

### The Change
- Updated [LobbySetup.tsx](/d:/projects/Cora/apps/web/src/components/lobby/LobbySetup.tsx) so the SOL arena SVG now uses dedicated green-toned colors for both its default and selected states instead of inheriting the browner shared fallback.

### The Reasoning
- The previous shared icon color made SOL read too close to the warmer BONK palette. Giving SOL its own green treatment better matches the arena identity and keeps the token options more distinct at a glance.

### The Tech Debt
- Arena icon colors are still partly hardcoded inside `ArenaIcon`. If we keep refining per-arena visual identity, these colors should likely move into shared arena presentation data alongside the other token-specific styling values.

## 2026-05-12 - Challenge JPG QR and stat rows re-centered

### The Change
- Updated [renderChallengeCardJpg.ts](/d:/projects/Cora/apps/web/src/lib/challenge/renderChallengeCardJpg.ts) so the QR image is centered properly inside its right-column frame.
- Updated the exported `TOKEN`, `WAGER`, and `ARENA` rows so both labels and values are vertically centered within each stat box instead of reading top-heavy.

### The Reasoning
- The exported challenge/share JPG had a visibly low QR placement and the right-column stat text was sitting too high inside the boxes. Centering those elements makes the right rail feel more intentional and visually balanced.

### The Tech Debt
- The challenge JPG layout is still hand-positioned with explicit pixel geometry. If we keep art-directing this export surface, it would be safer to move repeated box/frame alignment rules into shared layout constants rather than adjusting raw coordinates ad hoc.

## 2026-05-12 - Match result share card copy simplified and address lines added

### The Change
- Updated [BattleScreen.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx) so the regular after-match share title is now the fixed line `I just won in a CORA match`.
- Updated [BattleScreenOverlays.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreenOverlays.tsx), [MatchResultShareCard.tsx](/d:/projects/Cora/apps/web/src/components/play/MatchResultShareCard.tsx), and [renderMatchResultCardPng.ts](/d:/projects/Cora/apps/web/src/lib/challenge/renderMatchResultCardPng.ts) so player and rival wallet address labels render under each scientist name in both the on-screen share card and exported PNG.

### The Reasoning
- The previous title was too dependent on the rival address and made the headline read noisy. A fixed match-win line keeps the title cleaner, while moving addresses into the scientist panels preserves the identity/context in a more structured place.

### The Tech Debt
- The match result share card now carries separate name and address lines in two rendering paths (React and canvas). If this layout keeps evolving, shared card-layout config would reduce the risk of those two versions drifting apart.

## 2026-05-12 - Match result title allowed to span wider

### The Change
- Updated [MatchResultShareCard.tsx](/d:/projects/Cora/apps/web/src/components/play/MatchResultShareCard.tsx) and [renderMatchResultCardPng.ts](/d:/projects/Cora/apps/web/src/lib/challenge/renderMatchResultCardPng.ts) so the after-match title can span farther to the right before wrapping.

### The Reasoning
- The fixed headline copy was short enough to use more horizontal space, but the export renderer was still wrapping it too early because of an overly narrow title width. Widening that title region keeps the headline cleaner and better balanced over the two portrait cards.

### The Tech Debt
- The match result title sizing and wrap width are still hand-tuned separately in React and canvas. If we keep adjusting this poster layout, shared typography/layout constants would make those two paths easier to keep in sync.

## 2026-05-12 - Share modal close button moved into top-right chrome

### The Change
- Updated [BattleScreenOverlays.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreenOverlays.tsx) so the share modal `Close` button now sits inset at the top-right corner of the modal container.

### The Reasoning
- The previous position was technically absolute, but it visually read as floating too close to the outer edge and disconnected from the modal surface. Moving it inward makes it feel like part of the modal chrome instead of a stray badge.

### The Tech Debt
- The close control still uses hand-tuned absolute offsets tied to the current modal padding. If the share modal layout changes significantly later, those offsets may need to be normalized with a shared modal header/chrome pattern.

## 2026-05-12 - Share modal close button moved above card edge

### The Change
- Updated [BattleScreenOverlays.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreenOverlays.tsx) so the share modal `Close` button now sits above the card and aligns to the modal content block’s top-right edge.

### The Reasoning
- The previous top-right change still placed the button inside the card region, which was not the intended chrome position. Offsetting it upward while keeping it right-aligned makes it read as a true close control for the card stack.

### The Tech Debt
- The button position still depends on absolute offsets and transform-based placement relative to the current share modal wrapper. If this share surface gets a more formal header or top action row later, the close control should move into that structure instead of staying free-positioned.

## 2026-05-12 - Share modal close button switched to top-right row layout

### The Change
- Updated [BattleScreenOverlays.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreenOverlays.tsx) so the share modal `Close` button now lives in a dedicated flex row above the card content and is right-aligned there.

### The Reasoning
- The absolute-position approach still produced an incorrect visual placement. Using a normal top row with `justify-end` is simpler and more reliable for keeping the control actually at the top-right above the card.

### The Tech Debt
- The close button now sits in flow above the share content, which is more stable, but the share surface still lacks a formal reusable modal header pattern. If more controls appear up there later, it may be worth turning that top row into a shared modal chrome component.

## 2026-05-12 - Share modal helper copy removed from header

### The Change
- Updated [BattleScreenOverlays.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreenOverlays.tsx) to remove the helper sentences above the share cards, leaving only the right-aligned `Close` button in the header row.

### The Reasoning
- The helper copy was competing with the poster itself and making the header area feel busier than necessary. Keeping only the close control gives the share modal a cleaner top edge and lets the card content lead.

### The Tech Debt
- The share modal header is now intentionally minimal. If we later need explanatory copy again, it may be better placed below the card or integrated into a more deliberate modal header layout rather than reintroducing an ad hoc text row.

## 2026-05-12 - Hero parallax depth polarity corrected

### The Change
- Updated [Hero.tsx](/d:/projects/Cora/apps/web/src/components/landing/Hero.tsx) so the rear hero layers now drift opposite the cursor while the foreground layers and logo move with it.

### The Reasoning
- The previous hero setup had the depth relationship reading backward, with background shelves following the pointer and front layers resisting it. Flipping that polarity makes the scene feel more natural and gives the cursor interaction clearer depth.

### The Tech Debt
- Hero parallax direction and intensity are still tuned layer-by-layer inline in the component. If we keep polishing this scene, it may be worth introducing small shared layer metadata conventions for `front`, `mid`, and `back` motion behavior rather than hand-tuning each direction scalar.

## 2026-05-12 - Hero cursor lag removed

### The Change
- Updated [Hero.tsx](/d:/projects/Cora/apps/web/src/components/landing/Hero.tsx) to remove spring-smoothing from the cursor-following motion values, so hero layers now track the pointer directly.

### The Reasoning
- The hero felt delayed because pointer movement was being eased through a spring before driving the parallax transforms. That smoothing added visual lag and made the cursor response feel less direct than intended.

### The Tech Debt
- Direct pointer tracking feels more immediate, but it also removes the soft settle that springs can provide. If we later want a tiny amount of polish without reintroducing obvious lag, we may want a lighter-weight smoothing approach or more selective easing per layer.

## 2026-05-12 - Hero cursor sensitivity reduced slightly

### The Change
- Updated [Hero.tsx](/d:/projects/Cora/apps/web/src/components/landing/Hero.tsx) to apply a shared pointer-sensitivity multiplier, slightly reducing overall parallax travel without changing the front/back direction logic.

### The Reasoning
- Once the cursor lag was removed, the hero became more immediate but also a little more sensitive. A small global reduction keeps the response smooth and readable without making the scene feel sluggish again.

### The Tech Debt
- Hero sensitivity is now controlled by a single top-level multiplier, which is a good start, but the layer movement values are still hand-tuned individually. If we keep iterating, we may want to separate global sensitivity from per-depth movement presets more explicitly.

## 2026-05-12 - Hero parallax now tracks through navbar hover

### The Change
- Updated [Hero.tsx](/d:/projects/Cora/apps/web/src/components/landing/Hero.tsx) so cursor tracking now listens at the window level and normalizes against the hero section bounds, instead of relying on pointer events only from the hero section itself.

### The Reasoning
- The fixed navbar sits above the hero in the pointer event stack, which meant hero parallax stopped updating whenever the cursor moved over the navbar. Window-level tracking keeps the scene responsive across that overlap.

### The Tech Debt
- The hero now depends on global pointer listeners, which is the right fix for this overlap case, but it also means the component owns a slightly more complex event lifecycle. If more global pointer-driven surfaces appear later, a shared interaction utility may be cleaner than repeating window-level listener logic.

## 2026-05-12 - Hero logo scaled up dramatically for visual tuning

### The Change
- Updated [Hero.tsx](/d:/projects/Cora/apps/web/src/components/landing/Hero.tsx) so the `landscape_warm.png` hero logo uses a much larger frame footprint as an intentional first-pass overshoot.

### The Reasoning
- The fastest way to tune hero logo scale is to push it clearly too far first, then walk it back to the sweet spot with visual feedback. This pass is meant to establish that upper bound quickly.

### The Tech Debt
- Hero logo sizing is still controlled inline through the layer frame class. If we keep iterating on logo scale and placement across breakpoints, those values may be easier to manage as named hero layout constants instead of embedded utility strings.

## 2026-05-12 - Hero atmosphere pass added with layered light and dust

### The Change
- Updated [Hero.tsx](/d:/projects/Cora/apps/web/src/components/landing/Hero.tsx) to add extra lighting overlays between scene depths and a subtle animated dust field drifting across the hero.

### The Reasoning
- The hero already had depth, but it still felt a bit static between pointer moves. Adding soft inter-layer light and slow-floating dust gives the scene a more inhabited, breathing quality without changing the core composition.

### The Tech Debt
- The new atmosphere treatment is still composed from inline gradients and per-particle motion values inside the hero component. If this visual language expands, those lighting layers and ambient particle settings may be easier to maintain as shared hero scene constants or small reusable primitives.

## 2026-05-12 - Hero ambient animation made visibly stronger

### The Change
- Updated [Hero.tsx](/d:/projects/Cora/apps/web/src/components/landing/Hero.tsx) to replace the barely-there dust feel with larger glowing particles and two slow-moving haze bands so the ambient hero animation is visibly readable.

### The Reasoning
- The first ambient pass was too subtle to register as real motion. Increasing particle size, glow, travel, and adding drifting light haze makes the hero feel alive even when the cursor is still.

### The Tech Debt
- The stronger hero atmosphere is still hand-tuned with inline particle definitions and haze gradients. If we keep iterating on this cinematic treatment, it may be worth separating “subtle” vs “pronounced” ambient presets or moving the effect into a dedicated ambient scene layer component.

## 2026-05-12 - Hero ambient particles simplified into tiny drifting motes

### The Change
- Updated [Hero.tsx](/d:/projects/Cora/apps/web/src/components/landing/Hero.tsx) so the hero ambient motion now uses tiny independent dust-like motes drifting left-to-right, and removed the larger haze-band animation.

### The Reasoning
- The stronger atmospheric pass was readable, but it had drifted away from the specific brief of small live dust movement. Simplifying the effect back to tiny autonomous motes keeps the hero alive without turning the ambient layer into a large glowing haze event.

### The Tech Debt
- The dust layer still relies on hand-authored particle positions and timings inside the hero component. If we continue iterating on ambient scene motion, those particle presets may be better managed as a dedicated ambient config rather than embedded arrays.

## 2026-05-12 - Battle arena given continuous light effects

### The Change
- Updated [BattleScreen.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx) to add continuous animated light sweeps and a soft pulsing light veil above the arena background layer.

### The Reasoning
- The arena backdrop had strong artwork but still felt static whenever no gameplay effect was active. Adding slow ambient light motion keeps the battle scene feeling alive without competing directly with cards, characters, or damage effects.

### The Tech Debt
- The new arena lighting treatment is composed from inline animated gradients inside the battle screen. If we keep adding ambient scene effects, it may be worth extracting a reusable arena-atmosphere layer or shared motion constants instead of continuing to build these ad hoc in one component.

## 2026-05-12 - Battle characters given a soft idle breathing loop

### The Change
- Updated [BattleScreen.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx) and [globals.css](/d:/projects/Cora/apps/web/src/app/globals.css) to give both battle character sprites a subtle continuous breathing animation using a shared inner wrapper and a small bottom-anchored keyframe.

### The Reasoning
- The arena and UI already had ambient motion, but the character art itself still felt a bit too static between gameplay actions. Applying the idle motion on an inner wrapper keeps the characters feeling alive without interfering with the outer Framer Motion hit and action transforms.

### The Tech Debt
- The breathing timing and amplitude are currently global and hand-tuned for all battle characters. If individual characters later need distinct idle personalities, this will probably want a small per-character motion config instead of one shared CSS animation.

## 2026-05-12 - Heal actions now face each character back toward their base

### The Change
- Updated [BattleScreen.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx) so a character briefly flips orientation during heal actions, making the animation point toward their own base instead of toward the enemy.

### The Reasoning
- Attack-facing made sense as the default battle stance, but it looked wrong during healing because the character appeared to cast the effect at the opponent. Carrying the action kind through the existing action window lets healing read more clearly without changing the normal idle or attack presentation.

### The Tech Debt
- The facing swap is currently tied to a short shared action timer rather than a more explicit animation state machine. If character actions become more layered later, orientation may be cleaner to drive from a dedicated motion state object instead of a couple of transient flags.

## 2026-05-12 - Landing Enter Arena CTAs now open in a new tab

### The Change
- Updated [Navbar.tsx](/d:/projects/Cora/apps/web/src/components/landing/Navbar.tsx) and [CtaBanner.tsx](/d:/projects/Cora/apps/web/src/components/landing/CtaBanner.tsx) so both landing-page `Enter Arena` buttons open `/connect` in a new browser tab.

### The Reasoning
- Opening the arena flow in a separate tab preserves the landing page as a stable reference point while still letting players jump into the connect flow immediately. Applying it to both CTAs keeps the behavior consistent across the page.

### The Tech Debt
- The new-tab behavior is currently applied inline on each CTA. If more landing links start needing shared external or new-tab handling, it may be worth wrapping this in a small shared CTA component instead of duplicating attributes.

## 2026-05-12 - Hero parallax layers now ease in with real staged entrances

### The Change
- Updated [Hero.tsx](/d:/projects/Cora/apps/web/src/components/landing/Hero.tsx) so the hero image layers now use true initial entrance states with staggered opacity, position, scale, and blur settling instead of appearing abruptly.

### The Reasoning
- The hero already had per-layer entrance definitions, but the layers were using `initial={false}`, which muted the intended reveal. Restoring real initial states and adding a soft blur-to-sharp settle makes each depth plane feel like it is arriving into the scene rather than just popping on.

### The Tech Debt
- The hero entrance tuning is still distributed across inline entrance presets and per-layer branching logic. If the landing scene keeps evolving, it may be cleaner to centralize the entrance timing and filter presets into a small reusable hero motion config.

## 2026-05-12 - Hero scene populated with floating token coins across depth layers

### The Change
- Updated [Hero.tsx](/d:/projects/Cora/apps/web/src/components/landing/Hero.tsx) to add floating `SOL`, `BONK`, and `MEW` coin art into the hero, with some tokens rendered behind the mid-scene set dressing and others rendered in front. Each coin now has a slight tilt and a slow autonomous float.

### The Reasoning
- The hero already had strong environmental depth, but adding token coins makes the game economy more visible at a glance and gives the scene more motion cues. Splitting the coins across back and front z-layers helps the parallax read more clearly instead of feeling like all decorative elements are pasted on one plane.

### The Tech Debt
- The token placements are currently hand-authored inside the hero component, including their depth, offsets, and float timings. If we keep expanding the landing scene, this decorative object layout would be easier to maintain as a dedicated scene config rather than embedded arrays.

## 2026-05-12 - Hero token coins simplified into a single foreground float band

### The Change
- Updated [Hero.tsx](/d:/projects/Cora/apps/web/src/components/landing/Hero.tsx) so all floating token coins now render in front of the bookshelf layers and sit higher in the composition instead of being split between back and front depth bands.

### The Reasoning
- The mixed-depth token placement added parallax complexity, but it also made the hero feel a bit busier than necessary. Moving all coins into one elevated foreground band keeps the decorative motion readable while preserving the bookshelf scene behind them.

### The Tech Debt
- The foreground token layout is still manually positioned and tuned per coin. If we keep iterating on this hero ornamentation, it may be worth extracting responsive token placement presets rather than continuing to tweak raw coordinates in the component.

## 2026-05-12 - Hero coins re-scattered with SOL made the dominant token accent

### The Change
- Updated [Hero.tsx](/d:/projects/Cora/apps/web/src/components/landing/Hero.tsx) to re-scatter the floating coins across higher and lower positions in the hero foreground, and increased the size and visibility of the `SOL` coins so they read as the strongest visual anchors.

### The Reasoning
- Keeping all coins in front simplified the scene, but the previous arrangement still felt too banded. Spreading them vertically makes the ornamentation feel more natural, while emphasizing `SOL` gives the token set a clearer focal hierarchy instead of equal visual weight.

### The Tech Debt
- The new hierarchy still relies on hand-tuned coordinates, sizes, and opacity per coin. If we keep refining the hero art direction, it may be worth introducing named composition presets so these visual balances are easier to iterate without editing raw token objects every time.

## 2026-05-12 - Hero token layout moved fully to the sides with all six assets used

### The Change
- Updated [Hero.tsx](/d:/projects/Cora/apps/web/src/components/landing/Hero.tsx) so the floating token set now uses all six assets (`SOL`, `BONK`, `MEW`, `PEPE`, `PENGU`, `USDC`) while keeping the center clear for the `CORA` logo. The side composition now makes `SOL` the largest coin, keeps `BONK` and `MEW` medium, and scales `PEPE`, `PENGU`, and `USDC` smaller.

### The Reasoning
- The scattered foreground pass was starting to compete with the logo in the middle of the hero. Moving the tokens to the left and right edges keeps the title readable while still letting the token ecosystem show up in the scene with a clearer visual hierarchy.

### The Tech Debt
- The side composition and size hierarchy are still hand-authored in the hero token config. If we continue refining this scene, it may be worth splitting token placement into left/right layout presets so future art-direction tweaks are easier to make without editing every token object manually.

## 2026-05-12 - Lead SOL coin nudged inward on the hero

### The Change
- Updated [Hero.tsx](/d:/projects/Cora/apps/web/src/components/landing/Hero.tsx) to move the main left-side `SOL` coin a bit farther right without changing the rest of the token arrangement.

### The Reasoning
- The lead `SOL` accent was sitting a little too close to the outer edge. Nudging it inward helps it feel more intentionally framed while keeping the center logo area clear.

### The Tech Debt
- This is another hand-tuned placement tweak inside the hero token config. If these positional refinements continue, the hero would benefit from a more structured decorative layout system instead of one-off coordinate edits.

## 2026-05-12 - Lead SOL coin pushed farther inward on the hero

### The Change
- Updated [Hero.tsx](/d:/projects/Cora/apps/web/src/components/landing/Hero.tsx) again to move the main left-side `SOL` coin farther toward the center while keeping it clear of the `CORA` logo.

### The Reasoning
- The first inward nudge still left the lead `SOL` coin reading a little too edge-hugging. Moving it farther in gives that primary token accent more presence inside the composition without letting it drift into the logo zone.

### The Tech Debt
- The hero token layout is still being tuned through direct coordinate edits. If we keep iterating visually at this level, a small compositional grid or named anchor system would make repeated placement adjustments less manual.

## 2026-05-12 - Lead SOL coin moved further right again

### The Change
- Updated [Hero.tsx](/d:/projects/Cora/apps/web/src/components/landing/Hero.tsx) to push the primary left-side `SOL` coin farther right once more, with the rest of the token arrangement unchanged.

### The Reasoning
- The main `SOL` accent still needed a bit more inward presence to feel balanced against the right-side token group. This extra shift keeps it visually important without crossing into the middle logo space.

### The Tech Debt
- Repeated micro-adjustments like this are a sign the hero token composition is still being tuned by eye. A simple placement system or design tokens for decorative anchors would make this sort of iteration less repetitive over time.

## 2026-05-12 - Right-side hero coins now follow the cursor direction correctly

### The Change
- Updated [Hero.tsx](/d:/projects/Cora/apps/web/src/components/landing/Hero.tsx) so the right-side foreground coins use the same parallax follow direction as the cursor instead of drifting opposite it.

### The Reasoning
- The mixed token layout had inherited opposite-direction motion on some right-side coins, which made them feel inconsistent with the rest of the hero foreground. Normalizing their direction keeps the coin layer reading as one coherent cursor-following group.

### The Tech Debt
- The coin parallax direction is still configured per token object, which makes directional inconsistencies easy to introduce during visual tweaking. If the hero token system keeps evolving, shared directional presets would reduce that risk.

## 2026-05-12 - Battle audio, orientation gate, and mobile landing flow tightened up

### The Change
- Added a shared client audio helper in [gameAudio.ts](/d:/projects/Cora/apps/web/src/lib/audio/gameAudio.ts) and wired battle/lobby audio into [OpponentFound.tsx](/d:/projects/Cora/apps/web/src/components/lobby/OpponentFound.tsx) and [BattleScreen.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx), including match-found/countdown cues, low-volume looping battle music, answer feedback, attack/heal resolution SFX, Chrome-friendly audio unlock on deposit, and cached/preloaded endgame sounds.
- Added [MobileLandscapeGate.tsx](/d:/projects/Cora/apps/web/src/components/play/MobileLandscapeGate.tsx) and mounted it only in [BattleScreen.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx) so portrait phones get a rotate prompt without touching landing, lobby, or desktop/tablet landscape layouts.
- Updated landing responsiveness across [Hero.tsx](/d:/projects/Cora/apps/web/src/components/landing/Hero.tsx), [HowItWorks.tsx](/d:/projects/Cora/apps/web/src/components/landing/HowItWorks.tsx), [TokenMarquee.tsx](/d:/projects/Cora/apps/web/src/components/landing/TokenMarquee.tsx), and [Navbar.tsx](/d:/projects/Cora/apps/web/src/components/landing/Navbar.tsx) to add a portrait-specific hero composition, smaller mobile marquee treatment, tap-to-advance mobile How It Works cards, and a burger menu with the CTA moved inside on mobile.

### The Reasoning
- Audio needed to feel attached to real battle state changes rather than just button taps, so the wiring was split between answer-result events and damage-resolution events. Caching and preloading the `HTMLAudioElement`s was the safer choice for Chrome because server-driven end states like surrender were too easy to lose when spawning a fresh `Audio` instance at the last second.
- The landscape requirement was intentionally scoped to the actual battle surface instead of the whole app. The landing page, deposit flow, and challenge-entry screens still need to work in portrait, while the battle board is the one surface that truly depends on width.
- The landing page mobile fixes intentionally branch at the component level instead of trying to coerce the desktop interaction model into a narrow viewport. The hero needed a different crop, How It Works needed a different interaction model, and the navbar needed a different information architecture, so mobile-specific paths were cleaner than stacking more breakpoint overrides onto the desktop behavior.

### The Tech Debt
- The result-share card still needs a follow-up pass for surrender-specific copy and card-title mapping. The current share-card pipeline still assumes a generic win-style title in some surrender paths, which can make the exported result card read incorrectly even when the overlay text is right.
- Mobile landing behavior now has distinct interaction branches, but it has only been linted, not fully visually regression-tested across every tablet breakpoint. Small tablets in portrait are the most likely place where we may still want to retune the mobile/desktop cutoff after real-device testing.
- The audio helper is now centralized, but mute/preferences are still implicit. If battle audio keeps growing, we should probably introduce an explicit user-facing audio state (music vs SFX, remembered mute, maybe per-surface toggles) instead of continuing to encode levels inline at call sites.

## 2026-05-12 - Mobile hero logo enlarged and burger menu simplified

### The Change
- Updated [Hero.tsx](/d:/projects/Cora/apps/web/src/components/landing/Hero.tsx) so the mobile `CORA` logo sits larger within the bookshelf-3 portrait composition.
- Updated [Navbar.tsx](/d:/projects/Cora/apps/web/src/components/landing/Navbar.tsx) so the mobile burger sheet now only contains navigation links and no longer repeats the `Enter Arena` CTA inside the menu.

### The Reasoning
- The bookshelf-3 mobile crop had enough negative space to support a larger `CORA` mark, and the previous size still felt a little timid relative to the rest of the portrait composition.
- The mobile menu was reading heavier than necessary once the burger interaction was in place. Removing the duplicated CTA keeps the sheet focused on navigation instead of turning it into a second action panel.

### The Tech Debt
- The mobile hero title scale is still tuned by eye inside the layer config. If we continue iterating on portrait hero variants, we may want to promote these mobile composition values into named presets instead of continuing to adjust frame geometry inline.

## 2026-05-12 - Mobile navbar CTA restored into burger and hero title re-centered

### The Change
- Updated [Navbar.tsx](/d:/projects/Cora/apps/web/src/components/landing/Navbar.tsx) so the mobile `Enter Arena` CTA lives inside the burger sheet again and no longer shows in the top bar beside the menu button.
- Updated [Hero.tsx](/d:/projects/Cora/apps/web/src/components/landing/Hero.tsx) to move the large mobile `CORA` mark lower and more centrally within the bookshelf-3 portrait composition while nudging its scale up slightly again.

### The Reasoning
- The previous pass interpreted "hide the CTA inside the burger" too literally and removed it from the menu instead of tucking it away there. Restoring it inside the sheet keeps the top bar lighter while still preserving the primary mobile entry action.
- The first portrait-logo enlargement made the mark bigger, but the actual visual center still felt too high in the shelf scene. Moving it deeper into the composition makes the mobile hero read more intentionally framed instead of top-heavy.

### The Tech Debt
- The portrait hero framing is still manually tuned by asset bounds and layer geometry. If we keep adjusting the mobile art direction, the title and shelf crop would benefit from a more explicit composition token set rather than repeated literal `top/width/scale` edits.

## 2026-05-12 - Mobile hero logo given extra top spacing

### The Change
- Updated [Hero.tsx](/d:/projects/Cora/apps/web/src/components/landing/Hero.tsx) to push the large mobile `CORA` mark a bit lower in the portrait hero composition, effectively adding more top margin above it on phones.

### The Reasoning
- The previous re-centering improved the bookshelf composition, but the mark still felt a little tight against the upper part of the scene. Giving it more breathing room above helps the mobile hero feel less crowded.

### The Tech Debt
- This is another hand-tuned vertical offset inside the mobile hero layer config. If the portrait composition keeps being art-directed through micro-adjustments, we should eventually capture these spacing decisions as named mobile composition presets instead of raw percentages.

## 2026-05-12 - Mobile hero tokens resized and re-scattered

### The Change
- Updated [Hero.tsx](/d:/projects/Cora/apps/web/src/components/landing/Hero.tsx) so the mobile landing view now uses its own token layout instead of reusing the desktop positions.
- Reduced mobile token sizes and scattered all six token assets into separate portrait-friendly positions so the full set can show up around the bookshelf scene instead of only `SOL` and `BONK` remaining visible.

### The Reasoning
- The desktop token coordinates were composed for a wide hero and did not survive the portrait crop well. A dedicated mobile token band is the cleaner fix because it lets the bookshelf-3 composition breathe while still showing the broader token ecosystem.

### The Tech Debt
- The mobile token arrangement is still hand-authored like the desktop token band. If we keep iterating on the landing art direction, we should consider promoting token layouts into named desktop/mobile presets or shared scene data instead of maintaining multiple raw placement arrays in the component.

## 2026-05-12 - Mobile hero logo given additional vertical breathing room again

### The Change
- Updated [Hero.tsx](/d:/projects/Cora/apps/web/src/components/landing/Hero.tsx) to move the large mobile `CORA` mark farther down in the portrait hero composition for extra top margin.

### The Reasoning
- The previous spacing pass still left the logo reading a little too close to the upper shelf area. Pushing it farther down gives the portrait hero more visual air at the top and keeps the mark from feeling cramped against the navbar zone.

### The Tech Debt
- The portrait hero title placement is still being art-directed through raw positional percentages. If we keep iterating at this level, it would be cleaner to formalize a small mobile composition preset rather than continuing to stack manual `top` adjustments.

## 2026-05-12 - Mobile Features section spacing tightened

### The Change
- Updated [Features.tsx](/d:/projects/Cora/apps/web/src/components/landing/Features.tsx) to reduce the top/bottom section padding and tighten the heading-to-card gap on mobile while preserving the existing desktop spacing.

### The Reasoning
- The landing flow had accumulated too much blank space before the roster section on phones, especially after the taller portrait hero adjustments. Tightening the mobile-only spacing keeps the page feeling more continuous without compressing the desktop layout.

### The Tech Debt
- The landing section spacing is still being tuned one component at a time. If we keep polishing mobile rhythm across the page, it may be worth defining a shared spacing system for mobile section transitions instead of continuing to patch individual `mt`/`py` values in place.

## 2026-05-12 - Footer logo aligned with the shared warm landscape mark

### The Change
- Updated [Footer.tsx](/d:/projects/Cora/apps/web/src/components/landing/Footer.tsx) so the landing footer now uses the same `landscape_warm.png` logo asset as the rest of the landing experience instead of the previous text-and-initial mark.

### The Reasoning
- The footer was still carrying a simpler placeholder-style brand treatment while the rest of the landing page had already standardized on the warm landscape logo. Reusing the shared asset keeps the branding more visually consistent from hero to footer.

### The Tech Debt
- The footer still relies on a fixed logo box width. If we later introduce alternate footer layouts or responsive brand variations, it may be worth centralizing logo sizing rules instead of continuing to tune them locally per component.

## 2026-05-12 - Mobile CTA banner content centered

### The Change
- Updated [CtaBanner.tsx](/d:/projects/Cora/apps/web/src/components/landing/CtaBanner.tsx) so the mobile-only version centers the text block and `Enter Arena` CTA while preserving the existing left-aligned desktop layout through `md:` overrides.

### The Reasoning
- Once the mobile banner hides the heavier right-side decorative content, the remaining copy-and-button stack reads more intentional when centered instead of still inheriting the desktop left alignment.

### The Tech Debt
- The CTA banner now has another mobile-specific presentation branch layered onto the desktop composition. If we keep refining the landing mobile layout, we may eventually want a more explicit shared mobile typography/alignment system instead of handling each section’s centering case individually.
## 2026-05-12 - Mobile lobby character select now scrolls correctly

### The Change
- Updated [CharacterSelect.tsx](/d:/projects/Cora/apps/web/src/components/lobby/CharacterSelect.tsx) so the lobby setup shell allows vertical scrolling on mobile by switching the small-screen wrapper from fixed-height `overflow-hidden` to mobile `overflow-y-auto`, while preserving the existing desktop viewport lock with `md:` overrides.

### The Reasoning
- The real "can't scroll on mobile" issue was in the lobby character-select shell, not in the landing roster cards. The wrapper was clamping the whole setup screen to `overflow-hidden`, which prevented the scientist grid from extending naturally on phones. Letting the lobby phase scroll on small viewports fixes the actual problem at the right layer.

### The Tech Debt
- The room-phase setup flow now intentionally diverges between mobile and desktop overflow behavior. If more room-phase screens start carrying tall mobile content, it may be worth centralizing "mobile scroll / desktop viewport lock" behavior inside `RoomPhaseShell` instead of continuing to tune it per screen wrapper.

## 2026-05-12 - Mobile OpponentFound stack no longer overlaps

### The Change
- Updated [OpponentFound.tsx](/d:/projects/Cora/apps/web/src/components/lobby/OpponentFound.tsx) so the mobile rival-found screen uses scrollable vertical flow instead of a fully locked viewport, and reduced a few small-screen gaps/sizes around the `VS` separator and deposit panel spacing.

### The Reasoning
- The rival cards, center `VS`, and deposit panel were all trying to fit inside a hard `100svh` mobile container while also refusing to shrink, which caused the middle and lower blocks to visually collide. Letting the mobile screen scroll and slightly tightening the vertical rhythm fixes the overlap at the layout level without disturbing the desktop three-column arrangement.

### The Tech Debt
- `OpponentFound` now has another mobile-vs-desktop overflow split similar to the lobby character screen. If more setup-phase screens keep hitting this issue, we should likely formalize a shared “scroll on mobile, lock on desktop” pattern for these full-screen pre-battle states instead of solving each one independently.
## 2026-05-12 - Landing video slot wired, Curie base renamed, and history page held as Devnet coming soon

### The Change
- Wired the landing replay section to a real gameplay video in [VideoSlot.tsx](/d:/projects/Cora/apps/web/src/components/landing/VideoSlot.tsx), replacing the placeholder state with an embedded Cloudinary-hosted demo clip and first-frame poster behavior.
- Standardized Marie Curie's base naming to `The Laboratory` in the active frontend content surfaces, including [content.ts](/d:/projects/Cora/apps/web/src/components/landing/content.ts), [LobbyScreen.tsx](/d:/projects/Cora/apps/web/src/components/lobby/LobbyScreen.tsx), and [page.tsx](/d:/projects/Cora/apps/web/src/app/dev/room-states/page.tsx).
- Kept the dedicated history route in a coming-soon state in [page.tsx](/d:/projects/Cora/apps/web/src/app/history/page.tsx) because the full history experience is still gated by Devnet-backed data readiness.

### The Reasoning
- The landing page needed a real motion asset in the replay slot so the section stops reading like a stub and starts demonstrating actual product feel.
- `The Laboratory` is a cleaner and more consistent base label for Curie across landing, lobby, and dev surfaces than the earlier variant naming.
- History is better framed as intentionally coming soon rather than feeling partially broken while Devnet history/indexing remains incomplete.

### The Tech Debt
- The landing video is currently wired directly to a hosted asset URL inside the component. If we expect to swap clips often, we should move the media source and poster into environment/config-driven content.
- The history page messaging is accurate for the current Devnet state, but once indexed history becomes stable we should replace the placeholder route with the full records experience and remove the temporary hold copy.

## 2026-05-20 - Connect screen wallet and guest entry hierarchy clarified

### The Change
- Updated [ConnectWalletScreen.tsx](/d:/projects/Cora/apps/web/src/components/connect/ConnectWalletScreen.tsx) so `Connect Wallet` and `Enter As Guest` are sibling entry actions on the connect screen.
- Replaced the raw wallet adapter button on this screen with a local wallet action that either opens the wallet modal or connects the selected wallet, keeping Phantom as provider context instead of a competing top-level CTA.
- Tightened guest and practice copy across connect, lobby, handoff, battle notice, surrender, and result surfaces so user-facing text says `practice round`, `practice rival`, or `no-stakes round` instead of implementation-flavored `bot match` and generated-address wording.
- Added a quiet `Disconnect Wallet` action to the connected `/connect` state so users can still undo an auto-synced wallet after the embedded wallet dropdown was removed from this screen.
- Updated [LobbySetup.tsx](/d:/projects/Cora/apps/web/src/components/lobby/LobbySetup.tsx) so the wallet and Blink actions sit on the same footer row, with the guest/wallet helper text spanning below them, and the wallet action uses the same CORA `btn-game-primary` styling as lobby progression buttons instead of the default wallet adapter pill.
- Updated guest identity pills in [CharacterSelect.tsx](/d:/projects/Cora/apps/web/src/components/lobby/CharacterSelect.tsx), [MatchmakingWaiting.tsx](/d:/projects/Cora/apps/web/src/components/lobby/MatchmakingWaiting.tsx), and [OpponentFound.tsx](/d:/projects/Cora/apps/web/src/components/lobby/OpponentFound.tsx) so guest addresses consistently render with a `Guest` prefix, matching the lobby setup identity pill.
- Updated [BattleScreen.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx) so post-match share cards and the in-battle player identity line also render guest practice addresses with the `Guest` prefix.
- Updated bot rival identity labels in [OpponentFound.tsx](/d:/projects/Cora/apps/web/src/components/lobby/OpponentFound.tsx) and [BattleScreen.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx) so practice rival addresses render with a `Bot` prefix anywhere they feed the lobby handoff, battle HUD, share card, or share-copy text.
- Removed the always-visible `Practice Now` action from [MatchmakingWaiting.tsx](/d:/projects/Cora/apps/web/src/components/lobby/MatchmakingWaiting.tsx), leaving the slow-queue overlay as the dedicated practice fallback prompt.

### The Reasoning
- The connect screen has two real product paths: wallet-backed CORA with queue/deposits/rewards, and guest bot practice. Presenting Phantom beside those paths made the hierarchy read like three modes instead of one provider inside the wallet path.
- Keeping both actions in the existing centered arena panel preserves the current visual language while making the decision clearer for new users.

### The Tech Debt
- The custom wallet action is intentionally scoped to the connect screen. Other surfaces still use the shared `HydratedWalletButton`, so if this hierarchy becomes the standard wallet entry pattern, we should promote it into a reusable component.

## 2026-05-21 - Server-acknowledged card opening in battle UI

### The Change
- Updated [useMatchSocket.ts](/d:/projects/Cora/apps/web/src/hooks/useMatchSocket.ts) to expose the new backend `openCardAccepted` and `cardActionRejected` events.
- Updated [BattleScreen.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx) so clicking a card still opens the question shell immediately, but answer buttons remain disabled until the matching `openCardAccepted` event or legacy matching `cardCountdown` arrives.
- Added `cardActionRejected` handling that resets the active card and shows the backend message, plus `cardExpired(reason: "rejected")` handling that unlocks without treating the event as a real timeout.

### The Reasoning
- The previous card flow trusted the client-side open state too early. If the backend rejected or lost the open state, the player could answer into a silent backend rejection and get stuck.
- Waiting for the server ACK before enabling answers preserves the authoritative open-before-play contract while keeping the UX responsive: players see the card shell right away, then answers become available as soon as the server confirms.

### The Tech Debt
- The battle UI still uses a local `Opening card...` pending state rather than a dedicated visual treatment. If this state becomes noticeable over real network conditions, add a small animated sync affordance to the question card instead of relying only on disabled answers and `...` countdown copy.

## 2026-05-21 - First-Time Intro Overlay & Free Tutorial Flow Completed

### The Change
- Verified the implementation of the skippable first-time glassmorphic `<IntroOverlay>` in [IntroOverlay.tsx](/d:/projects/Cora/apps/web/src/components/lobby/IntroOverlay.tsx). Features 3 interactive, beautiful animated CSS/SVG fallback components (`PlayCardsMockup`, `TimerMockup`, `WagerMockup`) representing cards, timers, and wager/practice mechanics that seamlessly defer to real WebM/PNG media assets once available in `/assets/intro/`.
- Confirmed the lobby setup bottom-right action stack in [LobbySetup.tsx](/d:/projects/Cora/apps/web/src/components/lobby/LobbySetup.tsx) successfully renders the sibling `"Try Free Tutorial"` action, alongside polished, context-aware prompt labels (`"Select a token to wager, or try free tutorial"`).
- Checked the full tutorial integration in [LobbyScreen.tsx](/d:/projects/Cora/apps/web/src/components/lobby/LobbyScreen.tsx):
  - Automatically loads and sets `cora:introSeen` in local storage for new normal lobby users.
  - Implements the complete `startTutorialFlow` transition which guides guest users to Scientist Selection in tutorial mode.
  - Implements `startTutorialMatch` which generates temporary guest credentials, registers the session with `isTutorial: true`, starts a practice bot match via `createBotMatch`, and routes natively to `/play` with `tutorial=1` in query parameters.

### The Reasoning
- Keeping interactive SVG/CSS animations as high-fidelity fallbacks guarantees a premium, visually engaging client experience even when external media assets are still loading or missing.
- Scoping the tutorial mode to a custom `isTutorial: true` flag and isolated temp guest credentials prevents active wallet sessions or live deposit queues from being overridden.

### The Tech Debt
- The `IntroOverlay` asset availability check performs dynamic `HEAD` requests on mount. If the overlay is loaded frequently or asset count increases, these checks should be debounced or pre-cached in static configuration metadata instead of hitting network endpoints on each load.

## 2026-05-21 - Lobby Tutorial CTA Prioritized Beside Wallet-Gated Draft CTA

### The Change
- Updated [LobbySetup.tsx](/d:/projects/Cora/apps/web/src/components/lobby/LobbySetup.tsx) so the bottom-right action row now renders `Try Free Tutorial` on the left and the stronger primary `Pick Scientist` action on the right.
- Added explicit wallet gating to the primary lobby draft action, so `Pick Scientist` remains disabled when no wallet is connected even if an arena is selected.

### The Reasoning
- The tutorial path is the low-friction no-wallet/no-wager path, so it should remain immediately available while the wallet-backed wager path stays visually primary but blocked until the required setup is complete.
- Keeping the stronger action on the right preserves the main competitive flow hierarchy while making the free tutorial an obvious fallback instead of a hidden alternative.

### The Tech Debt
- The primary draft action now explicitly requires `walletConnected` in `LobbySetup` in addition to the upstream `canPlay` flag. If lobby playability rules keep expanding, these conditions should be consolidated into a named view-state object to avoid duplicated policy between parent and child components.

## 2026-05-21 - Lobby Arena Bottom Vignette for CTA Readability

### The Change
- Updated [LobbySetup.tsx](/d:/projects/Cora/apps/web/src/components/lobby/LobbySetup.tsx) to add a bottom-only dark gradient overlay above the arena preview image and below the lobby content/actions.

### The Reasoning
- The new side-by-side `Try Free Tutorial` and `Pick Scientist` action row sits over varied arena artwork, so a bottom vignette gives the buttons and helper copy stable contrast without dimming the whole preview image.

### The Tech Debt
- The vignette height and opacity are locally tuned to the current lobby artwork. If future arena images have much brighter lower thirds, this may need to become a reusable overlay token or per-arena readability setting.

## 2026-05-21 - Intro Overlay Shared Across Connect and Lobby

### The Change
- Updated [IntroOverlay.tsx](/d:/projects/Cora/apps/web/src/components/lobby/IntroOverlay.tsx) so all three panels use WebM media, including the new `/assets/intro/intro-practice-wager.webm` asset.
- Removed the top-right close control and the final-panel `Try Free Tutorial` CTA from the intro overlay, leaving only the `Skip`, `Next`, and final `Enter Arena` actions.
- Updated [ConnectWalletScreen.tsx](/d:/projects/Cora/apps/web/src/components/connect/ConnectWalletScreen.tsx) to show the same first-time intro overlay on `/connect` using the existing `cora:introSeen` localStorage key.
- Kept the `/lobby` intro trigger in [LobbyScreen.tsx](/d:/projects/Cora/apps/web/src/components/lobby/LobbyScreen.tsx) as a fallback for users who bypass `/connect` directly.
- Renamed the uploaded practice/wager intro asset to [intro-practice-wager.webm](/d:/projects/Cora/apps/web/public/assets/intro/intro-practice-wager.webm) so the public path is URL-safe and consistent with the other intro assets.

### The Reasoning
- The intro now teaches the game once, then reveals the current screen's real decisions. `/connect` owns the normal first-time entry experience, while `/lobby` still protects direct links and bookmarks.
- Removing game-mode CTAs from the intro keeps responsibility clean: the overlay explains, `/connect` handles wallet/guest choice, and `/lobby` handles tutorial versus wager flow.

### The Tech Debt
- `IntroOverlay` now serves both connect and lobby but still lives under `components/lobby`. If more onboarding surfaces appear, move it into a neutral `components/onboarding` folder with any shared intro storage helpers.

## 2026-05-21 - Intro Videos Hold First Frame Before Playback

### The Change
- Updated [IntroOverlay.tsx](/d:/projects/Cora/apps/web/src/components/lobby/IntroOverlay.tsx) to render intro media through a dedicated `IntroPanelVideo` helper.
- Intro videos now wait for `loadedData`, pause on the first frame, hold for one second, and only then start muted looped playback.

### The Reasoning
- Holding the first frame lets the overlay finish appearing and gives the video a stable loaded state before motion begins, which makes the onboarding panels feel smoother and avoids premature autoplay while the modal is still settling.

### The Tech Debt
- The one-second hold is a local constant tuned by feel. If intro timing becomes part of a broader motion system, move it into shared animation timing tokens.

## 2026-05-21 - Intro Video Loop Hold

### The Change
- Updated [IntroOverlay.tsx](/d:/projects/Cora/apps/web/src/components/lobby/IntroOverlay.tsx) so intro videos no longer use native `loop` playback.
- Added manual `ended` handling that pauses on the final frame for one second, resets to the beginning, and then starts playback again.

### The Reasoning
- The same deliberate pause used before first playback now applies between loops, making repeated intro media feel less abrupt and easier to read.

### The Tech Debt
- The first-frame and end-frame holds currently share the same timing constant. If later media has different pacing needs, the start hold and loop hold may need separate constants.

## 2026-05-21 - React Lint Cleanup After Intro/Tutorial Wiring

### The Change
- Updated [ConnectWalletScreen.tsx](/d:/projects/Cora/apps/web/src/components/connect/ConnectWalletScreen.tsx) so first-time intro visibility is derived from lazy initial state instead of setting state synchronously inside an effect.
- Updated [LobbyScreen.tsx](/d:/projects/Cora/apps/web/src/components/lobby/LobbyScreen.tsx) to defer effect-driven guest/login/intro/queue-state updates, remove the unused legacy HTTP matchmaking helper/imports, and complete callback dependency lists for tutorial and auto-requeue paths.
- Updated [useQueueSocket.ts](/d:/projects/Cora/apps/web/src/hooks/useQueueSocket.ts) so mutable queue refs are synchronized in effects instead of during render, and reconnects call the latest socket opener through a ref.
- Cleaned small unused items in [LobbySetup.tsx](/d:/projects/Cora/apps/web/src/components/lobby/LobbySetup.tsx), [BattleScreen.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx), and [signDepositIntent.ts](/d:/projects/Cora/apps/web/src/lib/solana/signDepositIntent.ts).

### The Reasoning
- The current ESLint setup includes stricter React Compiler and hooks rules. Deferring state updates that are triggered by effects and moving ref writes out of render keeps the existing behavior while satisfying those rules.

### The Tech Debt
- Several older effects in the lobby and battle screens still mix state coordination with side effects. They now satisfy lint for the surfaced cases, but longer-term cleanup should split state machines from transport/storage effects.

## 2026-05-21 - Stabilize Practice Match Callback Dependency

### The Change
- Wrapped `startBotMatch` in [LobbyScreen.tsx](/d:/projects/Cora/apps/web/src/components/lobby/LobbyScreen.tsx) with `useCallback` and added its explicit dependency list.

### The Reasoning
- `beginMatchmaking` depends on `startBotMatch` for guest/practice flow. Stabilizing the callback prevents `beginMatchmaking` from changing every render and clears the remaining React hooks lint warning.

### The Tech Debt
- Lobby still has several large callback blocks in one component. If tutorial, guest practice, and wager queue keep expanding, extracting flow-specific hooks would make dependency management easier to audit.

## 2026-05-21 - Soften Lobby Arena CTA Vignette

### The Change
- Tuned the bottom arena vignette in [LobbySetup.tsx](/d:/projects/Cora/apps/web/src/components/lobby/LobbySetup.tsx) from a taller, darker overlay to a shorter and lighter gradient.

### The Reasoning
- The CTA area still needs contrast, but the previous black gradient covered too much of the arena artwork. The lighter pass keeps button readability while letting more of the preview image show through.

### The Tech Debt
- The gradient remains hand-tuned for the current arena art. Future arenas may need per-image contrast review.

## 2026-05-21 - Lobby Board Hover Motion Removed

### The Change
- Added a `.game-card-static` utility in [globals.css](/d:/projects/Cora/apps/web/src/app/globals.css) to opt specific game-card wrappers out of the global hover lift while preserving a warm hover glow.
- Applied the static game-card variant to the main horizontal lobby board in [LobbySetup.tsx](/d:/projects/Cora/apps/web/src/components/lobby/LobbySetup.tsx).
- Restored the individual arena token selection buttons to their button-like hover/selected lift behavior.

### The Reasoning
- The large lobby board is a layout wrapper rather than a direct action target, so it should not move on hover. A glow still gives the surface a responsive feel, while the actual arena token selectors remain buttons and can keep their hover affordance.

### The Tech Debt
- `.game-card-static` now carries a lobby-tuned glow value. If more wrapper-only cards appear, consider a named component-level card variant instead of utility opt-outs.

## 2026-05-21 - Preserve Tutorial Match Address

### The Change
- Updated [LobbyScreen.tsx](/d:/projects/Cora/apps/web/src/components/lobby/LobbyScreen.tsx) so the generic matched-room session writer does not run while the free tutorial flow is active.

### The Reasoning
- `startTutorialMatch` creates a bot room using a temporary no-wallet guest address and writes that exact address into the active match session before routing to `/play`. The generic lobby session effect could run afterward and overwrite the same room with the connected wallet or stored guest identity, causing the play socket to join as the wrong address and leaving the bot room stuck waiting for its original player.

### The Tech Debt
- Tutorial mode still depends on local lobby state to protect the session write. If match session handling grows further, extract a dedicated tutorial session helper so normal wager recovery and tutorial handoff cannot share the same write path by accident.

## 2026-05-21 - Route Tutorial Through Opponent Found

### The Change
- Updated [LobbyScreen.tsx](/d:/projects/Cora/apps/web/src/components/lobby/LobbyScreen.tsx) so the free tutorial creates the bot room, stores the tutorial guest address, then moves into the existing `found` phase instead of routing directly to `/play`.
- Updated [OpponentFound.tsx](/d:/projects/Cora/apps/web/src/components/lobby/OpponentFound.tsx) so guest/tutorial flows use the provided guest address for the match socket even when a wallet is connected.

### The Reasoning
- The normal matchmaking flow uses `OpponentFound` to connect to the room, wait for the server battle snapshot, show the prep/countdown UI, and only then enter `/play`. Tutorial should mimic that path so `/play` loads with ready server state instead of showing an in-battle waiting message.

### The Tech Debt
- `OpponentFound` now handles both wager deposits and no-wager bot prep. If practice-specific prep grows, split the status copy/control logic into smaller mode-specific helpers while keeping the shared matched-screen shell.

## 2026-05-21 - Keep Connected-Wallet Tutorial on Guest Identity

### The Change
- Updated [LobbyScreen.tsx](/d:/projects/Cora/apps/web/src/components/lobby/LobbyScreen.tsx) so tutorial mode uses the guest identity for lobby display, bot match creation, and the `OpponentFound` socket handoff even when a wallet is connected.
- Prevented the connected-wallet auto-switch effect from flipping `loginMode` out of guest while the tutorial flow is active.

### The Reasoning
- The free tutorial is intentionally a no-wager guest-style match. A connected wallet could previously make the UI look like guest mode while still passing the wallet address into the matched/prep flow, which caused the server to wait for the original tutorial guest address.

### The Tech Debt
- `isTutorialMode` and `isGuestMode` now intentionally overlap in the lobby. If more practice modes appear, introduce a clearer `identityMode` or match-entry state machine instead of combining booleans.

## 2026-05-21 - Split Tutorial Transport And Display Identity

### The Change
- Added optional display identity fields to [matchSession.ts](/d:/projects/Cora/apps/web/src/lib/session/matchSession.ts) so a match can keep one address for socket/session transport and another for UI display.
- Updated [LobbyScreen.tsx](/d:/projects/Cora/apps/web/src/components/lobby/LobbyScreen.tsx), [CharacterSelect.tsx](/d:/projects/Cora/apps/web/src/components/lobby/CharacterSelect.tsx), [OpponentFound.tsx](/d:/projects/Cora/apps/web/src/components/lobby/OpponentFound.tsx), and [BattleScreen.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx) so connected-wallet tutorial shows the real wallet while still using the hidden tutorial guest address for the no-deposit bot room.

### The Reasoning
- Free tutorial needs the generated guest address to keep the no-wager bot socket stable, but a connected user should still see their wallet identity in character select, opponent found, and battle. Splitting display identity from transport identity gives that UX without turning tutorial into a real wallet wager flow.

### The Tech Debt
- The display identity is currently stored as optional fields on the local match session. If the app later needs richer profile display names or wallet aliases, move this into a dedicated player presentation model.

## 2026-05-21 - Add Intro Wallet Devnet Step

### The Change
- Updated [IntroOverlay.tsx](/d:/projects/Cora/apps/web/src/components/lobby/IntroOverlay.tsx) to add `intro-wallet-devnet.webm` as the first onboarding panel before cards, timer, and practice/wager.
- Added a lightweight wallet/devnet fallback mockup for missing media.

### The Reasoning
- First-time users need wallet, Devnet, and faucet context before they understand wager matches. Navigation stays intentionally simple with Skip as the low-emphasis escape and Next/Enter Arena as the primary path.

### The Tech Debt
- The intro overlay now mixes onboarding content and video fallback mockups in one component. If more setup panels land, extract panel data and fallback renderers into a small onboarding module.

## 2026-05-21 - Connect Screen Devnet Signal

### The Change
- Added a small `Live on Devnet` status pill to [ConnectWalletScreen.tsx](/d:/projects/Cora/apps/web/src/components/connect/ConnectWalletScreen.tsx).

### The Reasoning
- The onboarding now teaches wallet, Devnet, and faucet setup. Showing the Devnet signal directly on `/connect` reinforces that this environment is live for testing before users choose wallet or guest entry.

### The Tech Debt
- The signal is currently static UI copy. If network selection becomes dynamic, wire it to runtime cluster config instead of hardcoding Devnet.

## 2026-05-21 - Refine Connected Devnet Signal

### The Change
- Updated [ConnectWalletScreen.tsx](/d:/projects/Cora/apps/web/src/components/connect/ConnectWalletScreen.tsx) so the generic connect/practice helper copy hides once a wallet is connected.
- Shifted the `Live on Devnet` pill to the warm yellow/brown accent family and tightened spacing between it and the connected wallet status.

### The Reasoning
- Once a wallet is connected, the helper line repeats information the UI already implies. The Devnet and wallet status should read as a compact connected-state cluster.

### The Tech Debt
- Connected-state spacing is still tuned in the component with conditional margin classes. If the connect card gains more states, extract small header/status subcomponents.

## 2026-05-21 - Lobby Replay Intro Utility

### The Change
- Added a `Replay Intro` lobby utility action wired to reopen the existing [IntroOverlay.tsx](/d:/projects/Cora/apps/web/src/components/lobby/IntroOverlay.tsx) without resetting intro localStorage.
- Updated [LobbySetup.tsx](/d:/projects/Cora/apps/web/src/components/lobby/LobbySetup.tsx) so wallet, wager, balance, replay intro, and history share the same clipped pill language, with warm action coloring for replay and muted disabled styling for history.

### The Reasoning
- Users may want to revisit onboarding after landing in the lobby. Keeping replay as a top utility action makes it discoverable without competing with arena selection or tutorial/practice CTAs.

### The Tech Debt
- The lobby header pill helper is local to `LobbySetup`. If other screens need the same pill treatment, promote it into a shared UI component.

## 2026-05-21 - Match Wallet Pill Height

### The Change
- Reduced the wallet identity marker size in [LobbySetup.tsx](/d:/projects/Cora/apps/web/src/components/lobby/LobbySetup.tsx) so the wallet pill matches the wager and balance pill height.

### The Reasoning
- The previous marker made the wallet pill visually taller than the rest of the lobby header controls. Keeping all pills aligned makes the header read as one consistent utility strip.

### The Tech Debt
- Header pill sizing is still manually tuned in `LobbySetup`; shared pill tokens would make future adjustments less repetitive.

## 2026-05-21 - Soften Replay Intro Pill

### The Change
- Reduced the warm outline and highlight strength on the `Replay Intro` header pill in [LobbySetup.tsx](/d:/projects/Cora/apps/web/src/components/lobby/LobbySetup.tsx).

### The Reasoning
- Replay Intro is a helpful utility action, but it should sit below the main lobby actions visually. Softer treatment keeps it discoverable without over-commanding the header.

### The Tech Debt
- Header action tones are still inline style objects; promote them to shared tokens if more header utilities are added.

## 2026-05-21 - Reset Intro Replay Step

### The Change
- Updated [IntroOverlay.tsx](/d:/projects/Cora/apps/web/src/components/lobby/IntroOverlay.tsx) so opening the overlay always resets to the first panel.

### The Reasoning
- Replay Intro should behave like a fresh replay, not resume from wherever the user last closed the onboarding.

### The Tech Debt
- Intro step state still lives inside the overlay. If parent screens ever need deep-linking to a specific intro step, expose an initial step prop instead.

## 2026-05-22 - Real Match Deposit Reminder

### The Change
- Added a pre-sign deposit reminder modal to [OpponentFound.tsx](/d:/projects/Cora/apps/web/src/components/lobby/OpponentFound.tsx) for the real matchmaking flow.
- Changed the idle primary action copy from `Sign Deposit` to `Deposit`; pressing it now opens the reminder, and `Confirm Deposit` starts the existing Phantom signing path.
- Finalized the reminder UI with centered content, a compact wager line, a single readable warning, and a light warm cancel action.

### The Reasoning
- The reminder needs to appear before Phantom opens, but the stable signing/socket logic should stay untouched. The modal gates only the UI click path and still calls the existing `onSignDeposit` handler, preserving transaction preparation, `Opening Phantom...`, deposit confirmation, and timeout behavior.

### The Tech Debt
- The reminder copy is local to `OpponentFound`. If Blink deposits or other wager entry points need the same rule reminder later, extract a shared deposit reminder component.

## 2026-05-22 - Phone Landscape Arena Responsiveness

### The Change
- Added phone-landscape CSS hooks to [BattleScreen.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx) for the arena shell, room header, player strip, stage, hand prompt, cards, and active question panel.
- Added responsive rules in [globals.css](/d:/projects/Cora/apps/web/src/app/globals.css) for coarse-pointer landscape screens under `960px` wide and `540px` tall, compressing vertical chrome and scaling cards by viewport height.
- Added [MobileFullscreenButton.tsx](/d:/projects/Cora/apps/web/src/components/play/MobileFullscreenButton.tsx), a phone-landscape-only fullscreen toggle that hides itself when the browser does not expose a fullscreen API.

### The Reasoning
- The existing portrait gate handled rotation, but landscape phones still had very little usable height after browser UI. The fix keeps desktop untouched while making the battle HUD, player strip, stage, and hand share the short viewport more deliberately.
- The fullscreen button is progressive enhancement: supported browsers can reclaim toolbar space, while unsupported browsers simply keep the responsive layout without showing a broken control.

### The Tech Debt
- The phone-landscape breakpoint is tuned to common mobile browser viewports rather than device-specific QA. We should still manually check Safari and Chrome on a real phone because fullscreen support and toolbar behavior differ by browser.

## 2026-05-22 - Phone Landscape Arena Overlay Scale Pass

### The Change
- Added responsive hooks to [BattleScreenStatusLayer.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreenStatusLayer.tsx) so socket/error notifications can shrink on phone landscape.
- Added class hooks in [BattleScreen.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx) for the in-arena combat notice and both base HP meters.
- Added class hooks in [BattleScreenOverlays.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreenOverlays.tsx) for the match-finished result card, expression blocks, payout/status/stat pills, actions, and settlement details.
- Extended [globals.css](/d:/projects/Cora/apps/web/src/app/globals.css) to reduce notification size, combat notice size, base-bar width/height/type, HUD pill type, result emoji blocks, and the match-finished overlay on phone landscape.

### The Reasoning
- The arena frame now fits better, but secondary UI was still eating the same short viewport. Scaling the notification and result layers in the same breakpoint keeps the entire battle experience consistent instead of fixing only the card hand.
- The result overlay uses max-height plus internal scrolling for details, so core outcome/action content stays reachable even when a phone browser toolbar leaves very little vertical room.

### The Tech Debt
- The share modal and generated share cards are not yet independently optimized for phone landscape. If users commonly share directly from landscape battle, those surfaces need their own compact pass.

## 2026-05-22 - Extra Compact Post-Match Overlay Tuning

### The Change
- Tightened the phone-landscape post-match result overlay rules in [globals.css](/d:/projects/Cora/apps/web/src/app/globals.css), reducing result card width/padding, title size, payout pill size, expression tile size, stat/status pill size, and vertical gaps.
- Added a more specific `.btn-game.battle-result-action` rule so the compact post-match action buttons override the global chunky game-button sizing in landscape phone viewports.
- Added a shorter-height override for sub-390px landscape heights, including smaller expression tiles and smaller result actions.

### The Reasoning
- The 642x300 viewport still showed the result overlay consuming nearly the whole arena, and the global `.btn-game` rule was re-inflating the buttons after the compact media query. The more specific selector keeps result actions intentionally small without changing buttons elsewhere.

### The Tech Debt
- This is still CSS-tuned rather than screenshot-tested through Playwright. Real-device Safari/Chrome should be the final judge because browser chrome changes the available viewport height.

## 2026-05-22 - Phone Landscape Share Modal Wrapper

### The Change
- Updated [BattleScreenOverlays.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreenOverlays.tsx) to wrap the existing match-result and challenge share cards in a phone-landscape preview shell.
- Added phone-landscape CSS in [globals.css](/d:/projects/Cora/apps/web/src/app/globals.css) to shrink the share modal chrome, scale the preview shell, and keep the preview scrollable inside tiny landscape heights.

### The Reasoning
- The share card renderer is also used for saved/generated outputs, so the card component and render inputs were left untouched. The modal now scales only the browser preview wrapper, preserving the original share-card rendering and export behavior.

### The Tech Debt
- The scaled preview uses CSS transform and an internal scroll frame. If the share flow becomes a primary mobile-landscape action, a dedicated mobile preview mode could improve ergonomics while still keeping export rendering separate.

## 2026-05-22 - Keep Share Modal Actions Visible

### The Change
- Updated the phone-landscape share modal CSS in [globals.css](/d:/projects/Cora/apps/web/src/app/globals.css) so the share modal stack is a fixed-height flex column.
- Capped the scaled preview frame height and made the share action row a non-shrinking footer inside the modal.

### The Reasoning
- The previous scaled preview still consumed too much of a 300px-tall landscape viewport, pushing `Save As PNG` and `Create Blink` below the visible area. The modal now reserves vertical room for those actions instead of relying on page scroll.

### The Tech Debt
- The preview scale is tuned for the current share card dimensions. If the share card content grows, revisit the preview scale or add responsive preview presets.

## 2026-05-22 - Remove Share Preview Scrollbars

### The Change
- Updated the phone-landscape share preview frame in [globals.css](/d:/projects/Cora/apps/web/src/app/globals.css) to hide internal overflow instead of showing horizontal and vertical scrollbars.
- Reduced the share preview scale further for short landscape viewports so the preview, close control, and action buttons can coexist in the 300px-height layout.

### The Reasoning
- The preview wrapper used CSS transform scaling, but the unscaled layout box still created scrollable overflow. Hiding the preview-frame overflow and tuning the scale keeps the modal clean while preserving the original share-card rendering and export path.

### The Tech Debt
- Extremely tall share-card content can now be clipped in the tiny landscape preview. The exported image is unaffected, but future preview-only affordances may need a tap-to-expand view.

## 2026-05-22 - Revert Mobile Share Modal Control Placement

### The Change
- Reverted the last phone-landscape share modal control-placement tweak in [globals.css](/d:/projects/Cora/apps/web/src/app/globals.css).
- Restored the share preview frame and close/action layout to the previous no-scrollbar state.

### The Reasoning
- The requested control placement change was not the desired direction. Keeping the prior no-scrollbar wrapper is safer while we decide the exact mobile share modal layout.

### The Tech Debt
- The share modal still needs a better mobile-only control layout, but the next pass should be checked against the target 642x300 viewport before landing.

## 2026-05-22 - Extreme Landscape Arena Scale Mode

### The Change
- Added an ultra-short phone-landscape breakpoint in [globals.css](/d:/projects/Cora/apps/web/src/app/globals.css) for viewports under `260px` tall.
- In that breakpoint, the battle shell is treated as a fixed `16 / 9` virtual board and scaled down to fit the available height/width.
- Added a tighter scale for sub-`230px` landscape heights, matching the `642x220` stress case.

### The Reasoning
- The existing phone-landscape responsive rules work for normal short phones, but extremely shallow viewports should not keep stretching the arena across the full width. Scaling the whole arena as a fixed-ratio board preserves the battle composition instead of continuing to compress individual pieces.

### The Tech Debt
- The scale factors are CSS-tuned for the current arena dimensions. If the battle HUD grows, the virtual-board scale may need a quick recalibration.

## 2026-05-22 - Center Extreme Landscape Scale Mode

### The Change
- Updated the extreme landscape arena scale rules in [globals.css](/d:/projects/Cora/apps/web/src/app/globals.css) so the scaled battle shell is absolutely centered with `left/top: 50%` and `translate(-50%, -50%)`.

### The Reasoning
- The previous transform-based scale relied on grid centering of the unscaled virtual board. In very shallow viewports, the visual scaled board could appear shifted to the right because layout and transformed visual dimensions were different. Explicit center positioning keeps the scaled board visually centered.

### The Tech Debt
- The extreme layout still depends on hand-tuned virtual-board scale values. A future cleanup could calculate this with a single CSS variable pair for virtual width and scale.

## 2026-05-22 - Restore Scientist Pick Scrolling

### The Change
- Updated [LobbyScreen.tsx](/d:/projects/Cora/apps/web/src/components/lobby/LobbyScreen.tsx) so the lobby root only hides horizontal overflow instead of clipping all overflow.
- Updated [CharacterSelect.tsx](/d:/projects/Cora/apps/web/src/components/lobby/CharacterSelect.tsx) so the pick-scientist shell stays vertically scrollable at medium/tablet widths instead of switching to a fixed `100svh` hidden-overflow layout.

### The Reasoning
- Mobile and tablet landscape can make the scientist roster plus header/action row taller than the viewport. The previous overflow clamps left the page with extra content but no scroll container, so users could not reach the lower cards or continue action.

### The Tech Debt
- This should still be checked on the target real devices/browser chrome, because `svh` behavior and visible toolbar height vary between mobile Safari and Chrome.

## 2026-05-22 - Compact Lobby Setup On Phones

### The Change
- Updated [LobbySetup.tsx](/d:/projects/Cora/apps/web/src/components/lobby/LobbySetup.tsx) with smaller base mobile spacing, text, arena rows, icon/check sizes, hero minimum height, and action-row gaps while keeping the existing roomier scale at `sm`/`md` breakpoints.
- Added a lobby-scoped phone override in [globals.css](/d:/projects/Cora/apps/web/src/app/globals.css) so `.btn-game` padding/font sizes shrink inside the lobby setup screen instead of being re-inflated by the global button rule.

### The Reasoning
- The `/lobby` setup screen was using desktop-ish defaults for phones, making the header pills, arena list, hero panel, and primary actions feel oversized before users even reach scientist selection. Compacting only the base styles improves mobile fit without disturbing tablet/desktop layout.

### The Tech Debt
- This pass is still size-tuning by breakpoint. The next mobile polish should be checked against the exact target phone dimensions and may need landscape-specific ordering if the arena art should stay visible above the selector.

## 2026-05-22 - Compact Lobby Setup In Short Landscape

### The Change
- Added short-landscape lobby setup selectors in [LobbySetup.tsx](/d:/projects/Cora/apps/web/src/components/lobby/LobbySetup.tsx) for the main card, arena panel/list/options, hero copy/title, and action block.
- Added a `max-width: 960px` plus `max-height: 540px` landscape override in [globals.css](/d:/projects/Cora/apps/web/src/app/globals.css) to shrink the `/lobby` header pills, arena column, option rows, hero padding/title, and action buttons when phone landscape triggers Tailwind's `md` breakpoint.

### The Reasoning
- The first compact pass only reduced base phone styles, but an iPhone 12 Pro landscape viewport is `844px` wide, so `md:` classes were still applying desktop-ish sizing. The short-landscape override targets that actual viewport shape directly.

### The Tech Debt
- The rule is intentionally scoped to `/lobby` setup. Other lobby phases may need matching short-landscape treatment as we move through the mobile/tablet pass.

## 2026-05-22 - Fit Lobby Setup Without Short-Landscape Scroll

### The Change
- Added a `lobby-setup-footer` hook in [LobbySetup.tsx](/d:/projects/Cora/apps/web/src/components/lobby/LobbySetup.tsx) for the secondary wallet/Blink action row.
- Updated the short-landscape rules in [globals.css](/d:/projects/Cora/apps/web/src/app/globals.css) so the `/lobby` setup screen uses a fixed `100svh` height, hides page overflow, flexes the main card into the remaining space, and keeps the footer as a compact visible row.
- Further tightened short-landscape header pill padding, arena option heights, hero padding, title size, and primary action sizing.

### The Reasoning
- The previous short-landscape pass reduced visual scale, but the main card still took enough height to push `Create Blink Challenge` below the viewport. Treating the screen as a height-budgeted layout makes the phase responsive enough to fit without page scrolling at the iPhone 12 Pro landscape viewport.

### The Tech Debt
- If wallet/browser overlays add more fixed UI in the future, the footer may need to become an icon-sized overflow menu in short landscape rather than staying as a full text button.

## 2026-05-22 - Stretch Lobby Setup On Tablet Landscape

### The Change
- Added a tablet-landscape media query in [globals.css](/d:/projects/Cora/apps/web/src/app/globals.css) for `961px`-plus landscape widths with enough viewport height.
- The `/lobby` setup screen now uses `100svh` height in that tablet-landscape range, keeps the header/footer fixed to their natural height, and lets the main arena card flex to fill the remaining vertical space.

### The Reasoning
- iPad landscape had the inverse of the phone problem: the UI fit, but the arena wrapper stayed content-height and left a large empty area underneath. Stretching the main card makes the layout feel intentionally responsive on tablet landscape without affecting the phone short-landscape no-scroll mode.

### The Tech Debt
- The tablet range is breakpoint-based. If Android tablets with unusual aspect ratios show awkward spacing, we may need to refine the range around aspect-ratio rather than only width/height.

## 2026-05-22 - Prevent Short-Landscape Arena Caption Wrap

### The Change
- Updated the short-landscape `/lobby` arena option caption rule in [globals.css](/d:/projects/Cora/apps/web/src/app/globals.css) so secondary labels stay on one line with ellipsis instead of wrapping.

### The Reasoning
- The narrow phone-landscape arena column made labels like `THE CLASSIC ARENA` wrap into three lines, making the selected row look broken. Keeping the caption single-line preserves row height and visual rhythm.

### The Tech Debt
- If arena captions become meaningfully longer, we may want explicit shorter mobile labels in data rather than relying on ellipsis.

## 2026-05-22 - Let Short-Landscape Arena Captions Span Right

### The Change
- Updated the short-landscape arena option layout in [globals.css](/d:/projects/Cora/apps/web/src/app/globals.css) so caption text uses the available row width and remains visible instead of truncating with ellipsis.

### The Reasoning
- The intended fix was not to show `THE...`, but to let labels like `THE CLASSIC ARENA` continue horizontally within the option row while staying single-line.

### The Tech Debt
- The short-landscape option structure is now CSS-targeted by child position. If this card markup changes, these selectors should be revisited.

## 2026-05-22 - Tune Short-Landscape Arena Icon and Check Alignment

### The Change
- Updated [LobbySetup.tsx](/d:/projects/Cora/apps/web/src/components/lobby/LobbySetup.tsx) to add explicit `lobby-setup-arena-token-icon` and `lobby-setup-arena-check` hooks and replaced text checkmarks with inline SVG check icons for stable centering.
- Updated short-landscape rules in [globals.css](/d:/projects/Cora/apps/web/src/app/globals.css) to reduce token icon SVG size and tighten check badge size/position.

### The Reasoning
- The phone-landscape arena row needed a smaller token icon, and the unicode checkmark baseline was visually offset inside the badge. SVG checks give predictable centering across devices and fonts.

### The Tech Debt
- These selector hooks are specific to the current arena option markup. If the row structure changes, icon/check overrides should be revalidated.

## 2026-05-22 - Restore Mobile-Landscape Arena Check Visibility

### The Change
- Updated [LobbySetup.tsx](/d:/projects/Cora/apps/web/src/components/lobby/LobbySetup.tsx) so arena check badges render with explicit inline color and higher stacking (`z-[2]`) in selected rows.
- Updated short-landscape check sizing in [globals.css](/d:/projects/Cora/apps/web/src/app/globals.css) to slightly larger badge/icon dimensions for better visibility on phone DPR scaling.

### The Reasoning
- After the SVG check migration, the mobile-landscape selected check could disappear due a combination of layering and tiny rendered size. Raising z-order and making the icon slightly larger restores reliable visibility.

### The Tech Debt
- If we continue scaling arena rows down further for extreme short viewports, check icon size should be tuned in lockstep to avoid another visibility regression.

## 2026-05-22 - Use CSS Arena Checks In Mobile Landscape

### The Change
- Updated [LobbySetup.tsx](/d:/projects/Cora/apps/web/src/components/lobby/LobbySetup.tsx) so selected arena badges render a `lobby-setup-arena-check-mark` span instead of an inline SVG path.
- Added CSS-drawn checkmark styling in [globals.css](/d:/projects/Cora/apps/web/src/app/globals.css) for the short-landscape arena check badge.
- Added an orange selected-check treatment for the BONK arena.

### The Reasoning
- The badge shell was visible in mobile landscape, but the SVG check path was disappearing. A CSS-drawn tick is simpler and more reliable at the tiny phone-landscape size, while the BONK state now matches its warm arena color.

### The Tech Debt
- The CSS check depends on border-based drawing. If the badge is scaled below the current short-landscape size, the mark dimensions should be retuned with the badge.

## 2026-05-22 - Restore Arena Checkmark Across Viewports

### The Change
- Moved `.lobby-setup-arena-check-mark` styling in [globals.css](/d:/projects/Cora/apps/web/src/app/globals.css) out of the short-landscape-only media query into a base rule so desktop, tablet, and mobile all render the selected checkmark.
- Changed the CSS-drawn tick from a left/bottom border shape to a right/bottom border shape rotated `45deg`, with phone-landscape only overriding its dimensions.

### The Reasoning
- The previous fix accidentally defined the visible checkmark only for short landscape, leaving other viewports with an unstyled empty span. The tick direction also made the phone-landscape mark barely visible. A base rule keeps the mark present everywhere, and the media query now only scales it.

### The Tech Debt
- The selected arena badge now depends on shared base styling plus a short-landscape size override. Future badge changes should be checked across phone portrait, phone landscape, tablet landscape, and desktop together.

## 2026-05-22 - Harden Arena Check Badge Shape

### The Change
- Updated [globals.css](/d:/projects/Cora/apps/web/src/app/globals.css) so `.lobby-setup-arena-check` owns its absolute position, fixed circular dimensions, grid centering, and full-circle radius with stronger CSS.
- Moved the visible checkmark drawing to `.lobby-setup-arena-check::before` and hid the child marker span, leaving the short-landscape rule to only resize the badge/check.

### The Reasoning
- The selected badge was still being stretched into an oval because Tailwind responsive sizing utilities and custom responsive rules were fighting. Making the badge a self-contained circular component removes that conflict and keeps the check visible.

### The Tech Debt
- The JSX still includes a child marker span for markup stability, but it is now hidden. A future cleanup can remove that span once the responsive pass settles.

## 2026-05-22 - Simplify Arena Check Badge

### The Change
- Updated [LobbySetup.tsx](/d:/projects/Cora/apps/web/src/components/lobby/LobbySetup.tsx) so selected arena badges render only the purpose-built `lobby-setup-arena-check` class and the original text checkmark character.
- Updated [globals.css](/d:/projects/Cora/apps/web/src/app/globals.css) to remove pseudo-element check drawing and make the badge a self-contained circular flex element with fixed width/height, `border-radius: 50%`, centered text, and short-landscape-only size reduction.

### The Reasoning
- The badge was broken because JSX utility classes, pseudo-element check drawing, and responsive overrides were all fighting each other. Returning to a plain text check inside one CSS-owned circle restores the previous mark while keeping the badge round and vertically centered across viewport sizes.

### The Tech Debt
- This should be visually checked after the dev server refresh because prior browser-cached CSS made this area hard to trust by inspection alone.

## 2026-05-22 - Refactor Option Layout Selectors to Prevent Check Leakage

### The Change
- Refactored generic direct-child selectors `.lobby-setup-arena-option > div` in [globals.css](/d:/projects/Cora/apps/web/src/app/globals.css) inside the landscape media query to target `.lobby-setup-arena-option > div:first-child` and `.lobby-setup-arena-token-icon` specifically.

### The Reasoning
- The `.lobby-setup-arena-check` badge was being stretched into a capsule shape and its text was overflowing/falling out because it was a direct child `div` of `.lobby-setup-arena-option`. As a result, it was matching the generic media-query rules for `.lobby-setup-arena-option > div`, which leaked `padding-right: 24px` and custom layout sizes onto it. Targeting only the first child div (the content wrapper) isolates the checkmark element completely, allowing it to render as a perfect circle with the check character centered.

### The Tech Debt
- Other parts of the app may still rely on generic `> div` selectors inside parent containers. Standardizing custom layout components with class-based selectors would prevent style leakage long-term.

## 2026-05-22 - Mobile Portrait Horizontal Token Chips selector

### The Change
- Updated [LobbySetup.tsx](/d:/projects/Cora/apps/web/src/components/lobby/LobbySetup.tsx) options container to use a responsive flex structure: horizontal row on mobile portrait (`flex-row gap-2`) and vertical stack on desktop/tablets (`sm:flex-col sm:gap-0 sm:space-y-3`).
- Refactored the option button contents layout to stack elements vertically (`flex-col items-center justify-center`) on mobile portrait view while keeping horizontal structure on desktop/tablets.
- Made the "And More To Come" placeholder button responsive, collapsing its long text on mobile to display a clean `+` sign.
- Added portrait mobile `@media (max-width: 639px)` style overrides in [globals.css](/d:/projects/Cora/apps/web/src/app/globals.css) to:
  - Transform rectangular options into perfect circular game tokens using `aspect-ratio: 1/1` and circular radiuses (`border-radius: 999px`), while overriding standard corner clips.
  - Hide long descriptive flavor texts and center label content.
  - Position and float selected checkmark icons (`.lobby-setup-arena-check`) at the top-right overlapping border of the active circular chips.

### The Reasoning
- On mobile portrait view, the vertical list of rectangular choice buttons occupied excessive vertical height. This pushed the key artwork card and the primary game buttons ("TRY FREE TUTORIAL", "PICK SCIENTIST") down the viewport, causing a cramped layout.
- Transforming the choices into a compact horizontal bar of sleek circular token chips reduces vertical selection height from ~260px to ~65px, giving full breathing room to the primary visual interface while maintaining a premium game-like feel.

### The Tech Debt
- On extremely narrow screens (< 320px), the circular chips might shrink. However, standard portrait viewports (360px+) are fully supported.
- If extra arenas are added in the future, we may need to implement a horizontal swiper for the token chip bar.

## 2026-05-22 - Fix Header Pill Wrap and Syntax Error in Lobby Setup

### The Change
- Fixed a compilation/syntax error in [LobbySetup.tsx](/d:/projects/Cora/apps/web/src/components/lobby/LobbySetup.tsx) around the top header layout.
- Restored the missing `style={{` tag on the main `.lobby-setup-card` wrapper.
- Properly flattened the top header layout so that the `Address` (Wallet ID), `Wager`, `Balance`, `Replay Intro`, and `History Coming Soon` pills are direct sibling nodes inside the outer `flex flex-wrap items-center gap-2` container.
- Added a responsive hidden-sm constraint `<span className="hidden sm:inline"> Balance</span>` inside the `Balance` pill.

### The Reasoning
- An incomplete file merge in a previous code edit deleted parts of the balance pill container and the `Replay Intro` button, resulting in a parsing error and a broken screen.
- In addition, selecting BONK/MEW expanded the balance text (`COMING SOON`), which caused the nested `[ Wager | Balance ]` block to wrap and push the entire dashboard layout down onto 3 rows.
- Flattening the flex container allows each badge/pill to wrap individually if space runs out, rather than grouping them in nested boxes.
- Shortening the mobile label (from `BONK Balance: COMING SOON` to `BONK: COMING SOON`) keeps the total character width tight and prevents the header row from wrapping into a third row entirely, keeping a stable two-row configuration on mobile portrait across all selected arenas.

### The Tech Debt
- The `wagerUsd` and `tokenBalanceValue` values are currently read-only mocks on mobile; when the live wallet transaction/balance hook integration is active, these layout constraints must be verified with active real data.

## 2026-05-22 - Standardize Compact Balance Pill to Prevent Header Wrap

### The Change
- Refactored `LobbySetup.tsx` to simplify and consolidate the `tokenBalanceValue` variable, removing the unused `tokenBalanceLabel` and `tokenBalanceValueMobile`.
- Modified the balance pill markup in [LobbySetup.tsx](/d:/projects/Cora/apps/web/src/components/lobby/LobbySetup.tsx) to always use the compact `{Token}: {Value}` format directly (e.g., `SOL: 0`, `BONK: Soon`, `MEW: Soon`), completely removing screen-width responsive spans and media-query toggles for the text content.

### The Reasoning
- Even with responsive helper spans, Next.js hydration mismatches or simulator layout queries could render the full `COMING SOON` text instead of `Soon` below the `sm` breakpoint on mobile viewports.
- Standardizing the balance pill to use the compact `{Token}: {Value}` HUD format across both mobile and desktop solves this cleanly. It guarantees a 100% stable layout width (maximum 10–12 characters), eliminates responsive CSS and hydration conflicts, and keeps all five header pills locked into a clean, stable two-row configuration on mobile portrait across all selected tokens.

### The Tech Debt
- None. This is a clean simplification that removes dead logic and media-query complexity from the component.

## 2026-05-22 - Fix Next.js Wallet Hydration Mismatch in Lobby Setup

### The Change
- Added a `mounted` state guard pattern via a local `useState` and `useEffect` inside [LobbySetup.tsx](/d:/projects/Cora/apps/web/src/components/lobby/LobbySetup.tsx).
- wrapped all properties, attributes, and conditional blocks that depend on the browser's client-side Solana wallet state (e.g. `selectedWallet`, `walletConnected`, `playability`, `connecting`) in the `mounted` check to render stable placeholder states during the initial pre-rendered SSR pass.

### The Reasoning
- The browser wallet adapter loads previously selected wallets from local storage on mount. Since Next.js has no access to client local storage during Server-Side Rendering (SSR), it pre-renders the HTML with no wallet connected (`Select Wallet` button text).
- Upon page hydration, if the client has a wallet selected, the mismatch in button labels (`Select Wallet` on server vs `Connect Wallet` on client) or the presence of conditionally rendered wallet status elements triggers a React hydration warning.
- Forcing the component to match the server HTML structure until `mounted` is set to `true` on the client completely avoids these hydration mismatches and allows the wallet state to safely load dynamically after the page loads.

### The Tech Debt
- None. This is standard best practice for client-only state variables in Next.js.

## 2026-05-22 - Fix Lobby Setup Header Split and Left-Centered Options

### The Change
- Split the single outer header flex container in [LobbySetup.tsx](/d:/projects/Cora/apps/web/src/components/lobby/LobbySetup.tsx) into two distinct sibling flex containers: one on the left containing `Address` (Wallet identity), `Wager`, and `Balance` pills, and one on the right containing `Replay Intro` and `History Coming Soon` pills.
- Added the `sm:justify-start` class to the inner flex container of the arena choice option buttons (both the dynamic mapping and the static MEW teaser) in [LobbySetup.tsx](/d:/projects/Cora/apps/web/src/components/lobby/LobbySetup.tsx).

### The Reasoning
- Flattening the header in a single wrapper previously caused `<header className="... justify-between">` to place all five pills on the far left. By dividing them into left and right flex cluster wrappers, Tailwind's `justify-between` naturally pushes the secondary utilities to the right side of the screen on desktop/landscape viewports while maintaining compact stacking behavior on mobile portrait.
- The arena choice buttons previously centered their icon and text contents horizontally on desktop/landscape viewports, which looked mismatched. Adding `sm:justify-start` aligns the icon and text block to the left edge of the wide rectangular button while keeping them vertically centered, aligning with the absolute checkmark floated on the right.

### The Tech Debt
- None. This utilizes standard Tailwind CSS alignment utility classes and restores the intended layout cleanly.

## 2026-05-22 - Make Main Setup Card Grow Vertically in Portrait

### The Change
- Added the `grow` (`flex-grow: 1`) class to the main `.lobby-setup-card` container in [LobbySetup.tsx](/d:/projects/Cora/apps/web/src/components/lobby/LobbySetup.tsx).

### The Reasoning
- In portrait viewports on tall devices, there was excessive empty space at the bottom of the screen below the card, causing the `Create Blink Challenge` footer button to sit floating awkwardly in the middle.
- Adding `grow` lets the card expand dynamically to fill all available vertical space inside the `min-h-[100svh]` container. This pushes the footer to the bottom of the screen, and the inner `.lobby-setup-hero` section (which already has `grow`) expands vertically to fill the card. The backdrop artwork, title, and buttons beautifully occupy this space, creating a highly polished, immersive full-screen dashboard app layout.

### The Tech Debt
- None. This uses standard Tailwind responsive flex structures and plays nicely with the landscape media overrides which force `flex: 1 1 auto` to stretch height correctly in landscape.

## 2026-05-22 - Refactor Character Selection Screen for Responsive Landscape

### The Change
- **Upgraded Grid Layout Breakpoints**: Changed the scientist cards selection grid breakpoint from `xl:grid-cols-3` to `lg:grid-cols-3` in [CharacterSelect.tsx (character)](/d:/projects/Cora/apps/web/src/components/character/CharacterSelect.tsx) to align all 3 option cards side-by-side on tablet landscape viewports (e.g. `1180px` wide).
- **Injected Semantic Class Hooks**: Introduced specific class wrappers (`.character-select-screen`, `.character-select-header`, `.character-select-title`, `.character-select-desc`, `.character-select-footer`, `.character-select-continue-btn`, `.character-card-btn`, `.character-card-avatar`, `.character-card-info`, `.character-card-name`, `.character-card-base`, `.character-card-badge-row`, and `.character-card-status-container`) inside [CharacterSelect.tsx (lobby)](/d:/projects/Cora/apps/web/src/components/lobby/CharacterSelect.tsx), [CharacterSelect.tsx (character)](/d:/projects/Cora/apps/web/src/components/character/CharacterSelect.tsx), and [CharacterCard.tsx](/d:/projects/Cora/apps/web/src/components/character/CharacterCard.tsx).
- **Wrapped Textual Info in Character Cards**: Refactored [CharacterCard.tsx](/d:/projects/Cora/apps/web/src/components/character/CharacterCard.tsx) to wrap card descriptions, role badges, base info, and selection status inside a dedicated vertical flex-column container (`.character-card-info`), decoupling them from the absolute card layout.
- **Implemented Premium Landscape Overrides**: Injected custom visual media query styles in [globals.css](/d:/projects/Cora/apps/web/src/app/globals.css) for short landscape screens (`@media (orientation: landscape) and (max-height: 540px)`):
  - Compressed paddings, text sizes, and margins globally across the selection phase container to fit inside a single `100svh` view height without scrolling.
  - Hid verbose description paragraphs (`.character-select-desc`) inside narrow landscape headers.
  - Forced a 3-column side-by-side grid layout on mobile landscape screens.
  - Morphed standard vertical rectangular cards into highly compact horizontal rows (`flex-direction: row`), containing a tight `68px` circular avatar on the left and stacked detail metadata on the right.

### The Reasoning
- On mobile landscape screens (e.g. iPhone 12 Pro), the original character select screen overflowed vertically, demanding significant scrolling to access characters and the main continue CTA button. Cards had rigid `min-h-[350px]` styles and square avatars that were too tall for a `390px` high viewport.
- Switching to horizontal flex-row cards under a media query compresses each card to a highly aesthetic `120px` height.
- On tablet landscape (e.g. iPad Air), the previous `xl:grid-cols-3` constraint forced the third scientist card to wrap to a second row, making it look unbalanced. Changing to `lg:grid-cols-3` lets all three cards sit side-by-side inside viewports wider than `1024px` perfectly.
- Compacting spacing, hiding verbose text, and layout morphing are handled entirely in pure CSS, ensuring stable rendering and avoiding any React SSR/client hydration warnings.

### The Tech Debt
- Tablet portrait sizes and mobile portrait screens continue to use the standard vertical stacking layouts correctly. The custom horizontal overrides are scoped strictly to low-height landscape orientations. No tech debt is introduced.

## 2026-05-22 - Refine Character Select Landscape to Vertical Card Layout

### The Change
- **Cleaned up globals.css duplicate styles**: Resolved a PostCSS compilation error (`CssSyntaxError`) in `apps/web/src/app/globals.css` by deleting duplicate keyframes, wallet-adapter overrides, and paper-grain text blocks.
- **Refactored character cards in mobile/tablet landscape overrides**: Modified the media-query overrides in `apps/web/src/app/globals.css` for `@media (orientation: landscape) and (max-height: 540px)` so character cards remain vertically oriented (picture above, info below) instead of turning horizontal (sideways).
- **Implemented vertical scaling and stretching constraints**:
  - Bound the cards' height to `100%` and `min-height: 0` inside the grid cells, and used flex grow constraints so that all three cards stretch to fill the screen viewport height exactly.
  - Compressed the avatar (`.character-card-avatar`) to a compact `80px` square and centered it horizontally above the description texts.
  - Tightened margins and scaled down name/base/badge typography to preserve standard game aesthetics in short viewports.

### The Reasoning
- The user requested keeping the gorgeous vertical card composition (portrait picture on top and info below) even on compact landscape screens, rather than layout-morphing them to sideways cards.
- Restructuring the CSS with `flex-grow` and `height: 100%` ensures the standard vertical cards scale down cleanly, fitting all elements (header, three cards, and queue button) perfectly inside an iPhone 12 Pro landscape viewport (`390px` high) without any vertical scroll.
- Fixing the duplicated blocks in `globals.css` ensures Next.js/Turbopack compiles the CSS bundle smoothly.

### The Tech Debt
- None. Spacing, padding, and sizes scale proportionally down, maintaining absolute parity with the design specs.

## 2026-05-22 - Polish Replay Intro Overlay for Mobile Landscape

### The Change
- **Injected Semantic Class Hooks**: Added specific class hooks (`.intro-overlay-backdrop`, `.intro-overlay-modal`, `.intro-overlay-glow`, `.intro-overlay-grid`, `.intro-overlay-visual`, `.intro-overlay-video-wrapper`, `.intro-overlay-mockup-wrapper`, `.intro-overlay-content`, `.intro-overlay-text-wrapper`, `.intro-overlay-step-pill`, `.intro-overlay-step-pill-dot`, `.intro-overlay-step-pill-text`, `.intro-overlay-title`, `.intro-overlay-copy`, `.intro-overlay-nav`, `.intro-overlay-dots-container`, and `.intro-overlay-btn-group`) into [IntroOverlay.tsx](/d:/projects/Cora/apps/web/src/components/lobby/IntroOverlay.tsx).
- **Added Semantic Classes to Mockups**: Added specific class hooks (`.wallet-mockup`, `.wallet-mockup-header`, `.wallet-mockup-body`, `.wallet-mockup-card`, `.wallet-mockup-steps`, and `.playcards-mockup`, `.playcards-mockup-opponent`) into [IntroOverlay.tsx](/d:/projects/Cora/apps/web/src/components/lobby/IntroOverlay.tsx) sub-components to allow targeted styling.
- **Implemented Premium Landscape Overrides**: Injected premium visual style overrides in [globals.css](/d:/projects/Cora/apps/web/src/app/globals.css) inside the short landscape media query (`@media (orientation: landscape) and (max-height: 540px)`):
  - Bound the modal height to `98svh` and forced `overflow: hidden` to completely eliminate vertical scrolling, providing a console-like native app feel.
  - Adjusted the grid and columns to stretch to 100% height without any overflow.
  - Scaled down padding, typography (title `3xl` -> `1.25rem`, copy `sm` -> `10.5px`), spacing, and dots indicators.
  - Created bespoke, meticulously detailed micro-scaling rules for all 4 animated CSS/SVG interactive fallbacks (`WalletDevnetMockup`, `PlayCardsMockup`, `TimerMockup`, `WagerMockup`) to ensure they scale and fit inside their aspect-ratio containers beautifully on small landscape viewports.
  - Applied `transform: scale(0.85) !important;` to `.intro-overlay-modal` to visually scale down the modal, providing margins around the edges and ensuring it feels like a native floating overlay rather than a full-screen takeover.

### The Reasoning
- On mobile landscape viewports (e.g. `844x390` on iPhone 12 Pro), the Replay Intro modal was too tall and got severely cut off/scrolled because of grid `min-h-[500px]` constraints and large padding.
- Adding targeted overrides under the low-height landscape media query shrinks and compacts spacing, text sizes, and mockup sizes perfectly.
- Applying a CSS `scale` transform shrinks the entire container while preserving its aspect ratio and layout rules, creating a comfortable visual padding without risking squished inner flex items.
- This creates an extremely premium, perfectly framed, scroll-free, and immersive onboarding slideshow that adapts elegantly to small landscape devices without affecting desktop or tablet experiences.

### The Tech Debt
- None. The changes are strictly scoped under the media query and use semantic class hooks, ensuring high maintainability and zero risk of regression on other viewports.

## 2026-05-22 - Scale Bot Found Screen in Mobile Landscape

### The Change
- Added a bot-only class hook to [OpponentFound.tsx](/d:/projects/Cora/apps/web/src/components/lobby/OpponentFound.tsx) so the found screen can be targeted without touching standard PvP rooms.
- Added a small class hook to the active match toast in [LobbyScreen.tsx](/d:/projects/Cora/apps/web/src/components/lobby/LobbyScreen.tsx).
- Added a short mobile landscape media query in [globals.css](/d:/projects/Cora/apps/web/src/app/globals.css) that scales the bot found screen to `0.82` and the toast to `0.86`.

### The Reasoning
- The bot found page was visually too large in iPhone-style landscape, but the layout itself was acceptable. Scaling the existing composition preserves positions and desktop/tablet behavior while making the mobile landscape view breathe.
- The query is scoped to `orientation: landscape`, `max-width: 960px`, `max-height: 540px`, and `pointer: coarse`, avoiding desktop and normal tablet viewports.

### The Tech Debt
- None. This is intentionally a narrow scale-only fix, leaving the underlying desktop layout untouched.

## 2026-05-22 - Tighten Tutorial Found Scale for iPhone Landscape

### The Change
- Added a stricter short-height mobile landscape override in [globals.css](/d:/projects/Cora/apps/web/src/app/globals.css) for `max-height: 420px`.
- Reduced the bot found screen scale from the broader `0.82` to `0.72` for iPhone-style landscape heights, and reduced the tutorial toast scale from `0.86` to `0.76`.

### The Reasoning
- The Try Free Tutorial path still felt oversized at `844x390` after the broader mobile-landscape scale.
- This keeps the requested scale-only approach while targeting the specific cramped viewport range without changing desktop, tablet, or taller landscape screens.

### The Tech Debt
- None. The fix remains scoped to coarse-pointer mobile landscape and uses only scale overrides.

## 2026-05-22 - Reflow Bot Found Screen for Mobile Landscape

### The Change
- Added semantic layout hooks to [OpponentFound.tsx](/d:/projects/Cora/apps/web/src/components/lobby/OpponentFound.tsx) for the bot found screen, practice banner, duel grid, player cards, VS label, and deposit/status area.
- Updated [globals.css](/d:/projects/Cora/apps/web/src/app/globals.css) so bot/tutorial opponent-found screens use a two-column layout only in coarse-pointer short landscape viewports:
  - Left column: player card, VS label, bot card.
  - Right column: practice banner and compact match/deposit/status info.
- Kept the active match toast compact in the same mobile landscape viewport via the existing [LobbyScreen.tsx](/d:/projects/Cora/apps/web/src/components/lobby/LobbyScreen.tsx) toast hook.

### The Reasoning
- The Try Free Tutorial flow reaches this screen after character selection, and the previous desktop-style stack was too tall and visually crowded on iPhone landscape.
- A two-column layout uses the available width instead of fighting the limited height, matching the requested structure while keeping desktop and larger tablet views on the original layout.
- The media query is scoped to `orientation: landscape`, `max-width: 960px`, `max-height: 540px`, and `pointer: coarse`, so regular desktop and tablet layouts remain untouched.

### The Tech Debt
- The deposit/status panel still uses descendant selectors for some compact text sizing. A future cleanup could add first-class semantic classes inside `DepositPanel` if this layout needs more tuning.

## 2026-05-22 - Center Bot Duel Stack in Mobile Landscape

### The Change
- Updated the bot/tutorial opponent-found mobile landscape grid in [globals.css](/d:/projects/Cora/apps/web/src/app/globals.css) so the left duel stack uses content-sized rows (`auto auto auto`) instead of stretching player and bot cards to fill the whole column height.
- Increased the internal duel stack gap slightly from `6px` to `8px` so the cards and VS label read as a centered cluster.

### The Reasoning
- The two-column mobile landscape layout was structurally correct, but the player and bot cards stretched from top to bottom, making the left side feel pinned to the extremes.
- Content-sized rows keep `[You] / VS / [Bot]` grouped in the middle, matching the intended compact duel presentation without affecting desktop or larger tablet layouts.

### The Tech Debt
- None. This is a small CSS-only refinement inside the existing coarse-pointer short-landscape query.

## 2026-05-22 - Align Bot Found Columns in Mobile Landscape

### The Change
- Updated the bot/tutorial opponent-found mobile landscape CSS in [globals.css](/d:/projects/Cora/apps/web/src/app/globals.css) so the left duel stack and right info stack both occupy row 2 of the layout grid.
- Changed the bot layout columns from `42% / 58%` to `38% / 62%`.
- Capped the player and bot card width at `22rem` and centered each card inside the left column.
- Centered the right deposit/status area vertically in the same row as the duel stack.

### The Reasoning
- The previous two-column layout had the left duel stack spanning both rows, while the right status panel started lower. This made the columns feel misaligned.
- Moving both major content groups into the same row gives them a shared vertical baseline, while the narrower card cap removes the empty right-side space inside the player and bot cards.

### The Tech Debt
- None. This remains a CSS-only refinement scoped to mobile landscape bot/tutorial found screens.

## 2026-05-22 - Unstack Bot Found Notifications and Lift Info Card

### The Change
- Updated [globals.css](/d:/projects/Cora/apps/web/src/app/globals.css) so the bot/tutorial found info shell has no extra top margin and is lifted slightly inside the mobile landscape layout.
- Moved the active match toast lower and narrowed it in the same mobile landscape query so it no longer stacks directly on top of the practice banner.

### The Reasoning
- The left duel stack and the right info panel still felt misaligned because the info card had visual top offset inside its grid area.
- The practice banner and tutorial toast were occupying the same top notification lane, so separating their vertical positions removes the stacked notification effect without changing desktop or larger tablet views.

### The Tech Debt
- None. This is scoped to the existing short, coarse-pointer landscape media query.

## 2026-05-22 - Center Bot Found Layout Vertically

### The Change
- Updated the mobile landscape bot/tutorial found layout in [globals.css](/d:/projects/Cora/apps/web/src/app/globals.css) so the outer grid uses content-sized rows (`auto auto`) and `align-content: center`.
- Removed the manual `translateY(-44px)` lift from the right info card.
- Slightly increased the row gap to keep the centered group readable after removing the manual offset.

### The Reasoning
- The previous fix lifted the right info card by hand, which made the bottom gap too large and the whole layout feel high in the viewport.
- Centering the actual grid content as a group balances the top and bottom breathing room without relying on hard-coded upward movement.

### The Tech Debt
- None. This is a CSS-only refinement inside the existing mobile landscape bot/tutorial query.

## 2026-05-22 - Center Practice Banner and Remove Tutorial Toast

### The Change
- Removed the success toast emitted by the Try Free Tutorial path in [LobbyScreen.tsx](/d:/projects/Cora/apps/web/src/components/lobby/LobbyScreen.tsx).
- Updated [globals.css](/d:/projects/Cora/apps/web/src/app/globals.css) so the practice mode banner spans the full bot/tutorial found mobile landscape grid and centers itself with a capped width.

### The Reasoning
- The tutorial transition already has the practice mode banner and match status panel, so the extra "Tutorial match initialized" toast duplicated the message and visually stacked over the banner.
- Centering the practice banner across both columns makes it read as a screen-level status instead of a right-column panel.

### The Tech Debt
- None. The toast removal is limited to the tutorial success path; other lobby success/error toasts remain intact.

## 2026-05-22 - Normalize Practice Banner Centering

### The Change
- Updated [globals.css](/d:/projects/Cora/apps/web/src/app/globals.css) so the bot/tutorial practice mode banner explicitly clears leftover fixed-position offsets, uses `translate: 0 0`, centers with auto margins, and has a slightly narrower capped width.

### The Reasoning
- The banner was spanning both columns but still visually read as attached to the left side because its inherited notification sizing/positioning made the centered grid item feel offset.
- Clearing those offsets and using explicit centered sizing makes the banner sit as a screen-level heading above the two-column layout.

### The Tech Debt
- None. This remains scoped to the mobile landscape bot/tutorial found screen.

## 2026-05-22 - Correct Bot Found Banner Grid Logic

### The Change
- Updated [globals.css](/d:/projects/Cora/apps/web/src/app/globals.css) so the bot/tutorial practice banner is forced to be a static grid item in row 1 spanning both columns.
- Replaced the combined grid `gap` with explicit row and column gaps for the mobile landscape bot/tutorial layout.
- Added `!important` resets for the practice banner's fixed-position offsets and translate/transform utilities.

### The Reasoning
- The intended mobile landscape structure is `tutorial banner` above `duel stack | info panel`.
- The banner still appeared clipped toward the left because it retained behavior from its original fixed notification role. Hard-resetting those mobile-landscape-only properties makes the sectioning match the intended two-row layout.

### The Tech Debt
- None. This only applies inside the existing coarse-pointer short-landscape media query.

## 2026-05-22 - Make Tutorial Banner Normal Flow

### The Change
- Removed the fixed-position Tailwind utilities from the bot/tutorial practice banner in [OpponentFound.tsx](/d:/projects/Cora/apps/web/src/components/lobby/OpponentFound.tsx).
- Simplified the mobile landscape banner override in [globals.css](/d:/projects/Cora/apps/web/src/app/globals.css) now that the banner is no longer fighting fixed positioning.

### The Reasoning
- The target structure is `tutorial banner` above `duel stack | info panel`.
- Reusing the old fixed notification classes made the banner keep escaping the mobile landscape grid, even with CSS resets. Making the JSX element normal-flow gives the grid full control over placement.

### The Tech Debt
- None. The banner only renders for bot/tutorial matches, so removing fixed utilities does not affect normal PvP opponent-found alerts.

## 2026-05-22 - Force Tutorial Found Grid Areas

### The Change
- Updated the bot/tutorial opponent-found mobile landscape rules in [globals.css](/d:/projects/Cora/apps/web/src/app/globals.css) to use explicit `practice`, `duel`, and `deposit` grid areas.
- Forced the relevant layout utilities inside that mobile-landscape-only query so the practice banner becomes a centered top row and the second row is `VS stack | info panel`.

### The Reasoning
- The intended structure is `tutorial banner` above `duel stack | info panel`.
- The previous rules still depended on normal grid placement and inherited utility behavior, which let the banner visually drift into the left cluster.

### The Tech Debt
- None. The override is still limited to short coarse-pointer landscape viewports for bot/tutorial matches.

## 2026-05-22 - Center Practice Banner on Tablet and Desktop

### The Change
- Updated the practice mode banner wrapper in [OpponentFound.tsx](/d:/projects/Cora/apps/web/src/components/lobby/OpponentFound.tsx) with `mx-auto` and `self-center`.

### The Reasoning
- Outside the mobile landscape grid override, the banner is a normal flex child with a capped width, so it defaulted to the left edge of the opponent-found content column.
- Centering the wrapper fixes tablet and desktop alignment while leaving the mobile landscape media query untouched.

### The Tech Debt
- None. Mobile landscape keeps its explicit grid-area override.

## 2026-05-22 - Compact Portrait Bot Duel Cards

### The Change
- Added a portrait-only bot/tutorial override in [globals.css](/d:/projects/Cora/apps/web/src/app/globals.css) for the opponent-found duel section.
- The portrait duel area now lays out as `[you card] VS [rival card]`, with each card using a compact 3:4 ratio and vertical `label -> portrait -> wallet` content.
- Hid the longer character name/base lines in this portrait bot view to keep the cards readable.

### The Reasoning
- Portrait mobile has enough vertical scroll room, but the full-width stacked cards made the rival reveal area feel heavy and repetitive.
- A compact side-by-side duel row gives the user the intended matchup read at a glance while leaving the existing deposit panel below for scrolling.

### The Tech Debt
- None. This is scoped to portrait coarse-pointer screens and does not touch the mobile landscape grid.

## 2026-05-22 - Extend Portrait Duel Cards to Tablet

### The Change
- Broadened the portrait bot/tutorial duel override in [globals.css](/d:/projects/Cora/apps/web/src/app/globals.css) from phone widths to tablet portrait widths.
- Capped the compact 3:4 player cards at `12rem` so they do not balloon on iPad portrait.
- Removed the portrait-only flex spacer above the deposit panel so the status card sits closer to the duel row.

### The Reasoning
- Tablet portrait was still using the roomy desktop card row, which left a large empty gap before the match info panel.
- Reusing the compact portrait duel treatment keeps the matchup visually tight and lets the scrollable status content follow naturally.

### The Tech Debt
- None. Mobile landscape remains governed by its separate explicit grid-area media query.

## 2026-05-22 - Scale Tablet Portrait Duel Cards Up

### The Change
- Added a tablet-portrait layer in [globals.css](/d:/projects/Cora/apps/web/src/app/globals.css) for bot/tutorial opponent-found screens.
- Increased the 3:4 duel card cap, portrait size, VS label size, and duel spacing for `641px-960px` portrait coarse-pointer viewports.

### The Reasoning
- Tablet portrait has enough width and height for a larger matchup row, and the phone-sized cards made the info panel sit too high with too much empty space below.
- Scaling the duel row up restores the intended visual weight while keeping the info panel below the matchup.

### The Tech Debt
- None. Phone portrait and mobile landscape keep their separate overrides.

## 2026-05-22 - Increase Tablet Portrait Duel Scale

### The Change
- Raised the tablet-portrait bot/tutorial duel card cap in [globals.css](/d:/projects/Cora/apps/web/src/app/globals.css) from `15.5rem` to `17.5rem`.
- Increased the tablet portrait image/question mark size, VS label size, card padding, and info-panel gap.

### The Reasoning
- The first tablet portrait pass still left the matchup row feeling undersized for iPad-style portrait space.
- Scaling the duel row further gives the cards the right visual weight while preserving the phone portrait and mobile landscape layouts.

### The Tech Debt
- None. This remains isolated to the tablet portrait media query.

## 2026-05-22 - Matchmaking Portrait Duel Cards

### The Change
- Added semantic class hooks to [MatchmakingWaiting.tsx](/d:/projects/Cora/apps/web/src/components/lobby/MatchmakingWaiting.tsx) for the waiting duel grid, player cards, avatars, labels, wallet text, VS marker, and unknown opponent card.
- Updated [globals.css](/d:/projects/Cora/apps/web/src/app/globals.css) so matchmaking portrait views reuse the same 3:4 side-by-side duel card language as opponent-found.
- Added the same tablet portrait scale-up layer for matchmaking cards.

### The Reasoning
- The actual matchmaking UI should visually match the approved opponent-found matchup composition.
- Portrait waiting now reads as `[You] VS [?]` with compact card anatomy, while desktop and landscape keep their existing layout.

### The Tech Debt
- None. The override is scoped to portrait coarse-pointer matchmaking screens.

## 2026-05-22 - Simplify Matchmaking Progress Copy

### The Change
- Updated [MatchmakingWaiting.tsx](/d:/projects/Cora/apps/web/src/components/lobby/MatchmakingWaiting.tsx) so the three progress bars render as unlabeled side-by-side segments.
- Replaced the per-bar labels and rotating flavor copy with one status text slot that follows the current matchmaking stage.

### The Reasoning
- The matchmaking loading area should read as `-- -- --` with one changing status label, reducing duplicate copy and making the state easier to scan.

### The Tech Debt
- None. This is a component-only simplification.

## 2026-05-22 - Tighten Matchmaking Top Spacing

### The Change
- Reduced the vertical padding and cancel-row bottom margin in [MatchmakingWaiting.tsx](/d:/projects/Cora/apps/web/src/components/lobby/MatchmakingWaiting.tsx).

### The Reasoning
- The matchmaking screen had too much empty space above the cancel button, especially in portrait view.
- Tightening the outer padding brings the header cluster closer to the top without changing the matchup card layout.

### The Tech Debt
- None.

## 2026-05-22 - Regular Opponent Found Portrait Duel Cards

### The Change
- Added portrait-only CSS in [globals.css](/d:/projects/Cora/apps/web/src/app/globals.css) so regular opponent-found deposit screens use the same side-by-side 3:4 duel cards as bot/tutorial and matchmaking.
- Added the same tablet portrait scale-up rules for the regular deposit matchup cards.

### The Reasoning
- The deposit-phase opponent-found screen still used stacked full-width player cards in portrait, making it inconsistent with the approved compact matchup treatment.
- Reusing the same card anatomy keeps the flow visually consistent while leaving the deposit panel behavior untouched.

### The Tech Debt
- There is some selector duplication between matchmaking, bot opponent-found, and regular opponent-found portrait rules. A future cleanup could consolidate these into shared class names.

## 2026-05-22 - Tighten Portrait Deposit Gap

### The Change
- Updated [globals.css](/d:/projects/Cora/apps/web/src/app/globals.css) so regular opponent-found portrait deposit screens use natural-height deposit layout instead of the default flex spacer.
- Reduced the portrait deposit shell top margin to close the gap under the compact matchup row.

### The Reasoning
- After switching regular opponent-found portrait cards to the compact 3:4 matchup, the inherited `flex-1 justify-end` deposit area created too much vertical space before the deposit card.

### The Tech Debt
- None. This is scoped to regular opponent-found portrait screens.

## 2026-05-22 - Center Portrait Match Stacks

### The Change
- Updated [globals.css](/d:/projects/Cora/apps/web/src/app/globals.css) so portrait matchmaking and opponent-found screens vertically center their full content stack when there is spare viewport height.
- Overrode tablet portrait opponent-found height/overflow so the centered stack remains scrollable if content exceeds the viewport.

### The Reasoning
- The compact portrait matchup/deposit screens could appear biased upward with a visible empty region at the bottom.
- Centering the full stack balances top and bottom space without changing landscape behavior.

### The Tech Debt
- None. This is limited to portrait coarse-pointer screens.

## 2026-05-22 - Fix Lobby Setup Hydration Lint

### The Change
- Updated [LobbySetup.tsx](/d:/projects/Cora/apps/web/src/components/lobby/LobbySetup.tsx) to derive the mounted/client-ready flag with `useSyncExternalStore` instead of setting state directly in an effect.
- Removed an unused `rightBoardBackground` constant flagged by lint.

### The Reasoning
- React's hook lint now rejects synchronous setState calls inside effects for derived render state.
- The mounted flag is a hydration snapshot, so `useSyncExternalStore` expresses the server/client split without cascading renders.

### The Tech Debt
- None.
