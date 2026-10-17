import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Vector3 } from 'three/webgpu';
import { FeedingCycle } from '../src/monster/feeding.ts';
import { MonsterBehavior } from '../src/monster/behavior.ts';
import { AutoLure } from '../src/monster/auto-lure.ts';
import { ARENA } from '../src/monster/arena.ts';
import { parseCage } from '../src/physics/cage-model.ts';
import { SoftBody } from '../src/physics/soft-body.js';
import { PHYS } from '../src/physics/constants.js';

const feeding=new FeedingCycle(),target=new Vector3(.02,.012,0),center=new Vector3(0,.03,0);
for(let i=0;i<120;i++)feeding.step(PHYS.step,target,center,false);
assert.equal(feeding.phase,'hunting','held prey and inactive creatures cannot start feeding');
for(let i=0;i<30;i++)feeding.step(PHYS.step,target,center,true);
assert.equal(feeding.phase,'cradling');
for(let i=0;i<400;i++)feeding.step(PHYS.step,target,center,true,false);
assert.equal(feeding.phase,'covering','the creature cannot lower itself while off-center');
assert.equal(feeding.drop,0);
center.x=target.x;
for(let i=0;i<300;i++)feeding.step(PHYS.step,target,center,true,false);
assert.equal(feeding.phase,'dropping','absorption waits for actual abdominal ground contact');
assert.equal(feeding.scale,1,'a ball is not shrunk away while the body is still descending');
feeding.reset(target);assert(!feeding.locked&&feeding.scale===1&&feeding.meals===0,'reset clears capture and restores prey');
const wobble=new FeedingCycle(),wobbleCenter=new Vector3(0,.03,0),wobbleTarget=new Vector3(0,.012,0);
for(let i=0;i<30;i++)wobble.step(PHYS.step,wobbleTarget,wobbleCenter,true);
for(let i=0;i<340;i++)wobble.step(PHYS.step,wobbleTarget,wobbleCenter,true);
for(let i=0;i<240&&wobble.phase==='covering';i++){
  wobbleCenter.x=i%6<4?.005:.009;
  wobble.step(PHYS.step,wobbleTarget,wobbleCenter,true,false);
}
assert.equal(wobble.phase,'dropping','small elastic oscillations do not endlessly restart covering');

const blockedWrap=new FeedingCycle(),wrappedTarget=new Vector3(.04,.012,0),wrappedCenter=new Vector3(0,.03,0);
for(let i=0;i<600;i++)blockedWrap.step(PHYS.step,wrappedTarget,wrappedCenter,true,true,false);
assert.equal(blockedWrap.phase,'cradling','unsafe membrane contact cannot time out into covering');
for(let i=0;i<40;i++)blockedWrap.step(PHYS.step,wrappedTarget,wrappedCenter,true,true,true);
assert.equal(blockedWrap.phase,'covering','clearance dwell releases the cradle');

