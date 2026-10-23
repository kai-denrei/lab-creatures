# Cutisling v1 Strides Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Cutisling v1's glide with anchor-and-drag strides: three lateral muscle bands that reach, plant, haul and release on staggered clocks, with heavy ground friction between contractions.

**Architecture:** A pure `Muscles` class owns band clocks, band assignment and grip state. The controller computes each driver's desired force per substep, gates it by the driver's band stage, adds friction, pins gripped drivers after the step, and lets the flock centre follow the centroid. The field skin is untouched.

**Tech Stack:** TypeScript (ES2023, `erasableSyntaxOnly`), Node 24 `--experimental-strip-types` for `scripts/verify-cutisling.mjs`.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-10-23-cutisling-v1-strides-design.md`.
- Bands: 3, by lateral offset across the heading, centre band `|lateral| < 0.3·radius`. Base periods 1.05 / 0.9 / 1.25 s, offsets 0 / 0.37 / 0.71, re-seeded per stride `base·(0.85+0.3·hash)`. Stages: reach < 0.3, plant < 0.4, haul < 0.85, release.
- Friction `−v·8·grip` added to Inago's own `−v·1.6`. Grip < 0.05 means no gating, no pinning.
- New settings `stride` (0.5–2, default 1) and `grip` (0–1, default 0.85).
- Hollow exclusion and cohesion are never gated. Hunt-prey-off mode is unchanged (Inago's glide).
- `npm run test:cutisling`, `npm run test:inago`, `npm run typecheck`, `npm run lint` must pass. Commit per task with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.

---

### Task 1: Muscles module, settings, panel

**Files:**
- Create: `src/cutisling/muscles.ts`
- Modify: `src/cutisling/settings.ts`, `src/cutisling/panel.ts`
- Append section F part 1 to `scripts/verify-cutisling.mjs`

**Interfaces (produced):**

```ts
export type Stage='reach'|'plant'|'haul'|'release';
export class Muscles{
  constructor(count:number);
  readonly phase:Float64Array; readonly period:Float64Array;   // per band
  readonly band:Uint8Array; readonly gripped:Uint8Array; readonly gripBand:Uint8Array; readonly gripX:Float64Array; readonly gripZ:Float64Array;
  reset():void; advance(dt:number,rhythm:number):void; stage(k:number):Stage;
  assign(x:Float64Array,z:Float64Array,cx:number,cz:number,hx:number,hz:number,width:number):void;
  grip(i:number,x:number,z:number):void; release(k:number):void;
}
```

- [ ] **Step 1: failing test** — append:

```js
import {Muscles} from '../src/cutisling/muscles.ts';
// ---- F. strides -------------------------------------------------------------
{
  const m=new Muscles(4);
  assert.deepEqual(Array.from(m.phase).map(p=>p.toFixed(2)),['0.00','0.37','0.71'],'bands start staggered');
  assert.equal(m.stage(0),'reach');assert.equal(m.stage(1),'plant');assert.equal(m.stage(2),'haul');
  const periods=[];for(let i=0;i<400;i++){m.advance(1/60,1);if(m.phase[0]<1/60/m.period[0])periods.push(m.period[0]);}
  assert(periods.length>=3&&new Set(periods.map(p=>p.toFixed(3))).size>=2,'stride periods are re-seeded each stride');
  for(const p of periods)assert(p>=1.05*.85-1e-9&&p<=1.05*1.15+1e-9,'periods stay within ±15 % of the base');
  m.assign(Float64Array.from([-1,0,1,0]),Float64Array.from([0,0,0,2]),0,0,0,1,.3);
  assert.deepEqual(Array.from(m.band),[0,1,2,1],'bands follow the lateral offset across the heading');
  m.grip(2,1,0);assert.equal(m.gripped[2],1);assert.equal(m.gripBand[2],2);m.release(1);assert.equal(m.gripped[2],1);m.release(2);assert.equal(m.gripped[2],0);
  m.reset();assert.equal(m.phase[1],.37);assert.equal(m.gripped[2],0);
  pass('muscles: staggered clocks, re-seeded periods, band assignment, grip bookkeeping');
}
```

- [ ] **Step 2: run** → fails: cannot find `muscles.ts`.

- [ ] **Step 3: implement** `src/cutisling/muscles.ts`:

```ts
const hash=(n:number)=>{const v=Math.sin(n*127.1+311.7)*43758.5453;return v-Math.floor(v);};
export type Stage='reach'|'plant'|'haul'|'release';
export const BANDS=3;
const BASE=[1.05,.9,1.25],OFFSET=[0,.37,.71];
/** Three lateral muscle bands with staggered stride clocks; drivers grip the ground between contractions. */
export class Muscles{
  readonly phase=new Float64Array(BANDS);
  readonly period=new Float64Array(BANDS);
  private readonly strides=new Int32Array(BANDS);
  readonly band:Uint8Array;readonly gripped:Uint8Array;readonly gripBand:Uint8Array;readonly gripX:Float64Array;readonly gripZ:Float64Array;
  constructor(count:number){this.band=new Uint8Array(count);this.gripped=new Uint8Array(count);this.gripBand=new Uint8Array(count);this.gripX=new Float64Array(count);this.gripZ=new Float64Array(count);this.reset();}
  reset(){for(let k=0;k<BANDS;k++){this.phase[k]=OFFSET[k];this.period[k]=BASE[k];}this.strides.fill(0);this.gripped.fill(0);this.band.fill(1);}
  advance(dt:number,rhythm:number){
    for(let k=0;k<BANDS;k++){
      this.phase[k]+=dt/(this.period[k]*Math.max(.1,rhythm));
      if(this.phase[k]>=1){this.phase[k]-=1;this.strides[k]++;this.period[k]=BASE[k]*(.85+.3*hash(this.strides[k]*7+k));}
    }
  }
  stage(k:number):Stage{const p=this.phase[k];return p<.3?'reach':p<.4?'plant':p<.85?'haul':'release';}
  /** Bands by lateral offset from the centroid across the heading (hx,hz). */
  assign(x:Float64Array,z:Float64Array,cx:number,cz:number,hx:number,hz:number,width:number){
    for(let i=0;i<this.band.length;i++){const lateral=-(x[i]-cx)*hz+(z[i]-cz)*hx;this.band[i]=lateral<-width?2:lateral>width?0:1;}
  }
  grip(i:number,x:number,z:number){if(this.gripped[i])return;this.gripped[i]=1;this.gripBand[i]=this.band[i];this.gripX[i]=x;this.gripZ[i]=z;}
  release(k:number){for(let i=0;i<this.gripped.length;i++)if(this.gripped[i]&&this.gripBand[i]===k)this.gripped[i]=0;}
}
```

(Band 0 is the right-hand side when looking along the heading, since lateral is measured with `(−hz, hx)`; the test fixes the convention.)

- [ ] **Step 4: settings** — add to `CUTISLING_DEFAULTS` after `swirl:1,`: `stride:1,` and `grip:.85,`.

- [ ] **Step 5: panel** — in the `Flock motion` group append:

```ts
    {key:'stride',label:'Stride rhythm',min:.5,max:2,step:.05,hint:'Period of each muscle band’s reach, plant and haul cycle.'},
    {key:'grip',label:'Grip',min:0,max:1,step:.05,hint:'Ground friction and pinning between contractions. Zero glides like before.'},
