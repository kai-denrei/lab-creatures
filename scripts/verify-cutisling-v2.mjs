import assert from 'node:assert/strict';
import {muscleProgress,limbPull,recoveryLimb} from '../src/cutisling-v2/muscle-motion.ts';
import {CutislingV2} from '../src/cutisling-v2/controller.ts';
import {V2_DEFAULTS,serializeV2Settings} from '../src/cutisling-v2/settings.ts';
import {seekingPose,seekNoise} from '../src/cutisling-v2/seeking.ts';
import {createV2Membrane} from '../src/cutisling-v2/membrane.ts';
import {V2_PALETTES} from '../src/cutisling-v2/palettes.ts';
import {sampleTendril,sampleRawTendril} from '../src/cutisling-v2/tendril-path.ts';
import {createV2TissueMaterial} from '../src/cutisling-v2/tissue-material.ts';
import {LOOP_SWEEP} from '../src/cutisling-v2/feeding-shape.ts';
import {V2Lure,WAVE_SPEED} from '../src/cutisling-v2/lure.ts';
import {createV2Tendrils} from '../src/cutisling-v2/tendrils.ts';

// Geometric/contact fixtures retain their original size and timing independently
// of the lab's artistic preset. The accepted defaults have their own full trial below.
function createMotionFixture(){
  const b=new CutislingV2();
  Object.assign(b.tuning,{spread:1,separation:1,turbulence:.65,tension:1,thickness:.18,aggro:2,
    seekSweep:.65,seekRate:1,strikeSpeed:3.4,anchorHold:.55,anchorPull:1.8,senseDistance:.16,
    anchorBulk:1,whipStrength:1.4,seed:17,frenzy:2.4,whipCurl:1,whipLift:1,whipAsymmetry:1,
    flattenTime:1.3,amorphous:1,muscleStrength:.85,limbLag:.8,lureSpeed:.32,lureBounce:.55,
    vibrationSense:1.6,veinPulse:1.4,veinSpeed:1.1,followCamera:false,crawlSway:0,crawlLift:0,supportReach:.25,limbClearance:0});
  b.reset();return b;
}

const a=createMotionFixture(),b=createMotionFixture();
for(let i=0;i<600;i++)a.step(1/60);
for(let i=0;i<1200;i++)b.step(1/120);
assert.deepEqual(a.x,b.x,'simulation is independent of display refresh rate');assert.deepEqual(a.edge,b.edge);
const frozen=a.mix(a.previousX[42],a.x[42]);a.paused=true;a.step(.1);assert.equal(a.mix(a.previousX[42],a.x[42]),frozen,'pause preserves the displayed pose');
const time=a.time;a.stepOne();assert(a.time>time);const stepped=a.mix(a.previousX[42],a.x[42]);a.paused=false;assert(Math.abs(a.mix(a.previousX[42],a.x[42])-stepped)<1e-8,'resume after single step does not jump backwards');
a.reset();a.paused=false;const initial=a.x.slice();a.step(.1);a.reset();assert.deepEqual(a.x,initial,'seeded reset is reproducible');
console.log('PASS fixed-step determinism, seeded reset, pause and single-step continuity');

function sampling(interpolation){
  const body=createMotionFixture();body.setRate(30);body.tuning.interpolation=interpolation;
  for(let i=0;i<120;i++)body.step(1/120);
  let previous=body.mix(body.previousX[42],body.x[42]);const movement=[];
  for(let i=0;i<360;i++){
    body.step(1/120);const x=body.mix(body.previousX[42],body.x[42]);movement.push(Math.abs(x-previous));previous=x;
  }return movement;
}
const blended=sampling(true),raw=sampling(false);
assert(raw.filter(v=>v<1e-10).length>200,'diagnostic unblended mode exposes held simulation frames');
assert(blended.filter(v=>v<1e-10).length<10,'interpolation removes held frames during motion');
assert(Math.max(...blended)<Math.max(...raw)*.4,'interpolation reduces frame-to-frame jumps');
console.log('PASS 30 Hz simulation sampled at 120 Hz: interpolation removes held frames and reduces jumps');

for(const count of [64,128,256,512,1024]){
  const body=createMotionFixture();body.setCount(count);body.tuning.neighborRange=.4;body.tuning.turbulence=1.5;body.tuning.spread=1.4;
  const skin=createV2Membrane(body),index=skin.geometry.index.array.slice(),uv=skin.geometry.attributes.uv.array.slice();
  for(let i=0;i<600;i++){
    body.step(1/60);
    if(i%30===0){skin.update();
      for(const attr of ['position','normal'])for(const value of skin.geometry.attributes[attr].array)assert(Number.isFinite(value));
      assert.deepEqual(skin.geometry.index.array,index,'mesh connections never change');assert.deepEqual(skin.geometry.attributes.uv.array,uv,'material coordinates never change');
    }
  }
  assert.equal(body.x.length,count);for(let i=0;i<count;i++)assert(Math.hypot(body.x[i],body.z[i])<26,'particles remain bounded at extreme controls');
  skin.dispose();
}
console.log('PASS particle count sweep, fixed mesh/UVs, finite normals and bounded motion at tuning extremes');

