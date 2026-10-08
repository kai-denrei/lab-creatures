import { normalizeMotion } from './motion-settings.ts';
import type { CreatureVariant } from './variants.ts';
import type { MotionSettings } from './motion-settings.ts';

export const KIT_SOURCES=[
  'LICENSE',
  'src/monster/portable.ts','src/monster/behavior.ts','src/monster/gait.ts','src/monster/pursuit.ts',
  'src/monster/motion-settings.ts','src/monster/appearance.ts','src/monster/model.ts','src/monster/auto-lure.ts','src/monster/arena.ts','src/monster/feeding.ts','src/monster/prey.ts','src/monster/skin.ts','src/monster/traction.ts','src/monster/limb-separation.ts','src/monster/cradle.ts','src/monster/variants.ts','src/monster/dorsal.ts',
  'src/physics/soft-body.js','src/physics/soft-body-kernel.js','src/physics/deform-surface.js','src/physics/constants.js','src/physics/cage-model.ts',
  'src/game/fixed-step.ts','src/graphics/renderer.ts','scripts/native/soft-body-kernel.c','scripts/build-kernel.mjs','scripts/build-monster.mjs','scripts/model-cage.mjs',
];
export const KIT_ASSETS=['nih-dairia','brood','reed','crown','ovum','sept','filament','globulifer'].flatMap(id=>[`src/assets/model/${id}.bin`,`src/assets/model/${id}.json`]);
export function kitScaffold(settings:MotionSettings,variant:CreatureVariant='nih-dairia'):Record<string,string>{
  return {
    'motion-settings.json':JSON.stringify({version:1,variant,motion:normalizeMotion(settings)},null,2),
    'package.json':JSON.stringify({name:'nih-dairia-creature-kit',version:'0.1.0',private:true,type:'module',scripts:{dev:'vite',build:'tsc && vite build',typecheck:'tsc --noEmit','build:model':'node scripts/build-monster.mjs'},dependencies:{three:'0.185.0'},devDependencies:{'@types/three':'^0.185.4',typescript:'~6.0.2',vite:'^8.2.2'}},null,2),
    'tsconfig.json':JSON.stringify({compilerOptions:{target:'es2023',module:'esnext',lib:['ES2023','DOM'],types:['vite/client'],allowJs:true,skipLibCheck:true,moduleResolution:'bundler',allowImportingTsExtensions:true,verbatimModuleSyntax:true,noEmit:true,resolveJsonModule:true},include:['src']},null,2),
    'index.html':'<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Nih-Dairia portable demo</title><style>body{margin:0;background:#19231f;color:#d9dfc8;font:14px sans-serif}canvas{display:block}#status{position:fixed;top:16px;left:16px;white-space:pre-wrap;max-width:80vw}</style><div id="status">Loading creature…</div><script type="module" src="/src/main.ts"></script></html>',
    'src/main.ts':`import * as THREE from 'three/webgpu';
import { createRenderer } from './graphics/renderer.ts';
import { createNihDairia } from './monster/portable.ts';
import { AutoLure } from './monster/auto-lure.ts';
import { createPrey } from './monster/prey.ts';
import preset from '../motion-settings.json';
import type { CreatureVariant } from './monster/variants.ts';
const status=document.querySelector('#status')!;
let renderer:THREE.WebGPURenderer|undefined;
function fail(error:unknown){status.textContent=String(error);void renderer?.setAnimationLoop(null);}
async function start(){
  renderer=await createRenderer(fail);document.body.appendChild(renderer.domElement);
  const scene=new THREE.Scene();scene.background=new THREE.Color('#19231f');
  const camera=new THREE.PerspectiveCamera(38,1,.001,5);camera.position.set(.45,.8,.9);camera.lookAt(0,.02,0);
  scene.add(new THREE.HemisphereLight('#dbe4c5','#374337',2));
  const light=new THREE.DirectionalLight('#ffffff',3);light.position.set(-.3,.8,.2);scene.add(light);
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(1.2,1.2),new THREE.MeshStandardNodeMaterial({color:'#62695e',roughness:.8}));floor.rotation.x=-Math.PI/2;scene.add(floor);
  const creature=await createNihDairia(preset.motion,preset.variant as CreatureVariant);scene.add(creature.mesh);
  const prey=createPrey();scene.add(prey.mesh);
  const auto=new AutoLure();auto.enabled=true;
  const resize=()=>{const w=Math.max(1,innerWidth),h=Math.max(1,innerHeight);renderer!.setDrawingBufferSize(w,h,Math.min(devicePixelRatio,1.7,Math.sqrt(4000000/(w*h))));camera.aspect=w/h;camera.updateProjectionMatrix();};
  window.addEventListener('resize',resize);resize();await renderer.compileAsync(scene,camera);
  status.textContent='Nih-Dairia / portable motion demo';let last=performance.now();
  await renderer.setAnimationLoop(time=>{try{const dt=Math.min(.05,Math.max(0,(time-last)/1000));last=time;if(document.hidden)return;if(!creature.motion.feeding.locked)auto.step(dt,creature.motion.target,creature.motion.center);creature.motion.stimulus=1;creature.update(dt);prey.update(creature.motion.feeding);renderer!.render(scene,camera);}catch(error){fail(error);}});
}
void start().catch(fail);
`,
    'README.md':`# Nih-Dairia portable creature kit\n\nDerived from Jelly Baby by scottstts (https://github.com/scottstts/Jelly-Baby), extended in lab-creatures (https://github.com/kai-denrei/lab-creatures). Distributed under GPL-3.0; see LICENSE.\n\nThis snapshot includes the selected motion settings, source, embedded WebAssembly solver, original C source and generated model. It has no dependency on the Jelly Baby checkout.\n\n## Run the included demo\n\nUse Node 24 (or a Vite 8 compatible Node version). Run npm install, then npm run dev. A WebGPU browser over localhost/HTTPS is required. npm run build typechecks and builds the demo. No WebGL fallback.\n\n## Use in another project\n\nCopy src/monster, src/physics, src/game/fixed-step.ts and src/assets/model into your TypeScript/Vite project, preserving their relative paths. Install three@0.185.0; do not silently mix renderer versions. Import createNihDairia from src/monster/portable.ts.\n\nconst creature = await createNihDairia(preset.motion,preset.variant as CreatureVariant);\nscene.add(creature.mesh);\ncreature.setTarget(new THREE.Vector3(x, 0.012, z));\n// Each animation frame, with elapsed time in seconds:\ncreature.update(dt);\n// On removal:\ncreature.dispose();\n\nThe host owns WebGPU rendering, lighting, camera and targets. creature.settings is mutable for live tuning. creature.motion exposes state and stimulus; creature.reset() retains settings. The included demo uses AutoLure and feeding. Feeding captures nearby prey, cups it with staggered opposing arms while checking membrane clearance, then aligns the torso above the stationary full-sized prey, then lowers it to the floor. A shape-specific, skin-colored deformation in the physical skin holds and resolves before the creature rises and spawns a new target. The ball never moves inward or shrinks during engulfment. While creature.motion.feeding.locked is true, stop external target movement; setTarget returns false. Use createPrey().update(feeding) or render feeding.shape at feeding.preyPosition with feeding.scale and feeding.visible. Shapes cycle through sphere, cube, triangular prism and dodecahedron. Set feeding.enabled=false to disable capture, or motion.targetHeld=true while manually dragging a target. Reset clears the feeding cycle and meal count. motion-settings.json can also be imported into the main experiment.\n\n## Coordinate and integration contract\n\nUnits are meters, seconds and kilograms. Gravity is world -Y; contact is a horizontal plane near Y=0. Simulate with update(dt), which owns fixed 240 Hz steps and clamps elapsed time to 50 ms. Each actor has independent physics and settings. Do not call both update and the underlying body step in one frame. Do not move the mesh transform independently from the body.\n\nStalheart's spherical ground needs a local surface-frame adapter before this can be a boss. Combat, damage and telegraphs remain host game work. Limb self-contact uses bounded sphere-chain proxies and reach sectors, not exact mesh collision. No tearing. Cradling uses sampled skin contact against an enlarged convex prey proxy; full continuous triangle collision is not implemented. Foot grip controls planted-contact adhesion and braking. The renderer is optional to reuse; the physics and behavior can be adapted independently. Source imports and binary URLs assume Vite or equivalent bundler support for TypeScript and new URL(import.meta.url).\n\n## Assets and rebuilding\n\nThe model binary is included. npm run build:model regenerates it. scripts/build-kernel.mjs and scripts/native/soft-body-kernel.c reproduce the embedded solver (requires a compatible clang/WebAssembly toolchain); rebuilding is not required to use the kit. Third-party Three.js/Vite/TypeScript dependencies are installed from npm and retain their own licenses.\n`,
  };
}
