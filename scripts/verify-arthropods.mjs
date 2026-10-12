import assert from 'node:assert/strict';
import { ArthropodGait, FEMUR, TIBIA } from '../src/arthropods/gait.ts';

for(const speed of [.3,1,1.8]){
  const gait=new ArthropodGait();gait.speed=speed;
  let lifted=0,maxError=0;
  for(let frame=0;frame<120*45;frame++){
    const t=frame/120;
    // Includes reversals while walking and tight turns to a near target.
    if(frame%480===0)gait.target.set(Math.sin(t*1.7)*.25,0,Math.cos(t*1.7)*.25);
    const before=gait.legs.map(leg=>({position:leg.foot.clone(),planted:leg.planted}));
    gait.step(1/120);
    assert(gait.center.toArray().every(Number.isFinite),'finite body position');
    assert(gait.legs.filter(leg=>leg.planted).length>=3,'at least three feet planted');
    gait.legs.forEach((leg,i)=>{
      const points=gait.joints(i);
      assert(points.every(p=>p.toArray().every(Number.isFinite)),'finite joints');
      maxError=Math.max(maxError,Math.abs(points[2].distanceTo(points[3])-FEMUR),Math.abs(points[3].distanceTo(points[4])-TIBIA));
      assert(leg.foot.y>=.008-1e-10,'feet and claws clear the table');
      if(leg.planted&&before[i].planted)assert(leg.foot.distanceTo(before[i].position)<1e-12,'support feet do not slide');
      if(!leg.planted&&leg.foot.y>.015)lifted++;
    });
  }
  assert(maxError<1e-6,`rigid femur/tibia lengths at ${speed}×; maximum error ${maxError}`);
  assert(lifted>0,'swing feet lift');
  gait.walking=false;for(let i=0;i<120;i++)gait.step(1/120);
  assert(gait.legs.every(leg=>leg.planted),'pause finishes active steps');
  const center=gait.center.clone();for(let i=0;i<120;i++)gait.step(1/120);
  assert(Math.hypot(center.x-gait.center.x,center.z-gait.center.z)<1e-12,'pause stops travel');
  gait.reset();assert(gait.center.x===0&&gait.center.z===0&&gait.heading===0,'reset restores origin');
  console.log(`PASS arthropod ${speed}×: rigid links, planted support, clearance, turning, pause and reset`);
}