function heightAt(skin,x,z){
  const p=skin.geometry.attributes.position.array,idx=skin.geometry.index.array;
  let height=-Infinity;
  for(let j=0;j<128*24*6;j+=3){
    const a=idx[j]*3,b=idx[j+1]*3,c=idx[j+2]*3;
    const det=(p[b+2]-p[c+2])*(p[a]-p[c])+(p[c]-p[b])*(p[a+2]-p[c+2]);
    if(Math.abs(det)<1e-10)continue;
    const u=((p[b+2]-p[c+2])*(x-p[c])+(p[c]-p[b])*(z-p[c+2]))/det;
    const v=((p[c+2]-p[a+2])*(x-p[c])+(p[a]-p[c])*(z-p[c+2]))/det,w=1-u-v;
    if(Math.min(u,v,w)>=-1e-6)height=Math.max(height,u*p[a+1]+v*p[b+1]+w*p[c+1]);
  }return height;
}

// All possible morphologies use the same buffers and complete the physical
// sequence. A digestive surface must never appear before visible enclosure.
const seeds=[1,7,17,6,10],counts=new Set();
for(const seed of seeds){
  const b=createMotionFixture();b.tuning.seed=seed;b.reset();counts.add(b.tentacleCount);
  const m=createV2Membrane(b),t=createV2Tendrils(b),indices=t.geometry.index.array,positions=t.geometry.attributes.position.array;
  const phases=new Set();let covered=false,flatFrames=0,anchorSeen=false;
  for(let i=0;i<60*35&&!b.meals;i++){
    const previous=b.phase,cx=b.centerX,cz=b.centerZ;b.step(1/60);phases.add(b.phase);
    if(['SEEK','SPOT','ANCHOR'].includes(previous))assert(Math.hypot(b.centerX-cx,b.centerZ-cz)<1e-9,'no unanchored body drift');
    if(b.phase==='TRANSFER')anchorSeen=true;
    if(i%3===0){
      m.update();t.update();assert.equal(t.geometry.index.array,indices);assert.equal(t.geometry.attributes.position.array,positions);
      for(const value of positions)assert(Number.isFinite(value));
      if(['SEEK','SPOT','ANCHOR','TRANSFER','EXTEND2','SURROUND'].includes(b.phase))assert(!m.mesh.visible,'no premature feeding sheet');
      if(['EXTEND2','SURROUND'].includes(b.phase))assert(t.mesh.visible,'tentacles stay visible until enclosure');
      if(m.mesh.visible){
        const p=m.geometry.attributes.position.array,idx=m.geometry.index.array;
        for(let j=0;j<128*24*6;j+=3){const a=idx[j]*3,c=idx[j+1]*3,d=idx[j+2]*3;
          assert((p[c+2]-p[a+2])*(p[d]-p[a])-(p[c]-p[a])*(p[d+2]-p[a+2])>=-1e-6,'sheet faces cannot invert');
        }
      }
    }
    if(b.phase==='FLATTEN'){
      flatFrames++;assert(b.wrap>=.999,'flattening waits for full wrap');assert.equal(b.preyScale,1,'prey remains whole while tentacles fuse');
      if(previous==='SURROUND')assert(b.tentaclesEnclose(),'visible arms must touch and wind around bait before flattening');
    }
    if(b.phase==='ABSORB'&&!covered){
      m.update();
      for(let ix=-7;ix<=7;ix++)for(let iz=-7;iz<=7;iz++){
        const dx=ix*.03,dz=iz*.03;if(dx*dx+dz*dz>=b.preyRadius**2)continue;
        assert(heightAt(m,b.preyX+dx,b.preyZ+dz)>.012+b.preyRadius+Math.sqrt(b.preyRadius**2-dx*dx-dz*dz),'tissue fully covers bait before digestion');
      }covered=true;
    }
  }
  assert(covered&&anchorSeen&&flatFrames>20&&b.meals===1);
  assert.deepEqual([...phases],['SEEK','SPOT','ANCHOR','TRANSFER','EXTEND2','SURROUND','FLATTEN','ENGULF','ABSORB','RECOVER']);
  const replay=createMotionFixture();replay.tuning.seed=seed;replay.reset();assert.equal(replay.tentacleCount,b.tentacleCount);
  m.dispose();t.dispose();
}
assert.deepEqual([...counts],[3,4,5,6,7]);
console.log('PASS seeded 3–7 arms, fixed buffers, visible enclosure before flattening and complete prey coverage');

