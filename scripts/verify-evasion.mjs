import assert from 'node:assert/strict';
import {EvasionGame,contacts} from '../src/evasion/game.ts';
import {CutisSwarm} from '../src/cutis/swarm/controller.ts';
import {GOROGORO_DEFAULT_CONFIG} from '../src/cutis/swarm/tiers.ts';
const swarm=new CutisSwarm({...GOROGORO_DEFAULT_CONFIG,r0:.33,seekCount:1});swarm.reset(12);swarm.scale.fill(1);
for(let i=0;i<12;i++){swarm.offset[i*3]=8;swarm.offset[i*3+2]=8;swarm.phase[i]=0;}
const game=new EvasionGame();game.step(.1,1,0,swarm);assert.equal(game.state,'EVADING');assert(Math.abs(game.x-.21)<1e-9);
const diagonal=new EvasionGame();diagonal.step(.1,1,1,swarm);assert(Math.abs(Math.hypot(diagonal.x,diagonal.z)-game.x)<1e-9);
swarm.offset[0]=game.x;swarm.offset[2]=0;game.step(.1,1,0,swarm);assert.equal(game.state,'GRIPPED');assert(game.x>.29);assert.equal(game.absorption,0);
swarm.offset[3]=game.x;swarm.offset[5]=0;for(let i=0;i<60;i++)game.step(.1,1,0,swarm);assert.equal(game.dead,true);const x=game.x;game.step(1,1,1,swarm);assert.equal(game.x,x);
game.reset();assert.equal(game.dead,false);assert.equal(game.absorption,0);game.resolve(1.5,{bodies:2,appendages:0});assert(game.devouring);game.resolve(1,{bodies:1,appendages:0});assert(game.devouring);
game.reset();game.paused=true;game.step(1,1,0,swarm);assert.equal(game.elapsed,0);
const lone=new CutisSwarm({...GOROGORO_DEFAULT_CONFIG,seekCount:1});lone.scale.fill(1);lone.step(1/120,{x:5,z:0});lone.scrub(.44);const a=lone.getAnchor(0);
const touching=contacts(lone,a.x,a.z,.2);assert.equal(touching.bodies,0);assert(touching.appendages>0);
const trapped=new EvasionGame();trapped.x=a.x;trapped.z=a.z;trapped.step(.1,1,0,lone);assert.equal(trapped.state,'ENTANGLED');assert(trapped.speed>0&&trapped.speed<2.1);
console.log('PASS evasion movement, diagonal normalization, appendage slowdown, body pin, two-body death, recovery, pause and restart');

const falling=new EvasionGame();falling.x=12.1;falling.step(.01,0,0,lone);assert(falling.falling);for(let i=0;i<200;i++)falling.step(.01,0,0,lone);assert(falling.dead);assert.equal(falling.deathReason,'FELL');
const ledge=new CutisSwarm({...GOROGORO_DEFAULT_CONFIG});ledge.offset[0]=13;const edgeGame=new EvasionGame();edgeGame.predators(.1,ledge);assert.equal(edgeGame.fallen[0],1);assert.equal(ledge.suspended[0],1);assert(ledge.offset[1]<0);
const feeding=new EvasionGame();feeding.resolve(1.5,{bodies:2,appendages:0});assert(feeding.devouring);for(let i=0;i<3;i++)feeding.resolve(.5,{bodies:2,appendages:0});assert.equal(feeding.legsCut,4);assert(feeding.absorption>0);assert(!feeding.dead);feeding.resolve(2,{bodies:2,appendages:0});assert(feeding.dead);
const rage=new EvasionGame();rage.elapsed=9.99;assert.equal(rage.huntSpeed,1);rage.elapsed=10;assert.equal(rage.huntSpeed,1.18);rage.elapsed=30;assert.equal(rage.huntSpeed,1.54);rage.reset();assert.equal(rage.huntSpeed,1);
console.log('PASS prey/predator falls, suspended fallen hunters, staged severing before absorption and 10-second bloodlust');

const struggling=new EvasionGame();const captors=new CutisSwarm({...GOROGORO_DEFAULT_CONFIG});captors.reset(2);captors.scale.fill(1);captors.offset[3]=0;captors.offset[5]=0;captors.phase[1]=0;captors.offset[0]=0;captors.offset[2]=0;captors.phase[0]=0;
for(let i=0;i<10;i++)struggling.step(.05,1,0,captors);
assert(struggling.x>0&&struggling.x<=.080001,'pinned Reed struggles within grip radius');
assert(struggling.speed>0&&struggling.speed<.3,'struggle remains slow');
console.log('PASS restrained Reed movement stays within adhesive grip');
const {startingHunterPosition}=await import('../src/evasion/game.ts');
const formation=Array.from({length:12},(_,i)=>startingHunterPosition(i));
assert(formation.every(p=>Math.abs(Math.hypot(p.x,p.z)-6.5)<1e-9));
assert(formation.every(p=>p.z>=-3.250001),'clear northern corridor at spawn');
assert.equal(new Set(formation.map(p=>`${p.x},${p.z}`)).size,12);
console.log('PASS twelve-hunter horseshoe with a clear forward opening');

const escape=new EvasionGame(),hunter=new CutisSwarm({...GOROGORO_DEFAULT_CONFIG});hunter.offset[0]=0;hunter.offset[2]=0;hunter.phase[0]=0;
escape.step(.1,1,0,hunter);assert.equal(escape.bodies,1);assert(escape.speed>=1);assert(escape.x>.08);
assert(escape.shake(hunter));assert.equal(escape.bodyGrip[0],0);assert.equal(escape.armGrip[0],0);assert(escape.heat>0);assert(!escape.shake(hunter),'no repeat during shake cooldown');
escape.step(.1,1,0,hunter);assert.equal(escape.bodies,0,'shake prevents immediate regrip');
for(let i=0;i<4;i++){escape.shakeCooldown=0;escape.shake(hunter);}assert(escape.overheated);assert(!escape.shake(hunter));
hunter.offset[0]=8;hunter.offset[2]=0;escape.bodies=0;escape.appendages=0;for(let i=0;i<50;i++)escape.step(.1,0,0,hunter);assert(!escape.overheated);assert(escape.shake(hunter));
escape.reset();assert.equal(escape.heat,0);assert(!escape.overheated);
console.log('PASS single-body escape, shake releases grip, heat lockout, cooling and reset');
