import {Cutisling} from '../cutisling/controller.ts';
const hash=(n:number)=>{const v=Math.sin(n*61.7+211.3)*43758.5453;return v-Math.floor(v);};
const WAVELENGTH=1.1,BASE_PERIOD=1.6;
/** A ribbon that crawls with a retrograde peristaltic wave; feeding, skin and prey come from Cutisling. */
export class Peristaling extends Cutisling{
  readonly wave={time:0,factor:1,target:1,cycle:0};
  // The ribbon crawls close before it wraps, so the gait is seen on every hunt.
  protected override approachDistance=2.6;
  private readonly thrustX=new Float64Array(256);
  private readonly thrustZ=new Float64Array(256);
  private readonly along=new Float64Array(256);
  private readonly across=new Float64Array(256);
  private waveFrac=0;
  reset(){super.reset();if(this.wave){this.wave.time=0;this.wave.factor=1;this.wave.target=1;this.wave.cycle=0;}this.waveFrac=0;}
  phaseOf(i:number){return Math.PI*2*this.along[i]/WAVELENGTH+this.wave.time;}
  protected prepareLocomotion(h:number){
    let cx=0,cz=0;for(let i=0;i<this.count;i++){cx+=this.x[i];cz+=this.z[i];}cx/=this.count;cz/=this.count;
    this.centerX=cx;this.centerZ=cz;
    const hx=Math.cos(this.heading),hz=Math.sin(this.heading);
    for(let i=0;i<this.count;i++){
      const dx=this.x[i]-cx,dz=this.z[i]-cz;this.along[i]=dx*hx+dz*hz;this.across[i]=-dx*hz+dz*hx;
      if(!this.locked){const t=this.target??{x:this.preyX,z:this.preyZ},tx=t.x-this.x[i],tz=t.z-this.z[i],d=Math.hypot(tx,tz)||.001;this.thrustX[i]=tx/d;this.thrustZ[i]=tz/d;}
      else{const [fx,fz]=this.desiredForce(i,this.x[i],this.z[i]);const f=Math.hypot(fx,fz)||.001,scale=Math.min(1,f/3);this.thrustX[i]=fx/f*scale;this.thrustZ[i]=fz/f*scale;}
    }
    // Randomised wave speed: a new factor each cycle, blended so it never steps; some cycles nearly stall.
    const w=this.wave,rate=Math.PI*2/(BASE_PERIOD*Math.max(.1,this.tuning.stride));
    w.factor+=(w.target-w.factor)*(1-Math.exp(-h/.3));
    w.time+=rate*w.factor*h;this.waveFrac+=rate*w.factor*h/(Math.PI*2);
    if(this.waveFrac>=1){this.waveFrac-=1;w.cycle++;w.target=hash(w.cycle*3)<.15?.15:.55+1.05*hash(w.cycle);}
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
      if(rho>1){const cx=x-this.centerX,cz=z-this.centerZ,rc=Math.hypot(cx,cz)||.001,pull=(rho-1)*3;ax-=cx/rc*pull;az-=cz/rc*pull;}
    }
    const hx=Math.cos(this.heading),hz=Math.sin(this.heading);
    if(grip<.05||c>0){const power=grip<.05?1.4:c*c*3.4;ax+=this.thrustX[i]*power;az+=this.thrustZ[i]*power;}
    else{
      const k=-c,friction=9*grip*k,squeeze=2*k*this.across[i];
      ax+=-vx*friction+hz*squeeze;az+=-vz*friction-hx*squeeze;
    }
    return {blend:1,x:ax,z:az};
  }
  protected pin(){/* The wave anchors with friction, never with pins. */}
}
