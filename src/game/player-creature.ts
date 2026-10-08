import { Mesh } from 'three/webgpu';
import { SoftBody } from '../physics/soft-body.js';

export type PlayerCreature='jelly-baby'|'nih-dairia';
export function selectedPlayerCreature():PlayerCreature{
  return new URLSearchParams(location.search).get('creature')==='nih-dairia'?'nih-dairia':'jelly-baby';
}

/** Appearance, physical controller and camera scale belong to the selected actor. */
export async function createPlayerCreature(kind:PlayerCreature){
  if(kind==='nih-dairia'){
    const [{loadMonsterCage},{createMonsterAppearance,updateMonsterAppearance},{MonsterPlayer}]=await Promise.all([
      import('../monster/model.ts'),import('../monster/appearance.ts'),import('./monster-player.ts'),
    ]);
    const body=new SoftBody(await loadMonsterCage()),rig=new MonsterPlayer(body);
    const mesh=createMonsterAppearance(body);
    return {body,rig,mesh,group:mesh,cameraScale:2.4,absorption:[22,18,32],
      update:()=>updateMonsterAppearance(mesh),
      dispose:()=>{
        mesh.traverse(object=>{if(object instanceof Mesh){object.geometry.dispose();const materials=Array.isArray(object.material)?object.material:[object.material];materials.forEach(material=>material.dispose());}});
        body.cage.opticalSurface.geometry.dispose();
      },
    };
  }
  const [{loadBabyCage},{Baby,ABSORPTION},{Locomotion}]=await Promise.all([
    import('../physics/baby-cage.ts'),import('../graphics/baby.ts'),import('./locomotion.ts'),
  ]);
  const body=new SoftBody(await loadBabyCage()),baby=new Baby(body),rig=new Locomotion(body);
  return {body,rig,mesh:baby.mesh,group:baby.group,cameraScale:1,absorption:ABSORPTION,update:()=>baby.update(),dispose:()=>{baby.dispose();body.cage.opticalSurface.geometry.dispose();}};
}
