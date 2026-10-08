import { Vector3, Mesh } from 'three/webgpu';
import { SoftBody } from '../physics/soft-body.js';
import { PHYS } from '../physics/constants.js';
import { FixedStepper } from '../game/fixed-step.ts';
import { loadMonsterCage } from './model.ts';
import { MonsterBehavior } from './behavior.ts';
import { createMonsterAppearance, updateMonsterAppearance } from './appearance.ts';
import { normalizeMotion } from './motion-settings.ts';
import type { CreatureVariant } from './variants.ts';
import type { MotionSettings } from './motion-settings.ts';

/** Drop-in actor for a Three.js WebGPU scene. Host owns rendering and lighting. */
export async function createNihDairia(values:Partial<MotionSettings>={},variant:CreatureVariant='nih-dairia'){
  const body=new SoftBody(await loadMonsterCage(variant));
  const settings=normalizeMotion(values),motion=new MonsterBehavior(body,settings);
  const mesh=createMonsterAppearance(body,motion.feeding),clock=new FixedStepper(PHYS.step);
  let disposed=false;
  return {
    mesh,body,motion,settings,
    setTarget(target:Vector3){if(motion.feeding.locked)return false;motion.target.copy(target);motion.stimulus=1;return true;},
    update(dt:number){
      if(disposed)return;
      const steps=clock.advance(dt,()=>{motion.step(PHYS.step);body.step(PHYS.step);});
      if(steps){if(!body.isFinite())throw new Error('Nih-Dairia physics became non-finite');body.updateSurface();updateMonsterAppearance(mesh);}
    },
    reset(){motion.reset();clock.reset();},
    dispose(){if(disposed)return;disposed=true;mesh.removeFromParent();mesh.traverse(object=>{if(object instanceof Mesh){object.geometry.dispose();const materials=Array.isArray(object.material)?object.material:[object.material];materials.forEach(material=>material.dispose());}});body.cage.opticalSurface.geometry.dispose();},
  };
}