const bytes=readFileSync('src/assets/model/nih-dairia.bin');
const body=new SoftBody(parseCage(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),JSON.parse(readFileSync('src/assets/model/nih-dairia.json','utf8'))));
const rig=new MonsterBehavior(body),rest=body.surface.positions.slice(),core=[];
for(let j=0;j<rest.length;j+=3)if(Math.hypot(rest[j],rest[j+2])<.018)core.push(j+1);
const tick=()=>{rig.step(PHYS.step);body.step(PHYS.step);assert(body.isFinite());assert(body.lastMinJacobian>=.12,'feeding never inverts an element');};
rig.active=false;for(let i=0;i<480;i++)tick();body.updateSurface();
const standing=Math.min(...core.map(j=>body.surface.positions[j]));
rig.target.set(rig.torsoCenter.x+.014,.012,rig.torsoCenter.z);const original=rig.target.clone();rig.active=true;
const phases=new Set();let lowest=Infinity,smallest=1,imprinted=-Infinity,resolved=Infinity;
const upper=[];
for(let j=0;j<rest.length;j+=3)if(body.surface.restNormals[j+1]>.25&&Math.hypot(rest[j],rest[j+2])<.032)upper.push(j);
const prominence=()=>{
  const inside=[],outside=[],positions=body.surface.positions;
  for(const j of upper){const d=Math.hypot(positions[j]-original.x,positions[j+2]-original.z);if(d<.008)inside.push(positions[j+1]);else if(d>.018&&d<.028)outside.push(positions[j+1]);}
  assert(inside.length&&outside.length,'surface samples cover the prey and surrounding membrane');
  return inside.reduce((sum,y)=>sum+y,0)/inside.length-outside.reduce((sum,y)=>sum+y,0)/outside.length;
};
let lastPhase='hunting';
for(let i=0;i<2400;i++){
  tick();phases.add(rig.feeding.phase);
  assert(rig.feeding.scale>=0&&rig.feeding.scale<=1);
  if(lastPhase==='covering'&&rig.feeding.phase==='dropping')assert(Math.hypot(rig.torsoCenter.x-original.x,rig.torsoCenter.z-original.z)<.010,'torso gets on top before descending');
  if(['cradling','covering','dropping','absorbing','recovering'].includes(rig.feeding.phase)){
    assert(rig.target.distanceTo(original)<1e-9,'captured target remains fixed');
    assert(rig.feeding.preyPosition.distanceTo(original)<1e-9,'prey is never sucked toward or into the creature');
  }
  if(rig.feeding.phase==='covering'||rig.feeding.phase==='dropping')assert.equal(rig.feeding.scale,1,'ball retains its full shape while being covered');
  if(rig.feeding.phase==='absorbing'){
    body.updateSurface();lowest=Math.min(lowest,...core.map(j=>body.surface.positions[j]));
    if(rig.feeding.imprint>.99)imprinted=Math.max(imprinted,prominence());
    if(rig.feeding.imprint<.02)resolved=Math.min(resolved,prominence());
    assert.equal(rig.feeding.scale,0,'prey is concealed beneath the molded body');
    assert.equal(rig.feeding.drop,1,'body stays down while the imprint resolves');
  }
  lastPhase=rig.feeding.phase;smallest=Math.min(smallest,rig.feeding.scale);
  if(rig.feeding.meals===1&&rig.feeding.phase==='hunting')break;
}
assert(lowest<.002,'the center reaches the table around the prey');
assert(standing-lowest>.02,'the torso fully descends');
assert(imprinted>.004,'a visible round imprint protrudes above the surrounding skin');
assert(imprinted-resolved>.004,'the bulge resolves before standing back up');
assert.equal(smallest,0,'the prey completely disappears');
assert.equal(rig.feeding.meals,1,'one capture produces exactly one meal');
assert(['cradling','covering','dropping','absorbing','recovering','spawning','hunting'].every(phase=>phases.has(phase)));
assert(rig.target.distanceTo(original)>.2,'new prey spawns elsewhere');
assert(Math.hypot(rig.target.x,rig.target.z)<=ARENA.lureRadius,'new prey stays inside the arena');
assert(body.volumeRatio()>.8&&body.volumeRatio()<1.2);
console.log('feeding',{standingClearance:standing,feedingClearance:lowest,imprinted,resolved,phases:[...phases],respawn:rig.target.toArray()});

// Automatic chasing must complete repeated capture/respawn cycles, not stall.
rig.reset();const auto=new AutoLure();auto.enabled=true;
for(let i=0;i<7200&&rig.feeding.meals<2;i++){
  if(!rig.feeding.locked){auto.step(PHYS.step,rig.target,rig.center);rig.stimulus=1;}
  tick();
}
assert(rig.feeding.meals>=2,'automatic prey resumes movement and can be consumed again');
const coveringTimes=[];
for(const [index,angle] of [0,Math.PI/3,Math.PI,4.2].entries()){
  rig.reset();rig.active=true;
  if(index===3)Object.assign(rig.settings,{speed:3,stepHeight:.05,stepDuration:.08,stepSpacing:.015,stride:.05,erratic:3});
  rig.target.set(Math.cos(angle)*.12,.012,Math.sin(angle)*.12);rig.stimulus=1;
  let coveredAt=-1,droppedAt=-1;
  for(let i=0;i<2880;i++){
    tick();
    if(rig.feeding.phase==='covering'&&coveredAt<0)coveredAt=i;
    if(rig.feeding.phase==='dropping'){droppedAt=i;break;}
  }
  assert(coveredAt>=0&&droppedAt>=0,`approach ${index} progresses into feeding`);
  const duration=(droppedAt-coveredAt)*PHYS.step;coveringTimes.push(duration);
  assert(duration<3,'covering converges promptly even after an aggressive chase');
  assert(rig.gait.planted.every(Boolean),'covering plants the feet instead of continuing to walk');
}
console.log('covering convergence seconds',coveringTimes);
rig.reset();assert(!rig.feeding.locked&&rig.feeding.visible&&rig.feeding.meals===0,'reset restarts the complete lifecycle');
console.log('PASS — alignment, ground contact, stationary prey, physical imprint and resolution, respawn and repeated feeding');

