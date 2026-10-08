import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Vector3} from 'three/webgpu';
import {SoftBody} from '../src/physics/soft-body.js';
import {parseCage} from '../src/physics/cage-model.ts';
import {PHYS} from '../src/physics/constants.js';
import {CrawlerLocomotion} from '../src/crawlers/locomotion.ts';
for(const kind of ['slug','flat-snake']){
 const bytes=readFileSync(`src/assets/model/${kind}.bin`),manifest=JSON.parse(readFileSync(`src/assets/model/${kind}.json`));
 const body=new SoftBody(parseCage(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),manifest)),rig=new CrawlerLocomotion(body,kind);
 const edges=new Map();const indices=body.surface.indices;
 for(let i=0;i<indices.length;i+=3)for(let k=0;k<3;k++){const a=indices[i+k],b=indices[i+(k+1)%3],key=[a,b].sort((x,y)=>x-y).join(',');edges.set(key,(edges.get(key)||0)+1);}
 assert([...edges.values()].every(count=>count===2),'closed manifold surface');
 let minLength=Infinity,maxLength=0,maxSide=0,anchored=0;
 function tick(seconds,measure=false){for(let i=0;i<seconds/PHYS.step;i++){
  rig.step(PHYS.step);body.step(PHYS.step);assert(body.isFinite());assert(body.lastMinJacobian>=.12);if(i%120===0)assert(body.volumeRatio()>.75&&body.volumeRatio()<1.25,'bounded tissue volume');
  if(measure&&i%16===0){body.updateSurface();const p=body.surface.positions;let lo=Infinity,hi=-Infinity;for(let j=0;j<p.length;j+=3){lo=Math.min(lo,p[j+2]);hi=Math.max(hi,p[j+2]);maxSide=Math.max(maxSide,Math.abs(p[j]-body.center.x));}minLength=Math.min(minLength,hi-lo);maxLength=Math.max(maxLength,hi-lo);anchored+=rig.anchored;}
 }}
 tick(.6);const start=body.center.clone();rig.move.set(0,0,1);tick(8,true);
 console.log(kind,{travel:body.center.clone().sub(start).toArray(),lengthRange:[minLength,maxLength],maxSide,anchored});
 assert(body.center.z>start.z+.04,'forward locomotion');assert(Math.abs(body.center.x-start.x)<(body.center.z-start.z)*.4,'forward input must not travel mainly sideways');assert(anchored>0,'planted contacts support motion');
 if(kind==='slug')assert(maxLength-minLength>.012,'visible extension and gathering');
 else assert(maxSide>.019,'visible lateral bending');
 rig.move.set(0,0,0);tick(.8);const stop=body.center.clone();tick(1);assert(body.center.distanceTo(stop)<.015,'release brakes');
 for(const direction of [new Vector3(1,0,0),new Vector3(-1,0,0),new Vector3(0,0,-1)]){
  rig.move.copy(direction);tick(2);const turn=body.center.clone();tick(5);
  assert(body.center.clone().sub(turn).dot(direction)>.015,'steering in all cardinal directions');
 }
 body.grab={};const before=body.velocity.slice();rig.step(PHYS.step);assert.deepEqual(body.velocity,before);body.grab=null;tick(1);
 rig.jump();tick(.1);assert(rig.activity<.5,'brace suppresses locomotion');
 rig.reset();body.reset();tick(.6);assert(Math.hypot(body.center.x,body.center.z)<.01);
 console.log('PASS',kind,'shape, anchored gait, turn, stop, grab, brace, reset');
}
