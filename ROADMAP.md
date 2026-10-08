# Creature locomotion roadmap

## Direction

Develop creatures that share the lab's soft-body physics and tactile materials but have distinct silhouettes and movement. The two selected next experiments are **1. Slug** and **2. Flat snake-like entity**. Their eventual destination is the Stalheart ecosystem; the immediate proving ground is the Jelly Baby wooden-table playground.

Keep the existing WebGPU/TSL renderer, physical surface deformation, camera-relative WASD/arrow controls, touch D-pad, orbit camera, grabbing and reset. Give each anatomy its own controller rather than forcing it through Nih-Dairia's six-legged gait. Reuse physical forces and ground contact; do not translate an animated mesh across the floor to simulate locomotion.

## 1. Slug — extend, plant, gather, pull

**Silhouette:** a low, fleshy oblong body with a substantial dorsal bulge, rounded front and tapered rear. It should visibly lengthen and thicken again, contrasting with both Jelly Baby and the tentacled creatures.

**Movement:** the rear grips while the front extends. The front establishes contact, then the body contracts and draws the rear forward. A shallow lateral coil and a traveling dorsal bulge can make the gathering phase feel organic. Pauses should read as weight resting on the surface, not a hovering animation.

**First implementation:** force-driven extension/contraction with alternating front/rear grip regions. Keep the body in broad, gentle curves; tight loops are deferred until self-contact is addressed. WASD supplies heading; releasing it settles the body. Space can contract/brace instead of hopping.

**Tuning to expose after the gait works:** extension ratio, extension duration, pull duration, pause duration, body bulge, coil amplitude, ground grip and steering response.

**Success criteria:** front and rear contact have visibly distinct roles; planted regions stay nearly fixed while the rest advances; the body gathers rather than merely scaling; release produces little residual travel; grabbing temporarily hands control to physics and release recovers without snapping.

## 2. Flat snake-like entity — traveling bends

**Silhouette:** a long, low ribbon with a broad flattened cross-section and tapered ends. It should have a readable sensing/front end without needing eyes or a conventional snake head.

**Movement:** broad S-shaped bends propagate along the body. Different underside regions grip and release as the wave passes. Heading changes should progressively redirect the body, rather than rotating the whole mesh rigidly. The tail follows the front's motion with a clear delay.

**First implementation:** a force-driven traveling lateral wave with distributed ground traction. Use bounded curvature and modest amplitude to keep the mesh from folding through itself. Preserve volume as it bends. Start with undulation; a stretch-and-pull preset on this same anatomy is a later comparison, not a third creature.

**Tuning to expose after the gait works:** wave amplitude, wavelength, wave speed, head-to-tail delay, grip, forward speed, steering response and body flatness.

**Success criteria:** the wave visibly travels rather than rocking the whole body sideways; contact points support forward motion; movement stops when input ends; turns do not create crossings or abrupt tail flips; the long body remains readable in the follow camera.

## Delivery sequence and status

- [x] Reusable playground actor selection and input contract exist for Jelly Baby and Nih-Dairia.
- [x] Initial closed surface meshes and tetrahedral cages generated for slug and flat snake. These are prototype assets, not validated final shapes.
- [x] Add separate physical crawler locomotion and materials.
- [x] Add both to the playground's Play as selector, with appropriate camera framing and labels.
- [x] Numerically verify cardinal steering, turns, release braking, planted contact, physical deformation, grab recovery, reset and stability.
- [ ] Compare both visually on desktop and mobile; user performs browser/device inspection under repository instructions.
- [ ] Add movement tuning and reusable settings export after the initial gaits prove useful.
- [ ] Add autonomous demonstrations in Creature Lab, then consider feeding and ecosystem behaviors.
- [ ] Adapt the resulting actor/controller interfaces for Stalheart's terrain, combat and boss behavior.

## Constraints and deferred work

Preserve the 4,000,000-pixel drawing-buffer cap, WebGPU-only behavior, clear boot/runtime failures and existing Jelly Baby behavior. Prefer modular anatomy/controller code. Automated checks can validate motion and stability but cannot establish that movement feels convincing.

Tight coils, full-body wrapping and exact self-collision are deferred. Broad curvature limits and approximate contacts are suitable for initial experiments; the existing tentacle separation rules are not a general solution for ribbon self-contact. Slime trails, fluid simulation, antennae, prey ingestion and combat are also outside the first locomotion pass.

Potential later directions: a reversible two-ended leech, a pleated accordion crawler, a folding living sheet, and a braided multi-ribbon worm. These are unselected ideas, not current implementation commitments.
