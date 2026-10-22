# Cutisling v1 — field skin redesign

Date: 2026-10-23. Scope: `src/cutisling/*`, `src/inago/page.ts` (HUD text), `scripts/verify-cutisling.mjs`, README v1 section. Cutisling v1 is modified in place; v2 and Inago are untouched.

## Problem

Four observed defects, each traced to one mechanism:

1. **Feeding stalls after surrounding the prey.** Cover waits for a chain of flock drivers, each within 0.64 m of the next, winding fully around the hollow. Turbulence and flock freedom keep reopening that chain. There is no squeeze and no cap, so Encircle can last forever.
2. **The skin splits into two pieces around the prey.** The mouth is carved out of the skin as a circle plus two straight lips extending 35 m. When the skin behind the prey is thinner than the hollow, the subtraction yields two outer loops.
3. **Straight lines and perfect circles.** Same carve: straight lips, an exact circular cup, a semicircular rear. The hollow boundary also projects every driver onto an exact radius, so the mouth is a true circle.
4. **Clipping at the end of phagocytosis.** The sealing lip descends to the ground at a hole radius smaller than the prey radius, passing through the prey sphere, and the cap over the prey is tessellated with 0.14 m facets whose chord sag can cut the sphere.

## Design

### 1. Skin as a scalar field, not a carved polygon

A new module `src/cutisling/field.ts` owns a fixed grid over the arena: cell 0.1 m, extent −12…12 m on both axes (240×240). Each simulation update:

- **Driver splat.** Every one of the 256 drivers adds a compact kernel `(1−(d/R)²)²` for `d<R`. `R` comes from edge detail: `R = 0.64 − 0.26·edgeDetail` (coarse fronts at low detail, finer lobes at high detail). The skin is the iso-line `F = 1`.
- **Prey hollow.** While hunting, the prey subtracts a hollow: `H = 2.2·s((ρ(θ,t) − d)/0.22)` where `s` is a smoothstep and `ρ(θ,t) = 0.68·(1 + 0.16·n(θ,t))`. `n` is three drifting harmonics in θ with irrational phase speeds, scaled by mouth irregularity. The hollow is never circular and never still.
- **Coverage.** Cover does not shrink the hole below the prey. The hollow radius stays at or above `1.05·preyRadius`; its *strength* fades to zero with coverage, so the skin closes by flowing over the prey, never by a collar descending into it.
- **Mouth pressure.** The existing 24-sector density sampling stays and still feeds the HUD. It is no longer used to shape the opening; the open sector is simply where the flock is not.
- **Approaches.** Flock, Elastic and Viscous become per-cell temporal filters on the field. Flock: `F_t += (F − F_t)·follow` with a short time constant. Viscous: same with a long time constant scaled by viscosity. Elastic: per-cell damped spring toward `F`, stiffness from tension, damping from viscosity. Tension additionally applies box-blur passes to the target field (0–5 passes). All three sample the same flock, as before.

### 2. Contour extraction

`src/cutisling/contour.ts` replaces `envelope.ts` and the `openingContour`/`subtractOpening` half of `outline.ts`:

- Marching squares on the filtered field at iso 1 with linear interpolation, producing closed loops.
- One corner-cutting pass (Chaikin) removes grid staircase; loops stay within one cell of the true iso-line.
- Loops with |area| < 0.02 m² are dropped. Loops are oriented: outer loops positive area, holes negative. The existing `contains`, `polygonArea` and `roundContour` remain in `outline.ts`.
- The controller owns the field and the contour tracer (both pure TypeScript, no three.js), so the closure test and the membrane read the same loops. `membrane.ts` reads them through `body.contours()` instead of running its own envelope.
- Output is the same `Point[][]` shape `membrane.ts` already consumes, so triangulation (ShapeUtils with holes), the rim profiles and the vein shader are kept.

### 3. Membrane geometry fixes (`membrane.ts`)

