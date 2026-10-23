// Development utility: render the actual model for static library thumbnails.
import * as THREE from 'three/webgpu';
import { createSpecimenScene } from '../monster/scene.ts';
import { loadEnvironment } from '../graphics/environment.ts';
import { ArthropodGait } from '../arthropods/gait.ts';
import { VeilGait } from '../arthropods/veil-gait.ts';
import { createArthropod } from '../arthropods/model.ts';
import { createOculus } from '../arthropods/oculus.ts';
import { createIsopod } from '../arthropods/isopod.ts';
import { createMembrane } from '../arthropods/membrane.ts';
import { LAB_VARIANTS } from '../arthropods/variants.ts';
import { CREATURE_VARIANTS } from '../monster/variants.ts';
import { loadMonsterCage } from '../monster/model.ts';
import { SoftBody } from '../physics/soft-body.js';
import { createMonsterAppearance,updateMonsterAppearance } from '../monster/appearance.ts';
import { createPlayerCreature } from '../game/player-creature.ts';
export async function renderThumbnail(id:string){
  if(id==='cutisling-v2'){
    const {createV2Scene}=await import('../cutisling-v2/scene.ts');
    document.body.innerHTML='<main id="v2-thumbnail" style="width:640px;height:420px"></main>';document.body.style.cssText='margin:0;overflow:hidden';
    const lab=createV2Scene(document.querySelector<HTMLElement>('#v2-thumbnail')!);
    for(let i=0;i<360;i++)lab.body.step(1/60);
    lab.controls.target.set(lab.body.centerX,0,lab.body.centerZ);lab.camera.position.set(lab.body.centerX+3,6,lab.body.centerZ+7);lab.draw();return;
  }
  if(id==='inago'||id==='cutisling'||id==='peristaling'){
    const {createInagoScene}=await import('../inago/scene.ts');
    document.body.innerHTML='<main id="inago-thumbnail" style="width:640px;height:420px"></main>';document.body.style.cssText='margin:0;overflow:hidden';
    const lab=createInagoScene(document.querySelector<HTMLElement>('#inago-thumbnail')!,id as 'inago'|'cutisling'|'peristaling');
    // Cutisling is shown with its ring closed around the prey, not mid-reshaping.
    for(let i=0;i<(id==='cutisling'?660:id==='peristaling'?150:480);i++)lab.organism.step(1/60);
    const x=lab.organism.x.reduce((sum,v)=>sum+v,0)/lab.organism.count,z=lab.organism.z.reduce((sum,v)=>sum+v,0)/lab.organism.count;lab.controls.target.set(x,0,z);lab.camera.position.set(x+4,8,z+9);lab.draw(false);return;
  }
  if(id==='cutis-maku'||id==='cutis-maku-k'||id==='cutis-maku-pearl'||id==='cutis-gorogoro'){
    const [{createCutisScene},{DEFAULT_CONFIG}]=await Promise.all([import('../cutis/scene.ts'),import('../cutis/swarm/config.ts')]);
    document.body.innerHTML='<main id="cutis-thumbnail" style="width:640px;height:420px"></main>';document.body.style.cssText='margin:0;overflow:hidden';
    const settings=id==='cutis-gorogoro'?(await import('../cutis/swarm/tiers.ts')).GOROGORO_DEFAULT_CONFIG:id==='cutis-maku-pearl'?(await import('../cutis/swarm/tiers.ts')).PEARL_DEFAULT_CONFIG:id==='cutis-maku-k'?(await import('../cutis/swarm/tiers.ts')).K_DEFAULT_CONFIG:DEFAULT_CONFIG;
    const lab=createCutisScene(document.querySelector<HTMLElement>('#cutis-thumbnail')!,{...settings});lab.lure.visible=false;
    if(id!=='cutis-maku')lab.camera.position.set(-1.25,.85,1.9);else lab.camera.position.set(-.85,.6,1.35);lab.controls.target.set(.3,.14,.2);lab.controls.update();lab.swarm.scrub(id==='cutis-gorogoro'?.705:.42);if(id==='cutis-gorogoro'){const c=lab.swarm.getCoreContact(0).center;lab.controls.target.set(c.x,c.y,c.z);lab.camera.position.set(c.x-1.1,c.y+.6,c.z+1.5);lab.controls.update();}lab.draw();return;
  }
  const variant=LAB_VARIANTS.find(v=>v.id===id),soft=CREATURE_VARIANTS.find(v=>v.id===id);
  let object:THREE.Object3D;
  if(variant){
    const model=(id==='oculus'||id==='monoculus')?createOculus(id):id==='isopod'?createIsopod():id==='veil'?createMembrane():createArthropod();
    const gait=id==='veil'?new VeilGait():new ArthropodGait(variant.id);
    if(id==='veil'){gait.target.set(.3,0,.2);for(let i=0;i<150;i++)gait.step(1/120);gait.center.x=0;gait.center.z=0;}
    model.update(gait);object=model.group;
  }else if(soft){const body=new SoftBody(await loadMonsterCage(soft.id));const mesh=createMonsterAppearance(body);updateMonsterAppearance(mesh);object=mesh;}
  else{
    const actor=await createPlayerCreature(id==='slug'?'slug':id==='flat-snake'?'flat-snake':id==='nih-dairia-player'?'nih-dairia':'jelly-baby');
    // The playable ancestor is shown mid-stride under player input so its card differs from the reference lab.
    if(id==='nih-dairia-player'&&'rig' in actor){const {rig,body}=actor;for(let i=0;i<80;i++){rig.step(1/240);body.step(1/240);}rig.move.set(1,0,0);for(let i=0;i<300;i++){rig.step(1/240);body.step(1/240);rig.afterStep();}}
    actor.update();object=actor.group;
  }
  const {scene,camera,lure}=createSpecimenScene(1.1);lure.visible=false;scene.add(object);
  const bounds=new THREE.Box3().setFromObject(object),center=bounds.getCenter(new THREE.Vector3()),size=bounds.getSize(new THREE.Vector3());
  camera.aspect=640/420;camera.fov=34;const distance=Math.max(size.x*.75,size.z*.8,size.y)*2.75;
  camera.position.copy(center).add(new THREE.Vector3(id==='nih-dairia-player'?1:.48,id==='nih-dairia-player'?.4:.85,id==='nih-dairia-player'?.7:1).normalize().multiplyScalar(distance));camera.lookAt(center);camera.updateProjectionMatrix();
  const renderer=new THREE.WebGPURenderer({antialias:true});await renderer.init();renderer.setSize(640,420);renderer.shadowMap.enabled=true;renderer.toneMapping=THREE.AgXToneMapping;renderer.toneMappingExposure=1.05;
  await loadEnvironment(renderer,scene);scene.environmentIntensity=.55;
  document.body.innerHTML='';document.body.style.cssText='margin:0;overflow:hidden';document.body.append(renderer.domElement);
  await renderer.compileAsync(scene,camera);renderer.render(scene,camera);await (renderer.backend as unknown as {device:GPUDevice}).device.queue.onSubmittedWorkDone();
}
