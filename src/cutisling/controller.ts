import { Inago } from '../inago/controller.ts';
import {CUTISLING_DEFAULTS} from './settings.ts';
import {FieldSkin} from './field.ts';
import {Muscles} from './muscles.ts';
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
  private readonly sectors=new Uint16Array(48);
  readonly skin=new FieldSkin(this,this.tuning);
  readonly muscles=new Muscles(256);
  private readonly desiredX=new Float64Array(256);
  private readonly desiredZ=new Float64Array(256);
  private readonly leading=new Uint8Array(256);
  private readonly bandSum=new Float64Array(9);
  private readonly gripCentroid=new Float64Array(9);
  // Invisible tissue drivers: local flock motion without hundreds of rendered bodies.
  override get count(){return 256;}
  private readonly flankSeed=Float64Array.from({length:256},(_,i)=>hash(i+3));
  private readonly reachSeed=Float64Array.from({length:256},(_,i)=>hash(i+77));
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
  reset(){super.reset();this.feeding='HUNT';this.feedingTime=0;this.meals=0;this.autoPrey=true;this.preyX=2.1;this.preyZ=2.2;this.approachX=0;this.approachZ=1;this.sealed=false;this.closureDwell=0;this.lastLoopCheck=-Infinity;this.loopResult=false;this.gapAngle=Math.PI/2;this.gapTarget=Math.PI/2;this.lastGapCheck=-Infinity;this.mouthPressure?.fill(0);this.muscles?.reset();}
  lure(x:number,z:number){if(this.locked)return;super.lure(x,z);this.autoPrey=false;this.preyX=this.target!.x;this.preyZ=this.target!.z;}
  /** Irregular, drifting hollow boundary: three harmonics, never a circle. */
  hollowAt(theta:number){
    const amplitude=.16*this.tuning.mouthDetail/.7,t=this.time;
    return this.hollowRadius*(1+amplitude*(.5*Math.sin(2*theta+.31*t)+.33*Math.sin(3*theta-.47*t+1.7)+.17*Math.sin(5*theta+.23*t+4.1)));
  }
  /** Hole mask radius: shrinks with coverage but never below the rendered prey. */
  holeRadius(){return Math.max(1.05*this.preyRadius*Math.max(this.preyScale,.001),this.hollowRadius*(1-.6*this.coverage));}
  private hollow():Hollow|null{
    if(!this.tuning.hunting||(!this.locked&&this.preyScale===0))return null;
    const coverage=this.coverage,scale=this.holeRadius()/this.hollowRadius;
    return {x:this.preyX,z:this.preyZ,radiusAt:theta=>this.hollowAt(theta)*scale,strength:this.locked?1-smooth((coverage-.6)/.4):0,cover:this.locked?smooth((coverage-.45)/.45):0,coverRadius:this.hollowRadius+.2};
  }
  contours():Point[][]{return this.skin.contours(this.hollow());}
  /** Closure: exactly one outer loop contains the prey centre. A horseshoe does not. */
  enclosed(){const outer=this.contours().filter(l=>polygonArea(l)>0&&contains(l,this.preyX,this.preyZ));return outer.length===1;}
  surfaceLift(x:number,z:number){
    if(this.coverage===0)return 0;
    const r2=(x-this.preyX)**2+(z-this.preyZ)**2,rp=this.preyRadius*this.preyScale,inflated=rp+.03;
    // A soft mound for the look, and a hard dome that is the prey sphere inflated by 3 cm.
    const mound=.5*Math.exp(-r2/.16)*smooth(this.coverage/.65)*(.25+.75*this.preyScale);
    const clearance=r2<inflated*inflated?rp+Math.sqrt(inflated*inflated-r2)-this.tuning.thickness:0;
    const gate=smooth((this.coverage-.4)/.25);
    return Math.max(mound,gate*clearance,0);
  }
  /** Lowest permitted tissue height above the prey sphere at a point. */
  floorAt(x:number,z:number){
    // Clearance against a sphere inflated by 3 cm, so collar walls beside the equator clear it too.
    const rp=this.preyRadius*this.preyScale,inflated=rp+.03,r2=(x-this.preyX)**2+(z-this.preyZ)**2;
    if(this.preyScale===0||r2>=inflated*inflated)return .012;
    return .012+rp+Math.sqrt(inflated*inflated-r2);
  }
  private updateOpening(dt:number){
    // Sample vacant sectors at 10 Hz: pressure feeds the HUD, the gap angle steers the squeeze.
    if(this.time-this.lastGapCheck>=.1||this.time<this.lastGapCheck){
      this.lastGapCheck=this.time;
      const sectors=this.sectors,tau=Math.PI*2;sectors.fill(0);
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
  /** Behaviour force before muscles: where this driver wants to go right now. Exclusion is added separately. */
  protected desiredForce(i:number,x:number,z:number):[number,number]{
    const dx=x-this.preyX,dz=z-this.preyZ,r=Math.hypot(dx,dz)||.001,theta=Math.atan2(dz,dx),squeeze=this.squeeze();
    const turbulence=this.tuning.turbulence*(1-.7*squeeze);
    const wave=Math.sin(this.time*1.7+dx*2.3+Math.sin(dz*1.8))*turbulence,eddy=Math.sin(this.time*.9+dz*2-dx)*turbulence;
    const rim=this.hollowAt(theta);
    if(!this.locked){
      const t=this.target??{x:this.preyX,z:this.preyZ},tx=t.x-x,tz=t.z-z,d=Math.hypot(tx,tz)||.001,ux=tx/d,uz=tz/d;
      return [ux*3.2-uz*.4*this.tuning.swirl+eddy*.5,uz*3.2+ux*.4*this.tuning.swirl+wave*.5];
    }
    const sector=Math.floor((theta+Math.PI)/(Math.PI*2)*48)%48,behind=this.sectors[(sector+46)%48]+this.sectors[(sector+47)%48],ahead=this.sectors[(sector+1)%48]+this.sectors[(sector+2)%48];
    const crowded=Math.max(0,Math.min(1,(this.sectors[sector]-5)/6));
    const spread=crowded*Math.max(-1,Math.min(1,(behind-ahead)/8))*(this.feeding==='FAN_OUT'?1:1.4+1.6*squeeze);
    if(this.feeding==='FAN_OUT'){
      // A crescent behind the prey that widens into a horseshoe: always one connected band.
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
    // Drivers within 60° of the open sector drift toward its centre so the last gap closes from both sides.
    const toGap=Math.atan2(Math.sin(this.gapAngle-theta),Math.cos(this.gapAngle-theta)),gapPull=closing&&Math.abs(toGap)<Math.PI/3?Math.sign(toGap)*squeeze*2.2:0;
    return [-dx/r*pull-dz/r*(curl+gapPull+spread)+eddy*.9,-dz/r*pull+dx/r*(curl+gapPull+spread)+wave*.9];
  }
  /** Per-substep muscle bookkeeping: bands, desired forces, leading drivers, grips and releases. */
  protected prepareLocomotion(h:number){
    let cx=0,cz=0;for(let i=0;i<this.count;i++){cx+=this.x[i];cz+=this.z[i];}cx/=this.count;cz/=this.count;
    // The centre follows the body; all travel comes from strides.
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
    for(let k=0;k<3;k++)if(this.muscles.stage(k)==='release'||!gripping)this.muscles.release(k);
    if(gripping)for(let i=0;i<this.count;i++){if(this.leading[i]&&this.muscles.stage(this.muscles.band[i])==='plant')this.muscles.grip(i,this.x[i],this.z[i]);}
    this.gripCentroid.fill(0);
    for(let i=0;i<this.count;i++)if(this.muscles.gripped[i]){const k=this.muscles.gripBand[i]*3;this.gripCentroid[k]+=this.muscles.gripX[i];this.gripCentroid[k+1]+=this.muscles.gripZ[i];this.gripCentroid[k+2]++;}
    this.muscles.advance(h,this.tuning.stride);
  }
  protected steering(i:number,x:number,z:number){
    if(!this.tuning.hunting)return null;
    const grip=this.tuning.grip,fx=this.desiredX[i],fz=this.desiredZ[i],vx=this.vx[i],vz=this.vz[i];
    // Never gated: the hollow is a wall, and the body stays one mass.
    const dx=x-this.preyX,dz=z-this.preyZ,r=Math.hypot(dx,dz)||.001,rim=this.hollowAt(Math.atan2(dz,dx));
    const exclusion=!this.sealed?Math.max(0,rim+.25-r)*24:0;
    const cx=x-this.centerX,cz=z-this.centerZ,rc=Math.hypot(cx,cz)||.001,extent=this.radius*(.75+.25*this.seed[i]),cohesion=!this.locked?Math.max(0,rc-extent)*1.5:0;
    let ax=dx/r*exclusion-cx/rc*cohesion,az=dz/r*exclusion-cz/rc*cohesion;
    if(grip<.05)return {blend:1,x:ax+fx,z:az+fz};
    const k=this.muscles.band[i],stage=this.muscles.stage(k),u=this.muscles.progress(k),lead=this.leading[i]===1,held=this.muscles.gripped[i]===1;
    // Eased envelopes: contractions swell and fade instead of switching, so the body stretches rather than jerks.
    const bump=Math.sin(Math.PI*Math.min(1,u))**2,friction=7*grip,freedom=this.tuning.freedom;
    let power=0,haulX=0,haulZ=0;
    if(held)power=0;
    else if(stage==='reach')power=lead?2.2*bump:freedom*.3*bump;
    else if(stage==='haul'){
      power=lead?freedom*.5:.8*bump;
      // The rear is drawn in late in the haul, after the stretch has built.
      const g=this.gripCentroid,kk=k*3,draw=smooth((u-.2)/.6)*(1-.5*Math.max(0,u-.8)/.2);
      if(!lead&&g[kk+2]>0){haulX=(g[kk]/g[kk+2]-x)*2.4*grip*draw;haulZ=(g[kk+1]/g[kk+2]-z)*2.4*grip*draw;}
    }
    else power=stage==='plant'?freedom*.3:0;
    const brake=friction*(1-Math.min(1,power));
    ax+=fx*power+haulX-vx*brake;az+=fz*power+haulZ-vz*brake;
    return {blend:1,x:ax,z:az};
  }
  protected pin(){
    if(this.tuning.grip<.05)return;
    const m=this.muscles;
    for(let i=0;i<this.count;i++)if(m.gripped[i]){this.x[i]=m.gripX[i];this.z[i]=m.gripZ[i];this.vx[i]=0;this.vz[i]=0;}
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
      if(this.muscles.gripped[i]){this.muscles.gripX[i]=this.x[i];this.muscles.gripZ[i]=this.z[i];}
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
        this.target={x:this.preyX,z:this.preyZ};this.prepareLocomotion(h);super.step(h/this.pace);this.pin();
        this.avoidPrey(h);
        const dx=this.preyX-this.centerX,dz=this.preyZ-this.centerZ,distance=Math.hypot(dx,dz);
        if(distance<4.8){this.approachX=dx/(distance||1);this.approachZ=dz/(distance||1);this.feeding='FAN_OUT';this.feedingTime=0;this.gapAngle=Math.atan2(this.approachZ,this.approachX);this.gapTarget=this.gapAngle;}
      }else{
        this.feedingTime+=h;
        // Keep the same neighbor alignment, separation, eddies and acceleration limits.
        // Only the collective intention changes: a crescent, then an escalating squeeze.
        this.target={x:this.preyX,z:this.preyZ};this.prepareLocomotion(h);super.step(h/this.pace);this.pin();this.avoidPrey(h);
        if(this.feeding==='FAN_OUT'&&this.feedingTime>=4.5){this.feeding='ENCIRCLE';this.feedingTime=0;}
        else if(this.feeding==='ENCIRCLE'){
          // Checking the contour at 10 Hz preserves the closure dwell without tracing every substep.
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
