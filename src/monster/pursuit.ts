import { Vector3 } from 'three/webgpu';
import { DEFAULT_MOTION } from './motion-settings.ts';
import type { MotionSettings } from './motion-settings.ts';

const clamp=(v:number)=>Math.max(0,Math.min(1,v));
const smooth=(v:number)=>{v=clamp(v);return v*v*(3-2*v);};

/** Repeatable, uneven reach/pull bursts; no frame-dependent random jitter. */
export class TentaclePursuit {
  lead=0;
  secondLead=1;
  readonly firstDirection=new Vector3(1,0,0);
  readonly secondDirection=new Vector3(1,0,0);
  searchScale=1;
  reach=0;
  secondReach=0;
  pull=0;
  speed=0;
  side=0;
  phase:'reach'|'pull'|'settle'='reach';
  private elapsed=0;
  private burst=0;
  private heading=new Vector3(1,0,0);
  private engaged=false;
  private clock=0;
  readonly settings:MotionSettings;
  constructor(settings:MotionSettings={...DEFAULT_MOTION}){this.settings=settings;}
  reset(){this.lead=0;this.secondLead=1;this.reach=0;this.secondReach=0;this.pull=0;this.speed=0;this.side=0;this.phase='reach';this.elapsed=0;this.burst=0;this.clock=0;this.engaged=false;}
  private selectArms(direction:Vector3){
    this.heading.copy(direction);
    const angle=Math.atan2(direction.z,direction.x);
    this.lead=(Math.round(angle/(Math.PI/3))+6)%6;
    const delta=Math.atan2(Math.sin(angle-this.lead*Math.PI/3),Math.cos(angle-this.lead*Math.PI/3));
    const side=Math.abs(delta)<.08?(this.burst%2===0?1:-1):Math.sign(delta);
    this.secondLead=(this.lead+side+6)%6;
  }
  step(h:number,direction:Vector3,engaged:boolean,distance=.3){
    this.searchScale=smooth((distance-.045)/.18);
    this.clock+=h;
    if(!engaged){this.engaged=false;this.reach*=Math.exp(-h*14);this.secondReach*=Math.exp(-h*14);this.pull=0;this.speed=0;this.side=0;return;}
    if(!this.engaged||this.heading.dot(direction)<.55){
      this.phase='reach';this.elapsed=0;this.reach=0;this.secondReach=0;this.pull=0;this.selectArms(direction);
    }
    this.engaged=true;this.elapsed+=h;
    const s=this.settings,variation=.5+.5*Math.sin(this.burst*2.399+1.1)*Math.min(1,s.erratic);
    const reachDuration=(.14+variation*.07)*s.reachTime,pullDuration=(.17+(1-variation)*.10)*s.pullTime,settleDuration=(.045+variation*.08)*s.pauseTime;
    if(this.phase==='reach'){
      this.reach=smooth(this.elapsed/reachDuration);this.pull=0;
      this.secondReach=smooth((this.elapsed/reachDuration-.16)/.84);
      if(this.elapsed>=reachDuration){this.phase='pull';this.elapsed=0;}
    }else if(this.phase==='pull'){
      const t=clamp(this.elapsed/pullDuration);
      this.reach=1-.5*smooth(t);this.pull=Math.sin(Math.PI*t)**.65;
      this.secondReach=1-.5*smooth(clamp(t-.12)/.88);
      if(this.elapsed>=pullDuration){this.phase='settle';this.elapsed=0;}
    }else{
      this.reach=.5*(1-smooth(this.elapsed/settleDuration));this.pull=0;
      this.secondReach=this.reach;
      if(this.elapsed>=settleDuration){this.phase='reach';this.elapsed=0;this.burst++;this.selectArms(direction);}
    }
    const side=(this.secondLead-this.lead+6)%6===1?1:-1,angle=Math.atan2(direction.z,direction.x);
    // Spread moves the two complete sensor arms apart, not just their membrane edges.
    const width=(.09+s.spread*.105)*(.25+.75*this.searchScale);
    const sweep=(.02+s.spread*.018)*this.searchScale;
    const a=angle-side*(width+sweep*Math.sin(this.clock*2.1)),b=angle+side*(width+sweep*Math.sin(this.clock*1.7+1.3));
    this.firstDirection.set(Math.cos(a),0,Math.sin(a));this.secondDirection.set(Math.cos(b),0,Math.sin(b));
    this.speed=this.pull*(.10+variation*.055)*s.speed;
    this.side=Math.sin(this.burst*4.13+.7)*this.pull*.28*s.erratic;
  }
}
