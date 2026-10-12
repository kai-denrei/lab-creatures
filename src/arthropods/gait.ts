import type { LabVariant } from './variants.ts';
import { Euler, Vector3 } from 'three/webgpu';

export const FEMUR=.083, TIBIA=.108, BODY_HEIGHT=.086;
export const LEG_NAMES=['Coxa','Trochanter','Femur','Tibia','Tarsi','Pretarsus'] as const;
export const ANATOMY_COLORS=['#dfb86b','#c87b61','#9fb783','#7faeb6','#b399ce','#ddd9bf'];
const UP=new Vector3(0,1,0);

/** Two rigid links, with an outward/upward knee. No segment stretching. */
export function solveKnee(hip:Vector3,ankle:Vector3,bend:Vector3,upper=FEMUR,lower=TIBIA){
  const axis=ankle.clone().sub(hip),distance=axis.length();
  axis.normalize();
  const d=Math.max(Math.abs(upper-lower)+1e-6,Math.min(upper+lower-1e-6,distance));
  const along=(upper*upper-lower*lower+d*d)/(2*d);
  const perpendicular=bend.clone().addScaledVector(axis,-bend.dot(axis));
  if(perpendicular.lengthSq()<1e-10)perpendicular.copy(UP).addScaledVector(axis,-axis.y);
  perpendicular.normalize();
  return hip.clone().addScaledVector(axis,along).addScaledVector(perpendicular,Math.sqrt(Math.max(0,upper*upper-along*along)));
}

