const hash=(n:number)=>{const v=Math.sin(n*127.1+311.7)*43758.5453;return v-Math.floor(v);};
export type Stage='reach'|'plant'|'haul'|'release';
export const BANDS=3;
const BASE=[1.7,1.45,2.0],OFFSET=[0,.37,.71];
// Stage boundaries within a stride: reach, plant, haul, release.
const REACH=.36,PLANT=.46,HAUL=.86;
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
  stage(k:number):Stage{const p=this.phase[k];return p<REACH?'reach':p<PLANT?'plant':p<HAUL?'haul':'release';}
  /** Progress 0→1 through the current stage, for eased power envelopes. */
  progress(k:number){const p=this.phase[k];return p<REACH?p/REACH:p<PLANT?(p-REACH)/(PLANT-REACH):p<HAUL?(p-PLANT)/(HAUL-PLANT):(p-HAUL)/(1-HAUL);}
  /** Bands by lateral offset from the centroid across the heading (hx,hz). */
  assign(x:Float64Array,z:Float64Array,cx:number,cz:number,hx:number,hz:number,width:number){
    for(let i=0;i<this.band.length;i++){const lateral=-(x[i]-cx)*hz+(z[i]-cz)*hx;this.band[i]=lateral<-width?2:lateral>width?0:1;}
  }
  grip(i:number,x:number,z:number){if(this.gripped[i])return;this.gripped[i]=1;this.gripBand[i]=this.band[i];this.gripX[i]=x;this.gripZ[i]=z;}
  release(k:number){for(let i=0;i<this.gripped.length;i++)if(this.gripped[i]&&this.gripBand[i]===k)this.gripped[i]=0;}
}
