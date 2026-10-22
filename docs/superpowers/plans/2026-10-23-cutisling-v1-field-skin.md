# Cutisling v1 Field Skin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Cutisling v1's carved radial envelope with a density-field skin, make phagocytosis always complete, and stop the skin splitting, looking geometric, or clipping the prey. Also add a dev-only build badge.

**Architecture:** The controller owns a `FieldSkin` (driver kernels splatted on a 0.1 m grid, a prey hollow mask, per-cell temporal filters) and a marching-squares tracer that yields oriented loops. `membrane.ts` consumes those loops with its existing triangulation and rim code. Feeding gains a crescent fan-out, an escalating squeeze, a contour-based closure test and a hard cap.

**Tech Stack:** TypeScript (ES2023, `erasableSyntaxOnly`, no `enum`/parameter properties), three.js r17x, Vite 8, Node 24 with `--experimental-strip-types` for `scripts/verify-*.mjs`.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-10-23-cutisling-v1-field-skin-design.md`.
- Grid: cell 0.1 m, extent −12…12 m, 241 nodes per axis. Iso value 1.
- Kernel `(1−(d/R)²)²`, amplitude 0.75, `R = (0.64 − 0.26·edgeDetail)·clamp(body.radius/1.9, 1, 2.2)`.
- Hollow base radius 0.68 m, noise amplitude `0.16·mouthDetail/0.7`, mask width 0.24 m. Hole mask radius never below `1.05·preyRadius·preyScale`.
- Encircle: squeeze `smooth((t−4)/10)`, dwell 0.4 s, hard cap 22 s.
- Clearance: cap roof ≥ sphere surface + 0.025 m; tessellation edge 0.07 m within `preyRadius+0.3` of the prey.
- Setting keys, ranges and `panel.ts` unchanged. `tsconfig` has `noUnusedLocals`, `noUnusedParameters`, `verbatimModuleSyntax`.
- Tests: `npm run test:cutisling` (= `node --experimental-strip-types scripts/verify-cutisling.mjs`). Also `npm run typecheck`, `npm run lint`, `npm run test:inago` must stay green.
- Commit after every task with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.

---

## File map

| File | Responsibility |
|---|---|
| `vite.config.ts` (modify) | define `__BUILD_ID__` from git at server start |
| `src/vite-env.d.ts` (create) | declare `__BUILD_ID__` |
| `src/main.ts` (modify) | append `.dev-build` badge in dev mode |
| `src/landing.css` (modify) | badge style |
| `src/cutisling/contour.ts` (create) | `traceContours`: marching squares → oriented loops |
| `src/cutisling/field.ts` (create) | `FieldSkin`: splat, hollow carve, blur, temporal filter, cached contours |
| `src/cutisling/controller.ts` (rewrite feeding) | hollow noise, crescent fan-out, squeeze, `enclosed()`, cap, `skin` |
| `src/cutisling/membrane.ts` (modify) | consume `FieldSkin` loops, clearance lift, lip floor, finer facets |
| `src/cutisling/outline.ts` (shrink) | keep `Point`, `Opening`, `polygonArea`, `contains`; delete carve code |
| `src/cutisling/envelope.ts` (delete) | superseded by `field.ts` |
| `src/inago/page.ts` (modify) | ENCIRCLE HUD text |
| `scripts/verify-cutisling.mjs` (rewrite) | sections per task |
| `README.md` (modify) | v1 section |

---

### Task 1: Dev build badge

**Files:**
- Modify: `vite.config.ts`
- Create: `src/vite-env.d.ts`
- Modify: `src/main.ts`
- Modify: `src/landing.css`

**Interfaces:**
- Produces: global `__BUILD_ID__: string` like `a2198ae* 23:41` (short sha, `*` when the tree is dirty, server start time).

- [ ] **Step 1: vite config**

```ts
import { execSync } from 'node:child_process';
import { defineConfig } from 'vite';

function buildId(){
  try{
    const sha=execSync('git rev-parse --short HEAD',{encoding:'utf8'}).trim();
    const dirty=execSync('git status --porcelain',{encoding:'utf8'}).trim()?'*':'';
    const started=new Date().toTimeString().slice(0,5);
    return `${sha}${dirty} ${started}`;
  }catch{return 'no-git';}
}

