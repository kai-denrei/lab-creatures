import type {V2Settings} from './settings.ts';
import {seekNoise,seekRandom} from './seeking.ts';

export const WAVE_SPEED=4.5,WAVE_LIFETIME=5.5;
export class V2Lure{
  x=9.5;z=6;previousX=9.5;previousZ=6;height=0;previousHeight=0;
  private vx=0;private vz=0;private nextStep=.7;private nextBounce=1.6;
  private bounceStart=-Infinity;private bounceDuration=1.9;private cycle=0;private seed=17;private waveIndex=0;
  readonly waves=Array.from({length:16},()=>({x:0,z:0,time:-Infinity,strength:0,heard:false}));
  reset(x:number,z:number,time:number,seed:number){
    this.x=this.previousX=x;this.z=this.previousZ=z;this.height=this.previousHeight=0;this.vx=this.vz=0;
    this.seed=seed;this.cycle=0;this.nextStep=time+.7;this.nextBounce=time+1.6;
    this.bounceStart=-Infinity;this.waveIndex=0;
    for(const wave of this.waves){wave.time=-Infinity;wave.strength=0;wave.heard=false;}
  }
  emit(time:number,strength:number){
    const wave=this.waves[this.waveIndex++%this.waves.length];
    wave.x=this.x;wave.z=this.z;wave.time=time;wave.strength=strength;wave.heard=false;
  }
  update(dt:number,time:number,s:V2Settings,free:boolean){
    this.previousX=this.x;this.previousZ=this.z;this.previousHeight=this.height;
    if(!s.hunting||!s.movingLure||!free){
      this.vx=this.vz=0;this.height*=Math.exp(-dt*10);this.bounceStart=-Infinity;
      // Resuming motion starts a fresh hop rather than jumping to its middle.
      this.nextBounce=Math.max(this.nextBounce,time+1);this.nextStep=Math.max(this.nextStep,time+.4);return;
    }
    let heading=.7+seekNoise(time*.17,this.seed+81)*2+.35*Math.sin(time*.39+this.seed);
    const distance=Math.hypot(this.x,this.z),inward=Math.atan2(-this.z,-this.x);
    const boundary=Math.min(1,Math.max(0,(distance-14)/4));
    heading+=Math.atan2(Math.sin(inward-heading),Math.cos(inward-heading))*boundary;
    const speed=s.lureSpeed*(.7+.3*Math.sin(time*.43+this.seed)**2),blend=1-Math.exp(-dt*2);
    this.vx+=(Math.cos(heading)*speed-this.vx)*blend;this.vz+=(Math.sin(heading)*speed-this.vz)*blend;
    this.x+=this.vx*dt;this.z+=this.vz*dt;
    if(time>=this.nextBounce&&s.lureBounce>0){
      this.bounceStart=time;this.bounceDuration=1.7+.5*seekRandom(this.seed+this.cycle*41);
      this.nextBounce=time+5.5+2.5*seekRandom(this.seed+this.cycle++*73+3);this.emit(time,.65);
    }
    if(Number.isFinite(this.bounceStart)){
      const phase=(time-this.bounceStart)/this.bounceDuration;
      this.height=s.lureBounce*Math.sin(Math.min(1,phase)*Math.PI)**2;
      if(phase>=1){this.height=0;this.bounceStart=-Infinity;this.emit(time,1);}
    }else this.height*=Math.exp(-dt*10);
    if(time>=this.nextStep){
      // Light ground contacts during wandering; larger pulses at takeoff/landing.
      if(this.height<.03&&speed>.01)this.emit(time,.38);
      this.nextStep=time+1.15+.3*seekRandom(this.seed+this.cycle*13+Math.floor(time));
    }
  }
}