// Mid-arm sensing is deliberately distinct from the nearest existing TIP.
const contact=createMotionFixture();Object.assign(contact.tuning,{hunting:false,anchoredLocomotion:false});
for(let i=0;i<120;i++)contact.stepOne();
const point=new Float64Array(4),next=new Float64Array(4);
sampleTendril(contact,0,.52,point,false);sampleTendril(contact,0,.53,next,false);
const dx=next[0]-point[0],dz=next[2]-point[2],distance=Math.hypot(dx,dz),offset=point[3]+contact.preyRadius+.09;
contact.placePrey(point[0]-dz/distance*offset,point[2]+dx/distance*offset);contact.tuning.hunting=true;
contact.stepOne();assert.equal(contact.phase,'SPOT');assert.equal(contact.sensingProbe,0);assert.equal(contact.anchorU,1);
let minimum=Infinity,bestArm=-1;
for(let arm=0;arm<contact.tentacleCount;arm++){
  sampleTendril(contact,arm,1,point,false);const d=Math.hypot(point[0]-contact.preyX,point[2]-contact.preyZ);
  if(d<minimum){minimum=d;bestArm=arm;}
}
assert.equal(contact.chosenProbe,bestArm,'anchor is globally nearest existing tip');
sampleTendril(contact,bestArm,1,point,false);
assert(Math.hypot(point[0]-contact.anchorX,point[2]-contact.anchorZ)<1e-10);
const locked=contact.attackPaths.slice(),tissue=createV2Tendrils(contact);tissue.update();
assert(tissue.core.visible,'small core covers the original root junction');
assert(tissue.mesh.material.roughness>=.9&&tissue.mesh.material.clearcoat===0&&tissue.mesh.material.specularIntensity<=.2,'tissue is matte');
const originalDistance=Math.hypot(contact.centerX-contact.preyX,contact.centerZ-contact.preyZ);
let pinned=0,sprouted=false,drawn=false,previousCenter=[contact.centerX,contact.centerZ],maxBoundaryMotion=0;
const oldPoint=new Float64Array(4),currentPoint=new Float64Array(4);
for(let i=0;i<600;i++){
  const previousPhase=contact.phase;sampleTendril(contact,0,.4,oldPoint,false);
  contact.stepOne();if(contact.phase==='FLATTEN')break;
  sampleTendril(contact,contact.chosenProbe,1,point,false);
  assert(Math.hypot(point[0]-contact.anchorX,point[2]-contact.anchorZ)<1e-10,'closest existing tip stays planted while the body gathers');
  if(contact.anchorTravel===0){
    for(let arm=0;arm<contact.tentacleCount;arm++)for(let j=0;j<=32;j++){
      sampleTendril(contact,arm,j/32,point,false);
      for(let axis=0;axis<4;axis++)assert(Math.abs(point[axis]-locked[(arm*33+j)*4+axis])<1e-12,'sensed pose holds until the pull begins');
    }
  }
  if(previousPhase==='TRANSFER'){
    drawn=true;assert(Math.hypot(contact.centerX-previousCenter[0],contact.centerZ-previousCenter[1])<.2,'bulk movement has a bounded speed');
  }
  sampleTendril(contact,0,.4,currentPoint,false);
  if(previousPhase!==contact.phase)maxBoundaryMotion=Math.max(maxBoundaryMotion,Math.hypot(currentPoint[0]-oldPoint[0],currentPoint[1]-oldPoint[1],currentPoint[2]-oldPoint[2]));
  previousCenter=[contact.centerX,contact.centerZ];
  tissue.update();
  let cords=0;
  for(let arm=0;arm<9;arm++){
    if(arm>=contact.tentacleCount&&arm<7)continue;
    sampleTendril(contact,arm,0,oldPoint,false);
    for(let j=1;j<=32;j++){
      sampleTendril(contact,arm,j/32,currentPoint,false);
      cords+=Math.PI*((oldPoint[3]+currentPoint[3])*.5)**2*Math.hypot(currentPoint[0]-oldPoint[0],currentPoint[1]-oldPoint[1],currentPoint[2]-oldPoint[2])*.9;oldPoint.set(currentPoint);
    }
  }
  const core=4/3*Math.PI*tissue.core.scale.x*tissue.core.scale.y*tissue.core.scale.z;
  assert(Math.abs(core+cords-contact.feedingMass)<1e-8,'retracting and growing arms exchange volume with the core');
  sampleTendril(contact,7,.7,point,false);
  if(contact.wrap===0)assert.equal(point[3],0,'engulfing arms wait for body arrival');
  if(contact.wrap>.3){
    assert(contact.anchorTravel===1&&Math.hypot(contact.centerX-contact.drawX,contact.centerZ-contact.drawZ)<1e-10);
    assert(Math.hypot(contact.centerX-contact.preyX,contact.centerZ-contact.preyZ)<originalDistance-1,'body comes closer before sprouting');
    sampleTendril(contact,7,0,point,false);assert(Math.hypot(point[0]-contact.centerX,point[2]-contact.centerZ)<1e-9,'new arms remain rooted in the arriving body');sprouted=true;
  }
  pinned++;if(pinned===5)contact.tuning.whipCurl=2.5;
}
assert(pinned>12&&contact.predation>.99&&sprouted&&drawn&&maxBoundaryMotion<.03);tissue.dispose();
console.log('PASS planted tip, body arrival before sprouting, connected roots, continuous state boundaries and core/cord volume exchange');

// A newly visible membrane must start on the enclosing cords and move
// continuously through flattening, engulfment and absorption.
const fusion=createMotionFixture();const fusionSkin=createV2Membrane(fusion);
let lastSkin=null,firstSkin=false,worstStep=0,previousBody=[0,0],worstBodyStep=0;
for(let i=0;i<1500&&!fusion.meals;i++){
  fusion.stepOne();fusionSkin.update();
  if(fusion.holdingPrey){worstBodyStep=Math.max(worstBodyStep,Math.hypot(fusion.centerX-previousBody[0],fusion.centerZ-previousBody[1]));}
  previousBody=[fusion.centerX,fusion.centerZ];
  if(!fusionSkin.mesh.visible)continue;
  const vertices=fusionSkin.geometry.attributes.position.array;
  if(!firstSkin){
    assert.equal(fusion.phase,'FLATTEN');
    const heading=Math.atan2(fusion.wrapRootZ-fusion.preyZ,fusion.wrapRootX-fusion.preyX);
    for(let i=0;i<=128;i++){
      const angle=fusion.mouthAngle+i/128*Math.PI*2,delta=Math.atan2(Math.sin(angle-heading),Math.cos(angle-heading));
      sampleTendril(fusion,delta>=0?7:8,Math.abs(delta)/LOOP_SWEEP,point,false);
      const k=(i*25+12)*3;
      assert(Math.hypot(vertices[k]-point[0],vertices[k+2]-point[2])<.03,'first surface is seated on the actual closed-loop contour');
    }
    firstSkin=true;
  }
  if(lastSkin)for(let j=0;j<vertices.length;j+=3)worstStep=Math.max(worstStep,Math.hypot(vertices[j]-lastSkin[j],vertices[j+1]-lastSkin[j+1],vertices[j+2]-lastSkin[j+2]));
  lastSkin=vertices.slice();
}
assert(firstSkin&&fusion.meals===1&&worstStep<.15&&worstBodyStep<.2,'feeding surface and body never teleport between states');fusionSkin.dispose();
console.log('PASS membrane grows from enclosing cords, continuous fusion/engulfment geometry and no body teleport');