export default defineConfig({base:'./',define:{__BUILD_ID__:JSON.stringify(buildId())}});
```

- [ ] **Step 2: declaration** `src/vite-env.d.ts`:

```ts
/// <reference types="vite/client" />
declare const __BUILD_ID__:string;
```

- [ ] **Step 3: badge** in `src/main.ts`, after the imports and before `openPage`:

```ts
if(import.meta.env.DEV){const badge=document.createElement('div');badge.className='dev-build';badge.textContent=`dev ${__BUILD_ID__}`;badge.title='Local development build: commit, dirty marker, server start time';document.body.append(badge);}
```

- [ ] **Step 4: style** appended to `src/landing.css`:

```css
.dev-build{position:fixed;left:8px;bottom:6px;z-index:99;padding:3px 7px;border-radius:3px;background:#0008;color:#e8e3d1;font:10px/1.4 ui-monospace,monospace;letter-spacing:.04em;pointer-events:none}
```

- [ ] **Step 5: verify** `npm run typecheck && npm run lint`, then `curl -s http://localhost:5174/` serves; the badge text is checked in the browser later. Expected: both commands exit 0.

- [ ] **Step 6: commit** `git add vite.config.ts src/vite-env.d.ts src/main.ts src/landing.css && git commit -m "Show commit and start time badge in local dev builds"`.

---

### Task 2: Contour tracer

**Files:**
- Create: `src/cutisling/contour.ts`
- Rewrite: `scripts/verify-cutisling.mjs` (section A only; later tasks append sections)

**Interfaces:**
- Produces: `traceContours(values:Float32Array, nodes:number, iso:number, cell:number, half:number, minArea?:number):Point[][]` — node `(i,j)` has value `values[j*nodes+i]` at `x=i·cell−half, z=j·cell−half`. Outer loops have positive `polygonArea`, holes negative. Each loop is smoothed once.

- [ ] **Step 1: failing test** — replace `scripts/verify-cutisling.mjs` with:

```js
import assert from 'node:assert/strict';
import {polygonArea,contains} from '../src/cutisling/outline.ts';
import {traceContours} from '../src/cutisling/contour.ts';
const pass=name=>console.log('PASS',name);
// ---- A. contour tracer -------------------------------------------------------
{
  const nodes=61,cell=.1,half=3,values=new Float32Array(nodes*nodes);
  const set=(fn)=>{for(let j=0;j<nodes;j++)for(let i=0;i<nodes;i++)values[j*nodes+i]=fn(i*cell-half,j*cell-half);};
  set((x,z)=>2*Math.exp(-(x*x+z*z)/.8));
  let loops=traceContours(values,nodes,1,cell,half);
  assert.equal(loops.length,1,'one blob gives one loop');
  assert(polygonArea(loops[0])>0,'outer loop is counterclockwise');
  const r=Math.sqrt(.8*Math.log(2));
  assert(Math.abs(polygonArea(loops[0])-Math.PI*r*r)<.06,'loop area matches the analytic disc');
  assert(contains(loops[0],0,0),'the loop encloses the blob centre');
  set((x,z)=>{const d=Math.hypot(x,z);return d<1.5?2:0;});
  for(let j=0;j<nodes;j++)for(let i=0;i<nodes;i++){const x=i*cell-half,z=j*cell-half;if(Math.hypot(x,z)<.6)values[j*nodes+i]=0;}
  loops=traceContours(values,nodes,1,cell,half);
  assert.equal(loops.length,2,'a ring gives an outer loop and a hole');
  const outer=loops.find(l=>polygonArea(l)>0),hole=loops.find(l=>polygonArea(l)<0);
  assert(outer&&hole,'orientation distinguishes outer loop from hole');
  assert(contains(outer,hole[0][0],hole[0][1]),'the hole lies inside the outer loop');
  set((x,z)=>Math.max(2*Math.exp(-((x-1.2)**2+z*z)/.3),2*Math.exp(-((x+1.2)**2+z*z)/.3)));
  loops=traceContours(values,nodes,1,cell,half);
  assert.equal(loops.length,2,'two separated blobs give two outer loops');
  set((x,z)=>Math.hypot(x-2.8,z-2.8)<.05?2:0);
  assert.equal(traceContours(values,nodes,1,cell,half).length,0,'specks below the minimum area are dropped');
  for(const loop of loops)for(let i=0;i<loop.length;i++){const p=loop[i],q=loop[(i+1)%loop.length];assert(Math.hypot(q[0]-p[0],q[1]-p[1])<.3,'consecutive points stay close');}
  pass('marching squares: orientation, holes, separation, speck removal');
}
```

- [ ] **Step 2: run** `npm run test:cutisling`. Expected: fails with `Cannot find module '../src/cutisling/contour.ts'`.

- [ ] **Step 3: implement** `src/cutisling/contour.ts`:

```ts
import type {Point} from './outline.ts';
import {polygonArea} from './outline.ts';
/**
 * Marching squares at `iso`. Walks each crossing with the interior (≥ iso) on its
 * left, so outer loops come out counterclockwise (positive area) and holes clockwise.
 * Edge ids: horizontal edge from node (i,j) to (i+1,j) is 2·(j·nodes+i); vertical edge
 * from (i,j) to (i,j+1) is that plus one.
 */
export function traceContours(values:Float32Array,nodes:number,iso:number,cell:number,half:number,minArea=.02):Point[][]{
  const next=new Int32Array(nodes*nodes*2).fill(-1);
  const at=(i:number,j:number)=>values[j*nodes+i];
  let used=0;
  for(let j=0;j<nodes-1;j++)for(let i=0;i<nodes-1;i++){
    const a=at(i,j)>=iso,b=at(i+1,j)>=iso,c=at(i+1,j+1)>=iso,d=at(i,j+1)>=iso;
    const code=(a?1:0)|(b?2:0)|(c?4:0)|(d?8:0);
    if(code===0||code===15)continue;
    const B=(j*nodes+i)*2,R=(j*nodes+i+1)*2+1,T=((j+1)*nodes+i)*2,L=(j*nodes+i)*2+1;
    used++;
    switch(code){
      case 1:next[B]=L;break;case 2:next[R]=B;break;case 4:next[T]=R;break;case 8:next[L]=T;break;
      case 3:next[R]=L;break;case 6:next[T]=B;break;case 12:next[L]=R;break;case 9:next[B]=T;break;
      case 14:next[L]=B;break;case 13:next[B]=R;break;case 11:next[R]=T;break;case 7:next[T]=L;break;
      case 5:{const centre=(at(i,j)+at(i+1,j)+at(i+1,j+1)+at(i,j+1))*.25>=iso;if(centre){next[B]=R;next[T]=L;}else{next[B]=L;next[T]=R;}break;}
      case 10:{const centre=(at(i,j)+at(i+1,j)+at(i+1,j+1)+at(i,j+1))*.25>=iso;if(centre){next[L]=B;next[R]=T;}else{next[R]=B;next[L]=T;}break;}
    }
  }
  if(used===0)return [];
  const point=(edge:number):Point=>{
    const node=edge>>1,i=node%nodes,j=(node-i)/nodes,f0=values[node];
    if((edge&1)===0){const f1=values[node+1],t=(iso-f0)/((f1-f0)||1e-9);return [(i+Math.max(0,Math.min(1,t)))*cell-half,j*cell-half];}
    const f1=values[node+nodes],t=(iso-f0)/((f1-f0)||1e-9);return [i*cell-half,(j+Math.max(0,Math.min(1,t)))*cell-half];
  };
  const loops:Point[][]=[];
  for(let start=0;start<next.length;start++){
    if(next[start]<0)continue;
    const loop:Point[]=[];let edge=start;
    for(let guard=0;guard<next.length&&edge>=0;guard++){
      loop.push(point(edge));const following=next[edge];next[edge]=-1;edge=following;
      if(edge===start)break;
    }
    if(edge!==start||loop.length<4)continue;
    // One smoothing pass removes the grid staircase without leaving the cell band.
    const smoothed=loop.map((p,k):Point=>{const q=loop[(k+loop.length-1)%loop.length],r=loop[(k+1)%loop.length];return [(q[0]+2*p[0]+r[0])*.25,(q[1]+2*p[1]+r[1])*.25];});
    if(Math.abs(polygonArea(smoothed))>=minArea)loops.push(smoothed);
  }
  return loops;
}
```

- [ ] **Step 4: run** `npm run test:cutisling`. Expected: `PASS marching squares: ...`.

- [ ] **Step 5: commit** `git add src/cutisling/contour.ts scripts/verify-cutisling.mjs && git commit -m "Add marching-squares contour tracer for Cutisling"`.

---

### Task 3: Field skin

**Files:**
- Create: `src/cutisling/field.ts`
- Modify: `src/cutisling/outline.ts` — extend `Opening`
- Append section B to `scripts/verify-cutisling.mjs`

**Interfaces:**
- Consumes: `traceContours` (Task 2).
- Produces:

```ts
export interface SkinSource{readonly count:number;readonly x:Float64Array;readonly z:Float64Array;readonly time:number;readonly radius:number;}
export interface Hollow{x:number;z:number;radiusAt:(theta:number)=>number;strength:number;cover:number;coverRadius:number;}
export class FieldSkin{
  constructor(body:SkinSource,settings:CutislingSettings);
  contours(hollow?:Hollow|null):Point[][];   // cached per body.time + settings signature
  readonly value:Float32Array;              // filtered field, 241×241, for tests
}
```
- `Opening` in `outline.ts` becomes `{x,z,radius,coverage,preyRadius,preyScale,time?,detail?,pressure?}` (`gapX/gapZ/gapWidth` removed).

- [ ] **Step 1: failing test** — append to `scripts/verify-cutisling.mjs`:

```js
import {Inago} from '../src/inago/controller.ts';
import {FieldSkin} from '../src/cutisling/field.ts';
import {CUTISLING_DEFAULTS} from '../src/cutisling/settings.ts';
// ---- B. field skin ----------------------------------------------------------
{
  const body=new Inago(),skin=new FieldSkin(body,{...CUTISLING_DEFAULTS});
  let loops=skin.contours();
  assert.equal(loops.length,1,'the resting flock is one continuous skin');
  assert(polygonArea(loops[0])>3&&polygonArea(loops[0])<14,'resting skin area is plausible for a 1.3 m flock');
  assert(contains(loops[0],body.centerX,body.centerZ),'skin encloses the flock centre');
  assert.equal(skin.contours(),loops,'same time returns the cached loops');
  let spreadArea=0,contractedArea=0,maxLoops=0;
  for(let i=1;i<=18*60;i++){body.step(1/60);const l=skin.contours();maxLoops=Math.max(maxLoops,l.filter(x=>polygonArea(x)>0).length);if(i===10.5*60)spreadArea=l.reduce((s,x)=>s+polygonArea(x),0);if(i===17*60)contractedArea=l.reduce((s,x)=>s+polygonArea(x),0);}
  assert(spreadArea>contractedArea*1.6,'the skin spreads with the flock and contracts again');
  assert(maxLoops<=3,'free roaming never shatters into more than three pieces');
  const hollow={x:body.centerX,z:body.centerZ,radiusAt:()=>.68,strength:1,cover:0,coverRadius:.9};
  body.step(1/60);loops=skin.contours(hollow);
  assert(loops.some(l=>polygonArea(l)<0),'a full-strength hollow cuts a hole');
  const hole=loops.find(l=>polygonArea(l)<0);
  for(const p of hole)assert(Math.hypot(p[0]-hollow.x,p[1]-hollow.z)>.5,'the hole keeps the prey clearance');
  body.step(1/60);loops=skin.contours({...hollow,strength:0,cover:1});
  assert(!loops.some(l=>polygonArea(l)<0),'a faded hollow with full cover closes the hole');
  const approaches={};
  for(const approach of ['flock','elastic','viscous']){
    const b=new Inago(),s=new FieldSkin(b,{...CUTISLING_DEFAULTS,approach});
    for(let i=0;i<8*60;i++){b.step(1/60);s.contours();}
    approaches[approach]=Float32Array.from(s.value);
  }
  const diff=(a,b)=>{let d=0;for(let i=0;i<a.length;i++)d+=Math.abs(a[i]-b[i]);return d;};
  assert(diff(approaches.flock,approaches.viscous)>50&&diff(approaches.flock,approaches.elastic)>50,'the three approaches respond differently to the same flock');
  const tense=new FieldSkin(new Inago(),{...CUTISLING_DEFAULTS,tension:1}),slack=new FieldSkin(new Inago(),{...CUTISLING_DEFAULTS,tension:0});
  const perimeter=l=>l.reduce((s,p,i)=>s+Math.hypot(p[0]-l[(i+1)%l.length][0],p[1]-l[(i+1)%l.length][1]),0);
  assert(perimeter(tense.contours()[0])<perimeter(slack.contours()[0]),'tension smooths the outline');
  pass('field skin: continuous skin, spread/contract, hollow, cover, approaches, tension');
}
```

- [ ] **Step 2: run** `npm run test:cutisling`. Expected: fails with `Cannot find module '../src/cutisling/field.ts'`.

- [ ] **Step 3: implement** `src/cutisling/field.ts`:

```ts
import type {Point} from './outline.ts';
import {traceContours} from './contour.ts';
import type {CutislingSettings} from './settings.ts';
export const CELL=.1,HALF=12,NODES=241;
export interface SkinSource{readonly count:number;readonly x:Float64Array;readonly z:Float64Array;readonly time:number;readonly radius:number;}
/** Prey hollow: a multiplicative mask of `strength` inside `radiusAt(θ)`, plus a guaranteed cover disc once feeding closes. */
export interface Hollow{x:number;z:number;radiusAt:(theta:number)=>number;strength:number;cover:number;coverRadius:number;}
const smoothstep=(t:number)=>{const u=Math.max(0,Math.min(1,t));return u*u*(3-2*u);};
/** Driver kernels splatted on a fixed grid; the skin is the iso-line at 1. */
export class FieldSkin{
  readonly target=new Float32Array(NODES*NODES);
  readonly value=new Float32Array(NODES*NODES);
  private readonly velocity=new Float32Array(NODES*NODES);
  private readonly scratch=new Float32Array(NODES*NODES);
  private readonly body:SkinSource;
  private readonly settings:CutislingSettings;
  private lastTime=-Infinity;
  private lastConfig='';
  private loops:Point[][]=[];
  private i0=0;private i1=0;private j0=0;private j1=0;
  constructor(body:SkinSource,settings:CutislingSettings){this.body=body;this.settings=settings;}
  contours(hollow:Hollow|null=null):Point[][]{
    const config=`${this.settings.approach}|${this.settings.viscosity}|${this.settings.tension}|${this.settings.edgeDetail}`;
    if(this.body.time===this.lastTime&&config===this.lastConfig)return this.loops;
    const dt=this.body.time-this.lastTime,reset=!(dt>0&&dt<=.25)||config!==this.lastConfig;
    this.lastTime=this.body.time;this.lastConfig=config;
    this.splat();if(hollow)this.carve(hollow);this.blur(Math.round(this.settings.tension*5));this.relax(dt,reset);
    this.loops=traceContours(this.value,NODES,1,CELL,HALF);
    return this.loops;
  }
  private splat(){
    const {body,settings,target}=this;
    const radius=(.64-.26*settings.edgeDetail)*Math.max(1,Math.min(2.2,body.radius/1.9)),amplitude=.75,cells=Math.ceil(radius/CELL);
    target.fill(0);
    let i0=NODES,i1=-1,j0=NODES,j1=-1;
    for(let n=0;n<body.count;n++){
      const x=body.x[n],z=body.z[n],ci=Math.round((x+HALF)/CELL),cj=Math.round((z+HALF)/CELL);
      const ia=Math.max(0,ci-cells),ib=Math.min(NODES-1,ci+cells),ja=Math.max(0,cj-cells),jb=Math.min(NODES-1,cj+cells);
      if(ia<i0)i0=ia;if(ib>i1)i1=ib;if(ja<j0)j0=ja;if(jb>j1)j1=jb;
      for(let j=ja;j<=jb;j++){const dz=j*CELL-HALF-z;for(let i=ia;i<=ib;i++){const dx=i*CELL-HALF-x,q=(dx*dx+dz*dz)/(radius*radius);if(q<1){const w=1-q;target[j*NODES+i]+=amplitude*w*w;}}}
    }
    this.i0=Math.max(0,i0-1);this.i1=Math.min(NODES-1,i1+1);this.j0=Math.max(0,j0-1);this.j1=Math.min(NODES-1,j1+1);
  }
  private carve(h:Hollow){
    const reach=Math.max(h.coverRadius+.5,1.2),cells=Math.ceil(reach/CELL),ci=Math.round((h.x+HALF)/CELL),cj=Math.round((h.z+HALF)/CELL);
    const ia=Math.max(0,ci-cells),ib=Math.min(NODES-1,ci+cells),ja=Math.max(0,cj-cells),jb=Math.min(NODES-1,cj+cells);
    this.i0=Math.min(this.i0,ia);this.i1=Math.max(this.i1,ib);this.j0=Math.min(this.j0,ja);this.j1=Math.max(this.j1,jb);
    for(let j=ja;j<=jb;j++){const dz=j*CELL-HALF-h.z;for(let i=ia;i<=ib;i++){
      const dx=i*CELL-HALF-h.x,d=Math.hypot(dx,dz),k=j*NODES+i;
      let f=this.target[k];
      if(h.strength>0){const mask=1-smoothstep((d-h.radiusAt(Math.atan2(dz,dx)))/.24+.5);f*=1-h.strength*mask;}
      if(h.cover>0)f+=h.cover*2*(1-smoothstep((d-h.coverRadius)/.3+.5));
      this.target[k]=f;
    }}
  }
  private blur(passes:number){
    const {target,scratch}=this;
    for(let pass=0;pass<passes;pass++){
      for(let j=this.j0;j<=this.j1;j++)for(let i=this.i0;i<=this.i1;i++){
        const k=j*NODES+i,l=i>0?k-1:k,r=i<NODES-1?k+1:k;scratch[k]=(target[l]+2*target[k]+target[r])*.25;
      }
      for(let j=this.j0;j<=this.j1;j++)for(let i=this.i0;i<=this.i1;i++){
        const k=j*NODES+i,u=j>0?k-NODES:k,d=j<NODES-1?k+NODES:k;target[k]=(scratch[u]+2*scratch[k]+scratch[d])*.25;
      }
    }
  }
  private relax(dt:number,reset:boolean){
    const {target,value,velocity,settings}=this;
    if(reset){value.set(target);velocity.fill(0);return;}
    if(settings.approach==='elastic'){
      const k=40+60*settings.tension,c=4+12*settings.viscosity;
      for(let n=0;n<value.length;n++){velocity[n]+=((target[n]-value[n])*k-velocity[n]*c)*dt;value[n]+=velocity[n]*dt;}
    }else{
      const tau=settings.approach==='viscous'?.15+.6*settings.viscosity:.04+.08*settings.viscosity,a=1-Math.exp(-dt/tau);
      for(let n=0;n<value.length;n++)value[n]+=(target[n]-value[n])*a;
    }
  }
}
```

- [ ] **Step 4: update `Opening`** in `src/cutisling/outline.ts` (interface only; carve functions are deleted in Task 5):

```ts
export interface Opening{x:number;z:number;radius:number;coverage:number;preyRadius:number;preyScale:number;time?:number;detail?:number;pressure?:Float64Array}
```

- [ ] **Step 5: run** `npm run test:cutisling`. Expected: `PASS field skin: ...`. If `maxLoops<=3` fails, raise kernel scaling `2.2` toward `2.6` and re-run; record the final number in the Global Constraints line.

- [ ] **Step 6: commit** `git add src/cutisling/field.ts src/cutisling/outline.ts scripts/verify-cutisling.mjs && git commit -m "Add Cutisling field skin with hollow carve and temporal filters"`.

---

### Task 4: Feeding behavior on the field skin

**Files:**
- Rewrite: `src/cutisling/controller.ts`
- Append section C to `scripts/verify-cutisling.mjs`

**Interfaces:**
- Consumes: `FieldSkin`, `Hollow` (Task 3).
- Produces on `Cutisling`: `readonly skin:FieldSkin`; `contours():Point[][]` (passes the current hollow); `hollowAt(theta:number):number`; `holeRadius():number`; `enclosed():boolean`; `get opening():Opening`; `surfaceLift(x,z)`; `floorAt(x,z):number` (height of the prey sphere's surface + 0.015 at the point, else 0.012); `feeding`, `feedingTime`, `meals`, `autoPrey`, `preyX/Z`, `preyRadius`, `coverage`, `preyScale`, `feedingProgress`, `locked`, `sealed`, `mouthPressure`, `tuning`, `lure()`, `reset()`, `step()` unchanged in meaning.

- [ ] **Step 1: failing test** — append:

```js
import {Cutisling} from '../src/cutisling/controller.ts';
// ---- C. feeding behavior ----------------------------------------------------
{
  const run=(settings={},seconds=60)=>{const c=new Cutisling();Object.assign(c.tuning,settings);let splitFor=0,worst=0,longestEncircle=0;
    for(let i=1;i<=seconds*60;i++){c.step(1/60);
      if(c.feeding==='ENCIRCLE')longestEncircle=Math.max(longestEncircle,c.feedingTime);
      if(i%6===0&&c.tuning.hunting){const loops=c.contours(),outer=loops.filter(l=>polygonArea(l)>0),inside=outer.filter(l=>contains(l,c.preyX,c.preyZ));
        if(inside.length&&outer.length>1){splitFor+=.1;worst=Math.max(worst,outer.length);}else splitFor=0;
        assert(splitFor<=.25,`skin stayed split ${splitFor.toFixed(1)} s around prey (${worst} pieces) at t=${(i/60).toFixed(1)} feeding=${c.feeding}`);}
    }
    return {meals:c.meals,longestEncircle,c};};
  const base=run();
  assert(base.meals>=1,`defaults feed at least once in 60 s (got ${base.meals})`);
  assert(base.longestEncircle<=22.05,'encircle never exceeds the hard cap');
  const long=run({},180);
  assert(long.meals>=3,`defaults feed three times in 180 s (got ${long.meals})`);
  for(const settings of [{freedom:.5,turbulence:2},{freedom:0,turbulence:0,swirl:.2},{approach:'viscous',viscosity:1},{approach:'elastic',tension:1},{mouthDetail:1.4,edgeDetail:1},{mouthDetail:0,edgeDetail:0}]){
    const r=run(settings);assert(r.meals>=1,`feeds within 60 s at ${JSON.stringify(settings)} (got ${r.meals})`);
  }
  const c=new Cutisling();
  for(let i=0;i<60*60&&c.feeding!=='COVER';i++)c.step(1/60);
  assert.equal(c.feeding,'COVER','reaches cover');
  assert(c.enclosed(),'cover begins only once the skin encloses the prey');
  const o=c.opening;assert(o.radius>=1.05*c.preyRadius-1e-9,'the hole never shrinks below the prey');
  for(let k=0;k<5;k++){const theta=k/5*Math.PI*2;assert(Math.abs(c.hollowAt(theta)-.68)<.68*.2);}
  const radii=Array.from({length:36},(_,k)=>c.hollowAt(k/36*Math.PI*2)),mean=radii.reduce((a,b)=>a+b)/36,cv=Math.sqrt(radii.reduce((a,r)=>a+(r-mean)**2,0)/36)/mean;
  assert(cv>=.03,'the hollow radius is irregular around the prey');
  const free=new Cutisling();free.tuning.hunting=false;for(let i=0;i<10*60;i++)free.step(1/60);assert.equal(free.feeding,'HUNT');assert.equal(free.meals,0);
  const a=new Cutisling(),b=new Cutisling();for(let i=0;i<20*60;i++){a.step(1/60);b.step(1/60);}
  assert.deepEqual(Array.from(a.x),Array.from(b.x),'stepping is deterministic');
  a.paused=true;const before=a.time;a.step(1/60);assert.equal(a.time,before,'pause freezes the organism');a.paused=false;a.reset();assert.equal(a.feeding,'HUNT');assert.equal(a.time,0);
  pass('feeding: completes under defaults and extremes, one body around prey, hard cap, irregular hollow, determinism, pause, reset');
}
```

- [ ] **Step 2: run** `npm run test:cutisling`. Expected: fails (`c.contours is not a function` or a meals assertion).

- [ ] **Step 3: rewrite** `src/cutisling/controller.ts`:

```ts
import { Inago } from '../inago/controller.ts';
import {CUTISLING_DEFAULTS} from './settings.ts';
import {FieldSkin} from './field.ts';
import type {Hollow} from './field.ts';
import type {Opening,Point} from './outline.ts';
import {contains,polygonArea} from './outline.ts';
const smooth=(v:number)=>{const t=Math.max(0,Math.min(1,v));return t*t*(3-2*t);};
const hash=(n:number)=>{const v=Math.sin(n*311.7+74.3)*43758.5453;return v-Math.floor(v);};
export type CutislingFeeding='HUNT'|'FAN_OUT'|'ENCIRCLE'|'COVER'|'ABSORB'|'RECOVER';
const ENCIRCLE_CAP=22,CLOSURE_DWELL=.4;
/** The prey freezes where caught; the distributed body must surround it before covering. */
export class Cutisling extends Inago{
  readonly tuning={...CUTISLING_DEFAULTS};
  readonly mouthPressure=new Float64Array(24);
  readonly skin=new FieldSkin(this,this.tuning);
  // Invisible tissue drivers: local flock motion without hundreds of rendered bodies.
  override get count(){return 256;}
  private readonly flankSeed=Float64Array.from({length:256},(_,i)=>hash(i+3));
  private gapAngle=Math.PI/2;
  private gapTarget=Math.PI/2;
  private lastGapCheck=-Infinity;
  feeding:CutislingFeeding='HUNT';feedingTime=0;meals=0;autoPrey=true;
  approachX=0;approachZ=1;
  sealed=false;
  private closureDwell=0;
  private lastLoopCheck=-Infinity;
  private loopResult=false;
  readonly hollowRadius=.68;
  preyX=2.1;preyZ=2.2;readonly preyRadius=.24;
  get locked(){return this.feeding!=='HUNT';}
  get coverage(){return this.feeding==='COVER'?smooth(this.feedingTime/this.tuning.engulfTime):this.feeding==='ABSORB'?1:this.feeding==='RECOVER'?1-smooth(this.feedingTime/1.2):0;}
  get preyScale(){return this.feeding==='RECOVER'?0:this.feeding==='ABSORB'?1-smooth((this.feedingTime/2.5-.2)/.8):1;}
  get feedingProgress(){return this.feeding==='FAN_OUT'?Math.min(.15,this.feedingTime/4.5*.15):this.feeding==='ENCIRCLE'?.15+Math.min(.15,this.feedingTime/ENCIRCLE_CAP*.15):this.feeding==='COVER'?.3+.3*this.coverage:this.feeding==='ABSORB'?.6+.3*Math.min(1,this.feedingTime/2.5):this.feeding==='RECOVER'?.9+.1*Math.min(1,this.feedingTime/1.2):0;}
  reset(){super.reset();this.feeding='HUNT';this.feedingTime=0;this.meals=0;this.autoPrey=true;this.preyX=2.1;this.preyZ=2.2;this.approachX=0;this.approachZ=1;this.sealed=false;this.closureDwell=0;this.lastLoopCheck=-Infinity;this.loopResult=false;this.gapAngle=Math.PI/2;this.gapTarget=Math.PI/2;this.lastGapCheck=-Infinity;this.mouthPressure?.fill(0);}
  lure(x:number,z:number){if(this.locked)return;super.lure(x,z);this.autoPrey=false;this.preyX=this.target!.x;this.preyZ=this.target!.z;}
  /** Irregular, drifting hollow boundary: three harmonics, never a circle. */
  hollowAt(theta:number){
    const amplitude=.16*this.tuning.mouthDetail/.7,t=this.time;
    return this.hollowRadius*(1+amplitude*(.5*Math.sin(2*theta+.31*t)+.33*Math.sin(3*theta-.47*t+1.7)+.17*Math.sin(5*theta+.23*t+4.1)));
  }
  /** Hole mask radius: shrinks with coverage but never below the rendered prey. */
  holeRadius(){return Math.max(1.05*this.preyRadius*Math.max(this.preyScale,.001),this.hollowRadius*(1-.6*this.coverage));}
  private hollow():Hollow|null{
    if(!this.tuning.hunting||!this.locked&&this.preyScale===0)return null;
    const coverage=this.coverage,scale=this.holeRadius()/this.hollowRadius;
    return {x:this.preyX,z:this.preyZ,radiusAt:theta=>this.hollowAt(theta)*scale,strength:this.locked?1-smooth((coverage-.6)/.4):0,cover:this.locked?smooth(coverage/.8):0,coverRadius:this.hollowRadius+.2};
  }
  contours():Point[][]{return this.skin.contours(this.hollow());}
  /** Closure: exactly one outer loop contains the prey centre. A horseshoe does not. */
  enclosed(){const outer=this.contours().filter(l=>polygonArea(l)>0&&contains(l,this.preyX,this.preyZ));return outer.length===1;}
  surfaceLift(x:number,z:number){
    if(this.coverage===0)return 0;
    const r2=(x-this.preyX)**2+(z-this.preyZ)**2,c=smooth(this.coverage/.65)*(.25+.75*this.preyScale),rp=this.preyRadius*this.preyScale;
    const gaussian=.5*Math.exp(-r2/.16),clearance=rp+Math.sqrt(Math.max(0,rp*rp-r2))-this.tuning.thickness+.025;
    return c*Math.max(gaussian,clearance);
  }
  /** Lowest permitted tissue height above the prey sphere at a point. */
  floorAt(x:number,z:number){
    const rp=this.preyRadius*this.preyScale,r2=(x-this.preyX)**2+(z-this.preyZ)**2;
    if(this.preyScale===0||r2>=rp*rp)return .012;
    return .012+rp+Math.sqrt(rp*rp-r2)+.015;
  }
  private updateOpening(dt:number){
    // Sample vacant sectors at 10 Hz: pressure feeds the HUD, the gap angle steers the squeeze.
    if(this.time-this.lastGapCheck>=.1||this.time<this.lastGapCheck){
      this.lastGapCheck=this.time;
      const sectors=new Uint16Array(48),tau=Math.PI*2;
      for(let i=0;i<this.count;i++){
        const x=this.x[i]-this.preyX,z=this.z[i]-this.preyZ;
        if(x*x+z*z<2.4**2)sectors[Math.floor((Math.atan2(z,x)+Math.PI)/tau*48)%48]++;
      }
      for(let i=0;i<24;i++){
        const density=sectors[i*2]+sectors[i*2+1];
        this.mouthPressure[i]+=(Math.max(-1,Math.min(1,(density-5)/8))-this.mouthPressure[i])*.22;
      }
      let longest=0,start=0;
      for(let i=0;i<48;i++)if(sectors[i]===0){let n=1;while(n<48&&sectors[(i+n)%48]===0)n++;if(n>longest){longest=n;start=i;}}
      if(longest>0&&longest<48)this.gapTarget=(start+longest*.5)/48*tau-Math.PI;
    }
    const blend=1-Math.exp(-dt*3);
    this.gapAngle+=Math.atan2(Math.sin(this.gapTarget-this.gapAngle),Math.cos(this.gapTarget-this.gapAngle))*blend;
  }
  get opening():Opening{
    return {x:this.preyX,z:this.preyZ,radius:this.holeRadius(),coverage:this.coverage,preyRadius:this.preyRadius,preyScale:this.preyScale,time:this.time,detail:this.tuning.mouthDetail,pressure:this.mouthPressure};
  }
  private squeeze(){return this.feeding==='ENCIRCLE'?smooth((this.feedingTime-4)/10):0;}
  protected steering(i:number,x:number,z:number){
    if(!this.locked)return null;
    const dx=x-this.preyX,dz=z-this.preyZ,r=Math.hypot(dx,dz)||.001,theta=Math.atan2(dz,dx),squeeze=this.squeeze();
    const turbulence=this.tuning.turbulence*(1-.7*squeeze);
    const wave=Math.sin(this.time*1.7+dx*2.3+Math.sin(dz*1.8))*turbulence,eddy=Math.sin(this.time*.9+dz*2-dx)*turbulence;
    const freedom=this.tuning.freedom*(1-.8*squeeze),blend=1-freedom*(this.feeding==='FAN_OUT'?.25:1);
    const rim=this.hollowAt(theta);
    if(this.feeding==='FAN_OUT'){
      // A crescent behind the prey that widens into a horseshoe: always one connected band.
      const rear=Math.atan2(-this.approachZ,-this.approachX),open=(70+80*smooth(this.feedingTime/4.5))*Math.PI/180;
      const seed=this.flankSeed[i],angle=rear+(seed-.5)*2*open,reach=rim+.5+hash(i+77)*.9;
      const hx=this.preyX+Math.cos(angle)*reach,hz=this.preyZ+Math.sin(angle)*reach;
      const ux=x-hx,uz=z-hz,d=Math.hypot(ux,uz)||.001,pull=Math.max(0,d-.35)*2.6;
      const avoid=Math.max(0,rim+.25-r)*24;
      return {blend,x:-ux/d*pull-uz/d*(.9+wave*.6)+eddy*.8+dx/r*avoid,z:-uz/d*pull+ux/d*(.9+wave*.6)+wave*.8+dz/r*avoid};
    }
    const closing=this.feeding==='ENCIRCLE',covering=this.feeding==='COVER';
    const extent=closing?3.25-2.15*smooth(this.feedingTime/6)-.2*squeeze:covering?.35:1.2;
    const desired=extent*(1+.27*Math.sin(theta*2+this.time*.31)+.14*Math.sin(theta*3-this.time*.43)),pull=Math.max(0,r-desired)*(4+4*squeeze)*this.cohesion;
    const exclusion=!this.sealed?Math.max(0,rim+.25-r)*24:0;
    const curl=(1.25+wave*.8+Math.sin(theta*2-this.time*.52)*.55)*this.tuning.swirl*(1-.5*squeeze);
    // Drivers within 60° of the open sector drift toward its centre so the last gap closes from both sides.
    const toGap=Math.atan2(Math.sin(this.gapAngle-theta),Math.cos(this.gapAngle-theta)),gapPull=closing&&Math.abs(toGap)<Math.PI/3?Math.sign(toGap)*squeeze*2.2:0;
    return {blend,x:dx/r*(exclusion-pull)-dz/r*(curl+gapPull)+eddy*.9,z:dz/r*(exclusion-pull)+dx/r*(curl+gapPull)+wave*.9};
  }
  private avoidPrey(dt:number){
    // The unsealed hollow is a soft contact boundary with a hard clamp inside it.
    if(this.sealed)return;
    for(let i=0;i<this.count;i++){
      const x=this.x[i]-this.preyX,z=this.z[i]-this.preyZ,r=Math.hypot(x,z),theta=Math.atan2(z,x),rim=this.hollowAt(theta);
      if(r>=rim)continue;
      const nx=r>1e-6?x/r:Math.cos(this.seed[i]*Math.PI*2),nz=r>1e-6?z/r:Math.sin(this.seed[i]*Math.PI*2);
      const push=(rim-r)*Math.min(1,dt*18);
      let target=r+push;if(target<rim*.85)target=rim*.85;
      this.x[i]=this.preyX+nx*target;this.z[i]=this.preyZ+nz*target;
      const inward=this.vx[i]*nx+this.vz[i]*nz;if(inward<0){this.vx[i]-=inward*nx;this.vz[i]-=inward*nz;}
    }
  }
  step(dt:number){
    if(this.paused||dt<=0)return;
    if(!this.tuning.hunting){this.feeding='HUNT';this.feedingTime=0;this.sealed=false;this.closureDwell=0;this.loopResult=false;this.target=null;super.step(dt);return;}
    let remaining=Math.min(dt,.25)*this.pace;
    while(remaining>1e-9){const h=Math.min(1/60,remaining);remaining-=h;
      if(!this.locked){
        if(this.autoPrey){const tx=2.8*Math.sin(this.time*.13+.8+this.meals*1.9),tz=2.6*Math.cos(this.time*.11+.5+this.meals*1.3);this.preyX+=(tx-this.preyX)*(1-Math.exp(-h*.8));this.preyZ+=(tz-this.preyZ)*(1-Math.exp(-h*.8));}
        this.target={x:this.preyX,z:this.preyZ};super.step(h/this.pace);
        this.avoidPrey(h);
        const dx=this.preyX-this.centerX,dz=this.preyZ-this.centerZ,distance=Math.hypot(dx,dz);
        if(distance<4.8){this.approachX=dx/(distance||1);this.approachZ=dz/(distance||1);this.feeding='FAN_OUT';this.feedingTime=0;this.gapAngle=Math.atan2(this.approachZ,this.approachX);this.gapTarget=this.gapAngle;}
      }else{
        this.feedingTime+=h;
        this.target={x:this.preyX,z:this.preyZ};super.step(h/this.pace);this.avoidPrey(h);
        if(this.feeding==='FAN_OUT'&&this.feedingTime>=4.5){this.feeding='ENCIRCLE';this.feedingTime=0;}
        else if(this.feeding==='ENCIRCLE'){
          if(this.time-this.lastLoopCheck>=.1){this.loopResult=this.enclosed();this.lastLoopCheck=this.time;}
          this.closureDwell=this.loopResult?this.closureDwell+h:0;
          if((this.feedingTime>=5&&this.closureDwell>=CLOSURE_DWELL)||this.feedingTime>=ENCIRCLE_CAP){this.sealed=true;this.feeding='COVER';this.feedingTime=0;}
        }
        else if(this.feeding==='COVER'&&this.feedingTime>=this.tuning.engulfTime){this.feeding='ABSORB';this.feedingTime=0;}
        else if(this.feeding==='ABSORB'&&this.feedingTime>=2.5){this.meals++;this.feeding='RECOVER';this.feedingTime=0;}
        else if(this.feeding==='RECOVER'&&this.feedingTime>=1.2){this.feeding='HUNT';this.feedingTime=0;this.sealed=false;this.closureDwell=0;this.lastLoopCheck=-Infinity;this.loopResult=false;const angle=this.meals*2.39996323;this.preyX=Math.cos(angle)*4.5;this.preyZ=Math.sin(angle)*4.5;}
      }
      this.updateOpening(h);
    }
  }
}
```

- [ ] **Step 4: run** `npm run test:cutisling`. Expected: `PASS feeding: ...`. Tuning knobs if an assertion fails: raise `gapPull` 2.2 → 3, lower crescent `reach` spread `.9` → `.6`, or raise `ENCIRCLE_CAP` only as a last resort (must stay ≤ 22 per spec).

- [ ] **Step 5: commit** `git add src/cutisling/controller.ts scripts/verify-cutisling.mjs && git commit -m "Feed Cutisling through a crescent, an escalating squeeze and a contour closure test"`.

---

### Task 5: Membrane on the field skin, with clearance

**Files:**
- Modify: `src/cutisling/membrane.ts`
- Shrink: `src/cutisling/outline.ts` (delete `openingWarp`, `warpPoint`, `smoothMax`, `openingContour`, `subtractOpening`, `roundContour`)
- Delete: `src/cutisling/envelope.ts`
- Append section D to `scripts/verify-cutisling.mjs`

**Interfaces:**
- `createCutislingMembrane(body:Inago, lift?, opening?, floor?)` — new optional fourth argument `floor:(x,z)=>number` (default `()=>.012`). Internally uses `(body as {skin?:FieldSkin}).skin ?? new FieldSkin(body,tuning)` and `(body as {contours?:()=>Point[][]}).contours?.()`.
- Return shape unchanged: `{group, skin, underside, rim, update, dispose, boundaries, area}`.

- [ ] **Step 1: failing test** — append:

```js
import {createCutislingMembrane} from '../src/cutisling/membrane.ts';
// ---- D. membrane geometry ----------------------------------------------------
{
  const inspect=(membrane,label)=>{
    const positions=membrane.skin.geometry.attributes.position.array,count=membrane.skin.geometry.drawRange.count*3;
    const outline=membrane.boundaries.reduce((s,l)=>s+polygonArea(l),0);
    let triangles=0;for(let i=0;i<count;i+=9)triangles+=Math.abs((positions[i+3]-positions[i])*(positions[i+8]-positions[i+2])-(positions[i+6]-positions[i])*(positions[i+5]-positions[i+2]))*.5;
    assert(Math.abs(outline-triangles)<2e-3,`${label}: triangles fill the outline (${outline.toFixed(3)} vs ${triangles.toFixed(3)})`);
    for(const mesh of [membrane.skin,membrane.underside,membrane.rim]){
      const {geometry}=mesh,p=geometry.attributes.position.array,n=geometry.drawRange.count*3;
      assert(n<=geometry.attributes.position.count*3,`${label}: draw range fits the buffer`);
      for(let i=0;i<n;i++)assert(Number.isFinite(p[i]),`${label}: finite geometry`);
      for(let i=1;i<n;i+=3)assert(p[i]>=.011&&p[i]<.8,`${label}: tissue stays between the ground and the dome`);
    }
  };
  const plain=new Inago(),plainMembrane=createCutislingMembrane(plain);
  assert.equal(plainMembrane.boundaries.length,1,'an Inago body without a controller still gets one skin');
  for(let i=1;i<=6*60;i++){plain.step(1/60);if(i%20===0){plainMembrane.update();inspect(plainMembrane,'plain');}}
  const c=new Cutisling(),membrane=createCutislingMembrane(c,(x,z)=>c.surfaceLift(x,z),()=>c.opening,(x,z)=>c.floorAt(x,z));
  let straightRuns=0,samples=0,coverSamples=0,holeChecked=false;
  const collinear=(a,b,d)=>{const ux=b[0]-a[0],uz=b[1]-a[1],vx=d[0]-b[0],vz=d[1]-b[1];const cross=Math.abs(ux*vz-uz*vx),dot=ux*vx+uz*vz;return dot>0&&Math.atan2(cross,dot)<.5*Math.PI/180;};
  for(let i=1;i<=90*60;i++){
    c.step(1/60);if(i%10)continue;membrane.update();inspect(membrane,`t=${(i/60).toFixed(1)} ${c.feeding}`);
    for(const loop of membrane.boundaries){samples++;let run=0;for(let k=0;k<loop.length;k++){if(collinear(loop[k],loop[(k+1)%loop.length],loop[(k+2)%loop.length]))run++;else run=0;if(run>=3){straightRuns++;break;}}}
    if(c.feeding==='ENCIRCLE'&&c.feedingTime>3){const hole=membrane.boundaries.find(l=>polygonArea(l)<0);if(hole){const radii=hole.map(p=>Math.hypot(p[0]-c.preyX,p[1]-c.preyZ)),mean=radii.reduce((a,b)=>a+b)/radii.length,cv=Math.sqrt(radii.reduce((a,r)=>a+(r-mean)**2,0)/radii.length)/mean;assert(cv>=.05,`hole is not a circle (cv ${cv.toFixed(3)})`);holeChecked=true;}}
    if(c.feeding==='COVER'||c.feeding==='ABSORB'){coverSamples++;const rp=c.preyRadius*c.preyScale,cy=.012+rp;
      for(const mesh of [membrane.skin,membrane.rim]){const p=mesh.geometry.attributes.position.array,n=mesh.geometry.drawRange.count*3;
        for(let k=0;k<n;k+=3){const dx=p[k]-c.preyX,dz=p[k+2]-c.preyZ,dy=p[k+1]-cy,d=Math.sqrt(dx*dx+dy*dy+dz*dz);assert(d>=rp+.01-1e-6,`${c.feeding} t=${c.feedingTime.toFixed(2)}: tissue vertex ${d.toFixed(3)} m from the prey centre is inside the ${rp.toFixed(3)} m prey`);}}}
  }
  assert(holeChecked,'the hole was observed during encircle');
  assert(coverSamples>0,'cover and absorb were observed');
  assert(straightRuns/samples<.05,`straight runs of 5 collinear points are rare (${straightRuns}/${samples})`);
  assert(c.meals>=1,'the membrane run fed');
  pass('membrane: continuous skin on any body, fills outline, bounded, no circles, no straight runs, clearance over prey');
}
```

- [ ] **Step 2: run** `npm run test:cutisling`. Expected: fails (membrane still imports `./envelope.ts`/carve functions, or clearance assertion).

- [ ] **Step 3: implement.** In `src/cutisling/membrane.ts`:

Replace the import block's outline/envelope lines with:

```ts
import {contains,polygonArea} from './outline.ts';
import type {Opening,Point} from './outline.ts';
import {FieldSkin} from './field.ts';
```

Change the signature and the skin source:

```ts
export function createCutislingMembrane(body:Inago,lift:(x:number,z:number)=>number=()=>0,opening:()=>Opening|null=()=>null,floor:(x:number,z:number)=>number=()=>.012){
  const tuning=(body as Inago & {tuning?:CutislingSettings}).tuning??CUTISLING_DEFAULTS;
  const owned=(body as Inago & {skin?:FieldSkin;contours?:()=>Point[][]});
  const fieldSkin=owned.skin??new FieldSkin(body,tuning);
  const loopsNow=()=>owned.contours?owned.contours():fieldSkin.contours();
  const veinTexture=createVeinTexture();
```

In `update()`:
- Replace `const outer=envelope();area=polygonArea(outer); const lipPadding=...; boundaries=subtractOpening(...).map(roundContour);` with:

```ts
    boundaries=loopsNow();area=boundaries.reduce((sum,loop)=>sum+polygonArea(loop),0);
    const holeRadius=aperture?.radius??1,lipPadding=tuning.lipWidth*Math.min(1,holeRadius/.25);
```
- In the bulging re-subdivision keep the code but use step `.07` within `aperture.preyRadius+.3` of the aperture and `.14` otherwise:

```ts
    if(bulging)boundaries=boundaries.map(loop=>loop.flatMap((p,i)=>{
      const q=loop[(i+1)%loop.length],near=aperture&&Math.hypot(p[0]-aperture.x,p[1]-aperture.z)<aperture.preyRadius+.3,steps=Math.max(1,Math.ceil(Math.hypot(q[0]-p[0],q[1]-p[1])/(near?.07:.14)));
      return Array.from({length:steps},(_,j):Point=>[p[0]+(q[0]-p[0])*j/steps,p[1]+(q[1]-p[1])*j/steps]);
    }));
```
- In `tessellate`'s `midpoint`, the split threshold near the lift becomes `.07`:

```ts
            const near=liftX>=Math.min(p[0],q[0])-.65&&liftX<=Math.max(p[0],q[0])+.65&&liftZ>=Math.min(p[2],q[2])-.65&&liftZ<=Math.max(p[2],q[2])+.65;
            if((p[0]-q[0])**2+(p[2]-q[2])**2<=(near?.07:.5)**2)return -1;
```
- In the rim profile loop, replace the `nearMouth`/`width` lines and the profile construction with a floor-aware collar:

```ts
        const roof=height+lift(b[0],b[1]),profile=[[b[0],roof,b[1],0,1,0]];
        const nearMouth=aperture&&Math.hypot(b[0]-aperture.x,b[1]-aperture.z)<aperture.radius+lipPadding+.2;
        const width=nearMouth?lipPadding:tuning.lipWidth;
        for(let j=0;j<=8;j++){
          const angle=j/8*Math.PI,offset=width*(.85+.15*Math.sin(angle))*miter,px=b[0]+nx*offset,pz=b[1]+nz*offset;
          const base=Math.max(.012,floor(px,pz),lift(px,pz)-tuning.thickness*.5),top=Math.max(roof,base+.004);
          profile.push([px,base+(top-.007-base)*(1+Math.cos(angle))*.5,pz,nx*Math.sin(angle),Math.cos(angle),nz*Math.sin(angle)]);
        }
        const ground=Math.max(.012,floor(b[0],b[1]));profile.push([b[0],ground,b[1],0,-1,0]);profiles.push(profile);
```
- Keep `bottomPositions[i+1]=.012` for the underside but clamp it to the floor: `bottomPositions[i+1]=Math.max(.012,floor(positions[i],positions[i+2]));`.
- Remove `createTissueEnvelope` usage and the `envelope` constant.

Then delete the carve code from `src/cutisling/outline.ts` so it contains only `Point`, `Opening`, `cross`, `polygonArea`, `contains`. Delete `src/cutisling/envelope.ts`. Update `src/inago/scene.ts` to pass the floor:

```ts
  const membrane=feeding?createCutislingMembrane(organism,(x,z)=>feeding.surfaceLift(x,z),()=>feeding.opening,(x,z)=>feeding.floorAt(x,z)):null;if(membrane)scene.add(membrane.group);
```

- [ ] **Step 4: run** `npm run test:cutisling && npm run typecheck && npm run lint`. Expected: all pass. If the clearance assertion fails on the cap, raise the `+.025` in `surfaceLift` to `+.04`; if it fails on the rim, raise the `+.015` in `floorAt` to `+.03`.

- [ ] **Step 5: commit** `git add -A src/cutisling src/inago/scene.ts scripts/verify-cutisling.mjs && git commit -m "Build the Cutisling membrane from the field skin with prey clearance"`.

---

### Task 6: HUD text, docs, full verification

**Files:**
- Modify: `src/inago/page.ts:15` (ENCIRCLE description)
- Modify: `README.md` (v1 section)
- Append section E (performance) to `scripts/verify-cutisling.mjs`

- [ ] **Step 1: HUD** — in `feedingDescriptions`, set `ENCIRCLE:'The skin tightens around the prey until it is enclosed.'`.

- [ ] **Step 2: performance section** — append:

```js
// ---- E. update cost ----------------------------------------------------------
{
  const c=new Cutisling();for(let i=0;i<20*60;i++)c.step(1/60);
  const t0=performance.now();let n=0;for(let i=0;i<120;i++){c.step(1/60);c.contours();n++;}
  const ms=(performance.now()-t0)/n;console.log(`field+contour ${ms.toFixed(2)} ms per update`);
  if(ms>3)console.warn('WARN update slower than the 3 ms budget');
  pass('update cost measured');
}
```

- [ ] **Step 3: README** — replace the paragraph starting "A golden prey lure wanders automatically" through the `npm run test:cutisling` paragraph in the "Cutisling v1" section with:

```markdown
A golden prey lure wanders automatically; clicking the ground places it manually, and **Moving lure** toggles wandering. The skin is no longer carved from a radial envelope. Every flock driver splats a soft kernel onto a 0.1 m field; the tissue is the field's iso-line, traced each frame with marching squares. The three boundary approaches are temporal filters on that field: Flock follows it closely, Viscous lags it, Elastic is a damped spring. Because the mouth is simply the sector the flock leaves open, the skin can no longer be cut into two pieces, and no edge is a straight line or a true circle. The prey hollow is a drifting, three-harmonic boundary scaled by **Mouth irregularity**.

Feeding runs **Fan out → Encircle → Cover → Absorb → Recover**. Fan out forms one ragged crescent behind the prey that widens into a horseshoe. Encircle applies an escalating squeeze: flock freedom and turbulence decay, the ring tightens, and drivers near the open sector are drawn toward its centre. Cover begins once the skin's outer contour encloses the prey for 0.4 s, or after 22 s regardless, so feeding always completes. The hole never shrinks below the prey; it fades out of the field while a clearance dome rises at least 2.5 cm above the prey sphere, and the feeding lip's floor rides on that dome. Facets under the dome are 7 cm.

`npm run test:cutisling` checks the contour tracer (orientation, holes, separation, speck removal), the field skin (one continuous skin at rest, spread and contraction, hollow and cover, distinct approaches, tension), feeding (completion within 60 s under defaults and extremes, one body around the prey, the hard cap, an irregular hollow, determinism, pause, reset), the membrane (fills its outline, bounded, no circular hole, rare straight runs, every cap and rim vertex outside the prey during Cover and Absorb) and the update cost.
```

- [ ] **Step 4: full check** — run:

```
npm run test:cutisling && npm run test:inago && npm run typecheck && npm run lint && npm run build
```
Expected: every command exits 0; build emits `dist/`.

- [ ] **Step 5: visual check** — with the dev server on 5174, render `http://localhost:5174/?specimen=cutisling` headless over CDP (script in the scratchpad from the catalog session, `cdp-eval.mjs`) at t≈8 s, 20 s, 35 s and save PNGs; look at them for splits, straight edges, and prey poking through.

- [ ] **Step 6: commit and push** `git add README.md src/inago/page.ts scripts/verify-cutisling.mjs && git commit -m "Document the Cutisling field skin and squeeze" && git push origin main`.

---

## Self-review

- **Spec coverage.** §1 field → Task 3; §2 contour → Task 2; §3 lift, facets, rim floor → Task 5; §4 crescent, squeeze, closure, cap, soft hollow, gap state removal → Task 4; §5 settings untouched → no task needed, `panel.ts` unchanged; §6 HUD and README → Task 6; §7 tests → sections A–E. Dev badge → Task 1.
- **Types.** `Opening` fields `preyRadius`/`preyScale` are produced in Task 4's `opening` getter and consumed in Task 5. `Hollow` is produced in Task 3 and consumed in Task 4. `floorAt` is defined in Task 4 and wired in Task 5. `contours()` on the controller is used by sections C and D.
- **Known risk.** Task 4's completion sweep is the one place numbers may need tuning; the plan names the knobs and their order.
