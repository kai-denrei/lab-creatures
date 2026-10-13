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
  x=0;z=0;radius=.2;elapsed=0;absorption=0;dead=false;paused=false;bodies=0;appendages=0;speed=0;
  heat=0;overheated=false;shakePulse=0;shakeCooldown=0;
  gripX=0;gripZ=0;
  y=0;falling=false;fallSpeed=0;deathReason='';capture=0;devourTime=0;devouring=false;legsCut=0;
  fallen=new Uint8Array(300);fallVelocity=new Float64Array(300);bodyGrip=new Float64Array(300);armGrip=new Float64Array(300);cooldown=new Float64Array(300);
  get bloodlust(){return Math.floor(this.elapsed/10);}
  get huntSpeed(){return 1+this.bloodlust*.18;}
  reset(){this.heat=0;this.overheated=false;this.shakePulse=0;this.shakeCooldown=0;this.x=0;this.z=0;this.elapsed=0;this.absorption=0;this.dead=false;this.paused=false;this.bodies=0;this.appendages=0;this.speed=0;this.y=0;this.falling=false;this.fallSpeed=0;this.deathReason='';this.capture=0;this.devourTime=0;this.devouring=false;this.legsCut=0;for(const a of [this.fallen,this.fallVelocity,this.bodyGrip,this.armGrip,this.cooldown])a.fill(0);}
  get state(){return this.dead?this.deathReason:this.paused?'PAUSED':this.falling?'FALLING':this.devouring?(this.legsCut<4?'SEVERING':'ABSORBING'):this.bodies>=2?'CAPTURED':this.bodies===1?'GRIPPED':this.appendages?'ENTANGLED':'EVADING';}
  resolve(dt:number,contact:{bodies:number;appendages:number}){
    this.bodies=contact.bodies;this.appendages=contact.appendages;
    if(!this.devouring){this.capture=clamp(this.capture+(this.bodies>=2?dt/1.4:-dt*2));if(this.capture>=1)this.devouring=true;}
    if(this.devouring){this.devourTime+=dt;this.legsCut=Math.min(4,Math.floor(this.devourTime/.5));this.absorption=clamp((this.devourTime-2)/2);if(this.absorption>=1){this.dead=true;this.deathReason='PHAGOCYTED';}}
  }
  shake(swarm:CutisSwarm){
    if(this.dead||this.paused||this.falling||this.devouring||this.overheated||this.shakeCooldown>0)return false;
    this.heat=clamp(this.heat+.26);this.overheated=this.heat>=1;
    this.shakePulse=.32;this.shakeCooldown=.38;this.capture=Math.max(0,this.capture-.75);
    for(let i=0;i<swarm.count;i++)if(!this.fallen[i]){
      this.bodyGrip[i]=0;this.armGrip[i]=0;this.cooldown[i]=.85;swarm.suspended[i]=0;
    }
    this.bodies=0;this.appendages=0;return true;
  }
  predators(dt:number,swarm:CutisSwarm){
    for(let i=0;i<swarm.count;i++){
      const k=i*3,p=swarm.position(i);
      if(!this.fallen[i]&&Math.hypot(p[0],p[2])>12){this.fallen[i]=1;this.bodyGrip[i]=0;this.armGrip[i]=0;}
      if(this.fallen[i]){swarm.suspended[i]=1;this.fallVelocity[i]+=9.8*dt;swarm.offset[k+1]-=this.fallVelocity[i]*dt;}
    }
  }
  step(dt:number,dx:number,dz:number,swarm:CutisSwarm,locomotion?:(dt:number,dx:number,dz:number,speed:number)=>{x:number;z:number}){
    if(this.dead||this.paused)return;
    this.elapsed+=dt;this.shakePulse=Math.max(0,this.shakePulse-dt);this.shakeCooldown=Math.max(0,this.shakeCooldown-dt);this.heat=clamp(this.heat+dt*(this.bodies>0?.12:this.appendages>0?.04:-.18));if(this.heat>=1)this.overheated=true;if(this.overheated&&this.heat<=.45)this.overheated=false;this.predators(dt,swarm);
    if(this.falling){this.fallSpeed+=9.8*dt;this.y-=this.fallSpeed*dt;if(this.y< -7){this.dead=true;this.deathReason='FELL';}return;}
    const contact=contacts(swarm,this.x,this.z,this.radius,this.fallen);
    for(let i=0;i<swarm.count;i++){
      if(this.fallen[i])continue;
      this.cooldown[i]=Math.max(0,this.cooldown[i]-dt);
      if(contact.bodyIds.includes(i)&&this.bodyGrip[i]<=0&&this.cooldown[i]<=0)this.bodyGrip[i]=2.2;
      if(contact.appendageIds.includes(i)&&this.cooldown[i]<=0)this.armGrip[i]=.7;
      this.armGrip[i]=Math.max(0,this.armGrip[i]-dt);
      if(this.bodyGrip[i]>0&&!this.devouring){this.bodyGrip[i]=Math.max(0,this.bodyGrip[i]-dt);if(!this.bodyGrip[i])this.cooldown[i]=1;}
      swarm.suspended[i]=this.bodyGrip[i]>0?1:0;
    }
    const bodies=Array.from(this.bodyGrip).filter(v=>v>0).length,arms=Array.from(this.armGrip).filter(v=>v>0).length;
    if(bodies>=2&&this.bodies<2){this.gripX=this.x;this.gripZ=this.z;}
    this.resolve(dt,{bodies,appendages:arms});
    this.speed=this.dead?0:this.devouring?.08:this.bodies>=2?.18:this.bodies===1?1.15:this.appendages?.45:2.1;
    const length=Math.max(1,Math.hypot(dx,dz));
    const delta=locomotion?locomotion(dt,dx/length,dz/length,this.speed):{x:dx/length*this.speed*dt,z:dz/length*this.speed*dt};
    this.x+=delta.x;this.z+=delta.z;
    if(this.bodies>=2||this.devouring){const gx=this.x-this.gripX,gz=this.z-this.gripZ,d=Math.hypot(gx,gz),limit=.08*(1-this.absorption);if(d>limit){this.x=this.gripX+gx/d*limit;this.z=this.gripZ+gz/d*limit;}}
    if(Math.hypot(this.x,this.z)>12){this.falling=true;this.speed=0;for(let i=0;i<swarm.count;i++){this.bodyGrip[i]=0;this.armGrip[i]=0;if(!this.fallen[i])swarm.suspended[i]=0;}}
  }
}

/** A 240-degree horseshoe leaves a 120-degree escape corridor toward W / up. */
export function startingHunterPosition(index:number,count=12){
  const angle=-Math.PI/6+index/Math.max(1,count-1)*(Math.PI*4/3);
  return {x:Math.cos(angle)*6.5,z:Math.sin(angle)*6.5};
}
