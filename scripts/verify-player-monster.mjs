import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Vector3 } from 'three/webgpu';
import { parseCage } from '../src/physics/cage-model.ts';
import { SoftBody } from '../src/physics/soft-body.js';
import { PHYS } from '../src/physics/constants.js';
import { MonsterPlayer } from '../src/game/monster-player.ts';
const bytes=readFileSync('src/assets/model/nih-dairia.bin');
const body=new SoftBody(parseCage(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),JSON.parse(readFileSync('src/assets/model/nih-dairia.json'))));
const rig=new MonsterPlayer(body);
function tick(seconds){for(let i=0;i<seconds/PHYS.step;i++){rig.step(PHYS.step);body.step(PHYS.step);rig.afterStep();assert(body.isFinite());assert(body.lastMinJacobian>=.12);}}
for(const [x,z] of [[1,0],[-1,0],[0,1],[0,-1]]){
 rig.reset();tick(.5);const start=body.center.clone();rig.move.set(x,0,z);tick(5);
 const travel=body.center.clone().sub(start);console.log('direction / travel',[x,z],travel.toArray());
 assert(travel.dot(new Vector3(x,0,z))>.045,'player travels in requested direction');
 assert.equal(rig.motion.feeding.phase,'hunting');assert.equal(rig.motion.feeding.enabled,false);
 rig.move.set(0,0,0);tick(.5);const stopped=body.center.clone();tick(1);
 console.log('release drift',body.center.distanceTo(stopped));
 assert(body.center.distanceTo(stopped)<.012,'released controls stop locomotion');
}
rig.reset();tick(.5);rig.move.set(1,0,0);tick(22);
assert(body.center.x>.55,'player can leave the observation arena');
rig.jump();tick(.1);assert.equal(rig.motion.state,'recoiling');
// A grab owns the solver; the motor must not fight it, and must release old anchors.
body.grab={};const before=body.velocity.slice();rig.step(PHYS.step);
assert.deepEqual(body.velocity,before,'no locomotion impulses during a grab');
body.grab=null;rig.move.set(0,0,1);const release=body.center.clone();tick(4);
assert(body.center.z>release.z+.03,'movement resumes after a grab');
rig.reset();assert.equal(rig.move.lengthSq(),0);assert.equal(rig.motion.feeding.enabled,false);tick(.5);
assert(Math.hypot(body.center.x,body.center.z)<.01);
console.log('PASS — cardinal steering, release braking, unbounded travel, brace, grab recovery and reset');