// Isolate the sensing rule with stationary, deliberately unequal probes:
// arm 0 senses along its middle; the closer existing endpoint belongs to arm 1.
function stagedProbes(){
  const b=createMotionFixture();Object.assign(b.tuning,{seed:1,anchoredLocomotion:false,whipStrength:0});b.reset();
  b.updateProbes=()=>{};
  for(const [i,angle,length] of [[0,0,6],[1,Math.atan2(.8,3),Math.hypot(.8,3)],[2,Math.PI,4]])Object.assign(b.probes[i],{angle,length,previousAngle:angle,previousLength:length});
  return b;
}
const split=stagedProbes();split.placePrey(3,.25);split.stepOne();
assert.equal(split.sensingProbe,0);assert.equal(split.chosenProbe,1);assert.equal(split.anchorU,1);
for(const [range,phase] of [[0,'SEEK'],[.8,'SPOT']]){
  const b=stagedProbes();b.tuning.senseDistance=range;b.placePrey(3,-.7);b.stepOne();assert.equal(b.phase,phase,'sense distance changes the actual trigger');
}
console.log('PASS sensing and anchoring can choose different arms; sensing-distance threshold controls detection');

// Expanded whip controls may deform tissue aggressively, but must preserve
// finite geometry and keep live bait out of the flanking tentacles.
for(const seed of [1,10])for(const extreme of [false,true]){
  const b=createMotionFixture();Object.assign(b.tuning,{seed,anchoredLocomotion:false});b.reset();b.placePrey(2,1);
  if(extreme)Object.assign(b.tuning,{whipStrength:4,whipFrequency:5,whipCurl:3,whipLift:3,whipAsymmetry:2.5,frenzy:5,aggro:6,tendrilWidth:1.5,spread:1.4});
  const t=createV2Tendrils(b);let wrapped=false;
  for(let i=0;i<1800&&!b.meals;i++){
    b.step(1/60);if(i%3)continue;t.update();
    for(const attr of ['position','normal'])for(const value of t.geometry.attributes[attr].array)assert(Number.isFinite(value));
    if(b.phase==='EXTEND2'||b.phase==='SURROUND'){
      wrapped=true;
      for(let arm=7;arm<9;arm++)for(let j=0;j<=32;j++){
        sampleTendril(b,arm,j/32,point,false);
        assert(Math.hypot(point[0]-b.preyX,point[2]-b.preyZ)>=b.preyRadius+point[3]+.024,'flanking curves stay outside bait');
      }
    }
  }
  assert(wrapped&&b.meals>0,'extreme whip trials still finish digestion');t.dispose();
}
console.log('PASS maximum whip/frenzy controls, finite normals, prey clearance and successful feeding at 3 and 7 arms');

const walker=createMotionFixture();walker.tuning.hunting=false;let moves=0;
for(let i=0;i<720;i++){
  const phase=walker.phase,x=walker.centerX,z=walker.centerZ;walker.step(1/60);
  if(phase!=='TRANSFER')assert(Math.hypot(walker.centerX-x,walker.centerZ-z)<1e-9);else moves++;
}
assert(walker.strides>=2&&moves>40);
const snapshot={...V2_DEFAULTS,seed:10,senseDistance:.6,whipStrength:3.5,whipCurl:2.5,frenzy:4,flattenTime:1.4,palette:'abyss'};
assert.deepEqual(JSON.parse(serializeV2Settings(snapshot)),{specimen:'cutisling-v2',settings:snapshot});
const skin=createV2Membrane(walker);
for(const [id,palette] of Object.entries(V2_PALETTES)){walker.tuning.palette=id;skin.update();assert.equal(skin.mesh.material.color.getHex(),palette.skin);}skin.dispose();
for(let i=1;i<8;i++)assert(Math.abs(seekNoise(i-1e-6,12)-seekNoise(i+1e-6,12))<1e-8);
for(let i=0;i<3;i++){assert.equal(seekingPose(0,i,1,1).extension,0);assert.equal(seekingPose(1,i,1,1).extension,1);}
console.log('PASS prey-independent anchored locomotion, live palettes, seeded settings copy and continuous searching noise');