const {PredatorInstinct}=await import('../src/arthropods/instinct.ts');
const {DEFAULT_SETTINGS,PRESETS,sanitizeSettings}=await import('../src/arthropods/settings.ts');
const {Vector3}=await import('three/webgpu');
for(const [name,overrides] of Object.entries({balanced:{},...PRESETS,extreme:{speed:1.8,turnRate:2.5,rushSpeed:6,aggression:2,erratic:2,lowering:38,abdomen:1.5,footLift:35}})){
  const gait=new ArthropodGait(),settings={...DEFAULT_SETTINGS,...overrides},instinct=new PredatorInstinct(gait,settings),lure=new Vector3(.10,.012,.17);
  const states=new Set(),speeds={rushing:[],stalking:[]};let minimumHeight=1,maxError=0;
  for(let frame=0;frame<120*35;frame++){
    if(frame===120*15)lure.set(-.13,.012,.08);
    const before=gait.center.clone(),feet=gait.legs.map(leg=>({position:leg.foot.clone(),planted:leg.planted}));
    instinct.step(1/120,lure);gait.step(1/120);states.add(instinct.state);
    minimumHeight=Math.min(minimumHeight,gait.center.y);
    if(speeds[instinct.state])speeds[instinct.state].push(Math.hypot(gait.center.x-before.x,gait.center.z-before.z)*120);
    assert(gait.legs.filter(leg=>leg.planted).length>=3,'predator retains a support tripod');
    assert(Math.hypot(gait.center.x,gait.center.z)<.31,'body stays within observation arena');
    gait.legs.forEach((leg,i)=>{
      const points=gait.joints(i);
      assert(points.every(p=>p.toArray().every(Number.isFinite)),'predator joints finite');
      maxError=Math.max(maxError,Math.abs(points[2].distanceTo(points[3])-FEMUR),Math.abs(points[3].distanceTo(points[4])-TIBIA));
      if(leg.planted&&feet[i].planted)assert(leg.foot.distanceTo(feet[i].position)<1e-12,'predatory support feet stay planted');
      assert(leg.foot.y>=.008-1e-10,'predatory foot clearance');
    });
  }
  assert(maxError<1e-6,`${name}: rigid predatory links, max error ${maxError}`);
  for(const state of ['noticing','hesitating','stalking','coiling','rushing','recovering'])assert(states.has(state),`${name}: visits ${state}`);
  assert(minimumHeight<.068,`${name}: visibly lowers body`);
  assert(Math.max(...speeds.rushing)>Math.max(...speeds.stalking)*1.4,`${name}: rush is faster than stalk`);
  instinct.active=false;for(let i=0;i<120;i++){instinct.step(1/120,lure);gait.step(1/120);}
  const stopped=gait.center.clone();for(let i=0;i<120;i++){instinct.step(1/120,lure);gait.step(1/120);}
  assert(Math.hypot(gait.center.x-stopped.x,gait.center.z-stopped.z)<1e-12,'instinct off stops travel');
  assert(gait.legs.every(leg=>leg.planted),'instinct off finishes swings');
  instinct.active=true;instinct.disturb(lure);assert.equal(instinct.state,'recoiling','manual startle recoils');
  console.log(`PASS ${name}: ${[...states].join(', ')}, rush contrast, body lowering, fixed links, pause`);
}
const passiveGait=new ArthropodGait(),passive=new PredatorInstinct(passiveGait,{...DEFAULT_SETTINGS,aggression:0,fear:0}),stimulus=new Vector3(0,.012,.15);
for(let i=0;i<120*15;i++){passive.step(1/120,stimulus);passiveGait.step(1/120);assert.notEqual(passive.state,'rushing','zero aggression disables attacks');}
passive.disturb(stimulus);assert.notEqual(passive.state,'recoiling','zero fear disables startle');
assert.equal(sanitizeSettings({rushSpeed:Infinity,fear:-3,lowering:100}).fear,0);
assert.equal(sanitizeSettings({lowering:100}).lowering,76);
console.log('PASS zero aggression/fear and stored-setting validation');
const {PREDATOR_CONTROLS,defaultSettings}=await import('../src/arthropods/settings.ts');
const liveGait=new ArthropodGait(),liveSettings={...DEFAULT_SETTINGS},liveInstinct=new PredatorInstinct(liveGait,liveSettings);
let liveError=0;
for(let frame=0;frame<7200;frame++){
  if(frame%73===0)PREDATOR_CONTROLS.forEach((control,i)=>{liveSettings[control.key]=(frame/73+i)%3===0?control.min:control.max;});
  if(frame%257===0)stimulus.set(Math.sin(frame)*.27,.012,Math.cos(frame)*.27);
  liveInstinct.step(1/120,stimulus);liveGait.step(1/120);
  for(let i=0;i<6;i++){const p=liveGait.joints(i);liveError=Math.max(liveError,Math.abs(p[2].distanceTo(p[3])-FEMUR),Math.abs(p[3].distanceTo(p[4])-TIBIA));}
}
assert(liveError<1e-6,'live tuning changes never stretch links');
console.log('PASS live tuning at control bounds during pursuit and abrupt retargeting');

