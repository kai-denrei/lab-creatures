import assert from 'node:assert/strict';
import {EvasionGame,contacts,startingHunterPosition} from '../src/evasion/game.ts';
import {CutisSwarm} from '../src/cutis/swarm/controller.ts';
import {GOROGORO_DEFAULT_CONFIG} from '../src/cutis/swarm/tiers.ts';
function hunters(count=12){
  const swarm=new CutisSwarm({...GOROGORO_DEFAULT_CONFIG,r0:.33,seekCount:1});swarm.reset(count);swarm.scale.fill(1);
  for(let i=0;i<count;i++){swarm.offset[i*3]=8;swarm.offset[i*3+2]=8;swarm.phase[i]=0;}
  return swarm;
}
function place(swarm,i,x=0,z=0){swarm.offset[i*3]=x;swarm.offset[i*3+2]=z;swarm.phase[i]=0;}
function advance(game,swarm,seconds,dx=0,dz=0){for(let i=0;i<Math.round(seconds*120);i++)game.step(1/120,dx,dz,swarm);}
const near=(actual,expected,message)=>assert(Math.abs(actual-expected)<1e-8,`${message}: ${actual} vs ${expected}`);
const swarm=hunters(),game=new EvasionGame();game.step(.1,1,0,swarm);assert.equal(game.state,'EVADING');near(game.x,.21,'normal movement');
const diagonal=new EvasionGame();diagonal.step(.1,1,1,swarm);near(Math.hypot(diagonal.x,diagonal.z),game.x,'diagonal normalization');
place(swarm,0,game.x);game.step(.1,1,0,swarm);assert.equal(game.state,'GRIPPED');assert(game.x>.25);assert.equal(game.absorption,0);
place(swarm,1,game.x);advance(game,swarm,7,1);assert(game.dead);const x=game.x;game.step(1,1,1,swarm);assert.equal(game.x,x);
game.reset();assert(!game.dead);assert.equal(game.absorption,0);game.paused=true;game.step(1,1,0,swarm);assert.equal(game.elapsed,0);
const lone=hunters(1);place(lone,0);lone.step(1/120,{x:5,z:0});lone.scrub(.44);const a=lone.getAnchor(0);
const touching=contacts(lone,a.x,a.z,.2);assert.equal(touching.bodies,0);assert(touching.appendages>0);
const trapped=new EvasionGame();trapped.x=a.x;trapped.z=a.z;trapped.step(.1,1,0,lone);assert.equal(trapped.state,'ENTANGLED');assert(trapped.speed>0&&trapped.speed<.5);
console.log('PASS movement, diagonal normalization, real appendage contacts, grips, death, pause and restart');

const safe=hunters(),recovery=new EvasionGame();recovery.armGrip[0]=.2;recovery.step(.1,0,0,safe);assert(recovery.speed>.25&&recovery.speed<.29,'immediate appendage slowdown');
let physicalSpeed=0;recovery.step(.1,0,0,safe,(_dt,_dx,_dz,speed)=>{physicalSpeed=speed;return {x:0,z:0};});
assert.equal(recovery.appendages,0);assert(recovery.speed>.28&&recovery.speed<.33);assert.equal(physicalSpeed,recovery.speed);
advance(recovery,safe,.9);assert(recovery.speed>.5&&recovery.speed<.65,'recovery remains slow after a second');
recovery.paused=true;const slow=recovery.speed;recovery.step(2,0,0,safe);assert.equal(recovery.speed,slow);recovery.paused=false;
recovery.armGrip[0]=.2;recovery.step(.1,0,0,safe);assert(recovery.speed<=.28,'new contact slows immediately');
advance(recovery,safe,9);assert.equal(recovery.speed,2.1,'recovery reaches full speed');
recovery.bodyGrip[0]=.2;recovery.step(.1,0,0,safe);assert(recovery.speed>.7&&recovery.speed<.76);recovery.step(.1,0,0,safe);assert(recovery.speed>.75&&recovery.speed<.8);
recovery.reset();recovery.step(.1,1,0,safe);assert.equal(recovery.speed,2.1);
console.log('PASS slow recovery reaches the physical gait, pauses, responds to new contact and resets');

