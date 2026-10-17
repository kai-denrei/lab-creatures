import type { CutisSwarm } from '../cutis/swarm/controller.ts';
import { membranePhase } from '../cutis/swarm/locomotion.ts';
const clamp=(v:number)=>Math.max(0,Math.min(1,v));
const smooth=(a:number,b:number,v:number)=>{const t=clamp((v-a)/(b-a));return t*t*(3-2*t);};
export function segmentDistance(x:number,z:number,ax:number,az:number,bx:number,bz:number){const dx=bx-ax,dz=bz-az,t=clamp(((x-ax)*dx+(z-az)*dz)/(dx*dx+dz*dz||1));return Math.hypot(x-ax-t*dx,z-az-t*dz);}
/** Ground-plane body circles and sampled curved appendage capsules. */
export function contacts(swarm:CutisSwarm,x:number,z:number,radius:number,excluded?:Uint8Array){
  const bodyIds:number[]=[],appendageIds:number[]=[];
  let bodies=0,appendages=0;
  for(let i=0;i<swarm.count;i++){
    if(excluded?.[i])continue;
    const c=swarm.configFor(i),k=i*3,r=c.r0*swarm.scale[i],body=swarm.getCoreContact(i).center;
    if(Math.hypot(x-body.x,z-body.z)<r+radius){bodies++;bodyIds.push(i);}
    const raw=swarm.phase[i],phase=membranePhase(raw,c.rollVariant);
    if(phase<.1||raw>=.76)continue;
    const seeking=clamp((phase-.1)/.45),envelope=Math.sin(seeking*Math.PI)*(1-smooth(.78,1,seeking));
    const probes=[swarm.probe0,swarm.probe1,swarm.probe2];
    for(let j=0;j<swarm.probeCount[i];j++){
      const probe=probes[j],winner=j===swarm.chosenProbe[i],wave=seeking*c.seekRate*Math.PI*2+swarm.seed[i]+probe[k+2];
      let extension=clamp(seeking+.12*Math.sin(wave)*envelope);
      if(!winner)extension*=1-smooth(.55,.72,phase);
      if(extension<.05)continue;
      const angle=probe[k],hx=swarm.heading[k]*Math.cos(angle)+swarm.heading[k+2]*Math.sin(angle),hz=swarm.heading[k+2]*Math.cos(angle)-swarm.heading[k]*Math.sin(angle);
      const transfer=smooth(.62,.85,phase),release=smooth(.70,.76,raw);
      let px=body.x,pz=body.z,hit=false;
      for(let n=1;n<=16;n++){
        const t=n/16,bow=Math.sin(t*Math.PI)*extension;
        const side=r*(.85*bow*Math.sin(swarm.seed[i]+1.2)+c.seekSweep*t*envelope*(Math.sin(wave+(1-t)*2.4)+.3*Math.sin(wave*1.73+swarm.seed[i]+(1-t)*4)));
        const reach=probe[k+1]*extension*t;
        let qx=swarm.offset[k]+hx*reach+hz*side,qz=swarm.offset[k+2]+hz*reach-hx*side;
        // The root follows mass; the chosen foothold stays planted until release.
        const follow=winner?transfer*(1-t)+release*t:transfer;
        qx+=(body.x-swarm.offset[k])*follow;qz+=(body.z-swarm.offset[k+2])*follow;
        if(segmentDistance(x,z,px,pz,qx,qz)<radius+r*(n===16?.58:.10))hit=true;
        px=qx;pz=qz;
      }
      if(hit){appendages++;if(!appendageIds.includes(i))appendageIds.push(i);}
    }
  }
  return {bodies,appendages,bodyIds,appendageIds};
}
export class EvasionGame{
  x=0;z=0;radius=.2;elapsed=0;absorption=0;dead=false;won=false;paused=false;bodies=0;appendages=0;speed=0;
  pressure=0;freeTime=0;limbCount=4;
  heat=0;overheated=false;shakePulse=0;shakeCooldown=0;
  meals=0;feedingTarget=-1;feedingTime=0;feedingDuration=5;notice='Isolate a hunter. Center over it and press E or click it to feed.';
  private gaitSpeed=2.1;
  gripX=0;gripZ=0;
  y=0;falling=false;fallSpeed=0;deathReason='';capture=0;devourTime=0;devouring=false;legsCut=0;
  fallen=new Uint8Array(300);consumed=new Uint8Array(300);removed=new Uint8Array(300);
  fallVelocity=new Float64Array(300);bodyGrip=new Float64Array(300);armGrip=new Float64Array(300);cooldown=new Float64Array(300);
  get strength(){return Math.min(1,this.meals/6);}
  get energy(){return 1-this.heat;}
  get pinThreshold(){return 2+Math.floor(this.strength*2);}
  get feedingTolerance(){return Math.floor(this.strength*2);}
  get feedingProgress(){return clamp(this.feedingTime/this.feedingDuration);}
  get bloodlust(){return Math.min(4,Math.floor(this.elapsed/10));}
  get huntSpeed(){return (1+this.bloodlust*.18)*(1+.65*this.pressure);}
  remaining(swarm:CutisSwarm){let count=0;for(let i=0;i<swarm.count;i++)if(!this.removed[i])count++;return count;}
  reset(){
    this.pressure=0;this.freeTime=0;this.gaitSpeed=2.1;this.heat=0;this.overheated=false;this.shakePulse=0;this.shakeCooldown=0;
    this.meals=0;this.feedingTarget=-1;this.feedingTime=0;this.feedingDuration=5;this.notice='Isolate a hunter. Center over it and press E or click it to feed.';
    this.x=0;this.z=0;this.elapsed=0;this.absorption=0;this.dead=false;this.won=false;this.paused=false;this.bodies=0;this.appendages=0;this.speed=0;
    this.y=0;this.falling=false;this.fallSpeed=0;this.deathReason='';this.capture=0;this.devourTime=0;this.devouring=false;this.legsCut=0;
    for(const a of [this.fallen,this.consumed,this.removed,this.fallVelocity,this.bodyGrip,this.armGrip,this.cooldown])a.fill(0);
  }
  get state(){return this.won?'APEX':this.dead?this.deathReason:this.paused?'PAUSED':this.falling?'FALLING':this.devouring?(this.legsCut<this.limbCount?'SEVERING':'ABSORBING'):this.feedingTarget>=0?'FEEDING':this.bodies>=this.pinThreshold?'CAPTURED':this.bodies>0?'GRIPPED':this.appendages?'ENTANGLED':this.strength>=1?'HUNTING':'EVADING';}
  resolve(dt:number,contact:{bodies:number;appendages:number}){
    this.bodies=contact.bodies;this.appendages=contact.appendages;
    if(!this.devouring){this.capture=clamp(this.capture+(this.bodies>=this.pinThreshold?dt/(1.1+this.strength):-dt*.35));if(this.capture>=1)this.devouring=true;}
    if(this.devouring){this.devourTime+=dt;this.legsCut=Math.min(this.limbCount,Math.floor(this.devourTime/2*this.limbCount));this.absorption=clamp((this.devourTime-2)/2);if(this.absorption>=1){this.dead=true;this.deathReason='PHAGOCYTED';}}
  }
  feedingCandidate(swarm:CutisSwarm){
    let nearest=-1,distance=.2+this.strength*.08;
    for(let i=0;i<swarm.count;i++){
      if(this.removed[i])continue;
      const center=swarm.getCoreContact(i).center,d=Math.hypot(center.x-this.x,center.z-this.z);
      if(d<distance){nearest=i;distance=d;}
    }
    return nearest;
  }
  canAct(){return !this.dead&&!this.won&&!this.paused&&!this.falling&&!this.devouring;}
  /** Feeding is explicit; shaking never starts a meal. */
  eat(swarm:CutisSwarm,requestedTarget?:number){
    if(!this.canAct()||this.feedingTarget>=0)return false;
    const target=this.feedingCandidate(swarm);
    if(target<0||requestedTarget!==undefined&&target!==requestedTarget){this.notice='Move directly over the hunter, then press E or click it.';return false;}
    if(this.bodies>=this.pinThreshold){this.notice='Held down. Shake a hunter loose before feeding.';return false;}
    if(this.energy<.12){this.notice='Too exhausted to feed. Recover energy first.';return false;}
    this.feedingTarget=target;this.feedingTime=0;this.feedingDuration=5-3*this.strength;this.heat=clamp(this.heat+.12);
    this.bodyGrip[target]=0;this.armGrip[target]=0;swarm.suspended[target]=1;
    this.notice='Feeding: cradle, lower, absorb. Move to abandon; Space shakes one hunter loose.';
    return true;
  }
  private abandonFeeding(swarm:CutisSwarm){
    const target=this.feedingTarget;if(target<0)return;
    // Failed attempts give no partial nutrition and leave the victim gripping Reed.
    if(!this.removed[target]){this.bodyGrip[target]=Math.max(this.bodyGrip[target],1.3);swarm.suspended[target]=1;}
    this.feedingTarget=-1;this.feedingTime=0;this.notice='Feeding interrupted. No meal gained; the hunter grips back.';
  }
  shake(swarm:CutisSwarm){
    if(!this.canAct()||this.overheated||this.shakeCooldown>0)return false;
    if(this.energy<.48){this.notice='Shaking needs 48% energy. Red means exhausted and slower.';return false;}
    const gripping=this.feedingTarget>=0||this.bodyGrip.some(v=>v>0)||this.armGrip.some(v=>v>0);
    if(!gripping){this.notice='No grip to shake off. Use E or click a centered hunter to feed.';return false;}
    this.abandonFeeding(swarm);
    this.heat=clamp(this.heat+.48);this.overheated=this.heat>=.85;
    this.gaitSpeed=Math.min(this.gaitSpeed,.55);this.speed=this.gaitSpeed*(1-.6*this.heat)*(1-.35*this.pressure);
    this.shakePulse=.32;this.shakeCooldown=1.6;this.capture=Math.max(0,this.capture-.25);
    let released=-1;
    for(let i=0;i<swarm.count;i++)if(!this.removed[i]&&this.bodyGrip[i]>0){released=i;break;}
    if(released<0)for(let i=0;i<swarm.count;i++)if(!this.removed[i]&&this.armGrip[i]>0){released=i;break;}
    if(released>=0){this.bodyGrip[released]=0;this.armGrip[released]=0;this.cooldown[released]=.3;swarm.suspended[released]=0;}
    this.bodies=Array.from(this.bodyGrip).filter(v=>v>0).length;this.appendages=Array.from(this.armGrip).filter(v=>v>0).length;
    this.notice='One hunter shaken loose. The others keep holding. Distress still draws the pack.';return true;
  }
  /** Distress makes the pack converge tightly instead of politely keeping its distance. */
  advanceHunters(dt:number,swarm:CutisSwarm){
    swarm.config.separation=.8*(1-.9*this.pressure);
    swarm.config.cohesion=.15+this.pressure*.65;
    swarm.step(dt*this.huntSpeed,{x:this.x,z:this.z});
  }
  predators(dt:number,swarm:CutisSwarm){
    for(let i=0;i<swarm.count;i++){
      const k=i*3;
      if(this.consumed[i]){swarm.suspended[i]=1;continue;}
      const p=swarm.position(i);
      if(!this.fallen[i]&&Math.hypot(p[0],p[2])>12){this.fallen[i]=1;this.removed[i]=1;this.bodyGrip[i]=0;this.armGrip[i]=0;}
      if(this.fallen[i]){swarm.suspended[i]=1;this.fallVelocity[i]+=9.8*dt;swarm.offset[k+1]-=this.fallVelocity[i]*dt;}
    }
  }
  step(dt:number,dx:number,dz:number,swarm:CutisSwarm,locomotion?:(dt:number,dx:number,dz:number,speed:number)=>{x:number;z:number}){
    if(this.dead||this.won||this.paused)return;
    this.elapsed+=dt;this.shakePulse=Math.max(0,this.shakePulse-dt);this.shakeCooldown=Math.max(0,this.shakeCooldown-dt);
    this.heat=clamp(this.heat+dt*(this.bodies>0?.09:this.appendages>0?.035:this.feedingTarget>=0?0:-.06));
    if(this.heat>=.85)this.overheated=true;if(this.overheated&&this.heat<=.35)this.overheated=false;
    this.predators(dt,swarm);
    if(this.falling){this.fallSpeed+=9.8*dt;this.y-=this.fallSpeed*dt;if(this.y< -7){this.dead=true;this.deathReason='FELL';}return;}
    if(this.feedingTarget<0)this.y=Math.max(0,this.y-dt*2);
    if(this.feedingTarget>=0&&(Math.hypot(dx,dz)>.1||this.removed[this.feedingTarget]))this.abandonFeeding(swarm);
    const contact=contacts(swarm,this.x,this.z,this.radius,this.removed);
    for(let i=0;i<swarm.count;i++){
      if(this.removed[i])continue;
      if(i===this.feedingTarget){swarm.suspended[i]=1;continue;}
      this.cooldown[i]=Math.max(0,this.cooldown[i]-dt);
      if(contact.bodyIds.includes(i)&&this.cooldown[i]<=0)this.bodyGrip[i]=3.6;
      if(contact.appendageIds.includes(i)&&this.cooldown[i]<=0)this.armGrip[i]=1.4;
      this.armGrip[i]=Math.max(0,this.armGrip[i]-dt);
      if(this.bodyGrip[i]>0&&!this.devouring){this.bodyGrip[i]=Math.max(0,this.bodyGrip[i]-dt);if(!this.bodyGrip[i])this.cooldown[i]=.15;}
      swarm.suspended[i]=this.bodyGrip[i]>0?1:0;
    }
    let bodies=Array.from(this.bodyGrip).filter(v=>v>0).length;
    const arms=Array.from(this.armGrip).filter(v=>v>0).length;
    if(bodies||arms){this.freeTime=0;this.pressure=clamp(this.pressure+dt*(.24*bodies+.14*arms));}
    else{this.freeTime+=dt;if(this.freeTime>2)this.pressure=Math.max(0,this.pressure-dt*.07);}
    if(this.feedingTarget>=0&&bodies>this.feedingTolerance){this.abandonFeeding(swarm);bodies=Array.from(this.bodyGrip).filter(v=>v>0).length;}
    if(bodies>=this.pinThreshold&&this.bodies<this.pinThreshold){this.gripX=this.x;this.gripZ=this.z;}
    this.resolve(dt,{bodies,appendages:arms});
    if(this.feedingTarget>=0){
      const target=this.feedingTarget,center=swarm.getCoreContact(target).center;
      this.x=center.x;this.z=center.z;this.y=0;
      // Outside appendages or tolerated body grips double the exposure time.
      this.feedingTime+=dt*(bodies||arms?.5:1);
      this.speed=0;locomotion?.(dt,0,0,0);
      if(this.feedingProgress>=1){
        this.consumed[target]=1;this.removed[target]=1;swarm.offset.set([1000,-30,1000],target*3);swarm.anchor.set([1000,-30,1000],target*3);swarm.suspended[target]=1;
        this.meals++;this.heat=Math.max(0,this.heat-.32);if(this.heat<=.35)this.overheated=false;
        this.feedingTarget=-1;this.feedingTime=0;this.notice='Meal absorbed. More grip resistance, faster feeding, energy restored.';
      }
    }else{
      const contactSpeed=this.dead?0:this.devouring?.08:this.bodies>=this.pinThreshold?.18:this.bodies>1?.65+.55*this.strength:this.bodies===1?.75+.9*this.strength:this.appendages?(.28+.92*this.strength)/(1+.3*Math.max(0,this.appendages-1)):2.1;
      // Preserve the slow recovery from contact; exhaustion also reduces physical gait speed.
      this.gaitSpeed=Math.min(contactSpeed,this.gaitSpeed+.33*(1-.65*this.pressure)*dt);
      this.speed=this.gaitSpeed*(1-.6*this.heat)*(1-.35*this.pressure);
      const length=Math.max(1,Math.hypot(dx,dz));
      const delta=locomotion?locomotion(dt,dx/length,dz/length,this.speed):{x:dx/length*this.speed*dt,z:dz/length*this.speed*dt};
      this.x+=delta.x;this.z+=delta.z;
      if(this.bodies>=this.pinThreshold||this.devouring){const gx=this.x-this.gripX,gz=this.z-this.gripZ,d=Math.hypot(gx,gz),limit=.08*(1-this.absorption);if(d>limit){this.x=this.gripX+gx/d*limit;this.z=this.gripZ+gz/d*limit;}}
    }
    if(Math.hypot(this.x,this.z)>12){this.falling=true;this.speed=0;for(let i=0;i<swarm.count;i++){this.bodyGrip[i]=0;this.armGrip[i]=0;if(!this.removed[i])swarm.suspended[i]=0;}}
    if(!this.falling&&!this.dead&&!this.devouring&&this.remaining(swarm)===0){this.won=true;this.speed=0;this.notice='Arena cleared. The prey became the predator.';}
  }
}

/** A 240-degree horseshoe leaves a 120-degree escape corridor toward W / up. */
export function startingHunterPosition(index:number,count=12){
  const angle=-Math.PI/6+index/Math.max(1,count-1)*(Math.PI*4/3);
  return {x:Math.cos(angle)*6.5,z:Math.sin(angle)*6.5};
}