```

- [ ] **Step 6: run** `npm run test:cutisling` (section F passes), `npm run typecheck`, `npm run lint`.

- [ ] **Step 7: commit** `Add Cutisling muscle bands with stride clocks and grip settings`.

---

### Task 2: Gated steering, friction, pinning, centroid-following centre

**Files:**
- Modify: `src/cutisling/controller.ts`
- Append section F part 2 to `scripts/verify-cutisling.mjs`

**Interfaces:**
- Consumes `Muscles` (Task 1).
- Produces on `Cutisling`: `readonly muscles:Muscles`; `desiredForce(i,x,z)` (private), `steering` now returns `{blend:1,x,z}` in every hunting state including HUNT.

- [ ] **Step 1: failing test** — append:

```js
{
  const travel=(grip)=>{const c=new Cutisling();c.tuning.grip=grip;c.lure(7,0);c.autoPrey=false;
    const start=c.x.reduce((a,b)=>a+b)/c.count;let still=0,total=0;
    for(let i=1;i<=12*60;i++){c.step(1/60);if(i%6)continue;for(let n=0;n<c.count;n++){total++;if(Math.hypot(c.vx[n],c.vz[n])<.05)still++;}}
    return {advance:c.x.reduce((a,b)=>a+b)/c.count-start,stillFraction:still/total,c};};
  const gripped=travel(.85),glide=travel(0);
  assert(gripped.advance>=2,`gripping body still travels (${gripped.advance.toFixed(2)} m)`);
  assert(gripped.stillFraction>=.4,`most drivers hold the ground at any moment (${(gripped.stillFraction*100).toFixed(0)} %)`);
  assert(glide.stillFraction<.1,`grip 0 glides (${(glide.stillFraction*100).toFixed(0)} % still)`);
  assert(glide.advance>=gripped.advance*.8,'grip 0 travels at least as far');
  const c=new Cutisling();c.lure(7,0);c.autoPrey=false;let pinnedChecks=0;
  for(let i=1;i<=20*60;i++){c.step(1/60);for(let n=0;n<c.count;n++)if(c.muscles.gripped[n]){pinnedChecks++;assert(Math.hypot(c.x[n]-c.muscles.gripX[n],c.z[n]-c.muscles.gripZ[n])<1e-3,'gripped drivers stay pinned');}}
  assert(pinnedChecks>1000,`drivers were gripped during travel (${pinnedChecks} checks)`);
  const run=(settings)=>{const c=new Cutisling();Object.assign(c.tuning,settings);for(let i=1;i<=60*60;i++)c.step(1/60);return c.meals;};
  for(const settings of [{stride:.5},{stride:2},{grip:1},{grip:0},{grip:1,freedom:.5,turbulence:2}])assert(run(settings)>=1,`feeds within 60 s at ${JSON.stringify(settings)}`);
  const a=new Cutisling(),b=new Cutisling();for(let i=0;i<15*60;i++){a.step(1/60);b.step(1/60);}
  assert.deepEqual(Array.from(a.x),Array.from(b.x),'strides are deterministic');
  assert.deepEqual(Array.from(a.muscles.phase),Array.from(b.muscles.phase));
  a.reset();assert.equal(a.muscles.phase[0],0);assert.equal(a.muscles.gripped.reduce((s,v)=>s+v,0),0,'reset releases every grip');
  pass('strides: anchored travel, pinned grips, feeding under stride and grip extremes, determinism, reset');
}
```

- [ ] **Step 2: run** → fails (`c.muscles` undefined / stillFraction low).

- [ ] **Step 3: implement** in `src/cutisling/controller.ts`:

Imports: add `import {Muscles} from './muscles.ts';`.

Fields (after `readonly skin=...`):

```ts
  readonly muscles=new Muscles(256);
  private readonly desiredX=new Float64Array(256);
  private readonly desiredZ=new Float64Array(256);
  private readonly leading=new Uint8Array(256);
  private readonly bandSum=new Float64Array(9);   // per band: along sum, |F| sum, count
  private readonly gripCentroid=new Float64Array(9); // per band: x sum, z sum, count
