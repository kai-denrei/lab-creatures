import assert from 'node:assert/strict';
import {CutisSwarm} from '../src/cutis/swarm/controller.ts';
import {DEFAULT_CONFIG,cycleTiming,CUTIS_CONTROLS,sanitizeConfig,transferProgress,CUTIS_PALETTES,applyPalette,loadConfig,saveConfig} from '../src/cutis/swarm/config.ts';
import {settingsDocument,readSettings} from '../src/sharing/settings.ts';
for(const duration of [.15,.35,.5,.77,1.1,2.5,3]){const t=cycleTiming(duration);assert(t.coil>=.12,'minimum warning');assert(t.extend/t.transfer>=1.5,'mandatory slow reach / snap contrast');}
for(const count of [1,100,300]){
 const config={...DEFAULT_CONFIG,seekCount:1},swarm=new CutisSwarm(config);swarm.reset(count);
 const buffers=[swarm.offset,swarm.heading,swarm.anchor,swarm.phase,swarm.params];
 if(count>1)assert(new Set(Array.from(swarm.phase.slice(0,count),p=>Math.floor(p*10))).size>=8,'idle swarm desynchronized');
 const states=new Set();let anchorSamples=0,hops=0;
 for(let frame=0;frame<120*12;frame++){
  const before=swarm.getState(0),oldAnchor=swarm.getAnchor(0),oldHeading=swarm.heading.slice(0,3),cycle=swarm.cycles[0],origin=swarm.offset.slice(0,3);
  const target={x:Math.sin(frame/700)*3+2,z:Math.cos(frame/500)*2};swarm.step(1/120,target);states.add(swarm.getState(0));
  if(swarm.cycles[0]===cycle&&before!=='REST'&&swarm.phase[0]>.01){assert.deepEqual(swarm.getAnchor(0),oldAnchor,'anchor does not chase moving prey mid-hop');assert.deepEqual(swarm.heading.slice(0,3),oldHeading,'heading locks for hop');}
  if(before==='ANCHOR'){anchorSamples++;assert(swarm.getStretchSegment(0).from.x===swarm.offset[0]);}
  if(swarm.cycles[0]>cycle){hops++;assert(Math.abs(swarm.offset[0]-oldAnchor.x)<1e-5&&Math.abs(swarm.offset[2]-oldAnchor.z)<1e-5,'completed hop commits anchor');}
  else assert.deepEqual(swarm.offset.slice(0,3),origin,'origin does not drift between hops');
  for(const array of buffers)assert(array.every(Number.isFinite),'finite instance attributes');
 }
 assert(anchorSamples>0&&hops>0);for(const state of ['COIL','EXTEND','ANCHOR','TRANSFER','SETTLE'])assert(states.has(state));
 assert.deepEqual([swarm.offset,swarm.heading,swarm.anchor,swarm.phase,swarm.params],buffers,'buffers retained');
 swarm.scrub(.58);const frozen=swarm.phase.slice(),anchor=swarm.anchor.slice(),time=swarm.time;swarm.step(2,{x:9,z:9});assert.deepEqual(swarm.phase,frozen);assert.deepEqual(swarm.anchor,anchor);assert.equal(swarm.time,time);assert.equal(swarm.getState(0),'ANCHOR');assert(swarm.getStretchSegment(0).vulnerable);swarm.scrub(.74);assert(swarm.getStretchSegment(0).intangible);swarm.scrub(.94);assert(!swarm.getStretchSegment(0).vulnerable);
 console.log(`PASS Cutis-Maku ${count}: fixed anchor/heading, discrete hops, phase states, desync, frozen scrub, hooks and finite attributes`);
}
const json=JSON.stringify(settingsDocument('cutis-maku','cutis-maku',CUTIS_CONTROLS,DEFAULT_CONFIG));assert.deepEqual(readSettings(json,'cutis-maku',CUTIS_CONTROLS),DEFAULT_CONFIG);assert.equal(sanitizeConfig({reach:99}).reach,20);assert.equal(sanitizeConfig({r0:NaN}).r0,.2);
console.log('PASS timing asymmetry, 120ms telegraph, portable settings and bounds');