// Every rendered shape has its own membrane profile and completes ingestion.
const { PREY_SHAPES, preyImprint, createPrey }=await import('../src/monster/prey.ts');
const rendered=createPrey(),seen=[];
Object.assign(rig.settings,{speed:1.8,stepHeight:.032,stepDuration:.12,stepSpacing:.035,stride:.022,erratic:2});
for(let shapeIndex=0;shapeIndex<PREY_SHAPES.length;shapeIndex++){
  rig.reset();rig.feeding.meals=shapeIndex;
  rig.active=false;for(let i=0;i<240;i++)tick();
  rig.target.set(rig.torsoCenter.x,.012,rig.torsoCenter.z);rig.active=true;
  const shape=rig.feeding.shape;seen.push(shape);let absorbed=false,hidden=false,previousCoverage=0;
  for(let i=0;i<2200;i++){
    tick();rendered.update(rig.feeding);
    if(rig.feeding.phase!=='spawning'){
      assert(rig.feeding.skinCoverage>=previousCoverage,'skin wrapping cannot reverse during the meal');
      previousCoverage=rig.feeding.skinCoverage;
      if(hidden)assert(!rendered.mesh.visible,'concealed prey never reappears during recovery');
      hidden ||= !rendered.mesh.visible;
      if(['dropping','absorbing','recovering'].includes(rig.feeding.phase)){
        assert.equal(rig.feeding.skinCoverage,1,'red appearance is gone before the body descends');
        assert.equal(rendered.mesh.material.emissiveIntensity,0,'wrapped prey has no red emission');
        assert.equal(rendered.mesh.material.metalness,0,'wrapped prey has the tissue material response');
      }
    }
    if(rig.feeding.phase==='dropping'&&rig.feeding.drop>.55)assert(!rendered.mesh.visible,'colored prey is concealed when membrane forms');
    if(rig.feeding.phase==='absorbing'){absorbed=true;assert.equal(rig.feeding.shape,shape);assert(!rendered.mesh.visible);}
    if(rig.feeding.phase==='spawning')break;
  }
  assert(absorbed,`${shape} completes the drop and absorption`);
  assert.equal(rig.feeding.phase,'spawning',`${shape} resolves and respawns`);
  assert.equal(rig.feeding.shape,PREY_SHAPES[(shapeIndex+1)%4]);
  assert.equal(rig.feeding.skinCoverage,0,'only new prey restores the original surface');
  assert(preyImprint(shape,0,0)>.5);assert.equal(preyImprint(shape,.1,.1),0);
}
assert.deepEqual(seen,[...PREY_SHAPES]);
assert(preyImprint('cube',.012,.012)>preyImprint('sphere',.012,.012),'cube retains its broad flat top');
assert.notEqual(preyImprint('prism',.012,.009),preyImprint('cube',.012,.009),'prism outline differs from cube');
console.log('PASS — four prey shapes, membrane concealment, shape profiles and complete feeding cycles');

// Render-rate independence: skip the entire wrapping/concealment transition.
const skipped=new FeedingCycle(),same=new Vector3(0,.012,0);
for(let i=0;i<600;i++)skipped.step(PHYS.step,same,same,true,true);
rendered.update(skipped);
assert.equal(skipped.skinCoverage,1);
assert(!rendered.mesh.visible,'late render cannot flash the original prey');
skipped.reset(same);rendered.update(skipped);
assert(rendered.mesh.visible&&skipped.skinCoverage===0,'reset restores a fresh red prey');
rendered.mesh.geometry.dispose();rendered.mesh.material.dispose();

