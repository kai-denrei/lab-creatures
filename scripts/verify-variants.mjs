import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseCage } from '../src/physics/cage-model.ts';
import { SoftBody } from '../src/physics/soft-body.js';
import { MonsterBehavior } from '../src/monster/behavior.ts';
import { createMonsterAppearance, updateMonsterAppearance } from '../src/monster/appearance.ts';
import { SpiderGait } from '../src/monster/gait.ts';
import { Vector3 } from 'three/webgpu';
import { PHYS } from '../src/physics/constants.js';
for(const [name,count] of [['nih-dairia',6],['brood',6],['reed',4],['crown',8],['ovum',6],['sept',7],['filament',6],['globulifer',6]]){
 const bytes=readFileSync(`src/assets/model/${name}.bin`),metadata=JSON.parse(readFileSync(`src/assets/model/${name}.json`,'utf8'));
 const body=new SoftBody(parseCage(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),metadata)),rig=new MonsterBehavior(body);
 const edges=new Map();
 for(let j=0;j<body.surface.indices.length;j+=3)for(let k=0;k<3;k++){
  const a=body.surface.indices[j+k],b=body.surface.indices[j+(k+1)%3],key=`${Math.min(a,b)},${Math.max(a,b)}`;edges.set(key,(edges.get(key)||0)+1);
 }
 assert([...edges.values()].every(n=>n===2),`${name}: closed manifold skin`);
 assert.equal(rig.gait.feet.length,count);assert.equal(rig.pursuit.count,count);
 const tick=()=>{rig.step(PHYS.step);body.step(PHYS.step);assert(body.isFinite());assert(body.lastMinJacobian>=.12,`${name}: valid tetrahedra`);};
 rig.active=false;for(let i=0;i<360;i++)tick();
 assert(body.contact.some(v=>v>0),`${name}: supported stance`);
 const start=rig.center.x;rig.active=true;rig.feeding.enabled=false;rig.target.set(.22,.012,0);rig.stimulus=1;
 for(let i=0;i<960;i++)tick();assert(rig.center.x>start+.01,`${name}: pursues prey`);
 rig.reset();rig.active=false;rig.feeding.enabled=true;
 for(let i=0;i<240;i++)tick();
 rig.target.set(rig.torsoCenter.x+.06,.012,rig.torsoCenter.z);rig.active=true;
 const phases=new Set();let lastGap=Infinity,wrapped=false;
 for(let i=0;i<3000&&rig.feeding.meals===0;i++){
  tick();phases.add(rig.feeding.phase);
  if(rig.feeding.phase==='cradling'){lastGap=rig.cradle.minimumGap;wrapped=true;}
 }
 console.log(name,{count,meals:rig.feeding.meals,phases:[...phases],lastGap,volume:body.volumeRatio()});
 assert(wrapped&&phases.has('covering')&&rig.feeding.meals===1,`${name}: cradle and feeding complete`);
 assert(lastGap>=-.0005,`${name}: sampled membrane clears prey before covering`);
 assert(body.volumeRatio()>.75&&body.volumeRatio()<1.25);
 if(name==='globulifer'){
  body.updateSurface();const mesh=createMonsterAppearance(body,rig.feeding),growth=mesh.children[0];
  assert(growth&&growth.children.filter(child=>child.geometry?.type==='SphereGeometry').length===4,'four dorsal globes are present');
  const before=growth.position.clone();
  for(let j=0;j<body.x.length;j+=3)body.x[j]+=.03;
  body.surfaceDirty=true;body.updateSurface();updateMonsterAppearance(mesh);
  assert(Math.abs(growth.position.x-before.x-.03)<1e-5,'dorsal roots follow the deformed skin');
  growth.traverse(object=>{object.geometry?.dispose();object.material?.dispose();});mesh.material.dispose();
 }
 body.surface.geometry.dispose();body.cage.opticalSurface.geometry.dispose();
}
console.log('PASS — eight distinct body plans, locomotion, cradle clearance and feeding');

const oddGait=new SpiderGait(undefined,7),stepped=new Set();
for(let i=0;i<720;i++){
 oddGait.step(PHYS.step,new Vector3(),new Vector3(1,0,0),true);
 oddGait.planted.forEach((planted,leg)=>{if(!planted)stepped.add(leg);});
}
assert.equal(stepped.size,7,'odd limb count gives every tentacle a turn');
console.log('PASS — attached dorsal growths and seven-limb footfall coverage');