const requested={"cycleDuration":4,"aggression":2,"reach":15,"capAngle":10,"seekSweep":0.85,"seekCount":3,"seekRate":1,"transferAcceleration":1,"neckThin":0.5,"delaySpread":0.25,"cubenessPeak":0.9,"wobble":0.5,"r0":0.2,"noiseAmp":0.2,"breathRate":1.5,"cubenessRest":0.25,"pulseSpeed":2,"veinWidth":0.1,"skinTint":12165524,"veinTint":3679278,"pulseTint":15497546,"separation":2,"alignment":0.35,"cohesion":0.15};
for(const [key,value] of Object.entries(requested))assert.equal(DEFAULT_CONFIG[key],value,key);
assert(transferProgress(.2,2.8)<.02,'transfer begins slowly');
assert(transferProgress(.9,2.8)-transferProgress(.8,2.8)>(transferProgress(.2,2.8)-transferProgress(.1,2.8))*8,'transfer accelerates strongly');
assert.equal(transferProgress(1,2.8),1);assert.equal(transferProgress(0,2.8),0);
for(const key of Object.keys(CUTIS_PALETTES)){const config={...DEFAULT_CONFIG};applyPalette(config,key);for(const [key,value] of Object.entries(requested))if(!key.endsWith('Tint'))assert.equal(config[key],value,'palette leaves behavior intact');}
const oldHunt={schema:'lab-creatures/settings',version:1,family:'cutis-maku',group:'Hunt',values:{cycleDuration:2.5,aggression:.1,reach:5,capAngle:25}};
assert.deepEqual(readSettings(JSON.stringify(oldHunt),'cutis-maku',CUTIS_CONTROLS,'Hunt'),oldHunt.values,'older group payloads still paste without new seeking controls');
const storage=new Map([['cutis-maku-v3',JSON.stringify({reach:5})]]);globalThis.localStorage={getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value)};
assert.deepEqual(loadConfig(),DEFAULT_CONFIG,'updated defaults take effect');saveConfig({...DEFAULT_CONFIG,reach:16});assert.equal(loadConfig().reach,16,'extended values persist');
for(const extreme of ['min','max']){const config={...DEFAULT_CONFIG};for(const c of CUTIS_CONTROLS)if(c.kind!=='color')config[c.key]=c[extreme];const swarm=new CutisSwarm(config);swarm.reset(100);for(let i=0;i<1200;i++)swarm.step(1/120,{x:8,z:3});assert(swarm.offset.every(Number.isFinite)&&swarm.anchor.every(Number.isFinite));}
console.log('PASS requested defaults, expanded limits, accelerating transfer, seven independent palettes, old group imports and persistence');

for(const count of [2,3]){
 for(let winner=0;winner<count;winner++){
  const swarm=new CutisSwarm({...DEFAULT_CONFIG,seekCount:count});
  swarm.step(1/120,{x:4,z:1});
  const candidates=swarm.getSeekingAnchors(0);
  assert.equal(candidates.length,count);
  assert.equal(new Set(candidates.map(p=>p.reach)).size,count,'different probe reaches');
  assert.equal(new Set(candidates.map(p=>Math.atan2(p.x,p.z).toFixed(3))).size,count,'different directions');
  const prey=candidates[winner];swarm.phase[0]=.5499;
  swarm.step(1/120,prey);
  assert.equal(swarm.chosenProbe[0],winner,'closest cup selected at end of seeking');
  assert(Math.hypot(swarm.anchor[0]-prey.x,swarm.anchor[2]-prey.z)<1e-5);
  const locked=swarm.getAnchor(0),cycle=swarm.cycles[0];
  while(swarm.cycles[0]===cycle){const phase=swarm.phase[0];swarm.step(1/120,{x:-8,z:-5});if(swarm.cycles[0]===cycle&&phase>=.55)assert.deepEqual(swarm.getAnchor(0),locked,'winner stays locked despite moving prey');}
  assert(Math.hypot(swarm.offset[0]-locked.x,swarm.offset[2]-locked.z)<1e-5,'transfer commits winning cup');
 }
}
const editable=new CutisSwarm({...DEFAULT_CONFIG,seekCount:1});editable.scrub(.4);editable.config.seekCount=3;editable.step(1/120,{x:3,z:1});assert.equal(editable.getSeekingAnchors(0).length,3);assert.equal(editable.frozen,true);assert(Math.abs(editable.phase[0]-.4)<1e-6,'count updates frozen study without losing phase');
assert.equal(sanitizeConfig({seekCount:2.6}).seekCount,3);
console.log('PASS 1–3 appendages, distinct directions/reaches, every candidate can win, late prey selection, locked transfer and frozen count editing');