```

`reset()`: append `this.muscles.reset();`.

Replace `steering(...)` with a force builder plus a gate:

```ts
  /** Behaviour force before muscles: where this driver wants to go right now. Exclusion is added separately. */
  private desiredForce(i:number,x:number,z:number):[number,number]{
    const dx=x-this.preyX,dz=z-this.preyZ,r=Math.hypot(dx,dz)||.001,theta=Math.atan2(dz,dx),squeeze=this.squeeze();
    const turbulence=this.tuning.turbulence*(1-.7*squeeze);
    const wave=Math.sin(this.time*1.7+dx*2.3+Math.sin(dz*1.8))*turbulence,eddy=Math.sin(this.time*.9+dz*2-dx)*turbulence;
    const rim=this.hollowAt(theta);
    if(!this.locked){
      const t=this.target!,tx=t.x-x,tz=t.z-z,d=Math.hypot(tx,tz)||.001,ux=tx/d,uz=tz/d;
      return [ux*3.2-uz*.4*this.tuning.swirl+eddy*.5,uz*3.2+ux*.4*this.tuning.swirl+wave*.5];
    }
    const sector=Math.floor((theta+Math.PI)/(Math.PI*2)*48)%48,behind=this.sectors[(sector+46)%48]+this.sectors[(sector+47)%48],ahead=this.sectors[(sector+1)%48]+this.sectors[(sector+2)%48];
    const crowded=Math.max(0,Math.min(1,(this.sectors[sector]-5)/6));
    const spread=crowded*Math.max(-1,Math.min(1,(behind-ahead)/8))*(this.feeding==='FAN_OUT'?1:1.4+1.6*squeeze);
    if(this.feeding==='FAN_OUT'){
      const rear=Math.atan2(-this.approachZ,-this.approachX),open=(55+95*smooth(this.feedingTime/4.5))*Math.PI/180;
      const angle=rear+(this.flankSeed[i]-.5)*2*open,reach=rim+.45+this.reachSeed[i]*.7;
      const hx=this.preyX+Math.cos(angle)*reach,hz=this.preyZ+Math.sin(angle)*reach;
      const ux=x-hx,uz=z-hz,d=Math.hypot(ux,uz)||.001,pull=Math.max(0,d-.35)*2.6;
      return [-ux/d*pull-uz/d*(.9+wave*.6)-dz/r*spread+eddy*.8,-uz/d*pull+ux/d*(.9+wave*.6)+dx/r*spread+wave*.8];
    }
    const closing=this.feeding==='ENCIRCLE',covering=this.feeding==='COVER';
    const extent=closing?3.25-2.15*smooth(this.feedingTime/6)-.2*squeeze:covering?.35:1.2;
    const desired=extent*(1+.27*Math.sin(theta*2+this.time*.31)+.14*Math.sin(theta*3-this.time*.43)),pull=Math.max(0,r-desired)*(4+4*squeeze)*this.cohesion;
    const curl=(1.25+wave*.8+Math.sin(theta*2-this.time*.52)*.55)*this.tuning.swirl*(1-.5*squeeze);
    const toGap=Math.atan2(Math.sin(this.gapAngle-theta),Math.cos(this.gapAngle-theta)),gapPull=closing&&Math.abs(toGap)<Math.PI/3?Math.sign(toGap)*squeeze*2.2:0;
    return [-dx/r*pull-dz/r*(curl+gapPull+spread)+eddy*.9,-dz/r*pull+dx/r*(curl+gapPull+spread)+wave*.9];
  }
  /** Per-substep muscle bookkeeping: bands, desired forces, leading drivers, grips and releases. */
  private prepareMuscles(h:number){
    let cx=0,cz=0;for(let i=0;i<this.count;i++){cx+=this.x[i];cz+=this.z[i];}cx/=this.count;cz/=this.count;
    this.centerX=cx;this.centerZ=cz;
    const hx=Math.cos(this.heading),hz=Math.sin(this.heading);
    this.muscles.assign(this.x,this.z,cx,cz,hx,hz,this.radius*.3);
    this.bandSum.fill(0);
    for(let i=0;i<this.count;i++){
      const [fx,fz]=this.desiredForce(i,this.x[i],this.z[i]);this.desiredX[i]=fx;this.desiredZ[i]=fz;
      const k=this.muscles.band[i]*3,along=(this.x[i]-cx)*hx+(this.z[i]-cz)*hz;
      this.bandSum[k]+=along;this.bandSum[k+1]+=Math.hypot(fx,fz);this.bandSum[k+2]++;
    }
    for(let i=0;i<this.count;i++){
      const k=this.muscles.band[i]*3,n=this.bandSum[k+2]||1;
      this.leading[i]=(!this.locked?(this.x[i]-cx)*hx+(this.z[i]-cz)*hz>this.bandSum[k]/n:Math.hypot(this.desiredX[i],this.desiredZ[i])>this.bandSum[k+1]/n)?1:0;
    }
    const gripping=this.tuning.grip>=.05;
    for(let k=0;k<3;k++){const stage=this.muscles.stage(k);if(stage==='release'||!gripping)this.muscles.release(k);}
    if(gripping)for(let i=0;i<this.count;i++){const k=this.muscles.band[i];if(this.leading[i]&&this.muscles.stage(k)==='plant')this.muscles.grip(i,this.x[i],this.z[i]);}
    this.gripCentroid.fill(0);
    for(let i=0;i<this.count;i++)if(this.muscles.gripped[i]){const k=this.muscles.gripBand[i]*3;this.gripCentroid[k]+=this.muscles.gripX[i];this.gripCentroid[k+1]+=this.muscles.gripZ[i];this.gripCentroid[k+2]++;}
    this.muscles.advance(h,this.tuning.stride);
  }
  protected steering(i:number,x:number,z:number){
    if(!this.locked&&!this.tuning.hunting)return null;
    const grip=this.tuning.grip,fx=this.desiredX[i],fz=this.desiredZ[i],vx=this.vx[i],vz=this.vz[i];
    // Never gated: the hollow is a wall, and the body stays one mass.
    const dx=x-this.preyX,dz=z-this.preyZ,r=Math.hypot(dx,dz)||.001,rim=this.hollowAt(Math.atan2(dz,dx));
    const exclusion=!this.sealed?Math.max(0,rim+.25-r)*24:0;
    const cx=x-this.centerX,cz=z-this.centerZ,rc=Math.hypot(cx,cz)||.001,extent=this.radius*(.75+.25*this.seed[i]),cohesion=!this.locked?Math.max(0,rc-extent)*1.5:0;
    let ax=dx/r*exclusion-cx/rc*cohesion,az=dz/r*exclusion-cz/rc*cohesion;
    if(grip<.05)return {blend:1,x:ax+fx,z:az+fz};
    const k=this.muscles.band[i],stage=this.muscles.stage(k),lead=this.leading[i]===1,held=this.muscles.gripped[i]===1;
    const friction=8*grip,freedom=this.tuning.freedom;
    let power=0,haulX=0,haulZ=0;
    if(held)power=0;
    else if(stage==='reach')power=lead?1.6:freedom;
    else if(stage==='haul'){power=lead?freedom:1;const g=this.gripCentroid,kk=this.muscles.band[i]*3;if(!lead&&g[kk+2]>0){const gx=g[kk]/g[kk+2]-x,gz=g[kk+1]/g[kk+2]-z;haulX=gx*3.5*grip;haulZ=gz*3.5*grip;}}
    else power=stage==='plant'?freedom*.5:0;
    ax+=fx*power+haulX-vx*friction*(1-power);az+=fz*power+haulZ-vz*friction*(1-power);
    return {blend:1,x:ax,z:az};
  }