const {LAB_VARIANTS,LAB_ARENA}=await import('../src/arthropods/variants.ts');
for(const control of PREDATOR_CONTROLS)assert.equal(control.value*2,control.max,`${control.key}: previous max becomes default and new max doubles`);
for(const breed of LAB_VARIANTS.filter(breed=>breed.id!=='veil')){
  for(const maximum of [false,true]){
    const settings=maximum?Object.fromEntries(PREDATOR_CONTROLS.map(c=>[c.key,c.max])):defaultSettings(breed.id);
    const rig=new ArthropodGait(breed.id),brain=new PredatorInstinct(rig,settings),target=new Vector3(.5,.012,.2);
    let error=0,travel=0;const initial=rig.center.clone();
    assert.equal(rig.legs.length,breed.id==='isopod'?14:breed.id==='veil'?12:6);
    for(let frame=0;frame<120*50;frame++){
      if(frame===120*22)target.set(-.5,.012,.35);
      const before=rig.legs.map(leg=>({position:leg.foot.clone(),planted:leg.planted}));
      brain.step(1/120,target);rig.step(1/120);travel=Math.max(travel,rig.center.distanceTo(initial));
      assert(Math.hypot(rig.center.x,rig.center.z)<LAB_ARENA.travelRadius+.015,'expanded arena bounds');
      assert(rig.legs.filter(leg=>leg.planted).length>=rig.legs.length/2,'supporting half of legs remains planted');
      rig.legs.forEach((leg,i)=>{
        const p=rig.joints(i);assert(p.every(v=>v.toArray().every(Number.isFinite)),'finite joint positions');
        error=Math.max(error,Math.abs(p[2].distanceTo(p[3])-rig.upperLength),Math.abs(p[3].distanceTo(p[4])-rig.lowerLength));
        if(leg.planted&&before[i].planted)assert(leg.foot.distanceTo(before[i].position)<1e-12,'no planted-foot sliding');
        assert(leg.foot.y>=.008-1e-10,'feet clear the table');
      });
    }
    assert(error<1e-6,`${breed.id} ${maximum?'new max':'defaults'} fixed-length links: ${error}`);
    assert(travel>.04,`${breed.id} moves under ${maximum?'maximum':'default'} controls`);
    console.log(`PASS ${breed.id}: ${maximum?'doubled maxima':'specimen defaults'}, ${rig.legs.length} legs, locomotion, arena, reach and support`);
  }
}

const {createMembrane}=await import('../src/arthropods/membrane.ts');
const {VeilGait}=await import('../src/arthropods/veil-gait.ts');
const veil=createMembrane(),veilGait=new VeilGait();veil.update(veilGait);
const surface=veil.group.children[0].geometry,edges=new Map(),triangles=surface.index.array;
for(let i=0;i<triangles.length;i+=3)for(let k=0;k<3;k++){
  const a=triangles[i+k],b=triangles[i+(k+1)%3],key=[a,b].sort((a,b)=>a-b).join(',');
  const record=edges.get(key)||{count:0,direction:0};record.count++;record.direction+=a<b?1:-1;edges.set(key,record);
}
assert([...edges.values()].every(edge=>edge.count===2&&edge.direction===0),'membrane is closed and consistently oriented, with no disconnected strips');
assert([...surface.attributes.position.array].every(Number.isFinite),'membrane vertices finite');
assert.equal(veil.group.children.length,1,'membrane is a single visible surface without eyes or tentacles');
console.log('PASS Veil: single closed manifold membrane, consistent surface orientation, finite vertices');