const escape=new EvasionGame(),crowd=hunters(2);place(crowd,0,.3);
escape.step(.1,1,0,crowd);assert.equal(escape.bodies,1);assert(escape.speed>.7);
assert(escape.shake(crowd));near(escape.energy,.52,'shake consumes 48% energy');assert(escape.speed<.51,'shake immediately exhausts and slows Reed');assert.equal(escape.bodyGrip[0],0);
assert.equal(escape.cooldown[1],0,'unrelated hunters receive no immunity');assert(!escape.shake(crowd),'shake cooldown prevents spam');
escape.step(.1,1,0,crowd);assert.equal(escape.bodies,0,'brief protection against the released hunter');
place(crowd,1,escape.x);escape.step(.1,0,0,crowd);assert.equal(escape.bodies,1,'a different hunter can grab immediately');
escape.shakeCooldown=0;assert(escape.shake(crowd));assert(escape.overheated);assert(escape.energy<.06);assert(!escape.shake(crowd));
place(crowd,0,8,8);place(crowd,1,8,8);advance(escape,crowd,5);assert(escape.overheated,'exhaustion persists for seconds');advance(escape,crowd,7);assert(!escape.overheated);assert(escape.energy>.65);
const noGrip=new EvasionGame();assert(!noGrip.eat(safe));assert.equal(noGrip.energy,1,'empty-space actions do not waste energy');
noGrip.bodyGrip[0]=1;noGrip.heat=.6;assert(!noGrip.shake(safe),'insufficient energy cannot shake');assert.equal(noGrip.bodyGrip[0],1);
console.log('PASS costly shake, red exhaustion, slow cooling, limited immunity, no spam and insufficient energy');

const eater=new EvasionGame(),food=hunters(2);place(food,0,.3);
assert(!eater.eat(food),'body overlap alone is not centered enough to feed');place(food,0);
assert(eater.eat(food));assert.equal(eater.feedingTarget,0);near(eater.energy,.88,'feeding commitment cost');assert.equal(food.suspended[0],1);
advance(eater,food,2);assert.equal(eater.meals,0);assert.equal(eater.state,'FEEDING');assert.equal(eater.speed,0);assert.equal(eater.y,0,'feeding uses physical lowering instead of floating the entire mesh');
const progress=eater.feedingProgress;eater.paused=true;advance(eater,food,3);assert.equal(eater.feedingProgress,progress);assert(!eater.eat(food));eater.paused=false;
advance(eater,food,3.1);assert.equal(eater.meals,1);assert.equal(eater.consumed[0],1);assert.equal(eater.remaining(food),1);assert.equal(food.suspended[0],1);assert(eater.energy>.99);assert(!eater.won);
assert.equal(contacts(food,eater.x,eater.z,.2,eater.removed).bodies,0,'consumed hunter no longer collides');assert.equal(eater.feedingCandidate(food),-1,'cannot consume twice');
place(food,1,eater.x,eater.z);assert(eater.eat(food));assert.equal(eater.feedingDuration,4.5);advance(eater,food,4.6);assert(eater.won);assert(!eater.dead);assert.equal(eater.state,'APEX');
const victoryTime=eater.elapsed;assert(!eater.eat(food));eater.step(5,1,0,food);assert.equal(eater.elapsed,victoryTime,'victory freezes simulation');
eater.reset();assert(!eater.won);assert.equal(eater.meals,0);assert.equal(eater.feedingTarget,-1);assert(eater.removed.every(v=>v===0));assert.equal(eater.energy,1);
console.log('PASS precise feeding alignment, long exposed commitment, elevation, pause, growth, removal, victory and reset');

const interrupted=new EvasionGame(),ambush=hunters(2);place(ambush,0);assert(interrupted.eat(ambush));advance(interrupted,ambush,2);place(ambush,1);
interrupted.step(.1,0,0,ambush);assert.equal(interrupted.feedingTarget,-1);assert.equal(interrupted.meals,0);assert.equal(interrupted.bodies,2);assert(interrupted.capture>0,'interruption makes the original victim grip back');
const abandoned=new EvasionGame(),solo=hunters(1);place(solo,0);assert(abandoned.eat(solo));advance(abandoned,solo,1);abandoned.step(.1,1,0,solo);assert.equal(abandoned.feedingTarget,-1);assert.equal(abandoned.meals,0);assert.equal(abandoned.bodies,1);
const shaken=new EvasionGame();place(solo,0);assert(shaken.eat(solo));assert(shaken.shake(solo),'Space can shake out of a feed');assert.equal(shaken.feedingTarget,-1);near(shaken.energy,.4,'aborting by shaking pays both costs');assert.equal(shaken.bodyGrip[0],0);
console.log('PASS crowd interruption, movement abandonment and costly feeding escape');

