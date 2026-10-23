# Peristaling — peristaltic-wave membrane organism

Date: 2026-10-23. New specimen in Collectives: `?specimen=peristaling`. Approach 2 from the Cutisling locomotion discussion: contraction phase from position along the travel axis, with randomised wave speed so it never reads as "just a slug".

## Relationship to Cutisling

`Peristaling extends Cutisling`. Inherited unchanged: the field skin and contour tracer, the irregular prey hollow, the feeding state machine (FAN_OUT → ENCIRCLE → COVER → ABSORB → RECOVER), closure test and cap, the clearance dome and lip floor, the panel and settings. Replaced: locomotion (the muscle bands) and body shape (round cohesion). To allow this, Cutisling's `desiredForce`, `prepareLocomotion` (renamed from `prepareMuscles`), `steering` and `pin` become `protected`; `squeeze` and `hollow` stay private. Cutisling's behaviour does not change.

## Body

Cohesion is elliptical about the heading: along semi-axis `1.3·radius`, across semi-axis `0.5·radius`, where `radius` is Inago's current body radius. Drivers outside the ellipse (`ρ = √((along/a)² + (across/b)²) > 1`) are pulled toward the centroid with `(ρ−1)·3`. Applied in every hunting state; in feeding states the inherited ring forces dominate and the ribbon wraps into a ring.

## Gait

- Phase per driver: `φ_i = 2π·along_i/λ + waveTime`, `λ = 1.1 m`. Crests move backward along the body (retrograde wave).
- `c = sin φ_i`. Extension (`c > 0`): thrust along the driver's desired direction with power `c²·3.4`. Contraction (`c < 0`): no thrust, friction `−v·(9·grip·(−c))` on top of Inago's `−v·1.6`, and a lateral squeeze toward the axis `−across·2·(−c)`.
- Desired direction: in HUNT the unit vector to the target; in feeding states the inherited `desiredForce` direction, with its magnitude as the thrust scale (`min(1, |F|/3)`).
- Hollow exclusion and the elliptical cohesion are never gated.
- Randomised wave speed: `waveTime` advances at `ω·speedFactor`, base `ω = 2π/1.6 s`. At each full cycle the next factor is `0.55 + 1.05·hash(cycle)`, and every seventh-or-so cycle (`hash(cycle·3) < 0.15`) is a near stall at `0.15`. The current factor blends toward the target over 0.3 s.
- Settings reuse: `stride` scales the wave period (relabelled **Wave rhythm**), `grip` scales contraction friction (**Anchor grip**). Grip 0 removes friction and squeeze, giving a glide.

## Page, card, docs

- `src/inago/page.ts` and `src/inago/scene.ts` gain the `peristaling` variant: title "Peristaling", eyebrow "COLLECTIVE ORGANISM / CRAWLING MEMBRANE", tagline "A wave carries the skin.", HUD HUNT text "A travelling contraction drags the ribbon toward the lure.", teal accent `#7fa8a0` via a `peristaling-page` class on top of `cutisling-page`.
- `createCutislingPanel(body, refresh, signal, labels?)` accepts label/hint overrides for `stride` and `grip`.
- Catalog entry `peristaling` (Collectives) before Cutisling v2; route in `main.ts`; thumbnail via the existing Inago/Cutisling branch in `thumbnail.ts`; README section; `npm run test:peristaling`.

## Verification (`scripts/verify-peristaling.mjs`)

- **Ribbon.** While travelling (lure 7 m away, auto prey off, sampled 2–10 s), the driver covariance ratio along/across is ≥ 2 in at least 70 % of samples.
- **Wave.** At each sample the Pearson correlation between `sin φ_i` and forward speed is ≥ 0.3, and the along-axis density histogram (12 bins over the body) has at least two interior local maxima.
- **Randomised speed.** Over 20 s the wave speed factor takes at least three values differing by more than 0.1.
- **Travel.** Centroid advances ≥ 2 m toward the lure in 12 s; grip 0 travels at least as far.
- **Feeding.** `meals ≥ 1` by 60 s under defaults, `{grip:0}`, `{grip:1}`, `{stride:.5}`, `{stride:2}`, `{freedom:.5,turbulence:2}`.
- **One body and clearance.** Over 90 s with the membrane: when the prey centre is inside the skin there is one outer loop (no split longer than 0.25 s); during COVER and ABSORB every cap and rim vertex lies outside the prey sphere plus 1 cm.
- **Determinism, pause, reset** including the wave clock; update cost logged.
- `npm run test:cutisling` must still pass unchanged.