// Vibration fronts, not the prey's live position, provide the directional cue.
const guided=createMotionFixture(),silent=createMotionFixture();
for(const b of [guided,silent]){Object.assign(b.tuning,{movingLure:false,anchoredLocomotion:false});b.reset();b.placePrey(0,-12);}
guided.lure.emit(0,1);let heardAt=0;
for(let i=0;i<180;i++){
  const wave=guided.lure.waves[0],nextRadius=(guided.time+1/60-wave.time)*WAVE_SPEED;
  const reaches=[{tipX:guided.centerX,tipZ:guided.centerZ},...guided.probes.slice(0,guided.tentacleCount)].some(p=>Math.abs(Math.hypot(p.tipX-wave.x,p.tipZ-wave.z)-nextRadius)<.35);
  const before=guided.instinct;guided.stepOne();silent.stepOne();
  if(guided.instinct>0&&!heardAt){assert(reaches&&before===0,'reaction waits until a wave reaches a sensor');heardAt=guided.time;}
  if(!heardAt)assert.deepEqual(guided.probes,silent.probes,'no hidden steering before a vibration arrives');
}
const bearingError=b=>Math.min(...b.probes.slice(0,b.tentacleCount).map(p=>Math.abs(Math.atan2(Math.sin(p.angle+Math.PI/2),Math.cos(p.angle+Math.PI/2)))));
assert(heardAt>1&&bearingError(guided)<bearingError(silent)*.25,'received vibration points a searching arm toward its source');
assert.equal(silent.instinct,0);guided.tuning.anchoredLocomotion=true;guided.stepOne();
assert(guided.phase==='SPOT'&&!guided.anchorForPrey&&guided.anchorZ<-1,'the next ground foothold also follows the vibration');
guided.tuning.vibrationSense=0;guided.stepOne();assert.equal(guided.instinct,0);
const motion=new V2Lure(),settings={...V2_DEFAULTS,lureSpeed:1.2};motion.reset(18,0,0,17);
let landings=0,grounded=0,peak=0;
for(let i=1;i<=60*120;i++){
  const x=motion.x,z=motion.z,h=motion.height;motion.update(1/60,i/60,settings,true);
  assert(Math.hypot(motion.x-x,motion.z-z)<.021&&Math.abs(motion.height-h)<.04,'lure motion and slow hops stay continuous');
  assert(Math.hypot(motion.x,motion.z)<20&&motion.height>=0,'lure remains grounded or above the arena');
  if(h>0&&motion.height===0){landings++;assert(motion.waves.some(w=>w.time===i/60&&w.strength===1),'landing emits a strong pulse');}
  if(motion.height===0)grounded++;peak=Math.max(peak,motion.height);
}
assert(landings>10&&grounded>60*60&&peak>.5&&motion.waves.length===16);
const held=[motion.x,motion.z];for(let i=0;i<120;i++)motion.update(1/60,120+i/60,settings,false);
assert.deepEqual([motion.x,motion.z],held);assert(motion.height<1e-6,'contact settles the bouncing lure');
for(const seed of [1,7,17,6,10]){
  const b=createMotionFixture();b.tuning.seed=seed;b.reset();let detected=null;
  for(let i=0;i<60*40&&!b.meals;i++){
    b.stepOne();if(b.holdingPrey){if(!detected)detected=[b.preyX,b.preyZ];assert.deepEqual([b.preyX,b.preyZ],detected,'moving prey stays secured throughout anchored feeding');}
  }
  assert(b.meals===1&&detected,'each morphology tracks and consumes wandering prey');
}
const paused=createMotionFixture();for(let i=0;i<150;i++)paused.step(1/60);paused.paused=true;
const pose=JSON.stringify(paused.lure);paused.step(.1);assert.equal(JSON.stringify(paused.lure),pose,'pause freezes lure and vibration clocks');
paused.reset();assert.equal(paused.lure.height,0);assert(paused.lure.waves.every(w=>w.strength===0),'reset clears old vibration sources');
console.log('PASS causal vibration steering, occasional smooth hops, bounded wandering/pulse pool, pause/reset and all moving-prey feeding variants');

// Engulfing cords share the seeking taper and carry attached lateral branches.
const mycelium=createMotionFixture(),seeking=createMotionFixture();
for(let i=0;i<1800&&mycelium.phase!=='FLATTEN';i++)mycelium.stepOne();
assert.equal(mycelium.phase,'FLATTEN');assert.equal(mycelium.sheet,0);
for(const u of [.2,.5,.8]){
  sampleTendril(mycelium,7,u,point,false);sampleTendril(seeking,0,u,next,false);
  assert(Math.abs(point[3]-next[3])<1e-12,'wrapping and seeking arms use the same taper');
}
const branches=createV2Tendrils(mycelium),branchPositions=branches.geometry.attributes.position.array;
const mainVertices=33*11+2,lateralVertices=13*7+2,forkVertices=8*7+2,armVertices=mainVertices+2*lateralVertices+2*forkVertices;
for(const arm of [7,8])for(const branch of [0,1]){
  const start=arm*armVertices+mainVertices+branch*lateralVertices;
  let x=0,y=0,z=0;
  for(let n=0;n<6;n++){x+=branchPositions[(start+n)*3]/6;y+=branchPositions[(start+n)*3+1]/6;z+=branchPositions[(start+n)*3+2]/6;}
  sampleTendril(mycelium,arm,branch===0?.37:.66,point,false);
  assert(Math.hypot(x-point[0],y-point[1],z-point[2])<1e-5,'feeding branches remain attached to their parent cord');
  assert(Math.hypot(branchPositions[start*3]-x,branchPositions[start*3+2]-z)>.01,'feeding feelers have visible thickness');
}
const grown=branchPositions.slice(7*armVertices*3),uvs=branches.geometry.attributes.uv.array.slice();
mycelium.tuning.branching=0;branches.update();
assert(grown.some((v,i)=>Math.abs(v-branchPositions[7*armVertices*3+i])>.05),'mycelium control also changes engulfing branches');
assert.deepEqual(branches.geometry.attributes.uv.array,uvs,'vein coordinates stay attached to fixed material vertices');branches.dispose();
const tissueA=createV2TissueMaterial(mycelium),tissueB=createV2TissueMaterial(mycelium,true);
assert.equal(tissueA.uniforms.v2Veins.value,tissueB.uniforms.v2Veins.value,'cords and membrane share one baked vein network');
const clock=tissueA.uniforms.v2Clock.value;mycelium.step(.1);tissueA.update();assert.equal(tissueA.uniforms.v2Clock.value,clock,'pause freezes vein pulses');
mycelium.paused=false;mycelium.step(.1);tissueA.update();assert(tissueA.uniforms.v2Clock.value>clock);
mycelium.tuning.veins=false;tissueA.update();assert.equal(tissueA.uniforms.v2VeinStrength.value,0);
mycelium.tuning.veins=true;mycelium.tuning.veinStrength=1.8;mycelium.tuning.veinPulse=2.5;tissueA.update();
assert.equal(tissueA.uniforms.v2VeinStrength.value,1.8);assert.equal(tissueA.uniforms.v2Pulse.value,2.5);
let releases=0;tissueA.uniforms.v2Veins.value.addEventListener('dispose',()=>releases++);
tissueA.material.dispose();assert.equal(releases,0);tissueB.material.dispose();assert.equal(releases,1);tissueB.material.dispose();assert.equal(releases,1);
console.log('PASS matching mycelium taper, attached feeding branches, branch controls, shared vein texture, paused pulses and clean disposal');

