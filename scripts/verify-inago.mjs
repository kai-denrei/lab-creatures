import assert from 'node:assert/strict';
import {Inago} from '../src/inago/controller.ts';
const advance=(body,seconds)=>{for(let i=0;i<Math.round(seconds*60);i++)body.step(1/60);};
function footprint(body){let x=0,z=0;for(let i=0;i<body.count;i++){x+=body.x[i]/body.count;z+=body.z[i]/body.count;}let variance=0;for(let i=0;i<body.count;i++)variance+=(body.x[i]-x)**2+(body.z[i]-z)**2;return Math.sqrt(variance/body.count);}
const organism=new Inago();assert.equal(organism.count,768);
advance(organism,5);assert.equal(organism.phase,'MOVE');const compact=footprint(organism);assert(Math.hypot(organism.centerX,organism.centerZ)>2,'the body travels across the floor');
advance(organism,5.5);assert.equal(organism.phase,'SPREAD');const spread=footprint(organism);assert(spread>compact*2,'searching fronts visibly spread');
advance(organism,6.5);assert.equal(organism.phase,'COALESCE');const gathered=footprint(organism);assert(gathered<spread*.6,'all fragments gather back into one dense organism');
advance(organism,2);assert.equal(organism.phase,'MOVE');assert.equal(organism.cycle,2);assert.equal(organism.count,768,'no new organisms spawn while splitting');
console.log('PASS repeating travel / spread / coalescence',{compact,spread,gathered});
organism.paused=true;const position=organism.x.slice(),time=organism.time;organism.step(1);assert.deepEqual(organism.x,position);assert.equal(organism.time,time);organism.paused=false;
organism.reset();const copy=new Inago();advance(organism,1);for(let i=0;i<30;i++)copy.step(1/30);assert.deepEqual(organism.x,copy.x,'fixed substeps are independent of caller frame rate');assert.deepEqual(organism.vz,copy.vz);
assert(organism.contactAt(organism.x[0],organism.z[0]).exposure>0);assert.equal(organism.contactAt(100,100).exposure,0);
organism.lure(100,0);assert.equal(organism.target.x,7);advance(organism,10);assert(organism.centerX>6,'one shared stimulus attracts the body');
console.log('PASS pause, deterministic reset, frame-rate-independent steering, contact hooks and shared lure');
for(const settings of [{pace:2,spread:1.4,cohesion:.4},{pace:.3,spread:.5,cohesion:2}]){
  Object.assign(organism,settings);organism.lure(-7,0);advance(organism,25);
  for(let i=0;i<organism.count;i++){
    assert(Number.isFinite(organism.x[i])&&Number.isFinite(organism.z[i])&&Number.isFinite(organism.angle[i]));
    assert(Math.hypot(organism.x[i],organism.z[i])<=10.800001,'fragments stay on the ground arena');
    assert(Math.hypot(organism.vx[i],organism.vz[i])<=2.851,'motion stays speed-bounded');
  }
}
console.log('PASS finite, bounded movement at control extremes');
