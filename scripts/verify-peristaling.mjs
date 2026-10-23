import assert from 'node:assert/strict';
import {Peristaling} from '../src/peristaling/controller.ts';
import {polygonArea,contains} from '../src/cutisling/outline.ts';
import {createCutislingMembrane} from '../src/cutisling/membrane.ts';
const pass=name=>console.log('PASS',name);
const mean=a=>a.reduce((s,v)=>s+v,0)/a.length;
const corr=(a,b)=>{const ma=mean(a),mb=mean(b);let n=0,da=0,db=0;for(let i=0;i<a.length;i++){n+=(a[i]-ma)*(b[i]-mb);da+=(a[i]-ma)**2;db+=(b[i]-mb)**2;}return n/Math.sqrt(da*db||1e-12);};
{
  const travel=(settings={})=>{const c=new Peristaling();Object.assign(c.tuning,settings);c.lure(7,0);c.autoPrey=false;
    const start=mean(c.x);let ribbon=0,waveOk=0,peaksOk=0,samples=0;const factors=new Set();
    for(let i=1;i<=12*60;i++){c.step(1/60);factors.add(Math.round(c.wave.target*20)/20);
      if(i<2*60||i>10*60||i%15)continue;samples++;
      const hx=Math.cos(c.heading),hz=Math.sin(c.heading),cx=mean(c.x),cz=mean(c.z);
      const along=[],across=[],speed=[],phase=[];
      for(let n=0;n<c.count;n++){const dx=c.x[n]-cx,dz=c.z[n]-cz;along.push(dx*hx+dz*hz);across.push(-dx*hz+dz*hx);speed.push(c.vx[n]*hx+c.vz[n]*hz);phase.push(Math.sin(c.phaseOf(n)));}
      const va=mean(along.map(v=>v*v)),vc=mean(across.map(v=>v*v));if(va/vc>=2)ribbon++;
      if(corr(phase,speed)>=.3)waveOk++;
      const lo=Math.min(...along),hi=Math.max(...along),bins=new Array(12).fill(0);for(const v of along)bins[Math.min(11,Math.floor((v-lo)/((hi-lo)||1)*12))]++;
      let peaks=0;for(let b=1;b<11;b++)if(bins[b]>bins[b-1]&&bins[b]>=bins[b+1]&&bins[b]>=1.15*Math.min(bins[b-1],bins[b+1]))peaks++;if(peaks>=2)peaksOk++;
    }
    return {advance:mean(c.x)-start,ribbon:ribbon/samples,waveOk:waveOk/samples,peaksOk:peaksOk/samples,factors:[...factors].sort((a,b)=>a-b),c};};
  const t=travel();
  console.log(`travel ${t.advance.toFixed(2)} m, ribbon ${(t.ribbon*100).toFixed(0)}%, wave-locked ${(t.waveOk*100).toFixed(0)}%, peaks ${(t.peaksOk*100).toFixed(0)}%, factors ${t.factors.join(',')}`);
  assert(t.advance>=2,`ribbon travels (${t.advance.toFixed(2)} m)`);
  assert(t.ribbon>=.7,`body is a ribbon while travelling (${(t.ribbon*100).toFixed(0)} % of samples)`);
  assert(t.waveOk>=.6,`forward speed follows the wave phase (${(t.waveOk*100).toFixed(0)} %)`);
  assert(t.peaksOk>=.5,`density shows travelling peaks (${(t.peaksOk*100).toFixed(0)} %)`);
  assert(t.factors.length>=3&&t.factors[t.factors.length-1]-t.factors[0]>.3,`wave speed targets are randomised (${t.factors.join(', ')})`);
  const glide=travel({grip:0});assert(glide.advance>=t.advance*.8,`grip 0 travels at least as far (${glide.advance.toFixed(2)} vs ${t.advance.toFixed(2)})`);
  for(const settings of [{},{grip:0},{grip:1},{stride:.5},{stride:2},{freedom:.5,turbulence:2}]){const c=new Peristaling();Object.assign(c.tuning,settings);for(let i=1;i<=60*60;i++)c.step(1/60);assert(c.meals>=1,`feeds within 60 s at ${JSON.stringify(settings)}`);}
  pass('peristaling: ribbon body, phase-locked wave, travelling density peaks, randomised speed, travel, feeding');
}
{
  const c=new Peristaling(),m=createCutislingMembrane(c,(x,z)=>c.surfaceLift(x,z),()=>c.opening,(x,z)=>c.floorAt(x,z));
  let splitFor=0,coverSamples=0;
  for(let i=1;i<=90*60;i++){c.step(1/60);if(i%6)continue;m.update();
    const outer=m.boundaries.filter(l=>polygonArea(l)>0);
    if(outer.some(l=>contains(l,c.preyX,c.preyZ))&&outer.length>1)splitFor+=.1;else splitFor=0;assert(splitFor<=.25,`skin split around prey at t=${(i/60).toFixed(1)}`);
    if(c.feeding==='COVER'||c.feeding==='ABSORB'){coverSamples++;const rp=c.preyRadius*c.preyScale,cy=.012+rp;
      for(const mesh of [m.skin,m.rim]){const p=mesh.geometry.attributes.position.array,n=mesh.geometry.drawRange.count*3;for(let k=0;k<n;k+=3){const d=Math.sqrt((p[k]-c.preyX)**2+(p[k+1]-cy)**2+(p[k+2]-c.preyZ)**2);assert(d>=rp+.01-1e-6,`${c.feeding}: vertex inside prey`);}}}}
  assert(coverSamples>0,'cover was observed');assert(c.meals>=1,'the membrane run fed');
  const a=new Peristaling(),b=new Peristaling();for(let i=0;i<15*60;i++){a.step(1/60);b.step(1/60);}
  assert.deepEqual(Array.from(a.x),Array.from(b.x),'deterministic');assert.equal(a.wave.time,b.wave.time);
  a.paused=true;const t0=a.time;a.step(1/60);assert.equal(a.time,t0,'pause');a.paused=false;a.reset();assert.equal(a.wave.time,0);assert.equal(a.wave.cycle,0);
  const t1=performance.now();for(let i=0;i<120;i++){a.step(1/60);a.contours();}console.log(`peristaling update ${((performance.now()-t1)/120).toFixed(2)} ms`);
  pass('peristaling: one body around prey, clearance over prey, determinism, pause, reset, cost');
}