// Recovery must assemble a body before it pays tissue out into searching limbs.
for(const seed of [1,17,10]){
  const b=createMotionFixture();b.tuning.seed=seed;b.tuning.interpolation=false;b.reset();
  const t=createV2Tendrils(b),m=createV2Membrane(b),point=new Float64Array(4);
  for(let i=0;i<60*40&&b.phase!=='RECOVER';i++)b.step(1/60);
  assert.equal(b.phase,'RECOVER');
  const emergence=Array(b.tentacleCount).fill(-1),corePositions=t.core.geometry.attributes.position,coreIndices=t.core.geometry.index.array;
  const volume=()=>{let v=0;const p=corePositions.array;for(let j=0;j<coreIndices.length;j+=3){const a=coreIndices[j]*3,c=coreIndices[j+1]*3,d=coreIndices[j+2]*3;v+=p[a]*(p[c+1]*p[d+2]-p[c+2]*p[d+1])+p[a+1]*(p[c+2]*p[d]-p[c]*p[d+2])+p[a+2]*(p[c]*p[d+1]-p[c+1]*p[d]);}return v;};
  t.update();const initialVolume=volume();let previousCore=null,previousSheet=null;
  while(b.phase==='RECOVER'){
    t.update();m.update();const progress=b.recoveryProgress();
    assert(Math.abs(volume()/initialVolume-1)<2e-6,'amorphous deformation preserves the core reserve volume');
    for(let arm=0;arm<b.tentacleCount;arm++){
      sampleTendril(b,arm,.5,point);
      if(progress<.64)assert.equal(point[3],0,'no limb emerges before gathering has finished');
      if(point[3]>.004&&emergence[arm]<0){emergence[arm]=progress;assert.equal(b.sheet,0,'unfurling starts only after the sheet has gathered');assert(t.core.visible);}
    }
    const core=Array.from(corePositions.array,(v,i)=>v*t.core.scale.getComponent(i%3)+t.core.position.getComponent(i%3));
    if(previousCore&&t.core.visible)assert(Math.max(...core.map((v,i)=>Math.abs(v-previousCore[i])))<.06,'core reforms without a mesh jump');
    previousCore=t.core.visible?core:null;
    if(m.mesh.visible){
      const sheet=m.geometry.attributes.position.array;
      if(previousSheet)assert(Math.max(...sheet.map((v,i)=>Math.abs(v-previousSheet[i])))<.13,'gathering membrane has no position jumps');
      previousSheet=sheet.slice();
    }else if(previousSheet){
      let radius=0;for(let i=0;i<previousSheet.length;i+=3)radius=Math.max(radius,Math.hypot(previousSheet[i]-b.centerX,previousSheet[i+2]-b.centerZ));
      assert(radius<.4,'sheet is buried inside the body before it disappears');previousSheet=null;
    }
    b.step(1/60);
  }
  assert.equal(b.phase,'SEEK');assert(emergence.every(p=>p>.64));
  assert(Math.max(...emergence)-Math.min(...emergence)>.045,'limbs unfold asynchronously');
  t.update();const finalCore=Array.from(corePositions.array,(v,i)=>v*t.core.scale.getComponent(i%3)+t.core.position.getComponent(i%3));
  assert(Math.max(...finalCore.map((v,i)=>Math.abs(v-previousCore[i])))<.02,'return to seeking keeps the reformed body continuous');
  const radii=[];for(let i=0;i<corePositions.count;i++)radii.push(Math.hypot(corePositions.getX(i),corePositions.getY(i),corePositions.getZ(i)));
  assert(Math.max(...radii)-Math.min(...radii)>.35,'resting mass is visibly lobed, not a scaled sphere');
  b.paused=true;const frozen=corePositions.array.slice();t.update();assert.deepEqual(corePositions.array,frozen,'pause freezes the amorphous tissue');
  b.paused=false;for(let i=0;i<60*45&&b.meals<2;i++)b.step(1/60);assert.equal(b.meals,2,'a recovered organism can hunt again');
  t.dispose();m.dispose();
}
for(const strength of [0,.85,1]){
  let previous=0;for(let i=0;i<=1000;i++){const p=muscleProgress(i/1000,strength);assert(p>=previous&&p<=1,'contractions advance without backsliding');previous=p;}assert.equal(previous,1);
}
assert(limbPull(.5,0,.8)!==limbPull(.5,1,.8),'limbs take up slack at different rates');
for(let arm=0;arm<7;arm++){assert.equal(limbPull(0,arm,1.5),0);assert.equal(limbPull(1,arm,1.5),1);assert.equal(recoveryLimb(.62,arm,1.5),0);assert.equal(recoveryLimb(1,arm,1.5),1);}
console.log('PASS gather-before-unfurl recovery, staggered limbs, continuous return to seeking, lobed constant-volume core, muscular pulls and repeat feeding');