const mature=new EvasionGame(),pack=hunters(4);mature.meals=6;assert.equal(mature.pinThreshold,4);place(pack,0);assert(mature.eat(pack));assert.equal(mature.feedingDuration,2);place(pack,1);place(pack,2);advance(mature,pack,1);
assert.equal(mature.feedingTarget,0,'mature Reed tolerates two outside hunters');near(mature.feedingProgress,.25,'outside hunters double feeding exposure');
place(pack,3);mature.step(.1,0,0,pack);assert.equal(mature.feedingTarget,-1);assert.equal(mature.bodies,4);assert(mature.capture>0,'a crowd still threatens mature Reed');
const resistant=new EvasionGame();resistant.meals=6;resistant.armGrip[0]=1;resistant.step(.1,0,0,safe);assert(resistant.speed>1.15&&resistant.speed<1.2,'late-game appendage resistance');
const rage=new EvasionGame();rage.elapsed=10;assert.equal(rage.huntSpeed,1.18);rage.elapsed=30;assert.equal(rage.huntSpeed,1.54);rage.elapsed=600;near(rage.huntSpeed,1.72,'hunter speed capped for a fair late game');
console.log('PASS late-game faster feeding and grip resistance, remaining crowd danger, capped hunter acceleration');

const falling=new EvasionGame();falling.x=12.1;falling.step(.01,0,0,safe);assert(falling.falling);advance(falling,safe,2);assert(falling.dead);assert.equal(falling.deathReason,'FELL');
const ledge=hunters(1);place(ledge,0,13);const edgeGame=new EvasionGame();edgeGame.step(.1,0,0,ledge);assert.equal(edgeGame.fallen[0],1);assert.equal(ledge.suspended[0],1);assert(ledge.offset[1]<0);assert(edgeGame.won);assert.equal(edgeGame.meals,0,'falls clear enemies but grant no strength');
const doomed=new EvasionGame();doomed.x=12.1;doomed.step(.1,1,0,ledge);assert(doomed.falling);assert(!doomed.won,'falling cannot win even if the last hunter falls');
const feeding=new EvasionGame();feeding.resolve(1.5,{bodies:2,appendages:0});assert(feeding.devouring);for(let i=0;i<3;i++)feeding.resolve(.5,{bodies:2,appendages:0});assert.equal(feeding.legsCut,4);assert(feeding.absorption>0);assert(!feeding.dead);feeding.resolve(2,{bodies:2,appendages:0});assert(feeding.dead);
const struggling=new EvasionGame(),captors=hunters(2);place(captors,0);place(captors,1);advance(struggling,captors,.5,1);assert(struggling.x>0&&struggling.x<=.080001);assert(struggling.speed>0&&struggling.speed<.3);
const formation=Array.from({length:12},(_,i)=>startingHunterPosition(i));assert(formation.every(p=>Math.abs(Math.hypot(p.x,p.z)-6.5)<1e-9));assert(formation.every(p=>p.z>=-3.250001));assert.equal(new Set(formation.map(p=>`${p.x},${p.z}`)).size,12);
console.log('PASS falls, no posthumous victory, staged enemy feeding, restrained struggle and spawn corridor');

const pile=new EvasionGame(),gang=hunters(4);place(gang,0);advance(pile,gang,2);
assert(pile.bodyGrip[0]>3.5,'touching refreshes the grip instead of automatically letting go');
assert(pile.pressure>.45,'being held broadcasts distress');assert(pile.huntSpeed>1.25,'distress accelerates the hunt');
const isolatedSpeed=pile.speed;place(gang,1);place(gang,2);pile.step(.05,1,0,gang);assert(pile.speed<isolatedSpeed,'pile-on suppresses movement');
pile.heat=0;assert(pile.shake(gang));assert.equal(pile.bodies,2,'shake releases one hunter, leaving a crowd holding');assert(pile.bodyGrip.filter(v=>v>0).length===2);
assert(!pile.eat(gang),'being pinned prevents eating as an escape shortcut');
const pressured=new EvasionGame();pressured.pressure=1;const converging=hunters();pressured.advanceHunters(.01,converging);assert(converging.config.separation<.1);assert(converging.config.cohesion>.7);
advance(pressured,safe,1);assert.equal(pressured.pressure,1,'distress persists after escaping contact');advance(pressured,safe,2);assert(pressured.pressure>.9&&pressured.pressure<1);
const sixLegs=new EvasionGame();sixLegs.limbCount=6;sixLegs.resolve(1.1,{bodies:2,appendages:0});sixLegs.resolve(.9,{bodies:2,appendages:0});assert.equal(sixLegs.legsCut,6,'Nih-Dairia loses all six limbs before absorption');
console.log('PASS refreshed grips, distress-driven convergence, escalating restraint, one-hunter shake and six-limb capture');
