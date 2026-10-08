import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseCage } from '../src/physics/cage-model.ts';
import { SoftBody } from '../src/physics/soft-body.js';
import { MonsterBehavior } from '../src/monster/behavior.ts';
import { PHYS } from '../src/physics/constants.js';
for(const [name,count] of [['nih-dairia',6],['brood',6],['reed',4],['crown',8]]){
 const bytes=readFileSync(`src/assets/model/${name}.bin`),metadata=JSON.parse(readFileSync(`src/assets/model/${name}.json`,'utf8'));
 const body=new SoftBody(parseCage(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),metadata)),rig=new MonsterBehavior(body);
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
 body.surface.geometry.dispose();body.cage.opticalSurface.geometry.dispose();
}
console.log('PASS — four distinct body plans, locomotion, cradle clearance and feeding');
