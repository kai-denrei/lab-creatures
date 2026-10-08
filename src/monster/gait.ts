import { Vector3 } from 'three/webgpu';
import { DEFAULT_MOTION } from './motion-settings.ts';
import type { MotionSettings } from './motion-settings.ts';

const smooth=(v:number)=>{v=Math.max(0,Math.min(1,v));return v*v*(3-2*v);};

/** A traveling footfall sequence continues after the body's short pull impulse.
 * Each foot lifts first, advances while clear of the floor, then plants. */
export class SpiderGait {
  readonly feet=Array.from({length:6},()=>new Vector3());
  readonly velocities=Array.from({length:6},()=>new Vector3());
  readonly planted=Array.from({length:6},()=>true);
  private starts=Array.from({length:6},()=>new Vector3());
  private goals=Array.from({length:6},()=>new Vector3());
  private elapsed=new Float64Array(6).fill(-1);
  private durations=new Float64Array(6);
  private heights=new Float64Array(6);
  private pending:number[]=[];
  private cooldown=0;
  private steps=0;
  readonly settings:MotionSettings;
  constructor(settings:MotionSettings={...DEFAULT_MOTION}){this.settings=settings;this.reset();}
  reset(){
    this.feet.forEach((foot,i)=>foot.set(Math.cos(i*Math.PI/3)*.088,0,Math.sin(i*Math.PI/3)*.088));
    this.velocities.forEach(v=>v.set(0,0,0));this.planted.fill(true);
    this.elapsed.fill(-1);this.pending=[];this.cooldown=0;this.steps=0;
  }
  settle(){
    this.pending=[];this.elapsed.fill(-1);this.planted.fill(true);
    this.feet.forEach(foot=>{foot.y=0;});this.velocities.forEach(v=>v.set(0,0,0));
  }
  step(h:number,center:Vector3,direction:Vector3,walking:boolean,reservedLeg=-1,secondReservedLeg=-1){
    this.cooldown-=h;
    const airborne=this.planted.filter(p=>!p).length;
    if(!this.pending.length&&airborne===0&&walking&&this.cooldown<=0){
      const lead=reservedLeg>=0?reservedLeg:(Math.round(Math.atan2(direction.z,direction.x)/(Math.PI/3))+6)%6;
      // Left/right pairs are offset in time, progressing from front to rear.
      this.pending=[1,5,2,4,3,0].map(offset=>(lead+offset)%6).filter(i=>i!==reservedLeg&&i!==secondReservedLeg);
    }
    this.pending=this.pending.filter(i=>i!==reservedLeg&&i!==secondReservedLeg);
    // With two exploratory arms lifted, only one supporting leg steps at a time.
    const maxSwing=reservedLeg>=0&&secondReservedLeg>=0?1:2;
    if(this.pending.length&&airborne<maxSwing&&this.cooldown<=0){
      const i=this.pending.shift()!;
      this.planted[i]=false;this.elapsed[i]=0;this.starts[i].copy(this.feet[i]);
      const s=this.settings;
      this.durations[i]=(.18+.025*(.5+.5*Math.sin(++this.steps*2.4)*Math.min(1,s.erratic)))*s.stepDuration/.19;
      this.heights[i]=s.stepHeight;
      const stride=s.stride+.003*Math.sin(this.steps*1.7+i*.8)*s.erratic;
      this.goals[i].set(center.x+Math.cos(i*Math.PI/3)*.088+direction.x*stride,0,center.z+Math.sin(i*Math.PI/3)*.088+direction.z*stride);
      this.cooldown=s.stepSpacing;
    }
    for(let i=0;i<6;i++){
      const foot=this.feet[i],velocity=this.velocities[i];velocity.copy(foot);
      if(this.elapsed[i]>=0){
        this.elapsed[i]+=h;
        const t=Math.min(1,this.elapsed[i]/this.durations[i]);
        // The first/last 22% is purely vertical: no ground-level forward sweep.
        const advance=smooth((t-.22)/.56);
        foot.lerpVectors(this.starts[i],this.goals[i],advance);
        const height=this.heights[i];
        foot.y=t<.22?smooth(t/.22)*height:t>.78?(1-smooth((t-.78)/.22))*height:height+height/.021*.002*Math.sin(Math.PI*(t-.22)/.56);
        if(t===1){foot.copy(this.goals[i]);this.elapsed[i]=-1;this.planted[i]=true;}
      }
      velocity.subVectors(foot,velocity).multiplyScalar(h>0?1/h:0);
    }
  }
}
