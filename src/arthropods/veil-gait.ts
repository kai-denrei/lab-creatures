import { Vector3 } from 'three/webgpu';
import { ArthropodGait } from './gait.ts';

/** Elastic rim anchors: independent extensions, never paired skeletal footsteps. */
export class VeilGait extends ArthropodGait {
  curvature:number[]=[];
  private deadlines:number[]=[];
  private curveTargets:number[]=[];
  private seed=9317;
  private launchClock=0;
  private velocity=new Vector3();
  constructor(){super('veil');this.bodyHeight=.010;this.reset();}
  private random(){this.seed=(Math.imul(this.seed,1664525)+1013904223)>>>0;return this.seed/4294967296;}
  override nominal(i:number){
    const angle=i/12*Math.PI*2,radius=.164+.013*Math.sin(i*2.37);
    return new Vector3(this.center.x+Math.sin(angle)*radius,.005,this.center.z+Math.cos(angle)*radius);
  }
  override reset(){
    super.reset();this.center.y=.010;this.seed=9317;this.launchClock=0;
    this.curvature=Array(12).fill(0);this.curveTargets=Array(12).fill(0);
    this.deadlines=Array.from({length:12},()=>.15+this.random()*1.5);
    this.velocity=new Vector3();
    this.legs.forEach((leg,i)=>{leg.foot.copy(this.nominal(i));leg.from.copy(leg.foot);leg.to.copy(leg.foot);});
  }
  override step(dt:number){
    this.time+=dt;
    const direction=this.target.clone().sub(this.center);direction.y=0;
    const distance=direction.length();direction.normalize();
    const bursting=this.walking&&this.drive>2.5;
    const moving=this.walking&&this.drive>0&&distance>.012;
    const desired=direction.clone().multiplyScalar(moving?(bursting?Math.min(.52,.035*this.drive*this.speed):.008*this.speed*Math.min(1,this.drive)):0);
    this.velocity.lerp(desired,1-Math.exp(-dt*(bursting?35:10)*Math.sqrt(this.turnRate)));
    if(!moving)this.velocity.set(0,0,0);
    const before=this.center.clone(),motion=this.velocity.clone().multiplyScalar(dt);
    if(motion.length()>distance)motion.setLength(distance);
    this.center.add(motion);
    // Keep rim anchors in their sectors so broad webbing cannot cross itself.
    const valid=()=>this.legs.every((leg,i)=>{
      const d=leg.foot.clone().sub(this.center),radius=Math.hypot(d.x,d.z),angle=Math.atan2(d.x,d.z)-i/12*Math.PI*2;
      return radius>.085&&radius<.29&&Math.abs(Math.atan2(Math.sin(angle),Math.cos(angle)))<.225;
    });
    if(!valid())this.center.copy(before);
    this.center.y=.010-Math.min(.004,this.crouch*.12);
    this.abdomenPitch+=(this.abdomenTarget-this.abdomenPitch)*(1-Math.exp(-dt*8));
    this.launchClock-=dt;
    const active=this.legs.filter(leg=>!leg.planted).length;
    if(this.walking&&this.launchClock<=0&&active<(bursting?5:3)){
      let selected=-1,best=-Infinity;
      this.legs.forEach((leg,i)=>{
        if(!leg.planted)return;
        const rest=this.nominal(i),strain=rest.distanceTo(leg.foot),due=this.time-this.deadlines[i];
        if(due<0&&strain<.035)return;
        const score=strain*20+due*.15+.1*Math.sin(i*7.3+this.time);
        if(score>best){best=score;selected=i;}
      });
      if(selected>=0){
        const i=selected,leg=this.legs[i],angle=i/12*Math.PI*2+(this.random()-.5)*.16;
        const radial=new Vector3(Math.sin(angle),0,Math.cos(angle)),alignment=radial.dot(direction);
        const radius=.132+this.random()*.043+Math.max(0,alignment)*(bursting?.065:.048)*(moving?1:.35);
        leg.from.copy(leg.foot);leg.to.copy(this.center).addScaledVector(radial,radius);leg.to.y=.005;
        leg.duration=(bursting?.09+this.random()*.13:.65+this.random()*1.15)/Math.sqrt(this.speed);
        leg.swing=0;leg.planted=false;this.curveTargets[i]=(this.random()-.5)*.16;
        this.launchClock=(bursting?.025+this.random()*.025:.14+this.random()*.24)/Math.sqrt(this.speed);
      }
    }
    this.legs.forEach((leg,i)=>{
      this.curvature[i]+=(this.curveTargets[i]-this.curvature[i])*(1-Math.exp(-dt*3));
      if(leg.planted)return;
      leg.swing=Math.min(1,leg.swing+dt/leg.duration);
      const t=leg.swing,ease=t*t*(3-2*t);
      leg.foot.lerpVectors(leg.from,leg.to,ease);
      // Keep the web flat: only a small, individual rim curl lifts off the table.
      leg.foot.y+=Math.sin(Math.PI*t)*Math.min(.008,this.footLift*.16);
      if(t===1){leg.foot.copy(leg.to);leg.planted=true;this.deadlines[i]=this.time+(bursting?.10+this.random()*.20:.35+this.random()*1.8)/Math.sqrt(this.speed);}
    });
  }
}