export class ArthropodGait {
  breed:LabVariant;
  bodyHeight=BODY_HEIGHT;
  upperLength=FEMUR;
  lowerLength=TIBIA;
  center=new Vector3(0,BODY_HEIGHT,0);
  heading=0;
  time=0;
  speed=1;
  walking=true;
  drive=1;
  turnRate=1;
  footLift=.022;
  facing:Vector3|null=null;
  crouch=0;
  pitch=0;
  roll=0;
  pitchTarget=0;
  rollTarget=0;
  abdomenPitch=0;
  abdomenTarget=0;
  alert=0;
  target=new Vector3(0,0,.2);
  legs=Array.from({length:6},(_,i)=>({
    side:i<3?-1:1,row:i%3,foot:new Vector3(),from:new Vector3(),to:new Vector3(),swing:1,
    planted:true,duration:.25,
  }));
  private nextTripod=0;
  private stepClock=0;
  constructor(breed:LabVariant='aculis'){
    this.breed=breed;
    const pairs=breed==='isopod'?7:breed==='veil'?6:3;
    if(breed==='oculus'||breed==='monoculus'){this.bodyHeight=.098;this.upperLength=.105;this.lowerLength=.138;}
    if(breed==='isopod'){this.bodyHeight=.050;this.upperLength=.042;this.lowerLength=.058;}
    this.legs=Array.from({length:pairs*2},(_,i)=>({side:i<pairs?-1:1,row:i%pairs,foot:new Vector3(),from:new Vector3(),to:new Vector3(),swing:1,planted:true,duration:.25}));
    this.reset();
  }
  attachment(i:number,section:number){
    const leg=this.legs[i];
    if(this.breed==='veil'){
      const angle=i/this.legs.length*Math.PI*2,radius=[.012,.021,.029][section];
      return this.local(Math.sin(angle)*radius,-section*.004,Math.cos(angle)*radius);
    }
    const x=this.breed==='monoculus'?[.004,.008,.015][section]:this.breed==='oculus'?[.008,.014,.022][section]:this.breed==='isopod'?[.040,.050,.057][section]:[.014,.023,.029][section];
    const z=this.breed==='monoculus'?[.010,0,-.008][leg.row]:this.breed==='oculus'?[.018,.003,-.014][leg.row]:this.breed==='isopod'?.068-leg.row*.023:[.035,.005,-.027][leg.row];
    return this.local(leg.side*x,-section*.004,z);
  }
  local(x:number,y:number,z:number){return new Vector3(x,y,z).applyEuler(new Euler(this.pitch,this.heading,this.roll,'YXZ')).add(this.center);}
  nominal(i:number,ahead=0){
    const leg=this.legs[i];
    const angle=i/this.legs.length*Math.PI*2;
    const x=this.breed==='veil'?Math.sin(angle)*.167:this.breed==='isopod'?leg.side*.117:(this.breed==='oculus'||this.breed==='monoculus')?leg.side*(leg.row===1?.205:.180):leg.side*(leg.row===1?.163:.136);
    const z=(this.breed==='veil'?Math.cos(angle)*.167:this.breed==='isopod'?.078-leg.row*.026:(this.breed==='oculus'||this.breed==='monoculus')?[.130,0,-.140][leg.row]:[.113,0,-.118][leg.row])+ahead;
    const p=new Vector3(x,0,z).applyAxisAngle(UP,this.heading).add(this.center);p.y=.008;return p;
  }
  reset(){
    this.center.set(0,this.bodyHeight,0);this.heading=0;this.time=0;this.stepClock=0;this.nextTripod=0;this.pitch=0;this.roll=0;this.abdomenPitch=0;this.crouch=0;this.pitchTarget=0;this.rollTarget=0;this.abdomenTarget=0;this.facing=null;this.drive=1;
    this.legs.forEach((leg,i)=>{leg.foot.copy(this.nominal(i));leg.from.copy(leg.foot);leg.to.copy(leg.foot);leg.swing=1;leg.planted=true;});
  }
  step(dt:number){
    this.time+=dt;
    const delta=this.target.clone().sub(this.center);delta.y=0;
    const moving=this.walking&&this.drive>0&&delta.length()>.012;
    const face=(this.facing??this.target).clone().sub(this.center);
    const desired=Math.atan2(face.x,face.z),angle=Math.atan2(Math.sin(desired-this.heading),Math.cos(desired-this.heading));
    const turning=this.walking&&Math.abs(angle)>.04&&Math.hypot(face.x,face.z)>.015;
    const previous=this.center.clone(),oldHeading=this.heading,oldPitch=this.pitch,oldRoll=this.roll;
    const velocity=new Vector3();
    if(turning)this.heading+=Math.max(-dt*.65*this.speed*this.turnRate,Math.min(dt*.65*this.speed*this.turnRate,angle));
    if(moving){
      if(this.facing)velocity.copy(delta).normalize();
      else velocity.set(Math.sin(this.heading),0,Math.cos(this.heading)).multiplyScalar(Math.max(.15,Math.cos(angle)));
      velocity.multiplyScalar(.032*this.speed*this.drive);
      this.center.addScaledVector(velocity,Math.min(dt,delta.length()/Math.max(.001,velocity.length())));
    }
    const blend=1-Math.exp(-dt*12);
    this.center.y+=(Math.max(this.breed==='isopod'?.042:.043,this.bodyHeight-this.crouch)+Math.sin(this.time*2.4)*.001-this.center.y)*blend;
    this.pitch+=(Math.max(-.12,Math.min(.12,this.pitchTarget))-this.pitch)*blend;this.roll+=(this.rollTarget-this.roll)*blend;
    this.abdomenPitch+=(Math.max(-.30,this.abdomenTarget)-this.abdomenPitch)*blend;
    // The planted feet constrain the torso. Never stretch a rigid link to complete a command.
    const proposed=this.center.clone(),newHeading=this.heading,newPitch=this.pitch,newRoll=this.roll;
    const reachable=()=>this.legs.every((leg,i)=>{
      const hip=this.attachment(i,2);
      const length=hip.distanceTo(leg.foot);return length<this.upperLength+this.lowerLength-.004&&length>Math.abs(this.upperLength-this.lowerLength)+.004;
    });
    if(!reachable()){
      let lo=0,hi=1;
      for(let i=0;i<10;i++){
        const fraction=(lo+hi)/2;
        this.center.lerpVectors(previous,proposed,fraction);this.heading=oldHeading+(newHeading-oldHeading)*fraction;
        this.pitch=oldPitch+(newPitch-oldPitch)*fraction;this.roll=oldRoll+(newRoll-oldRoll)*fraction;
        if(reachable())lo=fraction;else hi=fraction;
      }
      this.center.lerpVectors(previous,proposed,lo);this.heading=oldHeading+(newHeading-oldHeading)*lo;
      this.pitch=oldPitch+(newPitch-oldPitch)*lo;this.roll=oldRoll+(newRoll-oldRoll)*lo;
    }
    const cadence=this.speed*Math.max(1,Math.sqrt(this.drive));
    this.stepClock-=dt;
    if((moving||turning)&&this.stepClock<=0&&this.legs.every(leg=>leg.planted)){
      for(let i=0;i<this.legs.length;i++){
        const leg=this.legs[i];
        if((this.breed==='veil'?i%2:(leg.row+(leg.side===1?1:0))%2)!==this.nextTripod)continue;
        leg.from.copy(leg.foot);leg.to.copy(this.nominal(i));
        leg.to.addScaledVector(velocity,Math.min(.2,.24/cadence));leg.to.y=.008;
        const hip=this.attachment(i,2),offset=leg.to.clone().sub(hip);
        const horizontal=Math.hypot(offset.x,offset.z),reach=Math.sqrt(Math.max(.0001,(this.upperLength+this.lowerLength-.009)**2-offset.y**2));
        if(horizontal>reach){leg.to.x=hip.x+offset.x*reach/horizontal;leg.to.z=hip.z+offset.z*reach/horizontal;}
        leg.duration=.25/cadence;leg.swing=0;leg.planted=false;
      }
      this.nextTripod=1-this.nextTripod;this.stepClock=.32/cadence;
    }
    for(let i=0;i<this.legs.length;i++){
      const leg=this.legs[i];
      if(leg.planted)continue;
      leg.swing=Math.min(1,leg.swing+dt/leg.duration);
      const t=leg.swing,s=t*t*(3-2*t);
      leg.foot.lerpVectors(leg.from,leg.to,s);leg.foot.y+=Math.sin(Math.PI*t)*this.footLift;
      if(t===1){leg.foot.copy(leg.to);leg.planted=true;}
      // Bound airborne reach too, including live changes to the lift slider.
      const hip=this.attachment(i,2),offset=leg.foot.clone().sub(hip),length=offset.length(),reach=this.upperLength+this.lowerLength-.002;
      const minimum=Math.abs(this.upperLength-this.lowerLength)+.002;
      if(length<minimum){if(length<1e-8)offset.set(leg.side,0,0);offset.normalize();leg.foot.copy(hip).addScaledVector(offset,minimum);leg.foot.y=Math.max(.008,leg.foot.y);}
      if(length>reach){leg.foot.copy(hip).addScaledVector(offset,reach/length);leg.foot.y=Math.max(.008,leg.foot.y);if(t===1)leg.to.copy(leg.foot);}
    }
  }
  joints(i:number){
    const leg=this.legs[i];
    const root=this.attachment(i,0),coxa=this.attachment(i,1),trochanter=this.attachment(i,2);
    const bend=this.breed==='veil'?new Vector3(Math.sin(i/this.legs.length*Math.PI*2),.95,Math.cos(i/this.legs.length*Math.PI*2)):new Vector3(leg.side,.95,leg.row===0?.12:-.12);
    bend.applyAxisAngle(UP,this.heading);
    const knee=solveKnee(trochanter,leg.foot,bend,this.upperLength,this.lowerLength);
    return [root,coxa,trochanter,knee,leg.foot.clone()];
  }
}
