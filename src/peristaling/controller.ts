import {Cutisling} from '../cutisling/controller.ts';
const hash=(n:number)=>{const v=Math.sin(n*61.7+211.3)*43758.5453;return v-Math.floor(v);};
const WAVELENGTH=1.1,BASE_PERIOD=.3,THRUST=18;
/**
 * A ribbon that crawls with a retrograde peristaltic wave at insect-like speed; feeding, skin and
 * prey come from Cutisling. Wave speed, heading and a body shiver are all re-rolled on short timers
 * so the motion stays hectic and hard to predict.
 */
export class Peristaling extends Cutisling{
  readonly wave={time:0,factor:1,target:1,cycle:0,burst:0,dart:0,dartTarget:0,nextDart:0};
  // The ribbon crawls close before it wraps, so the gait is seen on every hunt.
  protected override approachDistance=2.6;
  protected override accelerationLimit=30;
  protected override speedScale=2.2;
  private readonly thrustX=new Float64Array(256);
  private readonly thrustZ=new Float64Array(256);
  private readonly along=new Float64Array(256);
  private readonly across=new Float64Array(256);
  private waveFrac=0;
  reset(){super.reset();if(this.wave)Object.assign(this.wave,{time:0,factor:1,target:1,cycle:0,burst:0,dart:0,dartTarget:0,nextDart:0});this.waveFrac=0;}
  phaseOf(i:number){return Math.PI*2*this.along[i]/WAVELENGTH+this.wave.time;}
  protected prepareLocomotion(h:number){
    let cx=0,cz=0;for(let i=0;i<this.count;i++){cx+=this.x[i];cz+=this.z[i];}cx/=this.count;cz/=this.count;
    this.centerX=cx;this.centerZ=cz;
    const w=this.wave;
    // Darting: the travel direction carries a wandering offset re-rolled every 0.3–0.8 s.
    if(this.time>=w.nextDart){const n=Math.floor(this.time*7)+w.cycle;w.dartTarget=(hash(n*5+1)-.5)*1.8;w.nextDart=this.time+.45+.8*hash(n*5+2);}
    w.dart+=(w.dartTarget-w.dart)*(1-Math.exp(-h/.12));
    const shiver=Math.sin(this.time*11)*.14+Math.sin(this.time*17+1.3)*.08;
    const dir=this.heading+(this.locked?0:w.dart+shiver),hx=Math.cos(this.heading),hz=Math.sin(this.heading);
    for(let i=0;i<this.count;i++){
      const dx=this.x[i]-cx,dz=this.z[i]-cz;this.along[i]=dx*hx+dz*hz;this.across[i]=-dx*hz+dz*hx;
      if(!this.locked){
        const t=this.target??{x:this.preyX,z:this.preyZ},tx=t.x-this.x[i],tz=t.z-this.z[i],d=Math.hypot(tx,tz)||.001;
        // Blend the straight line to the target with the darting direction.
        const ux=tx/d*.35+Math.cos(dir)*.65,uz=tz/d*.35+Math.sin(dir)*.65,u=Math.hypot(ux,uz)||.001;this.thrustX[i]=ux/u;this.thrustZ[i]=uz/u;
      }else{const [fx,fz]=this.desiredForce(i,this.x[i],this.z[i]);const f=Math.hypot(fx,fz)||.001,scale=Math.min(1,f/3);this.thrustX[i]=fx/f*scale;this.thrustZ[i]=fz/f*scale;}
    }
    // Randomised wave speed: re-rolled every half cycle across a wide band, with bursts and near stalls.
    const rate=Math.PI*2/(BASE_PERIOD*Math.max(.05,this.tuning.stride));
    w.factor+=(w.target-w.factor)*(1-Math.exp(-h/.15));
    w.burst+=((w.target>1.8?1:0)-w.burst)*(1-Math.exp(-h/.15));
    w.time+=rate*w.factor*h;this.waveFrac+=rate*w.factor*h/(Math.PI*2);
    if(this.waveFrac>=.5){this.waveFrac-=.5;w.cycle++;const r=hash(w.cycle*3);w.target=r<.12?.12:r<.3?1.9+.6*hash(w.cycle*3+1):.45+1.3*hash(w.cycle);}
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
      // Linear inside the margin, quadratic beyond it: stragglers are reeled back before they shear off.
      if(rho>1){const cx=x-this.centerX,cz=z-this.centerZ,rc=Math.hypot(cx,cz)||.001,pull=(rho-1)*6+(rho-1)**2*20;ax-=cx/rc*pull;az-=cz/rc*pull;}
    }
    else{const far=Math.max(0,r-3.4);if(far>0){ax-=dx/r*far*14;az-=dz/r*far*14;}}
    const hx=Math.cos(this.heading),hz=Math.sin(this.heading),gain=THRUST*(1+.6*this.wave.burst);
    if(grip<.05||c>0){const power=grip<.05?gain*.4:c*c*gain;ax+=this.thrustX[i]*power;az+=this.thrustZ[i]*power;}
    else{
      const k=-c,friction=9*grip*k,squeeze=2.5*k*this.across[i];
      ax+=-vx*friction+hz*squeeze;az+=-vz*friction-hx*squeeze;
    }
    return {blend:1,x:ax,z:az};
  }
  protected pin(){/* The wave anchors with friction, never with pins. */}
}