// Preserve the accepted v2 preset and exercise its faster, smaller morphology.
const accepted=new CutislingV2(),acceptedTendrils=createV2Tendrils(accepted),acceptedSkin=createV2Membrane(accepted);
assert.deepEqual(accepted.tuning,V2_DEFAULTS);
assert.equal(accepted.tuning.seed,571519);
const acceptedPhases=new Set();
for(let i=0;i<60*60&&accepted.meals<2;i++){
  accepted.step(1/60);acceptedPhases.add(accepted.phase);
  if(i%6===0){
    acceptedTendrils.update();acceptedSkin.update();
    for(const geometry of [acceptedTendrils.geometry,acceptedTendrils.core.geometry,acceptedSkin.geometry])
      for(const attr of ['position','normal'])for(const value of geometry.attributes[attr].array)assert(Number.isFinite(value));
  }
}
assert.equal(accepted.meals,2,'accepted defaults complete repeated hunting, feeding and recovery');
assert.deepEqual([...acceptedPhases],['SEEK','SPOT','ANCHOR','TRANSFER','EXTEND2','SURROUND','FLATTEN','ENGULF','ABSORB','RECOVER']);
assert.deepEqual(JSON.parse(serializeV2Settings(accepted.tuning)).settings,V2_DEFAULTS);
accepted.reset();assert.equal(accepted.time,0);assert.equal(accepted.tuning.seed,571519);
acceptedTendrils.dispose();acceptedSkin.dispose();
console.log('PASS accepted seed 571519 defaults, finite tissue, full phase sequence, repeated meals and exact settings round-trip');

// Crawling must bend the actual pull, preserve the grip and keep its vertical
// motion low. Exercise both the selected preset and maximum crawling controls.
for(const extreme of [false,true]){
  const b=new CutislingV2();b.tuning.interpolation=false;
  if(extreme)Object.assign(b.tuning,{seed:10,crawlSway:2,crawlLift:1.5,crawlRate:2});
  b.reset();const t=createV2Tendrils(b),m=createV2Membrane(b),tip=new Float64Array(4);
  let left=0,right=0,lowest=Infinity,highest=0,draws=0,covered=false;
  const phases=new Set();
  for(let i=0;i<60*90&&b.meals<2;i++){
    const phase=b.phase,x=b.centerX,z=b.centerZ,drawX=b.drawX,drawZ=b.drawZ;b.step(1/60);phases.add(b.phase);
    if(['SEEK','SPOT','ANCHOR'].includes(phase))assert(Math.hypot(b.centerX-x,b.centerZ-z)<1e-9,'crawling does not create unanchored drift');
    if(b.holdingPrey&&['SPOT','ANCHOR','TRANSFER','EXTEND2','SURROUND'].includes(b.phase)){
      sampleTendril(b,b.chosenProbe,1,tip,false);
      assert(Math.hypot(tip[0]-b.anchorX,tip[2]-b.anchorZ)<1e-9,'weaving pull keeps the original anchor planted');
    }
    if(b.phase==='TRANSFER'){
      const dx=b.drawX-b.anchorFromX,dz=b.drawZ-b.anchorFromZ,d=Math.hypot(dx,dz)||1;
      const lateral=((b.centerZ-b.anchorFromZ)*dx-(b.centerX-b.anchorFromX)*dz)/d;
      left=Math.min(left,lateral);right=Math.max(right,lateral);draws++;
    }
    if(phase==='TRANSFER'&&b.phase!=='TRANSFER')assert(Math.hypot(b.centerX-drawX,b.centerZ-drawZ)<1e-9,'every weave settles exactly into its committed target');
    if(b.phase==='RECOVER'&&b.recoveryProgress()<.64){sampleTendril(b,0,.5,tip,false);assert.equal(tip[3],0,'crawling does not reveal limbs before the mass reforms');}
    if(i%3===0){
      t.update();m.update();
      if(t.core.visible){
        const rise=t.core.position.y-.018-t.core.scale.y*.34/.38;
        lowest=Math.min(lowest,rise);highest=Math.max(highest,rise);
        assert(rise>=-1e-8&&rise<.08,'crawling lift remains small and above the floor');
        assert(t.core.scale.y/Math.min(t.core.scale.x,t.core.scale.z)<.4,'crawling keeps the mass flat');
      }
      for(const geometry of [t.geometry,t.core.geometry,m.geometry])for(const attr of ['position','normal'])for(const v of geometry.attributes[attr].array)assert(Number.isFinite(v));
      if(b.phase==='ABSORB'&&!covered){m.update();assert(heightAt(m,b.preyX,b.preyZ)>.012+b.preyRadius*2,'travelling folds preserve the sealed prey covering');covered=true;}
    }
  }
  assert.equal(b.meals,2);assert(draws>60&&left<-.01&&right>.01,'body genuinely sways to both sides during anchored pulls');
  assert(highest-lowest>.005,'weight rises and settles during locomotion');
  assert(covered&&phases.has('FLATTEN')&&phases.has('RECOVER'));
  b.paused=true;t.update();m.update();const core=t.core.geometry.attributes.position.array.slice(),cords=t.geometry.attributes.position.array.slice(),sheet=m.geometry.attributes.position.array.slice();
  b.step(.1);t.update();m.update();assert.deepEqual(t.core.geometry.attributes.position.array,core);assert.deepEqual(t.geometry.attributes.position.array,cords);assert.deepEqual(m.geometry.attributes.position.array,sheet);
  t.dispose();m.dispose();
}
const crawl60=new CutislingV2(),crawl120=new CutislingV2();
for(let i=0;i<600;i++)crawl60.step(1/60);for(let i=0;i<1200;i++)crawl120.step(1/120);
assert.equal(crawl60.centerX,crawl120.centerX);assert.equal(crawl60.centerZ,crawl120.centerZ);assert.deepEqual(crawl60.probes,crawl120.probes);
console.log('PASS weaving anchored paths, planted tips, grounded flat-body lift, repeated feeds at maximum crawl controls, sealed prey, pause and display-rate determinism');


