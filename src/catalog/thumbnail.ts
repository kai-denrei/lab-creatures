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
  if(id==='cutis-maku'){
    const [{createCutisScene},{DEFAULT_CONFIG}]=await Promise.all([import('../cutis/scene.ts'),import('../cutis/swarm/config.ts')]);
    document.body.innerHTML='<main id="cutis-thumbnail" style="width:640px;height:420px"></main>';document.body.style.cssText='margin:0;overflow:hidden';
    const lab=createCutisScene(document.querySelector<HTMLElement>('#cutis-thumbnail')!,{...DEFAULT_CONFIG});lab.lure.visible=false;
    lab.camera.position.set(-.85,.6,1.35);lab.controls.target.set(.3,.14,.2);lab.controls.update();lab.swarm.scrub(.42);lab.draw();return;
  }
  const variant=LAB_VARIANTS.find(v=>v.id===id),soft=CREATURE_VARIANTS.find(v=>v.id===id);
  let object:THREE.Object3D;
  if(variant){
    const model=(id==='oculus'||id==='monoculus')?createOculus(id):id==='isopod'?createIsopod():id==='veil'?createMembrane():createArthropod();
    const gait=id==='veil'?new VeilGait():new ArthropodGait(variant.id);
    if(id==='veil'){gait.target.set(.3,0,.2);for(let i=0;i<150;i++)gait.step(1/120);gait.center.x=0;gait.center.z=0;}
    model.update(gait);object=model.group;
  }else if(soft){const body=new SoftBody(await loadMonsterCage(soft.id));const mesh=createMonsterAppearance(body);updateMonsterAppearance(mesh);object=mesh;}
  else{const actor=await createPlayerCreature(id==='slug'?'slug':id==='flat-snake'?'flat-snake':'jelly-baby');actor.update();object=actor.group;}
  const {scene,camera,lure}=createSpecimenScene(1.1);lure.visible=false;scene.add(object);
  const bounds=new THREE.Box3().setFromObject(object),center=bounds.getCenter(new THREE.Vector3()),size=bounds.getSize(new THREE.Vector3());
  camera.aspect=640/420;camera.fov=34;const distance=Math.max(size.x*.75,size.z*.8,size.y)*2.75;
  camera.position.copy(center).add(new THREE.Vector3(.48,.85,1).normalize().multiplyScalar(distance));camera.lookAt(center);camera.updateProjectionMatrix();
  const renderer=new THREE.WebGPURenderer({antialias:true});await renderer.init();renderer.setSize(640,420);renderer.shadowMap.enabled=true;renderer.toneMapping=THREE.AgXToneMapping;renderer.toneMappingExposure=1.05;
  await loadEnvironment(renderer,scene);scene.environmentIntensity=.55;
  document.body.innerHTML='';document.body.style.cssText='margin:0;overflow:hidden';document.body.append(renderer.domElement);
  await renderer.compileAsync(scene,camera);renderer.render(scene,camera);await (renderer.backend as unknown as {device:GPUDevice}).device.queue.onSubmittedWorkDone();
}