const organic=new VeilGait();organic.target.set(.55,0,.25);organic.drive=.6;organic.speed=1.8;
let slowPeak=0,burstPeak=0;const launches=new Set(),durations=new Set();let maxSimultaneous=0,minRadius=1,maxRadius=0;
for(let frame=0;frame<120*18;frame++){
  if(frame===120*8)organic.drive=6;
  const previous=organic.center.clone(),before=organic.legs.map(leg=>({planted:leg.planted,position:leg.foot.clone()}));
  organic.step(1/120);
  const velocity=Math.hypot(organic.center.x-previous.x,organic.center.z-previous.z)*120;
  if(frame<120*8)slowPeak=Math.max(slowPeak,velocity);else burstPeak=Math.max(burstPeak,velocity);
  let started=0;
  organic.legs.forEach((leg,i)=>{
    if(before[i].planted&&!leg.planted){launches.add(i);durations.add(leg.duration.toFixed(3));started++;}
    if(before[i].planted&&leg.planted)assert(leg.foot.distanceTo(before[i].position)<1e-12,'Veil anchor stays planted');
    const radius=Math.hypot(leg.foot.x-organic.center.x,leg.foot.z-organic.center.z);minRadius=Math.min(minRadius,radius);maxRadius=Math.max(maxRadius,radius);
  });
  maxSimultaneous=Math.max(maxSimultaneous,started);
  if(frame%120===0){
    veil.update(organic);const p=surface.attributes.position.array;
    for(let i=1;i<p.length;i+=3)assert(p[i]>=.001-1e-7&&p[i]<.025,'entire Veil stays a flat sheet with low rim curls');
  }
}
assert.equal(launches.size,12,'every membrane sector participates');
assert.equal(maxSimultaneous,1,'elastic tips launch individually, never symmetric groups');
assert(durations.size>12,'individual extensions have varied durations');
assert(maxRadius-minRadius>.05,'limbs visibly lengthen and retract');
assert(burstPeak>slowPeak*5,`clear slow/burst contrast: ${slowPeak} vs ${burstPeak}`);
organic.walking=false;for(let i=0;i<360;i++)organic.step(1/120);
assert(organic.legs.every(leg=>leg.planted),'paused Veil finishes current extensions');
const position=organic.center.clone();for(let i=0;i<120;i++)organic.step(1/120);assert(organic.center.distanceTo(position)<1e-12,'Veil stops travel');
console.log('PASS Veil: flat full sheet, 12 independently scheduled elastic tips, varied duration/reach, anchored pause, burst contrast', {slowPeak,burstPeak});
const {createOculus}=await import('../src/arthropods/oculus.ts');
const oculus=createOculus(),oculusGait=new ArthropodGait('oculus');oculus.update(oculusGait);
const names=[];oculus.group.traverse(o=>names.push(o.name));
assert.equal(names.filter(n=>n==='Single eye — entire head').length,1);
assert.equal(names.filter(n=>n==='Single antenna').length,1);
assert(oculusGait.upperLength>FEMUR&&oculusGait.lowerLength>TIBIA,'Oculus has longer legs than Aculis');
console.log('PASS Oculus: one ocular head, one antenna, oversized rigid legs');

const {createOculus:ocularFactory}=await import('../src/arthropods/oculus.ts');
const originalOculus=ocularFactory(),monoculus=ocularFactory('monoculus'),monoGait=new ArthropodGait('monoculus');
originalOculus.update(new ArthropodGait('oculus'));monoculus.update(monoGait);
originalOculus.group.updateMatrixWorld(true);monoculus.group.updateMatrixWorld(true);
const oldEye=originalOculus.group.getObjectByName('Eye globe'),newEye=monoculus.group.getObjectByName('Eye globe');
assert.equal(newEye.getWorldScale(new Vector3()).x,oldEye.getWorldScale(new Vector3()).x/4,'Monoculus eye diameter is one quarter of Oculus');
assert(originalOculus.group.getObjectByName('Reduced trunk'),'Oculus trunk retained');
assert(!originalOculus.group.getObjectByName('Interleg membrane'),'Oculus remains unwebbed');
assert(!monoculus.group.getObjectByName('Reduced trunk'),'Monoculus has no trunk');
assert(monoculus.group.getObjectByName('Tiny abdomen'),'Monoculus tiny abdomen retained');
const web=monoculus.group.getObjectByName('Interleg membrane');assert(web,'Monoculus leg web exists');
let changed=false;const rest=web.geometry.attributes.position.array.slice();
for(let frame=0;frame<360;frame++){
  monoGait.target.set(.4,0,.2);monoGait.step(1/120);monoculus.update(monoGait);
  const positions=web.geometry.attributes.position.array;assert(positions.every(Number.isFinite),'finite animated membrane');
  for(let i=1;i<positions.length;i+=3)assert(positions[i]>=.0029,'membrane clears the floor');
  changed ||= positions.some((n,i)=>Math.abs(n-rest[i])>1e-4);
}
assert(changed,'membrane follows the articulated gait');
console.log('PASS Monoculus: quarter-size eye, tiny abdomen, animated interleg web; Oculus geometry retained');
