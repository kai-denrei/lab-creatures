# Peristaling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Peristaling, a ribbon-bodied membrane organism that crawls with a retrograde peristaltic wave of randomised speed, sharing Cutisling's skin and feeding.

**Architecture:** `Peristaling extends Cutisling` and overrides the per-step locomotion hook and steering. Cutisling's hooks become protected. The Inago page, scene, catalog, router and thumbnail gain a `peristaling` variant.

**Tech Stack:** TypeScript, three.js, Node 24 `--experimental-strip-types` tests.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-10-23-peristaling-design.md`.
- λ = 1.1 m, base period 1.6 s, speed factor `0.55 + 1.05·hash`, stall 0.15 with probability ≈ 0.15, blend 0.3 s. Thrust `c²·3.4`, friction `9·grip·(−c)`, squeeze `2·(−c)`. Ellipse `1.3·radius` by `0.5·radius`.
- Cutisling behaviour unchanged: `npm run test:cutisling` passes without edits to its assertions.
- Commit per task with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.

---

### Task 1: Open Cutisling's hooks

**Files:** `src/cutisling/controller.ts`

- [ ] Rename `prepareMuscles` → `prepareLocomotion` (both definition and the two call sites in `step`).
- [ ] Change `private desiredForce`, `private prepareLocomotion`, `private pin` to `protected`. `steering` is already `protected`.
- [ ] Run `npm run test:cutisling && npm run typecheck && npm run lint`.
- [ ] Commit `Expose Cutisling locomotion hooks for subclasses`.

---

### Task 2: Peristaling controller and tests

**Files:** Create `src/peristaling/controller.ts`, create `scripts/verify-peristaling.mjs`, add `"test:peristaling"` to `package.json`.

**Interfaces produced:** `class Peristaling extends Cutisling { readonly wave:{time:number;factor:number;target:number;cycle:number}; phaseOf(i:number):number; }`.

- [ ] **Test** (`scripts/verify-peristaling.mjs`):

```js
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
    for(let i=1;i<=12*60;i++){c.step(1/60);factors.add(Math.round(c.wave.factor*20)/20);
      if(i<2*60||i>10*60||i%15)continue;samples++;
      const hx=Math.cos(c.heading),hz=Math.sin(c.heading),cx=mean(c.x),cz=mean(c.z);
      const along=[],across=[],speed=[],phase=[];
      for(let n=0;n<c.count;n++){const dx=c.x[n]-cx,dz=c.z[n]-cz;along.push(dx*hx+dz*hz);across.push(-dx*hz+dz*hx);speed.push(c.vx[n]*hx+c.vz[n]*hz);phase.push(Math.sin(c.phaseOf(n)));}
      const va=mean(along.map(v=>v*v)),vc=mean(across.map(v=>v*v));if(va/vc>=2)ribbon++;
      if(corr(phase,speed)>=.3)waveOk++;
      const lo=Math.min(...along),hi=Math.max(...along),bins=new Array(12).fill(0);for(const v of along)bins[Math.min(11,Math.floor((v-lo)/((hi-lo)||1)*12))]++;
      let peaks=0;for(let b=1;b<11;b++)if(bins[b]>bins[b-1]&&bins[b]>=bins[b+1]&&bins[b]>=1.15*Math.min(bins[b-1],bins[b+1]))peaks++;if(peaks>=2)peaksOk++;
    }
    return {advance:mean(c.x)-start,ribbon:ribbon/samples,waveOk:waveOk/samples,peaksOk:peaksOk/samples,factors:[...factors].sort(),c};};
  const t=travel();
  assert(t.advance>=2,`ribbon travels (${t.advance.toFixed(2)} m)`);
  assert(t.ribbon>=.7,`body is a ribbon while travelling (${(t.ribbon*100).toFixed(0)} % of samples)`);
  assert(t.waveOk>=.6,`forward speed follows the wave phase (${(t.waveOk*100).toFixed(0)} %)`);
  assert(t.peaksOk>=.5,`density shows travelling peaks (${(t.peaksOk*100).toFixed(0)} %)`);
  const distinct=t.factors.filter((f,i,a)=>i===0||f-a[i-1]>.1).length;
  assert(distinct>=3,`wave speed is randomised (${t.factors.join(', ')})`);
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
  assert(coverSamples>0,'cover was observed');assert(c.meals>=1);
  const a=new Peristaling(),b=new Peristaling();for(let i=0;i<15*60;i++){a.step(1/60);b.step(1/60);}
  assert.deepEqual(Array.from(a.x),Array.from(b.x),'deterministic');assert.equal(a.wave.time,b.wave.time);
  a.paused=true;const t0=a.time;a.step(1/60);assert.equal(a.time,t0,'pause');a.paused=false;a.reset();assert.equal(a.wave.time,0);assert.equal(a.wave.cycle,0);
  const t1=performance.now();for(let i=0;i<120;i++){a.step(1/60);a.contours();}console.log(`peristaling update ${((performance.now()-t1)/120).toFixed(2)} ms`);
  pass('peristaling: one body around prey, clearance over prey, determinism, pause, reset, cost');
}
```

- [ ] **Implement** `src/peristaling/controller.ts`:

```ts
import {Cutisling} from '../cutisling/controller.ts';
const hash=(n:number)=>{const v=Math.sin(n*61.7+211.3)*43758.5453;return v-Math.floor(v);};
const WAVELENGTH=1.1,BASE_PERIOD=1.6;
/** A ribbon that crawls with a retrograde peristaltic wave; feeding, skin and prey come from Cutisling. */
export class Peristaling extends Cutisling{
  readonly wave={time:0,factor:1,target:1,cycle:0};
  private readonly thrustX=new Float64Array(256);
  private readonly thrustZ=new Float64Array(256);
  private readonly along=new Float64Array(256);
  private readonly across=new Float64Array(256);
  private waveFrac=0;
  reset(){super.reset();if(this.wave){this.wave.time=0;this.wave.factor=1;this.wave.target=1;this.wave.cycle=0;}this.waveFrac=0;}
  phaseOf(i:number){return Math.PI*2*this.along[i]/WAVELENGTH+this.wave.time;}
  protected prepareLocomotion(h:number){
    let cx=0,cz=0;for(let i=0;i<this.count;i++){cx+=this.x[i];cz+=this.z[i];}cx/=this.count;cz/=this.count;
    this.centerX=cx;this.centerZ=cz;
    const hx=Math.cos(this.heading),hz=Math.sin(this.heading);
    for(let i=0;i<this.count;i++){
      const dx=this.x[i]-cx,dz=this.z[i]-cz;this.along[i]=dx*hx+dz*hz;this.across[i]=-dx*hz+dz*hx;
      if(!this.locked){const t=this.target??{x:this.preyX,z:this.preyZ},tx=t.x-this.x[i],tz=t.z-this.z[i],d=Math.hypot(tx,tz)||.001;this.thrustX[i]=tx/d;this.thrustZ[i]=tz/d;}
      else{const [fx,fz]=this.desiredForce(i,this.x[i],this.z[i]);const f=Math.hypot(fx,fz)||.001,scale=Math.min(1,f/3);this.thrustX[i]=fx/f*scale;this.thrustZ[i]=fz/f*scale;}
    }
    // Randomised wave speed: a new factor each cycle, blended so it never steps; some cycles nearly stall.
    const w=this.wave,rate=Math.PI*2/(BASE_PERIOD*Math.max(.1,this.tuning.stride));
    w.factor+=(w.target-w.factor)*(1-Math.exp(-h/.3));
    w.time+=rate*w.factor*h;this.waveFrac+=rate*w.factor*h/(Math.PI*2);
    if(this.waveFrac>=1){this.waveFrac-=1;w.cycle++;w.target=hash(w.cycle*3)<.15?.15:.55+1.05*hash(w.cycle);}
  }
  protected steering(i:number,x:number,z:number){
    if(!this.tuning.hunting)return null;
    const grip=this.tuning.grip,c=Math.sin(this.phaseOf(i)),vx=this.vx[i],vz=this.vz[i];
    const dx=x-this.preyX,dz=z-this.preyZ,r=Math.hypot(dx,dz)||.001,rim=this.hollowAt(Math.atan2(dz,dx));
    const exclusion=!this.sealed?Math.max(0,rim+.25-r)*24:0;
    let ax=dx/r*exclusion,az=dz/r*exclusion;
    if(!this.locked){
      // Elliptical cohesion keeps the ribbon.
      const a=this.radius*1.3,b=this.radius*.5,rho=Math.hypot(this.along[i]/a,this.across[i]/b);
      if(rho>1){const cx=x-this.centerX,cz=z-this.centerZ,rc=Math.hypot(cx,cz)||.001,pull=(rho-1)*3;ax-=cx/rc*pull;az-=cz/rc*pull;}
    }
    const hx=Math.cos(this.heading),hz=Math.sin(this.heading);
    if(grip<.05||c>0){const power=grip<.05?1.4:c*c*3.4;ax+=this.thrustX[i]*power;az+=this.thrustZ[i]*power;}
    else{
      const k=-c,friction=9*grip*k,squeeze=2*k*this.across[i];
      ax+=-vx*friction+hz*squeeze;az+=-vz*friction-hx*squeeze;
    }
    return {blend:1,x:ax,z:az};
  }
  protected pin(){/* The wave anchors with friction, never with pins. */}
}
```

- [ ] `package.json`: `"test:peristaling": "node --experimental-strip-types scripts/verify-peristaling.mjs"`.
- [ ] Run `npm run test:peristaling`; tune in order: thrust 3.4 → 4.5, ellipse pull 3 → 5, friction 9 → 7.
- [ ] Commit `Add Peristaling: a ribbon crawling on a randomised peristaltic wave`.

---

### Task 3: Page, scene, panel labels, route, catalog, thumbnail, README

**Files:** `src/inago/page.ts`, `src/inago/scene.ts`, `src/inago/style.css`, `src/cutisling/panel.ts`, `src/main.ts`, `src/catalog/specimens.ts`, `src/catalog/thumbnail.ts`, `README.md`, `public/thumbnails/peristaling.png`.

- [ ] `scene.ts`: `variant:'inago'|'cutisling'|'peristaling'`, `organism = variant==='peristaling'?new Peristaling():variant==='cutisling'?new Cutisling():new Inago()`; aria label mentions the variant.
- [ ] `page.ts`: `const specimen=params.get('specimen'); const cutisling=specimen==='cutisling'||specimen==='peristaling', peristaling=specimen==='peristaling', name=peristaling?'Peristaling':cutisling?'Cutisling':'Inago'`; add `peristaling-page` class; eyebrow/tagline/instructions per spec; `createInagoScene(host, peristaling?'peristaling':cutisling?'cutisling':'inago')`; HUD HUNT text per spec when peristaling; panel labels `{stride:{label:'Wave rhythm',hint:'Period of the travelling contraction.'},grip:{label:'Anchor grip',hint:'Friction of contracted bands. Zero glides.'}}`.
- [ ] `panel.ts`: fourth parameter `labels:Partial<Record<'stride'|'grip',{label:string;hint:string}>>={}` applied when rendering the controls.
- [ ] `style.css`: `.peristaling-page .inago-header h1 span,.peristaling-page .inago-cycle .active{color:#7fa8a0}.peristaling-page .inago-status{border-top-color:#7fa8a0}.peristaling-page .inago-status progress::-webkit-progress-value,.peristaling-page .inago-settings input{accent-color:#7fa8a0;background:#7fa8a0}`.
- [ ] `main.ts`: `specimen==='inago'||specimen==='cutisling'||specimen==='peristaling'`.
- [ ] `specimens.ts`: insert before Cutisling v2: `{id:'peristaling',name:'Peristaling',family:'Collectives',description:'A ribbon of living skin that crawls on a travelling contraction. The wave speeds, slows and sometimes stalls, then it surrounds and swallows prey.',url:'?specimen=peristaling'}`.
- [ ] `thumbnail.ts`: include `peristaling` in the Inago/Cutisling branch, stepping 660 frames.
- [ ] Render `public/thumbnails/peristaling.png` with the headless recipe; README section after Cutisling v2.
- [ ] Full checks, commit `Add the Peristaling card, page and docs`, push.