function exposedContacts(points,b){
  let contacts=0;const arms=[...Array(b.tentacleCount).keys(),7,8],core=.9*b.tuning.spread*b.tuning.tendrilWidth;
  for(let a=0;a<arms.length;a++)for(let o=a+1;o<arms.length;o++){
    if(arms[a]>=7&&arms[o]>=7)continue; // The feeding lips intentionally join.
    for(let j=2;j<32;j++){
      const k=(arms[a]*33+j)*4,r=points[k+3];if(r<.004||Math.hypot(points[k]-b.centerX,points[k+2]-b.centerZ)<core)continue;
      let touching=false;
      for(let n=1;n<33&&!touching;n++){
        const q=(arms[o]*33+n)*4,dx=points[q]-points[q-4],dy=points[q+1]-points[q-3],dz=points[q+2]-points[q-2],d2=dx*dx+dy*dy+dz*dz;
        if(d2<1e-10)continue;
        const along=Math.max(0,Math.min(1,((points[k]-points[q-4])*dx+(points[k+1]-points[q-3])*dy+(points[k+2]-points[q-2])*dz)/d2));
        const radius=(r+points[q-1]+(points[q+3]-points[q-1])*along)*.9;
        const distance=Math.hypot(points[k]-points[q-4]-dx*along,points[k+1]-points[q-3]-dy*along,points[k+2]-points[q-2]-dz*along);
        touching=radius>.01&&distance<radius*.8;
      }
      if(touching)contacts++;
    }
  }
  return contacts;
}
let beforeClearance=0,afterClearance=0,supportFrames=0;
for(const seed of [1,571519,10]){
  const b=new CutislingV2();b.tuning.seed=seed;b.tuning.interpolation=false;b.reset();
  const raw=new Float64Array(9*33*4),resolved=raw.slice(),point=new Float64Array(4);let gathered=false;
  for(let i=0;i<3600&&!b.meals;i++){
    b.step(1/60);
    if(b.holdingPrey&&b.anchorTravel===0){
      for(let arm=0;arm<b.tentacleCount;arm++)for(let j=0;j<33;j++){
        sampleTendril(b,arm,j/32,point,false);
        for(let axis=0;axis<3;axis++)assert(Math.abs(point[axis]-b.attackPaths[(arm*33+j)*4+axis])<1e-9,'resolved contact pose does not pop when the anchor is acquired');
      }
    }
    if(b.holdingPrey&&b.sheet===0&&b.anchorTravel>.5){
      for(let arm=0;arm<b.tentacleCount;arm++)if(arm!==b.chosenProbe&&b.contactLengths[arm]>b.tuning.spread){
        sampleTendril(b,arm,1,point,false);
        assert(Math.hypot(point[0]-b.centerX,point[2]-b.centerZ)>b.contactLengths[arm]*.70,'supporting arms retain their reach through the draw and flank');supportFrames++;
      }
    }
    if(b.phase==='ENGULF'){
      for(let arm=0;arm<b.tentacleCount;arm++){sampleTendril(b,arm,.5,point,false);assert.equal(point[3],0,'supporting arms resolve when the digestive sheet forms');}gathered=true;
    }
    if(i%6)continue;
    for(let arm=0;arm<9;arm++){
      if(arm>=b.tentacleCount&&arm<7)continue;
      for(let j=0;j<33;j++){sampleTendril(b,arm,j/32,point,false);resolved.set(point,(arm*33+j)*4);sampleRawTendril(b,arm,j/32,point,false);raw.set(point,(arm*33+j)*4);}
    }
    beforeClearance+=exposedContacts(raw,b);afterClearance+=exposedContacts(resolved,b);
  }
  assert(b.meals===1&&gathered,'long supporting arms still permit complete feeding');
}
assert(supportFrames>100&&beforeClearance>100);
assert(afterClearance<beforeClearance*.15,'clearance removes most exposed crossings throughout full transition sequences');
const supportWalker=new CutislingV2();supportWalker.tuning.hunting=false;supportWalker.tuning.interpolation=false;supportWalker.reset();
let stance=null,stanceFrames=0;
for(let i=0;i<1200&&supportWalker.strides<3;i++){
  const previous=supportWalker.phase;supportWalker.step(1/60);
  if(previous==='SEEK'&&supportWalker.phase==='SPOT')stance={chosen:supportWalker.chosenProbe,lengths:supportWalker.probes.map(p=>p.length)};
  if(stance&&(supportWalker.phase==='TRANSFER'||previous==='TRANSFER'&&supportWalker.phase==='SEEK')){
    for(let arm=0;arm<supportWalker.tentacleCount;arm++)if(arm!==stance.chosen)assert(supportWalker.probes[arm].length>=stance.lengths[arm]*.85,'ground strides never reset the supporting limbs to stubs');stanceFrames++;
  }
}
assert(supportWalker.strides===3&&stanceFrames>100);
console.log('PASS retained supporting arms, active ground strides, feeding-only gathering and transition clearance', {beforeClearance,afterClearance});