- **Lift.** `surfaceLift` becomes a clearance dome: `lift(r) = c·max(g(r), h(r))` where `g` is the current Gaussian and `h(r) = R_p + √(max(0,R_p²−r²)) − thickness + 0.025`, with `R_p` the prey's current rendered radius. `c` ramps with coverage as today. This guarantees the roof stays 2.5 cm above the sphere wherever the cap exists.
- **Tessellation.** Edge split threshold is 0.07 m within `R_p + 0.3` of the prey (0.14 elsewhere), halving chord sag under the dome.
- **Rim.** The lip profile's floor is `max(0.012, lift(x,z) − thickness·0.5)`. While the hole is open its edge sits on the field iso-line, which stays outside `1.05·R_p`, so no lip can pass through the sphere.

### 4. Feeding behavior (`controller.ts`)

Phases keep their names and HUD mapping: HUNT → FAN_OUT → ENCIRCLE → COVER → ABSORB → RECOVER.

- **FAN_OUT** keeps two flanks but each driver's flank offset uses its seed (±18 % width, ±0.3 m along), so the fronts are ragged rather than mirrored.
- **ENCIRCLE squeeze.** `squeeze = smooth((t − 4)/10)`. Effective freedom `= freedom·(1 − 0.8·squeeze)`, turbulence `·(1 − 0.7·squeeze)`, target ring extent shrinks to 1.1 m, inward pull multiplier 4 → 8. Drivers within 60° of the open sector get a tangential pull toward its centre, so the last gap closes from both sides.
- **Closure test.** `surrounded()` is replaced by `enclosed()`: the contour set has exactly one outer loop containing the prey centre, and the prey hollow is a hole of that loop (a loop with negative area whose first point is inside the outer loop and whose centroid is within 0.5 m of the prey). Dwell 0.4 s, then Cover.
- **Hard cap.** At `t ≥ 22 s` in ENCIRCLE the organism proceeds to COVER regardless; by then the squeeze is at maximum and the skin is at most a sliver from closed.
- **Hollow contact.** The hard projection onto an exact radius becomes a spring push outside `ρ(θ,t)` plus a hard clamp at `0.85·ρ`. Drivers settle on the noisy boundary instead of a circle.
- **No topological split.** The old gap-channel state (`gapAngle`, `gapSize`, `gapTarget`) is removed. The `opening` getter still returns `{x, z, radius, coverage, pressure, time, detail}` for the HUD and tests; `gapX/gapZ/gapWidth` are dropped.

### 5. Settings and panel

All existing keys keep their names, ranges and panel groups, so `panel.ts` and the settings drafts are unchanged. Meaning shifts slightly: edge detail now sets kernel radius; tension sets blur passes and elastic stiffness; viscosity sets filter time constants; mouth irregularity sets hollow noise amplitude. No new sliders.

### 6. HUD and docs

`ENCIRCLE` description: "The skin tightens around the prey until it is enclosed." README v1 section rewritten to describe the field skin and the squeeze; the test paragraph updated.

### 7. Verification (`scripts/verify-cutisling.mjs`)

Kept: determinism, pause, reset, continuous skin when uncut (one loop), triangles fill the outline, grounded finite geometry, buffer bounds, base Inago movement, expansion and contraction areas, three approaches differ on identical trajectories, free flock mode, paused tuning.

New or replaced:
- **Completion.** With defaults and with the extremes of freedom, turbulence and each approach, `meals ≥ 1` by 60 s and `≥ 3` by 180 s of simulated time.
- **One body.** Whenever hunting and the prey centre lies inside the skin, the contour set has exactly one outer loop. Over a 180 s run the count of outer loops never exceeds one for more than 0.25 s.
- **Organic edges.** On every sampled contour, no run of 5 consecutive points is collinear within 0.5°, and the hole loop's radius about the prey has a coefficient of variation ≥ 0.05.
- **Clearance.** During COVER and ABSORB, every cap and rim vertex within the prey's horizontal radius lies at least 0.01 m above the sphere surface.
- **Performance.** Field splat, filter and contour under 3 ms per update on the test machine (soft assertion, logged).

## Non-goals

No new sliders, no change to Inago, Cutisling v2 or the Evasion game, no change to the vein shader, no GPU field. The Stalheart contact hook (`contactAt`) is unchanged.
