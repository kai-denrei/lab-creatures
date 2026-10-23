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
    // Blur the driver field before carving so tension never bleeds tissue back into the hollow.
    this.splat();this.blur(Math.round(this.settings.tension*5));this.ripple();if(hollow)this.carve(hollow);this.relax(dt,reset);
    this.loops=traceContours(this.value,NODES,1,CELL,HALF,.1);
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
  /** Slow, multi-octave modulation so the iso-line wanders organically instead of running straight. */
  private ripple(){
    const {target,body}=this,t=body.time,amplitude=.5*(.4+.8*this.settings.edgeDetail);
    for(let j=this.j0;j<=this.j1;j++){const z=j*CELL-HALF;for(let i=this.i0;i<=this.i1;i++){
      const k=j*NODES+i;if(target[k]<.2)continue;const x=i*CELL-HALF;
      const n=(Math.sin(2.1*x+1.7*z+.3*t)+.6*Math.sin(4.3*x-3.1*z-.5*t+1.3)+.35*Math.sin(7.9*x+6.3*z+.9*t+2.7))/1.95;
      target[k]*=1+amplitude*n;
    }}
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
      // The vertical pass reads one row beyond the box; clear those apron rows so a stale earlier box cannot leak in.
      if(this.j0>0)scratch.fill(0,(this.j0-1)*NODES+this.i0,(this.j0-1)*NODES+this.i1+1);
      if(this.j1<NODES-1)scratch.fill(0,(this.j1+1)*NODES+this.i0,(this.j1+1)*NODES+this.i1+1);
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