// Evasion owns the meal clock but uses the same physical feeding muscles on both actors.
for(const variant of ['reed','nih-dairia']){
  const data=readFileSync(`src/assets/model/${variant}.bin`);
  const actor=new SoftBody(parseCage(data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength),JSON.parse(readFileSync(`src/assets/model/${variant}.json`,'utf8'))));
  const motion=new MonsterBehavior(actor);motion.active=false;motion.feeding.enabled=false;
  for(let i=0;i<160;i++){motion.step(PHYS.step);actor.step(PHYS.step);}
  const standingY=motion.torsoCenter.y;
  motion.target.copy(motion.torsoCenter);motion.target.y=.012;motion.active=true;
  let loweredY=standingY;const stages=new Set();
  for(let i=0;i<Math.ceil(5/PHYS.step);i++){
    motion.feeding.scriptedProgress=i*PHYS.step/5;
    motion.step(PHYS.step);actor.step(PHYS.step);assert(actor.isFinite());assert(actor.lastMinJacobian>=.12);
    stages.add(motion.feeding.phase);
    if(motion.feeding.phase==='absorbing')loweredY=Math.min(loweredY,motion.torsoCenter.y);
  }
  assert(standingY-loweredY>.01,`${variant} physically lowers its torso during the scripted meal`);
  assert(['cradling','covering','dropping','absorbing','recovering'].every(phase=>stages.has(phase)));
  motion.feeding.reset(motion.target);assert.equal(motion.feeding.scriptedProgress,null);assert.equal(motion.feeding.phase,'hunting');
  console.log('PASS Evasion physical feeding',variant,{standingY,loweredY});
}

// Ovum keeps the prey full-sized while connected wet folds accumulate on it.
const ovumData=readFileSync('src/assets/model/ovum.bin');
const ovumCage=parseCage(ovumData.buffer.slice(ovumData.byteOffset,ovumData.byteOffset+ovumData.byteLength),JSON.parse(readFileSync('src/assets/model/ovum.json','utf8')));
ovumCage.variant='ovum';
const ovumBody=new SoftBody(ovumCage),ovum=new MonsterBehavior(ovumBody);
const {createBiomassFlow}=await import('../src/monster/biomass.ts');
const honey=createBiomassFlow(ovumBody,ovum.feeding);assert(ovum.feeding.viscous);
ovum.active=false;for(let i=0;i<300;i++){ovum.step(PHYS.step);ovumBody.step(PHYS.step);}
ovum.target.set(ovum.torsoCenter.x+.008,.012,ovum.torsoCenter.z);const fixedPrey=ovum.target.clone();ovum.active=true;
let smallPile=0,largePile=0,smallHeight=0,largeHeight=0,coverStarted=-1,dropStarted=-1;
for(let i=0;i<2400;i++){
  ovum.step(PHYS.step);ovumBody.step(PHYS.step);assert(ovumBody.isFinite());assert(ovumBody.lastMinJacobian>=.12);
  if(ovum.feeding.phase==='covering'&&coverStarted<0)coverStarted=i;
  if(ovum.feeding.phase==='dropping'&&dropStarted<0){dropStarted=i;assert.equal(ovum.feeding.biomass,1,'the contact tissue builds fully before the torso descends');}
  if(['cradling','covering','dropping'].includes(ovum.feeding.phase)){assert.equal(ovum.feeding.scale,1);assert(ovum.feeding.preyPosition.distanceTo(fixedPrey)<1e-9);}
  if(i%24===0){
    ovumBody.updateSurface();honey.update();
    if(honey.mesh.visible){
      const positions=honey.mesh.geometry.attributes.position.array,number=honey.mesh.count;
      assert(number>0&&number<=honey.mesh.geometry.attributes.position.count);
      let top=-Infinity;
      for(let j=0;j<number*3;j+=3){assert(Number.isFinite(positions[j]+positions[j+1]+positions[j+2]));const y=positions[j+1]*.055+fixedPrey.y;assert(y>=.00099,'wet tissue remains above the table');top=Math.max(top,y);}
      if(ovum.feeding.phase==='covering'&&ovum.feeding.biomass<.25){smallPile=number;smallHeight=top;}
      if(ovum.feeding.phase==='covering'&&ovum.feeding.biomass>.9){largePile=number;largeHeight=top;}
    }
  }
  if(ovum.feeding.phase==='spawning')break;
}
assert.equal(ovum.feeding.meals,1);assert(largePile>smallPile*2,'biomass accumulates as a larger connected surface');assert(largeHeight>smallHeight+.004,'successive folds stack upward at contact');
assert((dropStarted-coverStarted)*PHYS.step>2,'viscous covering visibly takes time');honey.update();assert(!honey.mesh.visible,'the contact mound resolves after digestion');
ovum.reset();assert(ovum.feeding.viscous&&ovum.feeding.biomass===0);honey.mesh.geometry.dispose();honey.mesh.material.dispose();
console.log('PASS Ovum contact accumulation, increasing pile height, full-sized stationary prey, delayed coverage, stable physics and resolution',{smallPile,largePile,smallHeight,largeHeight});
