import {crawlSway} from './crawling.ts';
import {muscleProgress,recoveryGather} from './muscle-motion.ts';
import {CORE_FOOTPRINT} from './feeding-shape.ts';
import {V2_DEFAULTS} from './settings.ts';
import {seekingPose,seekRandom,seekNoise} from './seeking.ts';
import {sampleTendril} from './tendril-path.ts';
import {V2Lure,WAVE_SPEED,WAVE_LIFETIME} from './lure.ts';
export const EDGE_SAMPLES=96;
const tau=Math.PI*2;
const clamp=(x:number,a:number,b:number)=>Math.max(a,Math.min(b,x));
const smooth=(x:number)=>{const t=clamp(x,0,1);return t*t*(3-2*t);};
const hash=(n:number)=>{const v=Math.sin(n*127.1+17.7)*43758.5453;return v-Math.floor(v);};
export type V2Phase='SEEK'|'SPOT'|'ANCHOR'|'TRANSFER'|'EXTEND2'|'SURROUND'|'FLATTEN'|'ENGULF'|'ABSORB'|'RECOVER';

/** Separate from v1: fixed-step particles, smooth influence kernels and a persistent spring boundary. */
export class CutislingV2{
  readonly tuning={...V2_DEFAULTS};
  count=0;time=0;previousTime=0;private _paused=false;private pauseAlpha=1;private accumulator=0;
  get paused(){return this._paused;}
  set paused(value:boolean){if(value&&!this._paused)this.pauseAlpha=this.alpha;this._paused=value;}
  x=new Float64Array(0);z=new Float64Array(0);vx=new Float64Array(0);vz=new Float64Array(0);
  previousX=new Float64Array(0);previousZ=new Float64Array(0);
  private ax=new Float64Array(0);private az=new Float64Array(0);private next=new Int32Array(0);
  private heads=new Int32Array(4096);private polarX=new Float64Array(0);private polarZ=new Float64Array(0);private radial=new Float64Array(0);
  readonly edge=new Float64Array(EDGE_SAMPLES);readonly previousEdge=new Float64Array(EDGE_SAMPLES);
  private edgeVelocity=new Float64Array(EDGE_SAMPLES);private desired=new Float64Array(EDGE_SAMPLES);
  private cos=Float64Array.from({length:EDGE_SAMPLES},(_,i)=>Math.cos(i/EDGE_SAMPLES*tau));
  private sin=Float64Array.from({length:EDGE_SAMPLES},(_,i)=>Math.sin(i/EDGE_SAMPLES*tau));
  centerX=0;centerZ=0;previousCenterX=0;previousCenterZ=0;
  readonly lure=new V2Lure();
  instinct=0;instinctX=0;instinctZ=0;private trackingProbe=-1;
  preyX=9.5;preyZ=6;preyRadius=.24;preyScale=1;previousPreyScale=1;
  hole=0;previousHole=0;gap=0;previousGap=0;lift=0;previousLift=0;
  mouthAngle=0;phase:V2Phase='SEEK';phaseTime=0;meals=0;
  readonly probes=Array.from({length:7},(_,i)=>({angle:.4+i*tau/7,previousAngle:.4+i*tau/7,length:.82,previousLength:.82,tipX:0,tipZ:0,clock:0,cycle:0,duration:4.8}));
  tentacleCount=5;wrap=0;previousWrap=0;sheet=0;previousSheet=0;wrapRootX=0;wrapRootZ=0;
  readonly attackPaths=new Float64Array(7*33*4);
  sensingProbe=-1;contactTime=0;feedingMass=0;
  get feedingRadius(){return this.feedingMass>0?Math.max(1.25,Math.sqrt(.65**2+this.feedingMass/(Math.PI*this.tuning.thickness*.94))):Math.max(1.25,1.6*this.tuning.spread);}
  readonly contactLengths=new Float64Array(7);
  recoveryProgress(interpolate=true){
    const time=interpolate?this.mix(this.previousTime,this.time):this.time;
    return clamp((this.phaseTime-(this.time-time))/this.tuning.recoveryTime,0,1);
  }
  get holdingPrey(){return this.anchorForPrey&&this.phase!=='SEEK'&&this.phase!=='RECOVER';}
  anchorU=1;anchorAngle=0;anchorLength=1;anchorTime=0;drawX=0;drawZ=0;
  exploratory=1;previousExploratory=1;anchorForPrey=false;strides=0;
  anchorX=0;anchorZ=0;anchorFromX=0;anchorFromZ=0;anchorTravel=0;previousAnchorTravel=0;anchorDuration=1;
  get anchorVisible(){return this.holdingPrey&&this.sheet<.999||this.phase==='ANCHOR'||this.phase==='TRANSFER'||this.phase==='SPOT'||this.phase==='EXTEND2'&&this.phaseTime<.25;}
  get anchorGrip(){
    if(this.holdingPrey&&this.phase!=='SPOT')return 1-this.sheet;
    if(this.phase==='SPOT')return smooth(this.phaseTime/(.32/this.huntRate));
    if(this.phase==='ANCHOR'||this.phase==='TRANSFER')return 1;
    return this.phase==='EXTEND2'?1-smooth(this.phaseTime/.25):0;
  }
  predation=0;private attackAge=0;
  whipClock=0;previousWhipClock=0;whipBlend=0;previousWhipBlend=0;
  get huntRate(){return (.8+.2*this.tuning.aggro)*(1+(this.tuning.strikeSpeed-1)*this.predation)*(1+.15*this.tuning.frenzy*this.predation);}
  chosenProbe=-1;seekClock=0;private captureGap=.16;
  private spotAngles=new Float64Array(7);private spotLengths=new Float64Array(7);
  private contactA=new Float64Array(4);private contactB=new Float64Array(4);
  droppedTime=0;
  constructor(){this.reset();}
  reset(){
    this.tentacleCount=3+Math.floor(seekRandom(this.tuning.seed)*5);
    this.wrap=this.previousWrap=this.sheet=this.previousSheet=0;this.anchorU=1;this.attackPaths.fill(0);this.sensingProbe=-1;this.contactTime=0;this.feedingMass=0;
    this.count=Math.round(clamp(this.tuning.particles,64,1024));this.tuning.particles=this.count;
    this.x=new Float64Array(this.count);this.z=new Float64Array(this.count);this.vx=new Float64Array(this.count);this.vz=new Float64Array(this.count);
    this.previousX=new Float64Array(this.count);this.previousZ=new Float64Array(this.count);this.ax=new Float64Array(this.count);this.az=new Float64Array(this.count);this.next=new Int32Array(this.count);
    this.polarX=new Float64Array(this.count);this.polarZ=new Float64Array(this.count);this.radial=new Float64Array(this.count);
    this.time=0;this.previousTime=0;this.accumulator=0;this.centerX=this.centerZ=this.previousCenterX=this.previousCenterZ=0;
    this.hole=this.previousHole=this.gap=this.previousGap=this.lift=this.previousLift=0;
    this.lure.reset(9.5,6,0,this.tuning.seed);this.instinct=0;this.instinctX=this.instinctZ=0;this.trackingProbe=-1;
    this.preyX=9.5;this.preyZ=6;this.preyScale=this.previousPreyScale=1;this.phase='SEEK';this.phaseTime=0;this.meals=0;this.droppedTime=0;
    this.anchorX=this.anchorZ=this.anchorFromX=this.anchorFromZ=this.anchorTravel=0;this.previousAnchorTravel=0;this.anchorDuration=1;
    this.mouthAngle=0;this.predation=0;this.attackAge=0;this.chosenProbe=-1;this.seekClock=0;this.captureGap=.16;
    this.whipClock=this.previousWhipClock=this.whipBlend=this.previousWhipBlend=0;
    this.exploratory=this.previousExploratory=1;this.anchorForPrey=false;this.strides=0;
    for(let i=0;i<this.tentacleCount;i++){const p=this.probes[i];p.angle=.4+i*tau/this.tentacleCount;p.clock=-i*.22;p.cycle=0;p.duration=4.8*(1+this.tuning.organic*(seekRandom(31+i*13)-.5)*.65);p.length=.82*this.tuning.spread;p.tipX=Math.cos(p.angle)*p.length;p.tipZ=Math.sin(p.angle)*p.length;}

    this.edge.fill(.82*this.tuning.spread);this.previousEdge.set(this.edge);this.edgeVelocity.fill(0);
    for(let i=0;i<this.count;i++){const a=i*2.39996323,r=Math.sqrt((i+.5)/this.count)*.8*this.tuning.spread;this.x[i]=Math.cos(a)*r;this.z[i]=Math.sin(a)*r;}
    this.previousX.set(this.x);this.previousZ.set(this.z);
    for(const p of this.probes){p.previousAngle=p.angle;p.previousLength=p.length;}
  }
  setCount(count:number){this.tuning.particles=count;this.reset();}
  setRate(rate:number){this.tuning.rate=clamp(rate,30,120);this.accumulator=0;this.snapshot();}
  placePrey(x:number,z:number){if(this.phase!=='SEEK')return;const scale=Math.max(1,Math.hypot(x,z)/20);this.preyX=x/scale;this.preyZ=z/scale;this.lure.reset(this.preyX,this.preyZ,this.time,this.tuning.seed+this.meals);this.instinct=0;this.trackingProbe=-1;if(this.tuning.hunting&&this.tuning.movingLure)this.lure.emit(this.time,.65);}
  get alpha(){return this.paused?this.pauseAlpha:this.tuning.interpolation?clamp(this.accumulator*this.tuning.rate,0,1):1;}
  mix(a:number,b:number){return a+(b-a)*this.alpha;}
  private snapshot(){
    this.previousX.set(this.x);this.previousZ.set(this.z);this.previousEdge.set(this.edge);
    this.previousCenterX=this.centerX;this.previousCenterZ=this.centerZ;this.previousHole=this.hole;
    this.previousGap=this.gap;this.previousLift=this.lift;this.previousPreyScale=this.preyScale;this.previousTime=this.time;
    this.previousWhipClock=this.whipClock;this.previousWhipBlend=this.whipBlend;
    this.previousAnchorTravel=this.anchorTravel;
    this.previousExploratory=this.exploratory;this.previousWrap=this.wrap;this.previousSheet=this.sheet;
    for(const p of this.probes){p.previousAngle=p.angle;p.previousLength=p.length;}
  }
  step(dt:number){
    if(this.paused||dt<=0)return;
    const accepted=Math.min(dt,.1);this.droppedTime+=Math.max(0,dt-accepted);
    this.accumulator+=accepted*this.tuning.pace;
    const h=1/this.tuning.rate;
    while(this.accumulator+1e-10>=h){this.snapshot();this.advance(h);this.accumulator=Math.max(0,this.accumulator-h);}
  }
  stepOne(){this.snapshot();this.advance(1/this.tuning.rate);this.accumulator=(1-1e-9)/this.tuning.rate;this._paused=true;this.pauseAlpha=1;}
  private advance(dt:number){
    this.time+=dt;this.phaseTime+=dt;
    const t=this.time,s=this.tuning;
    this.updateLure(dt);
    const exploring=this.phase!=='FLATTEN'&&this.phase!=='ENGULF'&&this.phase!=='ABSORB';
    this.exploratory+=((this.phase==='FLATTEN'?1-this.sheet:exploring?1:0)-this.exploratory)*(1-Math.exp(-dt*12));
    const casting=this.phase==='EXTEND2'||this.phase==='SURROUND';
    if(casting||this.whipBlend>.0001)this.whipClock+=dt*this.huntRate;
    this.whipBlend+=((casting?1:0)-this.whipBlend)*(1-Math.exp(-dt*(casting?9:14)));
    if(this.anchorForPrey&&this.phase!=='SEEK'&&this.phase!=='RECOVER'){this.attackAge+=dt;this.predation=1-Math.exp(-this.attackAge*(10+this.tuning.frenzy*5));}else this.predation*=Math.exp(-dt*4);
    const aggro=s.aggro,openingTime=.95/this.huntRate;
    this.updateProbes(dt);
    if(this.phase==='SEEK'&&s.limbClearance>0){
      // Steer crowded roots apart before they can exchange sides during a turn.
      for(let i=0;i<this.tentacleCount;i++)for(let j=i+1;j<this.tentacleCount;j++){
        const a=this.probes[i],b=this.probes[j],delta=Math.atan2(Math.sin(b.angle-a.angle),Math.cos(b.angle-a.angle));
        const gap=Math.min(.55,.22+.12*s.spread*s.tendrilWidth/Math.max(.2,Math.min(a.length,b.length)))*s.limbClearance;
        if(Math.abs(delta)<gap){const push=(gap-Math.abs(delta))*(delta<0?-1:1)*(1-Math.exp(-dt*8))*.5;a.angle-=push;b.angle+=push;}
      }
    }
    const feeding=this.phase!=='SEEK',distance=Math.hypot(this.centerX-this.preyX,this.centerZ-this.preyZ);
    if(this.phase==='TRANSFER'){
      // Cutis-Gorogoro's slow draw into a fixed foothold. The target never
      // follows the prey or the searching noise after it has been committed.
      const progress=clamp(this.phaseTime/this.anchorDuration,0,1);
      this.anchorTravel=muscleProgress(progress,s.muscleStrength);
      const dx=this.drawX-this.anchorFromX,dz=this.drawZ-this.anchorFromZ,distance=Math.hypot(dx,dz);
      const sway=Math.min(.3*s.spread,distance*.12)*s.crawlSway*crawlSway(progress,this.chosenProbe*1.73+s.seed%97*.1,s.crawlRate);
      this.centerX=this.anchorFromX+dx*this.anchorTravel-dz/(distance||1)*sway;
      this.centerZ=this.anchorFromZ+dz*this.anchorTravel+dx/(distance||1)*sway;
    }
    const extent=1.55*s.spread;
    const cell=Math.max(s.neighborRange,(s.reach*s.spread+4)/30),offset=cell*32;
    this.heads.fill(-1);
    for(let i=0;i<this.count;i++){
      const ix=clamp(Math.floor((this.x[i]+offset)/cell),0,63),iz=clamp(Math.floor((this.z[i]+offset)/cell),0,63),id=ix+iz*64;
      this.next[i]=this.heads[id];this.heads[id]=i;
    }
    for(let i=0;i<this.count;i++){
      const x=this.x[i],z=this.z[i],dx=x-this.centerX,dz=z-this.centerZ,r=Math.hypot(dx,dz)||.001;
      const ix=clamp(Math.floor((x+offset)/cell),0,63),iz=clamp(Math.floor((z+offset)/cell),0,63);
      let alignX=0,alignZ=0,weight=0,repelX=0,repelZ=0;
      const separation=.18*Math.sqrt(256/this.count);
      for(let zz=Math.max(0,iz-1);zz<=Math.min(63,iz+1);zz++)for(let xx=Math.max(0,ix-1);xx<=Math.min(63,ix+1);xx++)for(let j=this.heads[xx+zz*64];j>=0;j=this.next[j]){
        if(i===j)continue;const ux=x-this.x[j],uz=z-this.z[j],d2=ux*ux+uz*uz;
        if(d2<s.neighborRange*s.neighborRange){const w=(1-d2/(s.neighborRange*s.neighborRange))**2;alignX+=this.vx[j]*w;alignZ+=this.vz[j]*w;weight+=w;}
        if(d2<separation*separation&&d2>1e-9){const w=(1-d2/(separation*separation))**2/(Math.sqrt(d2)+.025);repelX+=ux*w;repelZ+=uz*w;}
      }
      const angle=Math.atan2(dz,dx),focus=feeding?1/(1+aggro*.4):1;
      const lobe=1+focus*(.23*Math.sin(angle*3-t*.31)+.12*Math.sin(angle*2+t*.47));
      const radialBand=feeding?.24/(1+aggro*.25):.4;
      const probing=this.phase==='SEEK'||this.phase==='SPOT'||this.phase==='ANCHOR'||this.phase==='TRANSFER'||this.phase==='EXTEND2';
      const radius=probing?this.probeRadius(angle)*(.6+.4*hash(i+7)):extent*lobe*(1-radialBand+radialBand*hash(i+7));
      const pull=(r-radius)*(feeding?1.5+.3*aggro:2.4);
      const fieldX=Math.sin(z*1.7+t*s.turnSpeed)+.45*Math.sin(x*1.1-z*.9-t*.4);
      const fieldZ=Math.cos(x*1.5-t*s.turnSpeed)+.45*Math.cos(z*1.4+x*.6+t*.3);
      let ax=-dx/r*pull-dz/r*.45+fieldX*s.turbulence+repelX*s.separation*4;
      let az=-dz/r*pull+dx/r*.45+fieldZ*s.turbulence+repelZ*s.separation*4;
      if(weight){ax+=(alignX/weight-this.vx[i])*s.alignment;az+=(alignZ/weight-this.vz[i])*s.alignment;}
      if(s.hunting&&(this.phase==='SURROUND'||this.phase==='EXTEND2'||this.phase==='SPOT'||this.phase==='ANCHOR'||this.phase==='TRANSFER'||this.phase==='SEEK')){
        const px=x-this.preyX,pz=z-this.preyZ,pr=Math.hypot(px,pz)||.001,avoid=Math.max(0,.85-pr)*18;
        ax+=px/pr*avoid;az+=pz/pr*avoid;
        if(this.phase==='SURROUND'||this.phase==='EXTEND2'){
          // Opposing tangential streams carry the two flanks around the victim.
          const side=Math.tanh((px*Math.sin(this.mouthAngle)-pz*Math.cos(this.mouthAngle))*5);
          const front=(1+Math.cos(Math.atan2(pz,px)-this.mouthAngle))*.5;
          const flank=(.35+aggro*.85)*(1-front*.7)*smooth(this.phaseTime/openingTime)*smooth(distance/1.3);
          ax+=-pz/pr*side*flank;az+=px/pr*side*flank;
        }
      }
      if(this.phase==='EXTEND2'||this.phase==='SURROUND'){
        // Fill the enclosing ring deliberately; random flock gaps must not leave
        // visibly touching arms waiting several seconds to join.
        const route=smooth((1.3-distance)/.9)*this.predation;
        const targetAngle=i*2.39996323+this.time*.12;
        const error=Math.atan2(Math.sin(targetAngle-angle),Math.cos(targetAngle-angle));
        const ring=Math.max(.95,1.15*s.spread)+.1*Math.sin(i*1.7+this.time);
        ax+=route*(-dz/r*error*6-dx/r*(r-ring)*6);
        az+=route*(dx/r*error*6-dz/r*(r-ring)*6);
      }
      ax-=this.vx[i]*1.5;az-=this.vz[i]*1.5;
      const limit=Math.max(1,Math.hypot(ax,az)/(6+6*this.predation));this.ax[i]=ax/limit;this.az[i]=az/limit;
    }
    for(let i=0;i<this.count;i++){
      this.vx[i]+=this.ax[i]*dt;this.vz[i]+=this.az[i]*dt;
      const speed=Math.max(1,Math.hypot(this.vx[i],this.vz[i])/(2.5+1.5*this.predation));this.vx[i]/=speed;this.vz[i]/=speed;
      this.x[i]+=this.vx[i]*dt;this.z[i]+=this.vz[i]*dt;
      // A soft arena force avoids hard boundary projection jumps.
      const distance=Math.hypot(this.x[i],this.z[i]);if(distance>23){this.vx[i]-=this.x[i]/distance*(distance-23)*dt*8;this.vz[i]-=this.z[i]/distance*(distance-23)*dt*8;}
    }
    this.updateFeeding();
    this.updateEdge(dt);
    this.pinAnchor();
    this.detectPrey();
    this.chooseGroundAnchor();
  }
  private updateLure(dt:number){
    this.lure.update(dt,this.time,this.tuning,!this.holdingPrey&&this.phase!=='RECOVER');
    this.preyX=this.lure.x;this.preyZ=this.lure.z;
    this.instinct*=Math.exp(-dt/5);
    if(!this.tuning.hunting||this.tuning.vibrationSense<=0){this.instinct=0;return;}
    if(this.holdingPrey)return;
    for(const wave of this.lure.waves){
      const age=this.time-wave.time;
      if(wave.heard||age<0||age>WAVE_LIFETIME)continue;
      const radius=age*WAVE_SPEED;
      let received=Infinity;
      for(let i=-1;i<this.tentacleCount;i++){
        if(i>=0)sampleTendril(this,i,1,this.contactA,false);
        const x=i<0?this.centerX:this.contactA[0],z=i<0?this.centerZ:this.contactA[2];
        const distance=Math.hypot(x-wave.x,z-wave.z);
        if(Math.abs(distance-radius)<.35)received=Math.min(received,distance);
      }
      if(!Number.isFinite(received))continue;
      wave.heard=true;this.instinct=Math.max(this.instinct,clamp(wave.strength*this.tuning.vibrationSense*Math.exp(-received/24),0,1));
      this.instinctX=wave.x;this.instinctZ=wave.z;
    }
  }
  private updateEdge(dt:number){
    let mean=0;
    for(let i=0;i<this.count;i++){
      const dx=this.x[i]-this.centerX,dz=this.z[i]-this.centerZ,r=Math.hypot(dx,dz)||.001;
      this.polarX[i]=dx/r;this.polarZ[i]=dz/r;this.radial[i]=r*r;mean+=r*r/this.count;
    }
    const width=1-Math.cos(this.tuning.influenceWidth),regularizer=this.count*.002;
    for(let k=0;k<EDGE_SAMPLES;k++){
      let sum=regularizer*mean,total=regularizer;
      for(let i=0;i<this.count;i++){
        // Smooth compact support: no angular buckets or changing maximum particle.
        const v=Math.max(0,1-(1-this.polarX[i]*this.cos[k]-this.polarZ[i]*this.sin[k])/width),w=v*v*v;
        sum+=w*this.radial[i];total+=w;
      }
      const flock=Math.sqrt(sum/total)+.28;
      const guide=this.phase==='SEEK'||this.phase==='SPOT'||this.phase==='ANCHOR'||this.phase==='TRANSFER'||this.phase==='EXTEND2'?.92:this.phase==='SURROUND'?.78:0;
      this.desired[k]=flock*(1-guide)+this.probeRadius(k/EDGE_SAMPLES*tau)*guide;
    }
    const omega=2/Math.max(.035,this.tuning.response),decay=Math.exp(-omega*dt),tension=clamp(this.tuning.tension,0,3);
    const sample=(position:number)=>{
      const wrapped=(position+EDGE_SAMPLES)%EDGE_SAMPLES,k=Math.floor(wrapped),f=wrapped-k;
      return this.desired[k]*(1-f)+this.desired[(k+1)%EDGE_SAMPLES]*f;
    };
    for(let k=0;k<EDGE_SAMPLES;k++){
      // Broaden the smoothing neighborhood without negative filter weights.
      const a=sample(k-tension),b=this.desired[k],c=sample(k+tension);
      const target=Math.max(this.hole+.4,b+(a+c-2*b)*.45),error=this.edge[k]-target,v=this.edgeVelocity[k],temp=(v+omega*error)*dt;
      this.edge[k]=target+(error+temp)*decay;this.edgeVelocity[k]=(v-omega*temp)*decay;
    }
  }
  /** Keep the latent membrane field aligned with the planted tendril so the
   * handoff into predatory tissue starts from the same foothold. */
  private pinAnchor(){
    if(this.phase!=='SPOT'&&this.phase!=='ANCHOR'&&this.phase!=='TRANSFER')return;
    const dx=this.anchorX-this.centerX,dz=this.anchorZ-this.centerZ,distance=Math.hypot(dx,dz),base=.82*this.tuning.spread;
    const grip=this.anchorGrip*smooth((distance-base*.6)/(base*.6));
    if(grip<=0)return;
    const angle=Math.atan2(dz,dx),k=(angle/tau*EDGE_SAMPLES+EDGE_SAMPLES)%EDGE_SAMPLES,i=Math.floor(k),f=k-i;
    const sample=(values:Float64Array)=>{
      const a=values[(i+EDGE_SAMPLES-1)%EDGE_SAMPLES],b=values[i],c=values[(i+1)%EDGE_SAMPLES],d=values[(i+2)%EDGE_SAMPLES];
      return .5*(2*b+(-a+c)*f+(2*a-5*b+4*c-d)*f*f+(-a+3*b-3*c+d)*f*f*f);
    };
    // Reuse the scratch desired field for a continuous angular constraint.
    for(let j=0;j<EDGE_SAMPLES;j++){const delta=Math.atan2(Math.sin(j/EDGE_SAMPLES*tau-angle),Math.cos(j/EDGE_SAMPLES*tau-angle));this.desired[j]=Math.exp(-delta*delta/(2*.22*.22));}
    const correction=(distance-sample(this.edge))*grip/sample(this.desired);
    for(let j=0;j<EDGE_SAMPLES;j++){this.edge[j]+=correction*this.desired[j];this.edgeVelocity[j]*=1-grip*this.desired[j];}
  }
  /** Geometric local-chain test; neither disconnected clumps nor an open horseshoe can seal. */
  surrounded(){
    const angles=new Float64Array(this.count),unwrapped=new Float64Array(this.count).fill(NaN),eligible:number[]=[];
    const reach=.5*Math.sqrt(256/this.count),limit=Math.min(.7,reach);
    for(let i=0;i<this.count;i++){const dx=this.x[i]-this.preyX,dz=this.z[i]-this.preyZ,r=Math.hypot(dx,dz);if(r>.55&&r<2.8){eligible.push(i);angles[i]=Math.atan2(dz,dx);}}
    for(const start of eligible){if(Number.isFinite(unwrapped[start]))continue;unwrapped[start]=angles[start];const stack=[start];
      while(stack.length){const a=stack.pop()!;for(const b of eligible){if(a===b||(this.x[a]-this.x[b])**2+(this.z[a]-this.z[b])**2>limit*limit)continue;
        const next=unwrapped[a]+Math.atan2(Math.sin(angles[b]-angles[a]),Math.cos(angles[b]-angles[a]));
        if(Number.isFinite(unwrapped[b])){if(Math.abs(next-unwrapped[b])>Math.PI)return true;}else{unwrapped[b]=next;stack.push(b);}
      }}
    }return false;
  }
  /** Three rounded extensions share the existing tissue, rather than separate limb meshes. */
  private probeRadius(angle:number){
    const base=.82*this.tuning.spread;
    let radius=base;
    for(let i=0;i<this.tentacleCount;i++){const p=this.probes[i];
      const delta=Math.atan2(Math.sin(angle-p.angle),Math.cos(angle-p.angle));
      const width=.22-.045*this.whipBlend+.06*base/Math.max(base,p.length);
      radius+=Math.max(0,p.length-base)*Math.exp(-delta*delta/(2*width*width));
    }
    return radius;
  }
  private updateProbes(dt:number){
    const s=this.tuning,base=.82*s.spread;
    if(this.holdingPrey)return;
    const turn=(current:number,target:number,blend:number)=>current+Math.atan2(Math.sin(target-current),Math.cos(target-current))*blend;
    if(this.phase==='SEEK'){
      this.seekClock+=dt*(.75+.2*s.aggro);
      const heading=.4+this.seekClock*.065,orientation=smooth(this.instinct/.45);
      const bearing=Math.atan2(this.instinctZ-this.centerZ,this.instinctX-this.centerX);
      if(orientation<.01)this.trackingProbe=-1;
      if(orientation>.01&&this.trackingProbe<0){
        let best=Infinity;
        for(let i=0;i<this.tentacleCount;i++){const d=Math.abs(Math.atan2(Math.sin(this.probes[i].angle-bearing),Math.cos(this.probes[i].angle-bearing)));if(d<best){best=d;this.trackingProbe=i;}}
      }
      for(let i=0;i<this.tentacleCount;i++){
        const p=this.probes[i];p.clock+=dt*(.75+.2*s.aggro);
        if(p.clock>=p.duration){p.clock-=p.duration;p.cycle++;p.duration=4.8*(1+s.organic*(seekRandom(31+i*13+p.cycle*47)-.5)*.65);}
        const local=Math.max(0,p.clock)/p.duration,seed=31+i*13+p.cycle*47;
        const progress=clamp(local/.65,0,1),pose=seekingPose(progress,i+p.cycle*7,s.seekSweep,s.seekRate*(1+s.organic*(seekRandom(seed+2)-.5)*.5));
        const retract=1-smooth((local-.69)/.31);
        const hesitation=.1*s.organic*seekNoise(this.time*1.1,41+i*11)*Math.sin(progress*Math.PI);
        const extension=s.cycle?clamp(pose.extension+hesitation,0,1)*retract:.8;
        const reach=1+s.organic*(seekRandom(seed+5)-.5)*.24;
        let angle=heading+i*tau/this.tentacleCount+pose.sweep*.28+s.organic*(.28*seekNoise(this.time*.42,77+i*23)+.09*seekNoise(this.time*1.17,103+i*17));
        const attention=i===this.trackingProbe?.97:.16;
        angle=turn(angle,bearing+pose.sweep*.08,orientation*attention);
        p.angle=turn(p.angle,angle,1-Math.exp(-dt*(5+this.predation*this.tuning.frenzy*3)));
        const support=this.strides>0?smooth(1-this.phaseTime/2)*Math.max(base,this.spotLengths[i]*s.supportReach):base;
        const floor=s.supportReach>.3&&this.strides>0?Math.max(base,1.6*s.spread):base;
        const length=Math.max(support,floor+(s.reach*s.spread*reach-floor)*extension);
        p.length+=(length-p.length)*(1-Math.exp(-dt*8));
      }
    }else{
      const speed=1-Math.exp(-dt*(4+6*this.predation)),distance=Math.hypot(this.centerX-this.preyX,this.centerZ-this.preyZ);
      for(let i=0;i<this.tentacleCount;i++){
        const p=this.probes[i],side=i%2===0?1:-1;
        let angle=p.angle;let length:number;
        if(this.phase==='SPOT'){
          const u=smooth(this.phaseTime/(.32/this.huntRate));
          angle=i===this.chosenProbe?turn(this.spotAngles[i],this.mouthAngle,u):this.spotAngles[i];
          length=i===this.chosenProbe?Math.max(base,Math.hypot(this.anchorX-this.centerX,this.anchorZ-this.centerZ)):this.spotLengths[i]*(1-.35*u*(1-s.supportReach)/.75);
        }else if(this.phase==='ANCHOR'||this.phase==='TRANSFER'){
          angle=i===this.chosenProbe?Math.atan2(this.anchorZ-this.centerZ,this.anchorX-this.centerX):this.spotAngles[i];
          length=i===this.chosenProbe?Math.max(base,Math.hypot(this.anchorX-this.centerX,this.anchorZ-this.centerZ)):Math.max(base,this.spotLengths[i]*s.supportReach);
        }else if(this.phase==='EXTEND2'){
          const bias=s.organic*(i===(this.chosenProbe+1)%this.tentacleCount?-.08:.14);
          const u=clamp((this.phaseTime*this.huntRate/2.3-bias)/(1-bias),0,1);
          // A short backswing loads each flank, then a faster cast unfurls it.
          // Unequal starts and wave phases keep the two arms from mirroring.
          const cast=smooth((u-.10)/.48),settle=smooth((u-.55)/.45);
          angle=i===this.chosenProbe?this.mouthAngle+Math.PI:this.mouthAngle+side*(1.9-1.1*smooth(u)+.24*s.whipStrength*Math.sin(u*Math.PI*2)*(1-u))+s.organic*.07*Math.sin(this.time*1.3+i*2.1);
          length=i===this.chosenProbe?base+.3:base+(Math.min(s.reach*s.spread,distance+1.8*s.spread)*(1+side*.1*s.organic)-base)*cast*(1+.16*s.whipStrength*Math.sin(settle*Math.PI));
        }else if(this.phase==='SURROUND'){
          angle=i===this.chosenProbe?this.mouthAngle+Math.PI:this.mouthAngle+side*(this.gap+.28+side*.06*s.organic);
          length=i===this.chosenProbe?1.15*s.spread:(1.9+side*.13*s.organic+.12*Math.sin(this.time*1.2+i))*s.spread;
        }else{length=base;}
        const response=speed/(1+s.limbLag*s.muscleStrength*(.5+.5*Math.sin(i*2.37+1)));
        p.angle=turn(p.angle,angle,response);p.length+=(length-p.length)*response;
      }
    }
  }
  private detectPrey(){
    for(const p of this.probes){
      p.tipX=this.centerX+Math.cos(p.angle)*p.length;p.tipZ=this.centerZ+Math.sin(p.angle)*p.length;
    }
    if(!this.tuning.hunting||this.phase!=='SEEK'||this.lure.height>.08)return;
    let winner=-1,nearest=Infinity;
    for(let i=0;i<this.tentacleCount;i++){
      const p=this.probes[i];if(p.length<1.05*this.tuning.spread)continue;
      sampleTendril(this,i,0,this.contactA,false);
      for(let j=1;j<=32;j++){
        sampleTendril(this,i,j/32,this.contactB,false);
        const a=this.contactA,b=this.contactB,dx=b[0]-a[0],dz=b[2]-a[2],d2=dx*dx+dz*dz;
        const along=clamp(((this.preyX-a[0])*dx+(this.preyZ-a[2])*dz)/(d2||1),0,1);
        const distance=Math.hypot(a[0]+dx*along-this.preyX,a[2]+dz*along-this.preyZ);
        if(distance<nearest&&distance<a[3]+(b[3]-a[3])*along+this.preyRadius+this.tuning.senseDistance){nearest=distance;winner=i;}
        a.set(b);
      }
    }
    if(winner<0)return;
    // Sensing may happen along an arm, but anchoring always uses an EXISTING tip.
    let nearestTip=-1,tipDistance=Infinity;
    for(let arm=0;arm<this.tentacleCount;arm++){
      sampleTendril(this,arm,1,this.contactA,false);
      const d=Math.hypot(this.contactA[0]-this.preyX,this.contactA[2]-this.preyZ);
      if(d<tipDistance){tipDistance=d;nearestTip=arm;this.anchorX=this.contactA[0];this.anchorZ=this.contactA[2];}
      this.contactLengths[arm]=this.probes[arm].length;
      for(let j=0;j<=32;j++){sampleTendril(this,arm,j/32,this.contactA,false);this.attackPaths.set(this.contactA,(arm*33+j)*4);}
    }
    this.feedingMass=4/3*Math.PI*.68*.38*.64*(this.tuning.spread*this.tuning.tendrilWidth)**3;
    for(let arm=0;arm<this.tentacleCount;arm++)for(let j=1;j<=32;j++){
      const k=(arm*33+j)*4,a=this.attackPaths;
      this.feedingMass+=Math.PI*((a[k-1]+a[k+3])*.5)**2*Math.hypot(a[k]-a[k-4],a[k+1]-a[k-3],a[k+2]-a[k-2])*.9;
    }
    this.sensingProbe=winner;this.anchorU=1;this.contactTime=this.time;
    this.anchorAngle=this.probes[nearestTip].angle;this.anchorLength=this.probes[nearestTip].length;this.anchorTime=this.time;
    this.anchorFromX=this.centerX;this.anchorFromZ=this.centerZ;this.anchorTravel=this.previousAnchorTravel=0;
    // Pull along the planted tip's direction, stopping on the near side of prey.
    // The body must arrive before any engulfing tissue can grow.
    const dx=this.anchorX-this.centerX,dz=this.anchorZ-this.centerZ,d2=dx*dx+dz*dz;
    let approach=clamp(((this.preyX-this.centerX)*dx+(this.preyZ-this.centerZ)*dz)/(d2||1),0,1);
    const coreScale=Math.cbrt(this.feedingMass/(4/3*Math.PI*.68*.38*.64));
    const safe=Math.max(.85,.68*coreScale*CORE_FOOTPRINT+.08)+this.preyRadius;
    if(Math.hypot(this.centerX+dx*approach-this.preyX,this.centerZ+dz*approach-this.preyZ)<safe){
      let lo=0,hi=approach;
      for(let j=0;j<24;j++){const t=(lo+hi)/2;if(Math.hypot(this.centerX+dx*t-this.preyX,this.centerZ+dz*t-this.preyZ)>=safe)lo=t;else hi=t;}
      approach=lo;
    }
    this.drawX=this.centerX+dx*approach;this.drawZ=this.centerZ+dz*approach;
    this.wrapRootX=this.drawX;this.wrapRootZ=this.drawZ;
    this.chosenProbe=nearestTip;this.phase='SPOT';this.phaseTime=0;this.attackAge=0;this.anchorForPrey=true;
    this.mouthAngle=Math.atan2(this.preyZ-this.centerZ,this.preyX-this.centerX);
    for(let j=0;j<this.tentacleCount;j++){this.spotAngles[j]=this.probes[j].angle;this.spotLengths[j]=this.probes[j].length;}
  }
  /** Two visible opposing arms must touch at both ends and wind around prey. */
  tentaclesEnclose(){
    let winding=0,lastAngle=0,first=true;
    const a=new Float64Array(4),b=new Float64Array(4);
    sampleTendril(this,7,.95,a,false);sampleTendril(this,8,.95,b,false);
    if(Math.hypot(a[0]-b[0],a[2]-b[2])>a[3]+b[3])return false;
    sampleTendril(this,7,0,a,false);sampleTendril(this,8,0,b,false);
    if(Math.hypot(a[0]-b[0],a[2]-b[2])>a[3]+b[3])return false;
    for(let arm=0;arm<2;arm++)for(let i=0;i<=32;i++){
      sampleTendril(this,arm+7,(arm===0?i/32:1-i/32)*.95,a,false);
      const angle=Math.atan2(a[2]-this.preyZ,a[0]-this.preyX);
      if(!first)winding+=Math.atan2(Math.sin(angle-lastAngle),Math.cos(angle-lastAngle));
      first=false;lastAngle=angle;
    }
    return Math.abs(winding)>Math.PI*1.95;
  }
  /** Locomotion needs a real foothold even when no prey has been found. */
  private chooseGroundAnchor(){
    if(this.phase!=='SEEK'||!this.tuning.cycle||!this.tuning.anchoredLocomotion||this.phaseTime<2.5)return;
    const heading=this.instinct>.03?Math.atan2(this.instinctZ-this.centerZ,this.instinctX-this.centerX):.55+this.strides*.85;
    let best=-Infinity,winner=-1;
    for(let i=0;i<this.tentacleCount;i++){
      const p=this.probes[i];if(p.length<1.15*this.tuning.spread||Math.hypot(p.tipX,p.tipZ)>19)continue;
      const score=Math.cos(p.angle-heading)+p.length*.03;
      if(score>best){best=score;winner=i;}
    }
    if(winner<0)return;
    const p=this.probes[winner];this.chosenProbe=winner;this.anchorForPrey=false;
    this.anchorU=1;this.anchorAngle=p.angle;this.anchorLength=p.length;this.anchorTime=this.time;
    this.anchorX=p.tipX;this.anchorZ=p.tipZ;this.drawX=this.anchorX;this.drawZ=this.anchorZ;this.anchorFromX=this.centerX;this.anchorFromZ=this.centerZ;
    this.anchorTravel=this.previousAnchorTravel=0;this.mouthAngle=p.angle;this.phase='SPOT';this.phaseTime=0;
    for(let i=0;i<this.tentacleCount;i++){this.spotAngles[i]=this.probes[i].angle;this.spotLengths[i]=this.probes[i].length;}
  }
  private updateFeeding(){
    const urgency=this.huntRate;
    if(this.phase==='SPOT'){
      if(this.phaseTime>=.32/urgency){this.phase='ANCHOR';this.phaseTime=0;}
    }else if(this.phase==='ANCHOR'){
      if(this.phaseTime>=this.tuning.anchorHold/(this.anchorForPrey?1+this.tuning.frenzy*.65:1)){
        this.phase='TRANSFER';this.phaseTime=0;
        const distance=Math.hypot(this.drawX-this.anchorFromX,this.drawZ-this.anchorFromZ);
        this.anchorDuration=this.anchorForPrey?Math.max(.85,distance/3.5,this.tuning.anchorPull*(.7+.3*distance/6)/(1+.08*this.tuning.aggro)):Math.max(.4,this.tuning.anchorPull*(.6+.4*distance/6)/(.8+.2*this.tuning.aggro));
      }
    }else if(this.phase==='TRANSFER'){
      if(this.phaseTime>=this.anchorDuration){
        this.phase=this.anchorForPrey?'EXTEND2':'SEEK';this.phaseTime=0;
        if(!this.anchorForPrey){this.strides++;this.chosenProbe=-1;this.trackingProbe=-1;for(let i=0;i<this.tentacleCount;i++){this.probes[i].clock=-i*.22;if(this.tuning.supportReach<=.3)this.probes[i].length=.82*this.tuning.spread;}}
      }

    }else if(this.phase==='EXTEND2'){
      this.wrap=.64*smooth(this.phaseTime/Math.max(.9,2.8/urgency));
      if(this.wrap>=.64){this.phase='SURROUND';this.phaseTime=0;}
    }else if(this.phase==='SURROUND'){
      this.wrap=.64+.36*smooth(this.phaseTime/Math.max(.65,2.2/urgency));
      if(this.wrap>=.999&&this.tentaclesEnclose()){
        this.phase='FLATTEN';this.phaseTime=0;this.hole=.65;this.gap=0;
      }
    }else if(this.phase==='FLATTEN'){
      this.sheet=smooth(this.phaseTime/this.tuning.flattenTime);
      if(this.sheet>=1){this.phase='ENGULF';this.phaseTime=0;this.captureGap=0;}
    }else if(this.phase==='ENGULF'){
      const crawling=Math.min(1,Math.max(this.tuning.crawlSway,this.tuning.crawlLift));
      const duration=Math.max(2.8/urgency,.8*crawling/this.tuning.crawlRate),p=clamp(this.phaseTime/duration,0,1);
      const progress=smooth(p)*(1-crawling)+muscleProgress(p,this.tuning.muscleStrength)*crawling;
      const dx=this.preyX-this.drawX,dz=this.preyZ-this.drawZ,distance=Math.hypot(dx,dz);
      const sway=Math.min(.15*this.tuning.spread,distance*.08)*this.tuning.crawlSway*crawlSway(p,this.chosenProbe*1.73,this.tuning.crawlRate);
      this.centerX=this.drawX+dx*progress-dz/(distance||1)*sway;this.centerZ=this.drawZ+dz*progress+dx/(distance||1)*sway;
      this.hole=.65*(1-smooth(progress/.92));this.gap=this.captureGap*(1-smooth(this.phaseTime/(.45/urgency)));this.lift=.52*smooth(progress/.65);
      if(this.phaseTime>=duration){this.phase='ABSORB';this.phaseTime=0;this.hole=this.gap=0;}
    }else if(this.phase==='ABSORB'){
      this.preyScale=1-smooth(this.phaseTime/3);this.lift=.52*(.25+.75*this.preyScale);
      if(this.phaseTime>=3){
        this.meals++;this.phase='RECOVER';this.phaseTime=0;this.wrap=this.previousWrap=0;
        // Reset hidden limbs before unfurling, rather than reviving old search poses.
        for(let i=0;i<this.tentacleCount;i++){const p=this.probes[i];p.clock=-i*.22;p.cycle=0;p.length=p.previousLength=.82*this.tuning.spread;}
      }
    }else if(this.phase==='RECOVER'){
      const gather=recoveryGather(this.recoveryProgress(false));
      this.lift=.13*(1-gather);this.sheet=1-gather;
      if(this.phaseTime>=this.tuning.recoveryTime){this.phase='SEEK';this.phaseTime=0;this.seekClock=0;this.wrap=0;this.sheet=0;this.chosenProbe=-1;this.preyScale=1;const a=this.meals*2.4;const x=this.centerX+Math.cos(a)*9,z=this.centerZ+Math.sin(a)*9,scale=Math.max(1,Math.hypot(x,z)/18);this.preyX=x/scale;this.preyZ=z/scale;this.lure.reset(this.preyX,this.preyZ,this.time,this.tuning.seed+this.meals);this.instinct=0;this.trackingProbe=-1;if(this.tuning.hunting&&this.tuning.movingLure)this.lure.emit(this.time,.65);}
    }
  }
}
