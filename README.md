# lab-creatures

An interactive WebGPU creature lab: sensory locomotion, predatory movement, feeding, and a growing family of evolutionary studies. Nih-Dairia is the ancestor study, with a long-term goal of informing creatures and bosses for **Stalheart**.

**[Open the public lab](https://kai-denrei.github.io/lab-creatures/)**

- `/` — creature studies and project credits.
- `/?specimen=nih-dairia` — the reference six-limbed creature, motion controls and prey experiments.
- `/?specimen=creature-lab` — eight related body plans with independent tuning.
- `/?specimen=arthropod-lab` — Aculis, Oculus, Giant Isopod and Veil, with a shared predator lab.
- `/?specimen=jelly-baby` — the preserved original playground.

Interactive scenes require a WebGPU-capable browser. The landing page loads without a GPU. Each scene loads independently.

## Arthropod and membrane studies

The **Specimen** selector now includes **Aculis**, **Oculus** (`&breed=oculus`), **Giant Isopod** (`&breed=isopod`) and **Veil** (`&breed=veil`). The isopod has a broad armored silhouette, fourteen articulated walking legs, paired long and short antennae and a tail fan. Its anatomy is based on the [Aquarium of the Pacific's giant isopod reference](https://www.aquariumofpacific.org/onlinelearningcenter/species/giant_isopod/P1). Veil is an original form based on the supplied membrane reference: one closed, flat, eyeless sheet with twelve elastic sectors and webbing continuing all the way to the tips. There is no dome and no bare tentacle-like distal section. Each tip extends and retracts on its own seeded, irregular schedule; the center creeps behind stretched edges before accelerating into bursts. It uses a dedicated procedural elastic-rim controller rather than the arthropods’ alternating rigid-link gait. The rim stays close to the floor, with only small individual curls. Oculus has one eye forming its entire head, a single antenna and a greatly reduced trunk on longer legs. All four models share the Instinct/Lure and Walking modes.

This lab's arena is **2.2 m across**, twice the previous diameter (four times the area), with enlarged travel, manual lure and camera bounds. Other labs keep their original table. All fifteen defaults are now the previous slider maxima, and every upper bound is doubled. For example, pace defaults to 1.8× with a 3.6× maximum; lowering defaults to 38 mm with a 76 mm maximum. Ground clearance and joint reach constrain the actual pose at extreme values. Revision-2 settings start with these new defaults and persist separately for each specimen, leaving the old Aculis settings record intact. **Restore defaults** returns to the previous-max values.

**Aculis** has six long jointed legs (coxa, trochanter, femur, tibia, three-part tarsi and paired pretarsal claws), seven abdominal plates, compound eyes and moving antennae. Open **Arthropod Lab** from the specimen tabs or homepage. The default **Instinct & lure** mode lets you drag the red lure or tap the table to place it. **Auto lure** follows a figure-eight path; holding the lure pauses that path until release. **Instinct** toggles behavior, and **Startle** triggers a fearful recoil. Drag elsewhere to orbit and scroll/pinch to zoom. **Walking study** retains the original tap-to-guide controls, and **Anatomy colors** identifies leg sections.

The predator notices movement, hesitates or backs away, stalks, sometimes feints sideways, lowers its body and abdomen, then rushes and recovers. Rushes commit to a last-sighted position so moving the lure can cause a miss. Sudden close lure movement can startle it. Seeded choices vary timing and lateral motions without frame-by-frame random jitter. **Specimen defaults**, **Ambush**, **Wary** and **Feral** presets accompany controls for notice radius, fear, hesitation, aggression, unpredictability, rush speed/duration, recovery, body lowering, abdomen tuck, overall pace, turn speed, foot lift and auto-lure speed/range. Tuning persists separately for each specimen; **Reset** retains tuning and the Instinct/Auto lure preferences, while **Restore defaults** resets tuning.

This is a procedural articulated rig with fixed-length femur/tibia links, inverse-kinematics knees and alternating tripod support. Torso commands are limited by leg reach, while the abdomen and antennae respond to behavioral state. It does not yet use the soft-body solver, physical joint dynamics, grabbing or feeding. The lure remains visible for repeated encounters. `npm run test:arthropods` checks state progression, rush/stalk speed contrast, body lowering, zero aggression/fear, rigid segment lengths, planted-foot stability, foot clearance, arena bounds, pause and reset across presets and extreme settings.

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
the tuning; **Restore defaults** resets the sliders. **Export JSON** downloads
a versioned JSON file; **Import JSON** restores a saved experiment. Incoming
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

- **Copy all** copies versioned JSON; **Copy settings link** embeds the
  values in a link to this experiment (the receiving device must be able to reach
  the same host). Opening that link applies and saves the shared values.
- **Export creature ZIP** produces a ZIP of the current settings, creature
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

## Play as Nih-Dairia

Open the Jelly Baby playground and select **Nih-Dairia** from **Play as**, or open `?specimen=jelly-baby&creature=nih-dairia`. Selection reloads the playground with the chosen body plan and a camera distance sized for it. Both creatures use the same wooden table, environment lighting, optical transport, follow camera and physical grab controls.

WASD / arrow keys and the mobile D-pad steer relative to the camera. Nih-Dairia uses its own reach/pull gait and planted-foot traction; releasing movement brakes it. Space / the touch action makes it brace. Feeding and autonomous prey pursuit are disabled in this player mode. The Creature Lab retains its separate hunting behavior and tuning. Reset / R restores the selected creature.

`npm run test:player` checks four-direction travel, key-release braking, travel beyond the lab arena, bracing, grab handoff and reset with the actual soft-body solver.

The next anatomy and locomotion experiments are tracked in [the creature roadmap](ROADMAP.md).

## Crawler prototypes

The playground's **Play as** selector also includes **Slug** (`?specimen=jelly-baby&creature=slug`) and **Flat Snake** (`?specimen=jelly-baby&creature=flat-snake`). Both use the shared soft-body solver, wooden table, lighting and camera-relative WASD/touch controls. Space contracts/braces; dragging hands control to the physical grab system.

Slug alternates front/rear underside grip while extending and gathering. Flat Snake sends a lateral wave along its flattened body, gripping around alternating bend extrema. These are force-driven locomotion approximations with grounded propulsion, not complete biological simulations. Tight self-coiling and feeding are deferred; see [ROADMAP.md](ROADMAP.md).

`npm run build:crawlers` regenerates both closed meshes and tetrahedral cages. `npm run test:crawlers` validates geometry, volume, physical deformation, forward/turning movement, lateral drift, contact, release braking, grab recovery, brace and reset. Visual motion quality remains a manual review.

### Specimen library and sharing

The landing page lists all 17 individuals with rendered model thumbnails, family filters and name/trait search. Each card opens the selected specimen directly. Thumbnails are generated from the actual models with `src/catalog/thumbnail.ts` (development utility).

Oculus has one spherical compound eye covering its entire head and one antenna. Its defaults use every slider's current maximum except rush duration **1.5 s**, recovery pause **3 s**, and foot lift **10 mm**. Oculus uses a new storage generation so these defaults take effect; subsequent custom tuning remains saved independently of other specimens.

All soft-body and predator tuning panels share **Copy group / Paste group**, **Copy all / Paste settings**, JSON import/export, and **Export creature ZIP**. A group paste only changes that group. Imports validate the full payload before applying values and clamp numbers to the receiving controls' limits. Soft-body and predator settings are separate compatible families; predator settings may be shared between Aculis, Oculus, Monoculus, Isopod and Veil. Older Nih-Dairia motion JSON files remain importable.

The common JSON format is `lab-creatures/settings`, version 1, with `family`, `specimen`, `group`, `units` and `values`. Units describe stored values: soft-body lengths/durations use meters/seconds; predator controls use the declared millimeters/seconds/multipliers. Clipboard failures expose selectable JSON for manual copying; paste uses an editable text area, so clipboard-read permission is unnecessary.

Creature ZIPs contain a **static current-pose GLB** (meters, Y up, standard PBR approximation), selected settings, procedural source, license and a runnable Vite/Three.js demo. The GLB has no rig or baked animation; the included source supplies the creature's motion and instinct. The soft-body kit retains its physics models and solver. Run `npm install` and `npm run dev` inside an extracted kit. `npm run test:settings` checks settings interchange and Oculus defaults.

Monoculus is an independent Oculus relative with a compound eye at one-quarter the diameter, a tiny abdomen in place of the trunk, and a thin translucent membrane spanning all six legs. The sheet deforms with the articulated joints. It starts with Oculus defaults but stores its tuning separately. Oculus remains unchanged.


### Cutis-Maku — membrane swarm

Open `?specimen=cutis-maku` for the new independent membrane lab. A slow cap extension fixes a foothold, then the body follows a delayed, per-vertex Bézier transfer through the anchor. The rear catches up abruptly; a damped recoil reforms the body. Resting silhouettes are irregular droplets, with a projected 4D tesseract used as a temporary fold attractor. Skin has rest-space warped Voronoi veins, stretch-dependent translucency, a nested dark core and directional vein pulses.

The lab provides solo, 12-, 100- and desktop 300-creature views, a draggable/automatic lure, Patient predator/Feral surge/Slow drifting presets, live body/transfer/surface/swarm tuning, phase scrub, state colors, stretch heatmap, projected tesseract and forced fold geometry. All groups use the same copy/paste and JSON interface as the other labs. The creature ZIP includes GLSL, TypeScript, settings, license and a standalone lil-gui demo. Shader deformation is exported as source, without a baked GLB or rig.

This specimen uses the spec's **WebGL2 + instanced GLSL** path; existing specimens retain their WebGPU runtime. A closed spherical mesh joins three densely sampled cap patches. Polar rings concentrate detail in each reaching cap; matching core and membrane meshes follow the same curved centerline, preventing coarse core triangles from cutting across the sweep. Each tip flares into a rounded suction cup with distinct upper and lower surfaces and a thick rim. Each active tier/LOD batch has one membrane and one soft-interior InstancedMesh. Near membranes use back/front passes; far membranes skip the back pass and fine vein detail. Instance attribute buffers are reused; CPU simulation handles steering, phases and locked anchors rather than vertex deformation. The default radius is 0.2 m in a larger arena.

`src/cutis/creature` owns geometry/material/GLSL, `src/cutis/swarm` owns configuration and behavior, and `src/cutis/demo/index.html` is the development standalone demo. Exported kits run from their root `index.html`. `getState`, `getAnchor` and `getStretchSegment` expose weak-point and transfer-window information. Optional bridging, severing/splitting and game collision enforcement are not implemented.

`npm run test:cutis` checks timing, locked anchors/headings, hop commits, buffer reuse, state coverage, desynchronization, freeze/scrub, gameplay hooks and settings roundtrips for 1/100/300 creatures. The coil warning lasts at least 120 ms and EXTEND:TRANSFER duration is 45:23. Before the denser matched-shell geometry update, automated Chrome checks observed approximately 60 fps for 100 and 300 creatures at the default swarm framing on this development machine, and 60 fps in a 390×844 mobile viewport. This is not a real mid-range-phone benchmark; device performance remains to be measured on target hardware.


Cutis-Maku defaults now use the selected Hunt/Transfer/Body values: cycle 4 s, urgency 2, reach 15 radii, cap 10°, sweep 0.85 radii, 3 appendages, seeking frequency 1 cycle, transfer acceleration 1, neck 0.5, rear delay 0.25, fold 0.9, recoil 0.5, radius 0.2 m, asymmetry 0.2, breathing 1.5 Hz, resting structure 0.25, vein pulse speed 2, vein width 0.1 and separation 2. Storage generation v4 activates these defaults while retaining older drafts. Reach extends to 20 radii and cycles to 10 s; shape, timing and swarm limits are also widened. New Seeking sweep/frequency controls make the tip probe laterally and briefly retract before damping to a fixed foothold. Transfer acceleration controls a slow-start power curve, used by both the shader and the CPU position estimate. The anchor remains fixed during attachment and transfer.

Color scheme presets preserve behavior values: Original membrane, Green/moss, Yellow/amber, Blue/glacial, Purple/dusk, White/porcelain and Black/white veins. The inner core remains dark in the black scheme. Presets, controls and the new motion are included in the standalone export. Older Hunt/Transfer settings can still be pasted; missing newly added controls retain their current values.

Cutis-Maku Hunt → Seeking appendages selects 1, 2 or 3 probes (default 3). Each probe has its own direction, reach and sweep phase. With multiple probes, the cup nearest the current prey wins when EXTEND ends; the other probes retract and transfer commits the winning cup. The anchor stays locked after selection. Changing the appendage count restarts a live search, or updates a frozen phase study in place. The count travels with copied settings and creature exports; older settings retain the current count. `getSeekingAnchors(i)` exposes the candidate cups to host programs.

During transfer, the winning cup retains its settled cross-section instead of collapsing into the point used to funnel traveling tissue. Its rim expands and thickens with incoming mass, then merges into the destination body as transfer finishes.


### Cutis-Maku-K — belt difficulty studies

Open `?specimen=cutis-maku-k` (or `&tier=white` through `&tier=black`). This separate library entry and browser draft preserve the original Cutis-Maku. The **Belt difficulty** selector applies a complete size, behavior, appendage, membrane and combat preset; editing any value creates a custom variation. **Core** controls expose opacity, shape, radius, tint, contact damage and health.

| Tier | Body radius | Appendages | Interior | Health | Contact HP/s |
| --- | --- | --- | --- | --- | --- |
| White | 0.12 m | 1 | Soft | 15 | 0 |
| Yellow | 0.14 m | 1 | Soft | 25 | 0 |
| Orange | 0.16 m | 2 | Soft | 40 | 0 |
| Blue | 0.18 m | 2 | Soft | 60 | 0 |
| Green | 0.21 m | 2 | Pearl | 100 | 8 |
| Purple | 0.24 m | 2 | Dodecahedron | 160 | 14 |
| Brown | 0.28 m | 3 | Inverted pyramids | 240 | 22 |
| Black | 0.33 m | 3 | Pure red sphere | 360 | 35 |

These are initial lab balance values. Higher tiers increase urgency and shorten the hunt cycle from 6 to 2.5 seconds. Hard cores are separate rigid instanced meshes: the membrane stretches, the core does not. The membrane bulges around its collision sphere. Core color and geometry are independently editable. The mixed-pack toggle replaces color-only swarms: all eight tiers appear at their actual sizes, appendage counts, core shapes, contact rules and behavior. Each creature has a stable ±8% speed variation on top of its tier cadence. Core radii are 0.28× body radius for green/brown, 0.22× for purple, and 0.18× for black; brown uses two opposed interpenetrating triangular pyramids. Switching mixed mode off restores the selected specimen, and solo mode always uses it.

Stalheart's current convention uses `rammable` for the soft/hard split; both types appear on radar, while solids have larger blips and proximity warnings. `getCoreContact(i)` exposes this classification and a world-space bounding sphere. `contactDamageAt(i,point,unitRadius,dt)` computes prototype damage inside that sphere. The exported kit includes all eight presets, `gameplay.json`, and `belt-presets.json`. Actual unit health, collision response, radar rendering and deployment into Stalheart remain owned by the host game; this change does not edit that repository.


### Pearl lineage and core containment

`?specimen=cutis-maku-pearl` opens a separate saved lineage in which every hard tier uses a pearl sphere. The soft tiers stay soft; mixed packs keep the same size, speed and difficulty differences. The original K lineage retains its geometric cores. Both lineages use the reduced core sizes above.

Rigid cores now follow the same delayed Bézier body center used by the surrounding hard-tier membrane, including settle recoil and floor clearance. The hard-tier surface maintains a padded volume around that center to prevent folding stalk triangles from clipping the core. Soft-tier transfer keeps its original per-vertex rear delay.

`scripts/verify-cutis-containment.mjs` captures the actual GPU-deformed membrane vertices, measures the core sphere's clearance from every triangle, and checks odd/even ray containment. With Vite running, import it in the browser and call `verifyContainment()` and `verifyContainment(true)` for near/far LODs. The regression covers all four hard tiers, four seeds and 100 cycle samples per detail level (3,200 poses total). Pure controller tests also check pearl mixed packs, floor clearance and contact radii.


### Cutis-gorogoro — launch, roll, recover

Open `?specimen=cutis-gorogoro` for the separate Pearl-derived rolling lineage, with its own saved draft and all eight belt tiers. The first stages retain Cutis's seeking, anchoring and transfer. Momentum begins building during the final transfer, flowing through the foothold into a forward tumble. It travels **exactly the chosen appendage's reach distance again**, then recoils and settles before seeking again. The next origin is the rolled landing, not the original suction anchor. Steering stays locked through the roll.

Locomotion controls expose roll duration (default 2.4 s), landing recovery (0.8 s) and launch lift (0.5 body radii). The transfer and roll clocks blend across their handoff, respecting each creature's speed variation. A whole number of visible tumbles avoids an orientation snap at the next cycle; membrane and pearl share translation/lift and retain containment. `getLanding(i)` exposes the final destination, while `getAnchor(i)` remains the suction foothold. `GOROGORO_TIERS` / `GOROGORO_DEFAULT_CONFIG` and `rollVariant` travel in settings and source exports, including mixed packs.

Controller tests verify extra travel distance, launch lift, recoil and landing commit. `verifyContainment(false,true)` / `verifyContainment(true,true)` run the near/far GPU checks for Gorogoro through 3,200 sampled poses.

Gorogoro defaults to a 10-second hunt cycle, a slower 2.4-second roll and 0.8-second landing recovery. Its higher camera tracks the solo pursuit; the automatic lure steers continuously away from bodies and projected landings with bounded acceleration, without repositioning between rolls. The membrane stays organic throughout transfer (cube deformation is disabled for this lineage). The suction rim remains fixed during transfer before peeling free into the roll. The black tier uses a dark wine-red pearl.

### Evasion Game

Open `?specimen=evasion-game` or the Evasion Game card in Playground. Choose **Reed or Nih-Dairia** in the header; switching starts a new run. `&creature=nih-dairia` opens that option directly. Both use the physical reach / plant / pull gait, with four or six limbs respectively. WASD / arrows move, E or clicking a victim eats, Space shakes, Escape pauses, and R restarts. Touch direction and action buttons are available.

**Clear all twelve Gorogoro to win.** Eating grants strength; hunters falling off the 12 m platform count toward victory but grant no nutrition. The player has a 0.2 m body radius and each hunter has a 0.33 m radius. Crossing the edge is fatal.

**Feeding is explicit.** Center over an isolated hunter (within 0.2 m initially, highlighted by a ring), then press E, click its body, or use Eat. Reed and Nih-Dairia reuse the lab's physical feeding muscles: cradle with the limbs, cover, lower the torso, mold around the victim, absorb, and recover. The meal clock drives these poses over five seconds initially. The entire player mesh no longer floats above the victim. Starting costs 12% energy; completing restores 32%. Move to abandon or Space to attempt a costly shake. Interrupted meals give no nutrition and the victim grips back. One outside body grip interrupts early feeding; outside appendages halve feeding speed.

Each meal reduces eating time by 0.5 seconds, reaching two seconds after six meals, and improves grip resistance. Three meals raise the pin threshold from two bodies to three; six raise it to four. Mature creatures tolerate two outside body grips while eating, but those grips halve feeding speed. A crowd can still interrupt and consume a mature player.

**Contact escalates.** Early appendage contact cuts underlying gait speed to 0.28/2.1; additional appendage grips compound the slowdown. A single body cuts it to 0.75/2.1. Body grips refresh to 3.6 seconds for as long as bodies overlap, and appendage tethers last 1.4 seconds. Distress rises with each body or appendage grip, accelerating all hunters by up to 65% and reducing their spacing so they converge into a pile-on. It persists for two seconds after escaping, then decays at 7% per second. Distress also reduces player speed by up to 35% and slows recovery from 0.33 to 0.1155 speed units per second. Hunter time escalation remains capped at 1.72×, before the distress multiplier.

**Space releases only one hunter**, prioritizing a body grip, for 48% energy with a 1.6-second cooldown. That hunter gets just 0.3 seconds of regrip protection; others keep holding. Shaking drops underlying gait speed to at most 0.55/2.1 and only partially relieves capture progress. Empty-space shakes spend nothing. Low energy turns the player red and reduces physical gait speed by up to 60%. Energy recovers at 6% per second when free; body grips drain 9% and appendages 3.5% per second. At 85% exhaustion, shaking locks until exhaustion falls to 35%. Eating is still possible if energy permits.

Enough bodies holding for 1.1 seconds initially (2.1 at full strength) commit to irreversible devouring. Capture progress drains slowly when freed, making repeated grabs dangerous. All four or six limbs detach over two seconds, then membrane enclosure and absorption take two more. Captured creatures struggle within 8 cm of their grip. Pause freezes the simulation; restart restores energy, limbs, hunters and progression.

The HUD shows energy, distress, contacts, growth, pin threshold, meal/capture progress and remaining hunters. Contacts use ground-plane body circles and curved appendage capsules. `npm run test:evasion` covers escalation, movement, feeding, costs, interruption, growth, falls and victory; `npm run test:feeding` also checks that both playable creatures physically lower their torsos through the shared feeding poses. Gameplay balance remains a starting point for playtesting.

### Inago — collective ground organism

Open `?specimen=inago` or **Inago** in the new **Collectives** family. One organism moves through 768 dark, armored motiles with crawling limbs and faint ember seams. Its repeating 18-second cycle is **Move** (6 s), **Spread** (5 s), **Coalesce** (7 s). Searching fronts unfold from the body, align with nearby fragments, then gather into a dense, restless knot. There are no airborne particles or separately spawned enemies.

Click the floor to attract the whole organism to a shared stimulus; **Release lure** restores autonomous movement. Drag to orbit, scroll/pinch to zoom, Space to pause, and R to reset. Pace, spread and cohesion adjust live. Reset preserves these control values while restoring the deterministic body and clearing the lure.

`src/inago/controller.ts` owns deterministic local alignment, separation, shared steering, spreading fronts and coalescence. A spatial grid limits neighbor queries; fixed substeps keep caller frame rates consistent. All fragments remain inside the ground arena. `contactAt(x,z,radius)` exposes local density and exposure for future enemy integration. The model uses instanced carapaces, ridges, seams, six crawling limbs and contact shadows. Inago currently has a standalone study; it is not yet an Evasion opponent.

`npm run test:inago` verifies visible spread/contraction over repeated phases, bounded finite movement at tuning extremes, one shared lure, pause/reset, deterministic substeps and contact exposure.

### Cutisling v1 — Inago beneath one veined skin

Open `?specimen=cutisling` or **Cutisling v1** in Collectives. A continuous veined skin moves through 256 invisible flock drivers using Inago's local alignment, separation and eddies. Cutisling allocates no Inago body, appendage or shadow meshes. Its shallow volume has an underside and a rounded rim. Local density fronts drive a curved, non-convex outline; the cap and lip share the same cached vein texture and coordinate field.

Expand **Experiment controls** at the top right to compare three boundary approaches on the same flock: **Flock skin** follows local fronts directly; **Elastic web** uses a damped spring boundary; **Viscous sheet** smooths and trails the moving density. Sixteen live sliders control pace, spread, cohesion, flock freedom during pursuit, turbulence, circulation, surface tension, viscosity, edge detail, thickness, edge softness, mouth irregularity, engulf duration, vein density, vein curvature and vein contrast. Turn **Hunt prey** off to observe Inago's original movement cycle without a feeding opening. Controls also update while paused. The bottom **Reset** restarts with the current tuning; **Restore tuning defaults** restores all settings and restarts the specimen.

A golden prey lure wanders automatically; clicking the ground places it manually, and **Moving lure** toggles wandering. Two restless fronts spread left and right before closing inward. Local flock pressure bends the feeding mouth and the escape channel. Only a locally connected chain winding around prey permits engulfment, with a dwell and a live recheck at capture; separated clumps and open horseshoes cannot feed. The channel seals gradually and its lip narrows with the aperture so it cannot fold through the closing hole. The feeding dome rises smoothly, with shared mesh edges and consistent normals. The prey is fully covered before absorption; it then shrinks, the mound settles, and hunting resumes. Inago remains separately available with its original 768 visible motiles.

`npm run test:cutisling` checks continuous skin, finite grounded geometry, base Inago movement, expansion/contraction, irregular openings, moving and placed prey, wide flanks, active flock movement throughout feeding, hollow prey avoidance, connected-loop closure, actual mesh clearance over prey, persistent caps, rounded lips, bounded geometry uploads, repeated feeding, pause and reset. It also checks distinct boundary approaches on identical trajectories, free flock mode, paused tuning and a complete engulfment sweep at extreme lip/edge settings. Veins are baked once; shared vertex normals are computed once per vertex and only used buffer ranges are uploaded. Cutisling currently has a standalone study, not an Evasion integration.

### Cutisling v2 — tentacle network and feeding study

Open `?specimen=cutisling-v2` or **Cutisling v2** in Collectives. V1 remains separate. V2 now explores as **3–7 interconnected, tapering tentacles**, with small branching feelers and a low, asymmetrically lobed tissue junction. The gathered core is flattened vertically by 45%, with the same tissue volume spreading sideways; its buried tentacle roots flatten with it. Small travelling rises and rocking motions accompany lateral contractions while the body retains this low profile. Root caps are buried inside that core; blended root normals soften the junction without rebuilding the mesh. The dark palettes, travelling vein pulses and matte tissue (roughness 0.96, no clearcoat) are the visual defaults.

The accepted October 17 V2 checkpoint is preserved in commit `93b3546`. The October 18 crawling trial builds on the same preset in `src/cutisling-v2/settings.ts` before the separate V3 experiment. Each visit and **Restore defaults** use **Organism seed 571519**. **New organism** rolls another; **Reset trial** repeats the current seed. The seed determines tentacle count, stays fixed throughout a trial, and is included in **Copy settings** alongside every slider and switch. Counts never pop in or out during motion. The fixed buffers support seven original arms plus two additional feeding arms without rebuilding geometry. The hidden digestive membrane skips geometry updates during exploration.

Exploration follows **Seek → Anchor → Pull**. The network waits while its tendrils search, commits a ground foothold, and draws itself into that grip. **Plant footholds** isolates stationary seeking when disabled; feeding-off trials still travel through planted grips. The default bait starts at (9.5, 6), beyond the initial probing reach. Detection checks the actual curved tentacles within **Sense distance** (default 0.5, range 0–1.5 beyond the combined tissue/prey radii). Contact can occur along an arm, but the anchor is always the **existing tentacle tip closest to the prey**, even if it belongs to another arm. Once prey is sensed, the closest tip stays planted while the body pulls toward it and stops outside the prey. The anchored arm straightens under tension while the other arms retain most of their reach, rake backward and undulate to support the pull. Ground strides retain these supporting limbs instead of resetting them to stubs. They remain extended through flanking and gather into the body only as the feeding sheet forms. Engulfing arms cannot grow until the pull completes. Ground-only anchoring retains its normal pull cycle.

The lure now wanders by default and occasionally makes a slow hop. Light movement contacts and stronger takeoff/landing pulses send amber ripples across the ground. Each ripple retains its emission position and travels at a finite speed; only when it reaches the body or a visible tentacle tip does the organism remember the direction, aim a seeking arm and favor the next foothold toward it. That memory fades between contacts. Physical prey contact waits until the lure is near the ground, then secures it and settles its bounce throughout feeding. The fixed pool of 16 ripples adds no per-frame geometry allocation. Pause, single-step and seeded resets include the lure and wave clocks.

**Moving lure** toggles wandering/hopping. **Lure drift** (0–1.2, default 1.2), **Lure bounce** (0–1.2, default 1.2) and **Vibration instinct** (0–3, default 3) are copied with the other settings. Drift at zero allows stationary hopping; instinct at zero isolates unguided seeking. Clicking the ground relocates the lure and clears its old pulses.

Sensing causes a rapid predatory surge. The sequence is **Sense → Frenzy → Flank → Encircle → Flatten → Phagocyte → Digest**. Two mycelium arms grow from zero thickness at the arriving body, using the same broad-root-to-fine-tip taper, lateral feelers and secondary forks as the seeking arms. Their branches unfurl progressively along the outer flanks and withdraw into the skin during fusion. They flank the bait, and must physically meet and wind around it before fusion begins. A captured tissue-volume budget links retracting/growing cords to the core: tissue gathers visibly in the body before being spent on the enclosing loop. The membrane begins on the same irregular contour as the closed loop, then broadens as the core and cords flatten; its final footprint scales with the gathered tissue at the selected thickness. This is a geometric volume approximation, not a fluid simulation. During **Flatten**, the enclosed cords lower and spread into a continuous sheet. Only afterward does that surface cover the whole bait and absorb it. After digestion, the entire feeding footprint gathers into an irregular mass before any searching limbs emerge. The limbs then unfurl at staggered times; hidden probe clocks reset so the next search does not revive stale extensions. There is no early disk underneath the bait.

**Supporting arm reach** (0.65–1, default 0.88) sets retained length during the pull and flank. **Tentacle clearance** (0–1.5, default 1) spreads crowded seeking directions and adds local over/under detours around exposed shafts. Shared resolved centerlines keep sensing, anchoring and rendering consistent. Small side feelers shorten near another shaft; the buried root junction and deliberate feeding-lip fusion remain blended. Tube rings follow the full 3D tangent so raised bends do not collapse into clipped wedges. The fixed buffers are reused; clearance at zero disables separation for comparison.

**Crawl sway** (0–2, default 1), **Crawl lift** (0–1.5, default 1) and **Crawl rhythm** (0.4–2, default 1) add a slow, unequal crawling rhythm across exploration, anchored pulls, flanking, feeding and recovery. Anchored pulls weave to either side of their committed path and settle precisely at the target; the planted tip remains fixed. Independent low waves move along the arms and through the flat core. The digestive sheet carries small folds outside the sealed prey region while its outer rim remains grounded. Engulfment has enough time for the crawl to read, even at maximum frenzy. Set sway and lift to zero to compare with the previous motion. These controls use the simulation clock and existing mesh buffers.

**Muscular contractions** (0–1, default 1) blends three overlapping pulls into each anchored draw, with quiet intervals between efforts. **Limb delay** (0–1.5, default 1.5) offsets slack uptake and post-meal unfurling. **Body irregularity** (0–1.6, default 1.6) controls broad asymmetric lobes with slow local deformation, normalized to preserve the core geometry’s volume. **Gather / unfurl time** (2–6 seconds, default 3.4) separates recovery into gathering, settling and staggered regrowth. These controls are included in copied settings. The same fixed meshes are reused.

The collapsible **Motion laboratory** includes **Tentacle whip** (0–4), **Whip wave speed** (0.2–5), **Whip curvature** (0–3), **Whip lift** (0–3), **Whip asymmetry** (0–2.5), **Detection frenzy** (0–5, default 5), **Aggro** (0–6, default 6), **Spotted acceleration** (1–6, default 6), and **Flattening time** (0.35–2 seconds, default 0.6). Seeking tendril width, mycelium branching, reach, sweep, search irregularity, anchor bulk/hold/draw and tissue thickness remain adjustable. Camera, particles, skin and vein switches support inspection. Color schemes update skin, anchors and veins together: Cinder, Abyss, Carrion, Oxblood and Bruise. **Vein contrast** (0–2, default 1), **Vein pulse** (0–3, default 0.2) and **Vein pulse speed** (0.3–2, default 2) control the more pronounced vessels shared by the cords, core, grip and feeding surface. Pulses travel along the arms and inward through the digestive skin, widening and brightening the existing network, with stronger pulses during feeding. The tissue stays matte. One cached vein texture and simulation-clock uniforms keep pulses inexpensive, attached to the tissue and frozen when paused.

The solver retains fixed 30/60/120 Hz steps, display interpolation and persistent geometry. Particle count (64–1,024), render scale, flock controls, **Pause**, **Single step**, and copied JSON snapshots support repeatable comparisons. `npm run test:cutisling-v2` checks determinism, interpolation, all particle counts, seeded 3–7 arm variants, fixed geometry, no unanchored exploration, globally closest-tip anchoring, body arrival before sprouting, connected roots, planted tips through the pull, core/cord volume exchange, continuous feeding transitions, sensing-distance thresholds, enclosure before flattening, complete prey coverage, extreme whip/frenzy controls, live palettes, settings serialization, causal vibration steering, directional footholds, smooth occasional hops, bounded wandering, capture of moving prey and lure pause/reset, matching feeding/seeking tapers, attached engulfing branches, shared vein texture lifetime, paused pulse controls, gathering before limb regrowth, recovery continuity, asymmetric core volume, staggered contractions and repeated meals. V2 is a standalone experiment, not an Evasion opponent.

### Ovum — viscous contact accumulation

Open `?specimen=creature-lab&variant=ovum`. During feeding, wet biomass accumulates where the arms touch prey, then builds three overlapping folds that spread around both sides and flow across the top. One fused surface joins the accumulation to the physical skin. Its glossy tissue has the creature’s pigmentation; the prey’s coating advances from contact instead of changing color uniformly. Covering takes roughly two seconds while the full-sized prey stays stationary, then the pile and physical imprint settle during digestion. This is a procedural visual tissue volume driven by the feeding clock and nearest deformed skin, rather than a separate fluid solver. The effect also travels with Ovum in the portable creature kit. `npm run test:feeding` checks increasing pile height, gradual coverage, stationary prey, stable body physics and resolution.
