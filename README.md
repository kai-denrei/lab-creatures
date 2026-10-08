# lab-creatures

An interactive WebGPU creature lab: sensory locomotion, predatory movement, feeding, and a growing family of evolutionary studies. Nih-Dairia is the ancestor study, with a long-term goal of informing creatures and bosses for **Stalheart**.

**[Open the public lab](https://kai-denrei.github.io/lab-creatures/)**

- `/` — creature studies and project credits.
- `/?specimen=nih-dairia` — the reference six-limbed creature, motion controls and prey experiments.
- `/?specimen=creature-lab` — eight related body plans with independent tuning.
- `/?specimen=jelly-baby` — the preserved original playground.

Interactive scenes require a WebGPU-capable browser. The landing page loads without a GPU. Each scene loads independently.

## Inspiration and license

Based on **[Jelly Baby by scottstts](https://github.com/scottstts/Jelly-Baby)**, the initial inspiration and soft-body simulation foundation. Its original Git history and playground are retained. The focus here has moved to creature behavior and evolutionary variation. This derivative project preserves the upstream **GPL-3.0** license; see [LICENSE](LICENSE). Changes in this project include Nih-Dairia, creature studies, locomotion/feeding controllers, motion sharing and the public lab interface.

## Development

```sh
npm install
npm run dev
npm run lint
npm run typecheck
npm run test:monster
npm run test:probes
npm run test:feeding
npm run build
```

GitHub Actions builds and publishes `main` to GitHub Pages. The Vite base path supports deployment at `/lab-creatures/`. Source and package exports remain available in the repository.

## Original playground controls

WASD / arrows move; Space hops; drag the baby to stretch and throw. Drag the table to orbit, scroll to zoom. R resets. Sound starts with interaction.

## Implementation

- `src/physics/soft-body.js` uses the reference's neo-Hookean energy with coupled
  XPBD constraints, an orientation barrier, axial viscosity, Coulomb contact and
  force-limited barycentric grabbing. Coupling the elastic constraints eliminates
  artificial rest stress; whole-step backtracking prevents inverted elements.
  The 240 Hz fixed step matches `refs/jelly-webgpu.html`. Gravity is deliberately
  reduced to 2.4 m/s², with a smaller jump impulse for a gentle, floating hop.
  The exact same solver is executed by a small embedded WebAssembly kernel so the
  4,026 tetrahedra and full-resolution surface no longer monopolize the JS main
  thread. A JavaScript fallback retains the same equations if WebAssembly is
  unavailable. Catch-up work normally yields after 8 ms or six substeps; during
  an active grab the wall-clock cutoff is disabled while the six-step cap remains,
  so pointer response cannot lose ordinary 240 Hz samples under a transient frame spike.
- The displayed body is still the exact marching-tetrahedra mesh from
  `refs/jelly_baby_mesh.html`, uniformly scaled to 7 cm: 72,234 indexed vertices,
  144,464 triangles and no open edges. `npm run build:model` regenerates its binary
  asset and source hash. A regular tetrahedral cage deforms those vertices through
  barycentric embedding; contacts lie on the actual visible surface. The original
  smooth SDF normals follow the deformation. Position and normal BufferAttributes
  remain the fully deformed CPU surface used by rendering, picking and facial
  attachment; there is no lower-poly or shader-only visual substitute. The face
  follows the skin. Details are
  tessellated, kept outside the skin, and drawn after transmission so they cannot
  contaminate the opaque refraction buffer and produce duplicate images.
- `src/game/locomotion.ts` supplies a powered posture and gait through nodal
  forces and jump impulses. It does not replace particle positions with animation.
  The muscles release completely during a grab and recover gradually afterward.
  Gait forces stop when movement stops; damping dissipates recoil and the settled
  body sleeps until the next interaction.
- Fresnel transmission, internal reflection, spectral absorption and optical
  thickness run in a worker on a 20,176-triangle optical proxy sampled from the
  same implicit model. The full visible mesh stays intact. RGB shares one refracted
  path; thickness is interpolated back to the visible vertices through a precomputed
  surface mapping. Compact cage snapshots replace full-mesh transfers.
  There is one outstanding snapshot at a time, with at most 30 requests per second.
  Caustics publish before thickness finishes, camera-only updates reuse the light
  field, and idle frames do no optical work. Translation compensation keeps the light field
  attached while the worker traces the changing shape. A 256² RGBA16F receiver
  preserves bright caustic flux; vertical motion reprojects the directional shadow.
  Connected refracted beams replace point splats. Their incident flux is divided
  by the landed footprint and integrated over each receiver pixel, including
  subpixel footprints and overlapping folds, without a caustic blur kernel.
  Pixel clipping reuses scratch storage and skips empty or fully covered regions.
- The supplied HDR window is reoriented above the set, boosted, and balanced
  against reduced room fill. Window direction, color, and flux are then measured
  from that same edited HDR, combining adjacent panes into one emitter.
  The floor removes that source's occluded diffuse contribution and reconstructs
  transmitted flux. Environment illumination supplies the rest, without a second
  light duplicating the window. The environment is not drawn as a background.
- Linear HDR compositing adds restrained highlight bloom and a subtle grade,
  followed by a single AgX tone/output transform.
- Grab stencils reconstruct the selected surface point exactly. Pointer smoothing
  is short and force remains limited by XPBD. Dragging against the floor intersects
  the pointer ray with the table, preserving screen alignment.
  Hover uses a bounding-box cursor hint; a real grab still picks the exact mesh.
- Procedural contact audio combines damped membrane modes and a short filtered
  contact transient. No audio files or remote resources are required.

Optical approximations include screen-space view transmission, the optical proxy,
shared RGB ray paths, a finite ray grid, one measured window direction, a planar receiver, and omitted beams at visibility
discontinuities. The simulation has no self-collision or tearing. The character
uses powered posture forces to stand and walk.

## Verification

```sh
npm run lint
npm run typecheck
npm run test:physics
npm run test:performance
npm run build
```

The numerical checks cover settling upright, volume retention, walking, turning,
jumping, stretching, throwing, recovery, HDR source measurement, and refracted
light reaching the floor. Regressions also check roundness, airborne duration,
facial render ordering, grab projection before/after deformation, floor targeting,
and caustic color/flux, subpixel beam conservation, element orientation, zero-force
rest energy, complete idle sleep, and the generated model's source hash. Performance
regressions check bounded catch-up, active-grab step retention, byte-for-byte
visible position/normal equivalence with the original embedding, proxy
flux/thickness agreement, and the actual worker's transferable two-stage response
and camera-only reuse.

`npm run benchmark` reports CPU timings for walking and a severe stretch. The
optimization is intended to reduce main-thread solver/surface time without changing
mesh resolution, material parameters, grab constants, XPBD iteration order, or the
resulting visible positions/normals.

## Nih-Dairia experiment 001

Drag the red lure around the observation table. The creature alternates between
listening, probing, stalking and reaching around nearby stimuli. Its elevated torso
rests on six bent legs. Two adjacent arms stretch and fan in different directions
around the lure, slightly out of phase, as if feeling for it. Their extended search
precedes the body's surge. Supporting legs follow in staggered left/right
footfalls, progressing from front to rear. Each foot lifts vertically, swings
forward above the table, then plants; while two arms explore, only one of the four
supporting legs swings, leaving three planted. A started sequence finishes even when
the short body-pull phase ends. Burst duration, stride length, pauses
and sideways feints vary deterministically, producing uneven predatory movement
without frame-dependent random jitter. Rear legs continue to support the body. Touch its
surface to trigger recoil. Drag the table to orbit, scroll/pinch to zoom, use
**Instinct on/off** to toggle pursuit, and press **R** or **Reset** to start over.
Pointer controls support touch. Turning instinct off retains breathing/recovery
forces; it is not a simulation pause.

The observation table is now 1.1 m across, with a 40 cm lure travel radius.
**Auto lure on/off** runs a smooth figure-eight chase, slowing the lure when the
creature falls behind. Grab the lure to return to manual control; switching the
toggle off leaves it where it is. Reset restarts the path and creature while
retaining the toggle state. Camera framing, zoom limits and shadows cover the
larger arena.

Once unheld prey stays within capture range, Nih-Dairia first moves its torso
directly above it. It then lowers its center to the table and molds its tissue
around the stationary, full-sized prey. The prey is concealed once the descending
membrane forms around it; a skin-colored, shape-specific imprint remains visible
in the physical skin, holds briefly,
then smooths out while the body stays down. Only then does the creature stand up
and new prey appears at least 20 cm away. This visual phagocytosis cycle
runs in both manual and automatic lure modes; automatic movement pauses during
feeding and resumes afterward. Held prey cannot be consumed. Reset clears an
ongoing meal, restores the sphere and resets the consumed count. Turning instinct
off prevents new captures but allows an already started meal to finish.

Capture cancels queued walking steps and plants all feet. A dedicated damped
centering force aligns the torso, with an alignment tolerance that accepts small
elastic oscillations instead of restarting the wait on every wobble. No timed
fallback bypasses physical alignment or abdominal ground contact.

`src/monster/feeding.ts` owns this fixed-step lifecycle. Alignment, lowering and the
localized shape-specific imprint use the existing muscle forces and deformed body mesh.
Captured prey retains its position and size throughout the descent; visibility
changes when covered. Only the next prey's appearance uses a scale animation.
`npm run test:feeding` checks alignment before descent, real torso ground contact,
stationary prey, visible skin prominence and its resolution before recovery,
distant respawns, reset and repeated automatic meals.

Open **Motion tuning** to adjust fourteen live controls: chase speed, reach and
surge duration, pauses, erratic motion, leading-limb stretch/spread, foot lift,
step duration, leg stagger, stride length and recoil depth. Footwork changes are
sampled at the next step so a slider does not teleport a planted foot. The panel
is collapsible and starts closed on smaller screens.

Settings persist locally in the browser. **Reset** restarts the creature and keeps
the tuning; **Restore defaults** resets the sliders. **Export settings** downloads
a versioned JSON file; **Import settings** restores a saved experiment. Incoming
values are validated and bounded to the slider ranges. Shared settings live in
`src/monster/motion-settings.ts`, separate from the UI for later Stalheart reuse.
Numerical checks exercise minimum, maximum and fast-footwork combinations, plus
live parameter propagation and preservation of tuning across specimen reset.

The current defaults are chase speed **1.8×**, reach duration **2.4×**, surge
duration **2×**, pause **1.25×**, erratic motion **2×**, stretch **2.2×**, spread
**1.6×**, foot lift **32 mm**, step duration **120 ms**, and leg stagger **35 ms**.
Stride remains **22 mm** and recoil **1×**. Expanded ranges extend past those
values, including 3× speed/erratic motion, 2.5× stretch, 3× spread, 50 mm foot
lift, 80 ms minimum step duration and 15 ms minimum stagger. The new baseline
uses a v3 browser draft key; v2 tuning is migrated with only reach duration and
stretch updated to the new defaults. Other tuned values and old drafts are retained.

### Sharing with another project

- **Copy settings** copies versioned JSON; **Copy settings link** embeds the
  values in a link to this experiment (the receiving device must be able to reach
  the same host). Opening that link applies and saves the shared values.
- **Download code + settings** produces a ZIP of the current settings, creature
  source, model, physics solver, native source and rebuild scripts, plus a Vite
  demo and integration README. It does not require this checkout to run.
- `npm run export:monster` writes the same kit with the current defaults to
  `dist-exports/nih-dairia-creature-kit.zip`. To package a saved preset, run
  `npm run export:monster -- /path/to/nih-dairia-motion.json`.

The portable entry is `src/monster/portable.ts`: `await createNihDairia(settings)`
returns a mesh, `setTarget(Vector3)`, `update(dtSeconds)`, `reset()` and `dispose()`.
Add the mesh to your Three.js WebGPU scene, supply lighting, and call update each
frame. Settings are mutable. The included demo uses Three.js 0.185.0; check the
renderer version before integrating into a different game. Coordinates remain
meters on a horizontal Y-up plane. This is still a prototype, not a Stalheart
terrain/combat adapter.

The connected six-limbed membrane is generated by `scripts/build-monster.mjs`:
9,408 surface vertices, 18,812 triangles, 1,187 simulation nodes and 3,312 tetrahedra.
It uses the existing WebAssembly/JavaScript neo-Hookean XPBD solver and embedded
surface deformation. Its force controller is in `src/monster/behavior.ts`; the
renderer, input and observation scene are separate modules. `src/monster/gait.ts`
owns planted foot targets, staggered steps and swing velocities used by the muscle
controller to lift the actual tissue. `src/monster/pursuit.ts`
sequences reach, pull and settle phases, reselecting the leading limb when a target
changes direction. At 1×, pursuit has peak commanded speeds of 10–15.5 cm/s, easing near
the lure; actual speed remains constrained by contact and tissue deformation.
Vertical muscle forces
sum to zero: ground reaction through the legs supports the torso, rather than
an upward force applied to the whole animal. Pigment branches are
attached to the deforming surface through vertex colors. This experiment uses
Three.js physical transmission and direct shadows, without Jelly Baby's custom
worker-driven caustics or optical-thickness tracing.

```sh
npm run build:monster
npm run test:monster
```

Numerical checks cover closed mesh topology, element orientation, volume retention,
approach from opposite directions, stimulus enclosure, recoil, disabling pursuit,
and reset, plus raised torso clearance, leg-only ground contact, planted-foot
stability, staggered lift/swing/plant steps, completion after a short pull,
physical ground clearance for every supporting foot, absence of net muscle lift, measured skin extension
and widening before torso advance, subsequent body pursuit and abrupt retargeting.
Browser rendering,
visual quality and device performance still require
manual inspection; no development server/browser inspection was run.

### Stalheart direction

This is a creature/locomotion study, not an integrated boss. No sibling Stalheart
files or dependencies are modified. `MonsterBehavior` accepts a world-space target
and emits nodal forces and observable states, making it an initial boundary for
future game integration. Before integration it needs a surface-frame abstraction
for Stalheart's spherical terrain (today gravity/contact assume a horizontal table),
boss telegraphs and attack/recovery windows, gameplay collision and damage handling,
and performance budgets for multiple game entities.

Current physical limits are deliberate: self-contact uses sphere-chain proxies rather than exact mesh collision; there is no tearing, biochemical digestion,
independent per-cell biology, or solid lure contact. The lure is a sensory target;
envelopment is a limited force-driven curl, not a collision-constrained grasp.
Thin membrane refinement and limb-to-limb collision are next research steps before
tight coils, constriction or attacks. The landing illustration is a concept drawing,
not a rendered screenshot of the simulated specimen.

Per project instructions, no development server or browser inspection was run
during implementation. GPU shader execution, visual quality, touch feel, and sound
still need inspection in the target browser. WebGL fallback is disabled, and GPU
startup/runtime failures are surfaced with diagnostics.

Prey now cycles through sphere, cube, triangular prism, and dodecahedron, with matching membrane deformation. The covering skin becomes locally opaque during feeding so the red object does not tint the bulge. All tuning maximums are doubled: stretch 5×, spread 6×, foot lift 100 mm; minimums and saved/default values are unchanged.

During final alignment, prey blends into the same pigmentation and vein pattern as the creature. Its metallic response and red emission fade out before descent. Wrapping is latched for the meal, and concealment is latched at 45% descent; neither can reverse during absorption or recovery. Only respawn/reset restores the original red appearance. The temporary wrapped surface stays opaque and full-sized until hidden beneath the body imprint.


Foot grip (default **1.5×**, range **0–5×**) adds contact-based horizontal adhesion to planted distal feet. Lifting or probing releases the anchor. The chase drive no longer pushes gripping feet forward; forward propulsion requires supporting contacts, and the torso brakes more firmly between pulls. Existing settings files import with the new grip default, retaining all previous values.

To emphasize dragging: start with grip **1.5–2×**, chase speed **0.8–1.2×**, foot lift **10–18 mm**, stride **12–20 mm**, and step duration **160–220 ms**. Keep the long probing reach. Higher leg stagger can emphasize separate footfalls, but excessive stagger or step duration makes rear feet lag. These are optional tuning starting points, not replacements for your saved settings.

Tentacle reach targets stay within separate radial sectors and outside the torso. Thirty limb-volume proxies plus a torso proxy apply equal-and-opposite contact impulses, including contact between distant sections of the same limb. This reduces crossings without modifying the Jelly Baby solver or directly moving mesh vertices. It is approximate self-contact: thin membrane edges and extreme deformations can still intersect. The broadphase is bounded to at most 465 proxy pairs per physics step.


Probe controls now act on the pair of sensory arms: stretch raises their forward reach and muscle authority; spread widens their divergent sweeping directions. Extension and sweeping taper from full exploration at 225 mm to minimal reach at 45 mm from prey. During search, horizontal muscle forces balance so the arms extend before the torso follows in the pull phase. `npm run test:probes` measures both physical tips at zero/max stretch and spread and near/far prey distances.

`/?specimen=creature-lab` opens a separate Creature Lab tab, currently seeded with the six-limbed Nih-Dairia ancestor. It shares the simulation and feeding features, but stores motion tuning independently (`creature-lab-motion-v1`), initially copied from the reference specimen. Shared settings links retain the chosen tab. The variant selector includes the ancestor, Brood, Reed and Crown.


Reach duration extends to **10×**. **Reach sweep** (0–5×, default 1×) independently controls the two leading arms’ side-to-side ground-search arcs. At zero, their directions stay steady relative to prey. Enabling sweep brings the arms to full extension earlier in the reach phase, leaving time to explore before the torso pulls forward. The arcs have offset timing and slowly varying phases, remain on opposite sides of the target, and diminish near prey. Existing saved/exported settings gain the new default without losing other tuning.


Creature Lab now offers four independently generated body plans via its **Body variant** selector: Nih-Dairia (six limbs), Brood (six limbs, larger/thicker abdomen), Reed (four limbs, smaller/thinner abdomen), and Crown (eight limbs). Selecting one loads its own surface and tetrahedral cage, rather than scaling the rendered mesh. Gait, sensory-arm selection, traction and limb separation adapt to the limb count. Motion settings are saved per variant and shared links preserve the choice. Code downloads include all eight models and launch the selected variant. Regenerate relatives with `npm run build:variants`; check anatomy, locomotion and feeding with `npm run test:variants`.

A **cradling** phase precedes covering. Two front arms approach opposite prey flanks with 180 ms stagger and leave their tips separated; the rear legs brace. A conservative expanded convex prey proxy applies contact impulses through sampled visible-skin barycentric bindings, not just cage centerlines. Both arms must be near prey and the sampled membrane must clear it for 120 ms before covering proceeds. This is bounded sampled contact, not a guarantee against every triangle-level intersection. Cradling and the existing feeding lifecycle apply to all variants.


The second family adds **Ovum** (six tentacles with an oblong, swollen abdomen), **Sept** (seven tentacles), **Filament** (a tiny central junction and almost pure tentacles), and **Globulifer** (branched dorsal stalks with four globular tips). Globulifer’s silhouette is inspired by [Bocydium globulare, photographed in National Geographic](https://www.nationalgeographic.com/animals/article/crazy-animals-lady-gaga). Its dorsal growths follow the deformed back’s position and surface normal; they are lightweight visual attachments without independent soft-body dynamics or collisions. The other anatomical differences are built into each variant’s surface and tetrahedral physics cage. No reference photographs are bundled.

## Mobile and home-screen use

The creature scenes reserve touch gestures for the camera: drag to orbit and pinch to zoom. **Move prey** switches on touch dragging; tap **Camera mode** to return. Dragging pauses an enabled auto lure until release, without switching its preference off. The status line distinguishes reach/pull/settle, a held prey, paused instinct and feeding. Long reach/pause settings deliberately introduce pauses; **Reset** restarts a stalled encounter without losing tuning.

On phones, specimen selection and each tuning group collapse independently. **Hide controls** leaves the scene and a **Show controls** button. Sliders have 48px touch areas and 28px thumbs. The sheet scrolls independently; browser page panning is suppressed on the scene, not on the controls. OS edge gestures remain OS-controlled.

The relative-path manifest and mask-safe icons support installation under the GitHub Pages subdirectory. Use the browser's Install/Add to Home Screen command. The installed app opens Creature Lab, supports either orientation, and still requires WebGPU, HTTPS and a network connection to load. Offline caching is not implemented. A service worker is [not required for installability](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable).

`npm run test:mobile` verifies touch-mode selection, auto preference preservation, pointer cancellation and the feeding status without a GPU. Probe regressions also cover maximum reach duration with continuously turning prey and live setting changes. Real-device visual checks remain manual: portrait/landscape, pinch zoom, slider drags and sheet scrolling, app switching during a prey drag, home-screen launch, and a full auto feeding cycle. No browser/device visual inspection is automated by this repository.