```

In `step()`, both branches: call `this.prepareMuscles(h);` immediately before `super.step(h/this.pace);`, and after `this.avoidPrey(h);` add `this.pin();` where:

```ts
  private pin(){
    if(this.tuning.grip<.05)return;
    const m=this.muscles;
    for(let i=0;i<this.count;i++)if(m.gripped[i]){this.x[i]=m.gripX[i];this.z[i]=m.gripZ[i];this.vx[i]=0;this.vz[i]=0;}
  }
```

Order in each branch: `prepareMuscles(h)` → `super.step(h/this.pace)` → `pin()` → `avoidPrey(h)` → for gripped drivers that `avoidPrey` moved, refresh `gripX/gripZ` (inside `avoidPrey`'s loop: after moving driver `i`, `if(this.muscles.gripped[i]){this.muscles.gripX[i]=this.x[i];this.muscles.gripZ[i]=this.z[i];}`).

Remove the old `steering` body, the `squeeze`-dependent code stays. `flankSeed`, `reachSeed`, `sectors`, `gapAngle` are still used by `desiredForce`.

- [ ] **Step 4: run** `npm run test:cutisling`; tune if needed in this order: reach gain 1.6 → 2.2, haul 3.5 → 5, friction 8 → 6. Then `npm run typecheck && npm run lint && npm run test:inago`.

- [ ] **Step 5: commit** `Make Cutisling anchor and haul itself through muscle bands`.

---

### Task 3: HUD, README, visual check, push

- [ ] **Step 1:** `src/inago/page.ts` HUNT description → `'A moving lure draws the gripping, hauling membrane across the ground.'`.
- [ ] **Step 2:** README v1 section: after the Feeding paragraph add:

```markdown
Movement is anchor-and-drag rather than glide. Three lateral muscle bands run staggered stride clocks (about 0.9–1.3 s, re-seeded each stride). In each band the leading drivers reach, then plant and grip the ground, then the trailing drivers are hauled toward the planted front while it holds; between contractions every driver sits under heavy ground friction. The flock centre follows the drivers instead of advancing on its own, so all travel comes from strides, including the crescent and the tightening ring. **Stride rhythm** scales the clocks and **Grip** scales friction and pinning; Grip 0 restores the earlier glide for comparison.
```
Also extend the test paragraph with "strides (anchored travel, pinned grips, feeding under stride and grip extremes)".
- [ ] **Step 3:** full checks: `npm run test:cutisling && npm run test:inago && npm run typecheck && npm run lint && npm run build`.
- [ ] **Step 4:** headless screenshots of `?specimen=cutisling` at 3, 5, 8, 12 s; look for lunging lobes and a held rear.
- [ ] **Step 5:** commit `Document Cutisling strides` and `git push origin main`.

## Self-review

- Spec §bands/clocks → Task 1; §driver forces, friction, centre → Task 2; §settings/panel → Task 1; §HUD/docs → Task 3; §verification → sections F (Tasks 1–2) plus existing A–E.
- Names consistent: `Muscles.gripBand`, `stage()`, `assign()`, `grip()`, `release()`; controller `prepareMuscles`, `desiredForce`, `pin`, `leading`, `gripCentroid`.
