# Stalheart import: Cutis-Maku · Pearl

Source checkout: `/Users/minikai/Dev/Jelly-Baby/`
Target game checkout: `/Users/minikai/Dev/stalheart/`
Preview: `http://127.0.0.1:5175/?specimen=cutis-maku-pearl`

## Copy these runtime files, preserving their relative paths

From `/Users/minikai/Dev/Jelly-Baby/src/cutis/`:

- `swarm/config.ts`, `swarm/tiers.ts`, `swarm/controller.ts`, `swarm/locomotion.ts`
- `creature/geometry.ts`, `creature/material.ts`, `creature/hard-core.ts`
- `creature/shaders/membrane.vert.glsl`, `creature/shaders/membrane.frag.glsl`

Import `PEARL_TIERS` / `PEARL_DEFAULT_CONFIG` from `swarm/tiers.ts`, `CutisSwarm` from `swarm/controller.ts`, `createSwarmGeometry` from `creature/geometry.ts`, and `createHardCores` from `creature/hard-core.ts`.

Use **PEARL_TIERS**, not CUTIS_TIERS: white/yellow/orange/blue stay soft; green/purple/brown/black all contain rigid spheres. Black has the smallest relative core, colored pure red. Each tier includes size, appendages, cadence, health and contact damage. Balance values are prototypes.

## Minimal integration

```ts
const config = { ...PEARL_TIERS.find(t => t.id === 'green')!.values };
const swarm = new CutisSwarm(config);
swarm.reset(12);
const membrane = createSwarmGeometry(swarm);
const cores = createHardCores(swarm);
scene.add(membrane.group, cores.group);
// Fixed simulation step, seconds; target is in simulation coordinates:
swarm.step(1 / 120, { x: preyX, z: preyZ });
// Before rendering:
cores.update();
membrane.update(camera, viewportHeight);
// Teardown: remove both groups, then dispose both renderers.
```

For the lab's eight-tier mixed preview, construct with `PEARL_DEFAULT_CONFIG`, reset to 12/100/300, then call `swarm.setMixed(true)`. It assigns tiers by instance index with stable ±8% individual speed variation. In the game, use stable per-tier pools/spawn assignments; do not let index compaction silently change enemy identity.

- `swarm.getCoreContact(i)`: core center/radius, `rammable`, radar blip size, proximity flag, health and damage rate. Soft bodies are rammable; solids are not. Both appear on radar; solids have larger blips and proximity warnings, matching Stalheart's convention.
- `swarm.contactDamageAt(i, unitPosition, unitRadius, dt)`: damage amount for this step; host applies it to unit health. Coordinates must match the simulation frame.
- `getState(i)`, `getAnchor(i)`, `getSeekingAnchors(i)`, `getStretchSegment(i)`: motion/gameplay inspection. Host owns death, armor, pooling, collision response and radar rendering.

This is WebGL2/GLSL source, **not a GLB**. It uses Three.js and its ConvexGeometry / BufferGeometryUtils addons; the lab uses Three 0.185.0. Adapt imports to Stalheart's single pinned Three version, compile TypeScript, and preserve Vite's GLSL `?raw` imports. Do not copy `page.ts` or install a second Three runtime. `scene.ts` is reference integration only: its planar arena, camera and lure belong to the lab.

The simulation is meters, Y-up, moving in XZ. Stalheart's spherical terrain needs a tangent-frame/terrain adapter that transforms membrane, cores and contact centers consistently. Preserve the shared core/body transfer path and padded membrane clearance; independently interpolating the core recreates the escape bug.

Validation: `scripts/verify-cutis.mjs` and browser-served `scripts/verify-cutis-containment.mjs` (near/far GPU mesh clearance over 3,200 sampled poses). The lab's Export creature ZIP also supplies a standalone demo, settings, all belt presets and gameplay metadata. GPL-3.0, as in the source LICENSE. No Stalheart game files have been modified yet.

Optional rolling lineage: `GOROGORO_TIERS` / `GOROGORO_DEFAULT_CONFIG` preserve Pearl tiers but add launch, one-reach-distance rolling and recovery. `getLanding(i)` is the final rolled endpoint; `getAnchor(i)` is the earlier suction foothold. Keep the shared `swarm/locomotion.ts` helper with the controller. The optional lab scene also imports `swarm/prey.ts` for continuous fleeing-lure steering; it is not needed for game-owned targeting.
