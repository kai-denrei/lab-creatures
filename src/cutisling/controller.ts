import { Inago } from '../inago/controller.ts';
import {CUTISLING_DEFAULTS} from './settings.ts';
const smooth=(v:number)=>{const t=Math.max(0,Math.min(1,v));return t*t*(3-2*t);};
export type CutislingFeeding='HUNT'|'FAN_OUT'|'ENCIRCLE'|'COVER'|'ABSORB'|'RECOVER';
/** The prey freezes where caught; the distributed body must surround it before covering. */
export class Cutisling extends Inago{
  readonly tuning={...CUTISLING_DEFAULTS};
  readonly mouthPressure=new Float64Array(24);
  // Invisible tissue drivers: local flock motion without hundreds of rendered bodies.
  override get count(){return 256;}
  private gapAngle=Math.PI/2;
  private gapSize=.9;
  private gapTarget=Math.PI/2;
  private gapTargetSize=.9;
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
  get feedingProgress(){return this.feeding==='FAN_OUT'?Math.min(.15,this.feedingTime/4.5*.15):this.feeding==='ENCIRCLE'?.15+Math.min(.15,this.feedingTime/6*.15):this.feeding==='COVER'?.3+.3*this.coverage:this.feeding==='ABSORB'?.6+.3*Math.min(1,this.feedingTime/2.5):this.feeding==='RECOVER'?.9+.1*Math.min(1,this.feedingTime/1.2):0;}
  reset(){super.reset();this.feeding='HUNT';this.feedingTime=0;this.meals=0;this.autoPrey=true;this.preyX=2.1;this.preyZ=2.2;this.approachX=0;this.approachZ=1;this.sealed=false;this.closureDwell=0;this.lastLoopCheck=-Infinity;this.loopResult=false;this.gapAngle=Math.PI/2;this.gapSize=.9;this.gapTarget=Math.PI/2;this.gapTargetSize=.9;this.lastGapCheck=-Infinity;this.mouthPressure?.fill(0);}
  lure(x:number,z:number){if(this.locked)return;super.lure(x,z);this.autoPrey=false;this.preyX=this.target!.x;this.preyZ=this.target!.z;}
  surfaceLift(x:number,z:number){if(this.coverage===0)return 0;const r2=(x-this.preyX)**2+(z-this.preyZ)**2;return .50*smooth(this.coverage/.65)*(.25+.75*this.preyScale)*Math.exp(-r2/.16);}
  surrounded(){
    // A connected local chain must wind all the way around the hollow. A few
    // isolated clumps in every direction do not constitute a closed membrane.
    const ids:number[]=[],angles=new Float64Array(this.count),unwrapped=new Float64Array(this.count).fill(NaN),cells=new Map<number,number[]>();
    for(let i=0;i<this.count;i++){const x=this.x[i]-this.preyX,z=this.z[i]-this.preyZ,r2=x*x+z*z;if(r2>=(this.hollowRadius*.95)**2&&r2<2.4**2){ids.push(i);angles[i]=Math.atan2(z,x);const key=Math.floor((x+3)/.64)+Math.floor((z+3)/.64)*16;if(!cells.has(key))cells.set(key,[]);cells.get(key)!.push(i);}}
    for(const start of ids){
      if(Number.isFinite(unwrapped[start]))continue;
      unwrapped[start]=angles[start];const pending=[start];
      while(pending.length){const a=pending.pop()!;
        const cx=Math.floor((this.x[a]-this.preyX+3)/.64),cz=Math.floor((this.z[a]-this.preyZ+3)/.64);
        for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++)for(const b of cells.get(cx+dx+(cz+dz)*16)??[]){
          if(a===b||(this.x[a]-this.x[b])**2+(this.z[a]-this.z[b])**2>.64**2)continue;
          const delta=Math.atan2(Math.sin(angles[b]-angles[a]),Math.cos(angles[b]-angles[a]));
          const next=unwrapped[a]+delta;
          if(Number.isFinite(unwrapped[b])){if(Math.abs(next-unwrapped[b])>Math.PI)return true;}
          else{unwrapped[b]=next;pending.push(b);}
        }
      }
    }
    return false;
  }
  private updateOpening(dt:number){
    // Sample vacant sectors at 10 Hz, then let the lip flow toward the opening.
    // This prevents the channel jumping when different motiles exchange places.
    if(this.time-this.lastGapCheck>=.1||this.time<this.lastGapCheck){
      this.lastGapCheck=this.time;
      const sectors=new Uint16Array(48),tau=Math.PI*2;
      for(let i=0;i<this.count;i++){
        const x=this.x[i]-this.preyX,z=this.z[i]-this.preyZ;
        if(x*x+z*z<2.4**2)sectors[Math.floor((Math.atan2(z,x)+Math.PI)/tau*48)%48]++;
      }
      // Angular pressure comes from nearby flock density, not a fixed round mouth.
      for(let i=0;i<24;i++){
        const density=sectors[i*2]+sectors[i*2+1];
        this.mouthPressure[i]+=(Math.max(-1,Math.min(1,(density-5)/8))-this.mouthPressure[i])*.22;
      }
      let longest=0,start=0;
      for(let i=0;i<48;i++)if(sectors[i]===0){let n=1;while(n<48&&sectors[(i+n)%48]===0)n++;if(n>longest){longest=n;start=i;}}
      if(longest>0&&longest<48)this.gapTarget=(start+longest*.5)/48*tau-Math.PI;
      this.gapTargetSize=Math.max(.18,Math.min(.9,longest/48*tau*.45));
    }
    const blend=1-Math.exp(-dt*3);
    this.gapAngle+=Math.atan2(Math.sin(this.gapTarget-this.gapAngle),Math.cos(this.gapTarget-this.gapAngle))*blend;
    this.gapSize+=(this.gapTargetSize-this.gapSize)*blend;
  }
  get opening(){
    return {x:this.preyX,z:this.preyZ,radius:!this.tuning.hunting||this.preyScale===0?0:this.hollowRadius*(1-this.coverage),coverage:this.coverage,gapX:Math.cos(this.gapAngle),gapZ:Math.sin(this.gapAngle),gapWidth:this.sealed?(this.feeding==='COVER'?this.gapSize*(1-smooth(this.feedingTime/.45)):0):this.gapSize,time:this.time,detail:this.tuning.mouthDetail,pressure:this.mouthPressure};
  }
  flanksReady(){
    let left=0,right=0;
    for(let i=0;i<this.count;i++){
      const lateral=(this.x[i]-this.preyX)*-this.approachZ+(this.z[i]-this.preyZ)*this.approachX;
      const reach=Math.max(2.6,3.1*this.spread)*.7;
      if(lateral>reach)left++;if(lateral< -reach)right++;
    }
    return left>this.count*.22&&right>this.count*.22;
  }
  protected steering(i:number,x:number,z:number){
    if(!this.locked)return null;
    const dx=x-this.preyX,dz=z-this.preyZ,r=Math.hypot(dx,dz)||.001;
    const wave=Math.sin(this.time*1.7+dx*2.3+Math.sin(dz*1.8))*this.tuning.turbulence,eddy=Math.sin(this.time*.9+dz*2-dx)*this.tuning.turbulence;
    const settling=this.feeding==='ENCIRCLE'?1-.65*smooth((this.feedingTime-6)/8):1;
    const blend=1-this.tuning.freedom*(this.feeding==='FAN_OUT'?.25:settling);
    if(this.feeding==='FAN_OUT'){
      const side=i%2?1:-1,width=Math.max(2.6,3.1*this.spread)*(1+side*.10*Math.sin(this.time*.43));
      const hx=this.preyX-this.approachX*.65-this.approachZ*side*width;
      const hz=this.preyZ-this.approachZ*.65+this.approachX*side*width;
      const ux=x-hx,uz=z-hz,d=Math.hypot(ux,uz)||.001;
      const pull=Math.max(0,d-.65)*2.4;
      const avoid=Math.max(0,this.hollowRadius+.25-r)*24;
      return {blend,x:-ux/d*pull-uz/d*(1.3+wave*.6)+eddy*.8+dx/r*avoid,z:-uz/d*pull+ux/d*(1.3+wave*.6)+wave*.8+dz/r*avoid};
    }
    const closing=this.feeding==='ENCIRCLE';
    const extent=closing?3.25-2.05*smooth(this.feedingTime/6):1.2;
    const theta=Math.atan2(dz,dx);
    const desired=extent*(1+.27*Math.sin(theta*2+this.time*.31)+.14*Math.sin(theta*3-this.time*.43)),pull=Math.max(0,r-desired)*4*this.cohesion;
    const exclusion=!this.sealed?Math.max(0,this.hollowRadius+.25-r)*24:0;
    const curl=(1.25+wave*.8+Math.sin(theta*2-this.time*.52)*.55)*this.tuning.swirl;
    return {blend,x:dx/r*(exclusion-pull)-dz/r*curl+eddy*.9,z:dz/r*(exclusion-pull)+dx/r*curl+wave*.9};
  }
  private avoidPrey(){
    // The unsealed hollow is a contact boundary: no motile crosses the prey.
    if(!this.sealed)for(let i=0;i<this.count;i++){
          const x=this.x[i]-this.preyX,z=this.z[i]-this.preyZ,r=Math.hypot(x,z);
      if(r<this.hollowRadius){const nx=r>1e-6?x/r:Math.cos(this.seed[i]*Math.PI*2),nz=r>1e-6?z/r:Math.sin(this.seed[i]*Math.PI*2);this.x[i]=this.preyX+nx*this.hollowRadius;this.z[i]=this.preyZ+nz*this.hollowRadius;const inward=this.vx[i]*nx+this.vz[i]*nz;if(inward<0){this.vx[i]-=inward*nx;this.vz[i]-=inward*nz;}}
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
        this.avoidPrey();
        const dx=this.preyX-this.centerX,dz=this.preyZ-this.centerZ,distance=Math.hypot(dx,dz);
        if(distance<4.8){this.approachX=dx/(distance||1);this.approachZ=dz/(distance||1);this.feeding='FAN_OUT';this.feedingTime=0;this.gapAngle=Math.atan2(this.approachZ,this.approachX);this.gapTarget=this.gapAngle;}
      }else{
        this.feedingTime+=h;
        // Keep the same neighbor alignment, separation, eddies and acceleration limits.
        // Only the collective intention changes: two flanks, then an inward squeeze.
        this.target={x:this.preyX,z:this.preyZ};super.step(h/this.pace);this.avoidPrey();
        if(this.feeding==='FAN_OUT'&&this.feedingTime>=4.5&&this.flanksReady()){this.feeding='ENCIRCLE';this.feedingTime=0;}
        else if(this.feeding==='ENCIRCLE'){
          // Checking topology at 10 Hz preserves the closure dwell without
          // repeating a graph traversal in every simulation substep.
          if(this.time-this.lastLoopCheck>=.1){this.loopResult=this.surrounded();this.lastLoopCheck=this.time;}
          this.closureDwell=this.loopResult?this.closureDwell+h:0;
          if(this.feedingTime>=6&&this.closureDwell>=.3){
            // Revalidate the live chain at capture; a cached loop may have reopened.
            if(this.surrounded()){this.sealed=true;this.feeding='COVER';this.feedingTime=0;}
            else{this.closureDwell=0;this.loopResult=false;}
          }
        }
        else if(this.feeding==='COVER'&&this.feedingTime>=this.tuning.engulfTime){this.feeding='ABSORB';this.feedingTime=0;}
        else if(this.feeding==='ABSORB'&&this.feedingTime>=2.5){this.meals++;this.feeding='RECOVER';this.feedingTime=0;}
        else if(this.feeding==='RECOVER'&&this.feedingTime>=1.2){this.feeding='HUNT';this.feedingTime=0;this.sealed=false;this.closureDwell=0;this.lastLoopCheck=-Infinity;this.loopResult=false;const angle=this.meals*2.39996323;this.preyX=Math.cos(angle)*4.5;this.preyZ=Math.sin(angle)*4.5;}
      }
      this.updateOpening(h);
    }
  }
}
