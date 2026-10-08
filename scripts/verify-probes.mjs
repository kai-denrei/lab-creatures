import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseCage } from '../src/physics/cage-model.ts';
import { SoftBody } from '../src/physics/soft-body.js';
import { MonsterBehavior } from '../src/monster/behavior.ts';
import { DEFAULT_MOTION } from '../src/monster/motion-settings.ts';
import { PHYS } from '../src/physics/constants.js';
const bytes=readFileSync('src/assets/model/nih-dairia.bin');
const body=new SoftBody(parseCage(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),JSON.parse(readFileSync('src/assets/model/nih-dairia.json','utf8'))));
const rig=new MonsterBehavior(body),rest=body.surface.positions.slice(),tips=Array.from({length:6},()=>[]);
rig.feeding.enabled=false;
for(let j=0;j<rest.length;j+=3)if(Math.hypot(rest[j],rest[j+2])>.081)tips[(Math.round(Math.atan2(rest[j+2],rest[j])/(Math.PI/3))+6)%6].push(j);
function tick(){rig.step(PHYS.step);body.step(PHYS.step);assert(body.isFinite());assert(body.lastMinJacobian>=.12);}
function measure(settings,distance=.3){
  Object.assign(rig.settings,DEFAULT_MOTION,settings);rig.reset();rig.active=false;
  for(let i=0;i<360;i++)tick();
  const start=rig.center.clone();
  rig.target.set(start.x+distance,.012,start.z);rig.active=true;rig.stimulus=1;
  for(let i=0;i<105;i++)tick();body.updateSurface();
  assert.equal(rig.pursuit.phase,'reach');
  const points=[rig.pursuit.lead,rig.pursuit.secondLead].map(leg=>{
    const ids=tips[leg];let x=0,z=0;
    for(const j of ids){x+=body.surface.positions[j]/ids.length;z+=body.surface.positions[j+2]/ids.length;}
    return {x:x-rig.center.x,z:z-rig.center.z};
  });
  return {lengths:points.map(p=>Math.hypot(p.x,p.z)),width:Math.abs(points[0].z-points[1].z),advance:rig.center.x-start.x};
}
const short=measure({stretch:0}),long=measure({stretch:5}),narrow=measure({stretch:4,spread:0}),wide=measure({stretch:4,spread:6}),near=measure({stretch:5},.07);
console.log({short,long,narrow,wide,near});
for(let arm=0;arm<2;arm++){
 assert(long.lengths[arm]>short.lengths[arm]+.04,'stretch increases each physical sensor reach by at least 4 cm');
 assert(long.lengths[arm]>near.lengths[arm]+.04,'each sensor retracts substantially near prey');
}
assert(wide.width>narrow.width+.04,'spread widens the two actual sensor tips by at least 4 cm');
assert(long.advance<.03,'the searching arms extend before the whole body follows');
console.log('PASS — two physical sensor arms, stretch/spread range and distance taper');

// A long reach must include visible lateral travel while both arms are extended.
function sweepTravel(sweep){
 Object.assign(rig.settings,DEFAULT_MOTION,{reachTime:10,stretch:3,sweep});rig.reset();rig.active=false;
 for(let i=0;i<240;i++)tick();
 rig.target.set(.35,.012,0);rig.active=true;rig.stimulus=1;
 const low=[Infinity,Infinity],high=[-Infinity,-Infinity];let staggered=0;
 for(let i=0;i<440;i++){
  tick();
  if(i<290||i%4)continue;
  assert.equal(rig.pursuit.phase,'reach','10x duration keeps the body in search mode');
  body.updateSurface();
  for(const [arm,leg] of [rig.pursuit.lead,rig.pursuit.secondLead].entries()){
   const ids=tips[leg];let x=0,z=0;
   for(const j of ids){x+=body.surface.positions[j]/ids.length;z+=body.surface.positions[j+2]/ids.length;}
   const angle=Math.atan2(z-rig.center.z,x-rig.center.x);low[arm]=Math.min(low[arm],angle);high[arm]=Math.max(high[arm],angle);
  }
  const a=rig.pursuit.firstDirection,b=rig.pursuit.secondDirection;
  if(Math.abs(a.z+b.z)>.05)staggered++;
 }
 return {ranges:high.map((v,i)=>v-low[i]),staggered};
}
const steady=sweepTravel(0),sweeping=sweepTravel(3);
console.log('physical sweep angle ranges (radians)',{steady,sweeping});
for(let i=0;i<2;i++)assert(sweeping.ranges[i]>steady.ranges[i]+.15,'each actual arm sweeps through a visibly larger arc');
assert(sweeping.staggered>10,'arms are not locked into mirrored arcs');
console.log('PASS — extended ground-search sweep, separate timing and 10x reach duration');
