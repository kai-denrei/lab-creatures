# Cutisling v1 — anchor-and-drag strides

Date: 2026-10-23. Scope: `src/cutisling/*`, `scripts/verify-cutisling.mjs`, README v1 section. Builds on the field skin design of the same date. Inago keeps its glide; Cutisling with **Hunt prey** off still shows Inago's original cycle for comparison.

## Problem

Cutisling glides. The flock centre advances kinematically at constant speed, every driver receives the same forward thrust every frame, and damping is light (1.6 /s). Nothing holds the ground, so the skin reads as liquid. The owner wants it to anchor and drag itself: ground friction, a body made of muscles, a predatory feel.

## Design: muscle bands with grip and haul

### Bands and stride clocks

- Three lateral bands relative to the body's heading: left, centre, right. A driver's band is recomputed every substep from its lateral offset to the driver centroid (`|lateral| < 0.3·radius` is the centre band). Membership drifts slowly as drivers move, which is intended.
- Each band has a stride clock. Base periods 1.05, 0.9 and 1.25 s, phase offsets 0, 0.37 and 0.71 of a cycle. At each wrap the next period is `base·(0.85 + 0.3·hash(strideIndex))`. The **Stride rhythm** setting (0.5–2, default 1) scales all periods.
- Cycle stages by phase: Reach 0–0.3, Plant 0.3–0.4, Haul 0.4–0.85, Release 0.85–1.

### Driver forces

Every substep each driver gets a *desired force* `F_i` from the current behaviour: in HUNT, thrust toward the destination along the body heading plus a weak curl; in FAN_OUT the existing crescent force; in ENCIRCLE, COVER, ABSORB and RECOVER the existing ring force. The hollow exclusion and the cohesion pull toward the centroid are never gated (safety and integrity).

Leading drivers of a band: in HUNT those ahead of the band centroid along the heading; in feeding phases those whose `|F_i|` exceeds the band's mean (they have furthest to go).

| Stage | Leading drivers | Trailing drivers |
|---|---|---|
| Reach | `F_i` at full strength (muscle extension) | friction |
| Plant | become **gripped**: velocity zeroed, position pinned | friction |
| Haul | stay gripped | `F_i` plus a contractile pull toward the band's gripped centroid, proportional to distance |
| Release | grip off, friction | friction |

Friction: acceleration `−v·(1.6 + 8·grip)`, so an unpowered driver stops within about 0.15 s at the default grip. **Grip** (0–1, default 0.85) scales friction and pinning; at 0 no driver is pinned, friction is Inago's 1.6 /s and every stage applies `F_i`, which reproduces today's glide for comparison.

The flock centre follows the driver centroid each substep instead of advancing on its own. All travel comes from strides.

### Settings and panel

Two sliders in the Flock motion group: `stride` (Stride rhythm, 0.5–2, step 0.05) and `grip` (Grip, 0–1, step 0.05). Defaults 1 and 0.85. Restore defaults covers them.

### Skin

No change to `field.ts`, `contour.ts` or `membrane.ts`.

### HUD and docs

HUNT description becomes "A moving lure draws the gripping, hauling membrane across the ground." README v1 section gains a strides paragraph.

## Verification

New section F in `scripts/verify-cutisling.mjs`:
- **Anchored travel.** Hunting on, lure placed 7 m away, auto prey off. Over 12 s the driver centroid advances at least 2 m toward the lure, and across that time at least 40 % of driver-samples are nearly stationary (speed under 0.05 m/s): most of the body is gripping the ground at any moment. With `grip` 0 that fraction is under 10 % and the centroid travels at least as far. (The leading edge itself is rarely still because the three bands overlap, which is the intended ripple.)
- **Pinned drivers.** Whenever `gripped[i]` is set, the driver's position after a step equals its grip position within 1 mm.
- **Feeding still completes.** The existing completion sweep passes with `{stride:.5}`, `{stride:2}`, `{grip:1}` and `{grip:0}` added.
- **Determinism, pause, reset** cover the muscle state.
- Existing sections A–E keep passing; update cost stays under 3 ms.

## Non-goals

No change to Inago, Cutisling v2 or Evasion. No new approach for free-flock mode. No per-driver muscle rendering.
