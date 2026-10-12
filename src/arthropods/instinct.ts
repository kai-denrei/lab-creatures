import { LAB_ARENA } from './variants.ts';
import { Vector3 } from 'three/webgpu';
import type { ArthropodGait } from './gait.ts';
import type { PredatorSettings } from './settings.ts';

export type PredatorState='roaming'|'noticing'|'hesitating'|'stalking'|'feinting'|'coiling'|'rushing'|'recoiling'|'recovering';
export const STATE_NOTES:Record<PredatorState,string>={
  roaming:'Slow exploration. Searching for movement.',
  noticing:'Movement detected. It orients and braces.',
  hesitating:'A fearful pause. It leans away before committing.',
  stalking:'Low, deliberate steps. It approaches from an angle.',
  feinting:'A sudden lateral cut tests the stimulus.',
  coiling:'Body and abdomen lower. A brief stillness before the rush.',
  rushing:'A committed burst toward the last sighted position.',
  recoiling:'Startled. It backs away while keeping the lure in view.',
  recovering:'An abrupt stop. It watches, then decides again.',
};

export const VEIL_STATE_NOTES:Record<PredatorState,string>={
  ...STATE_NOTES,
  roaming:'Separate edges feel along the table. The sheet follows slowly.',
  noticing:'The rim arrests. A few sectors stretch toward the stimulus.',
  hesitating:'Uneven extensions and retractions. No synchronized footsteps.',
  stalking:'Leading webbing stretches while the center creeps behind it.',
  coiling:'The flat sheet gathers tension before releasing.',
  rushing:'A sudden pull. Individual edges snap through a rapid sequence.',
  recovering:'Speed falls away. Small exploratory motions return.',
};

/** Seeded choices at state boundaries: irregular intent without per-frame random jitter. */
export class PredatorInstinct {
  active=true;
  state:PredatorState='roaming';
  age=0;
  time=0;
  duration=.5;
  private seed=1741;
  private side=1;
  private wander=new Vector3(.12,0,.12);
  private destination=new Vector3();
  private lastLure=new Vector3();
  private sampled=false;
  private startleCooldown=0;
  private gait:ArthropodGait;
  settings:PredatorSettings;
  constructor(gait:ArthropodGait,settings:PredatorSettings){this.gait=gait;this.settings=settings;}
  private random(){this.seed=(Math.imul(this.seed,1664525)+1013904223)>>>0;return this.seed/4294967296;}
  private enter(state:PredatorState,duration:number){this.state=state;this.age=0;this.duration=duration;}
  reset(){this.state='roaming';this.age=0;this.time=0;this.duration=.5;this.seed=1741;this.side=1;this.sampled=false;this.startleCooldown=0;this.wander.set(.12,0,.12);}
  disturb(lure:Vector3){
    if(!this.active||this.settings.fear===0)return;
    const away=this.gait.center.clone().sub(lure);away.y=0;
    if(away.lengthSq()<1e-8)away.set(-Math.sin(this.gait.heading),0,-Math.cos(this.gait.heading));
    this.destination.copy(this.gait.center).addScaledVector(away.normalize(),.025+.03*this.settings.fear);
    this.enter('recoiling',.22+.22*this.settings.fear);this.startleCooldown=2.5;
  }
  step(dt:number,lure:Vector3){
    const g=this.gait,s=this.settings;
    this.time+=dt;
    g.speed=s.speed;g.turnRate=s.turnRate;g.footLift=s.footLift/1000;
    const lureSpeed=this.sampled?lure.distanceTo(this.lastLure)/dt:0;
    this.sampled=true;this.lastLure.copy(lure);this.startleCooldown=Math.max(0,this.startleCooldown-dt);
    if(!this.active){g.walking=false;g.facing=null;g.crouch=0;g.pitchTarget=0;g.rollTarget=0;g.abdomenTarget=0;g.alert=0;return;}
    this.age+=dt;
    const toLure=lure.clone().sub(g.center);toLure.y=0;
    const distance=toLure.length(),direction=toLure.normalize(),tangent=new Vector3(direction.z,0,-direction.x);
    if(lureSpeed>.20/Math.max(.2,s.fear)&&distance<.24&&this.startleCooldown===0&&this.state!=='roaming')this.disturb(lure);
    if(this.age>=this.duration){
      switch(this.state){
        case 'roaming':
          if(distance<s.detection/1000){this.side=this.random()<.5?-1:1;this.enter('noticing',.22+this.random()*.3);}
          else {if(this.age>2){this.wander.set((this.random()-.5)*1.1,0,(this.random()-.5)*1.1);this.age=0;}}
          break;
        case 'noticing':this.enter('hesitating',s.hesitation*(.7+this.random()*.6)*(1+s.fear*.25));break;
        case 'hesitating':this.enter('stalking',(.45+this.random()*.8)/(1+s.aggression*.35));break;
        case 'stalking':
          if(s.erratic>0&&this.random()<Math.min(.9,s.erratic*.4)){
            this.destination.copy(g.center).addScaledVector(tangent,this.side*(.025+s.erratic*.018));
            this.enter('feinting',.22+this.random()*.2);
          }else this.enter('coiling',.18+this.random()*.2);
          break;
        case 'feinting':this.enter('coiling',.16+this.random()*.22);break;
        case 'coiling':
          if(s.aggression===0){this.enter('recovering',s.recovery);break;}
          // Snapshot the attack line: later lure motion can make the predator miss.
          this.destination.copy(lure).addScaledVector(direction,-.074);
          this.enter('rushing',s.burst*(.8+this.random()*.4));break;
        case 'rushing':this.enter('recovering',s.recovery*(.65+this.random()*.7));break;
        case 'recoiling':this.enter('hesitating',s.hesitation*(1+s.fear*.3));break;
        case 'recovering':
          if(distance>s.detection/1000*1.2)this.enter('roaming',.4);
          else if(this.random()<Math.min(.8,s.erratic*.25)){this.side=-this.side;this.enter('stalking',.35+this.random()*.5);}
          else this.enter('noticing',.15+this.random()*.3);
      }
    }
    g.walking=true;g.drive=0;g.facing=lure;g.target.copy(g.center);g.crouch=0;g.pitchTarget=0;g.rollTarget=0;g.abdomenTarget=0;g.alert=1;
    const sway=Math.sin(this.time*7)*.015*s.erratic;
    switch(this.state){
      case 'roaming':g.facing=null;g.drive=.65;g.target.copy(this.wander);g.alert=.15;break;
      case 'noticing':g.crouch=.2;g.pitchTarget=-.035*s.fear;g.alert=1.6;break;
      case 'hesitating':
        g.crouch=.4;g.pitchTarget=-.06*s.fear;g.rollTarget=sway;
        if(this.age<this.duration*.3){g.drive=.45*s.fear;g.target.copy(g.center).addScaledVector(direction,-.045);}
        break;
      case 'stalking':
        g.drive=.6+s.aggression*.25;g.crouch=.55;g.target.copy(lure).addScaledVector(direction,-.13).addScaledVector(tangent,this.side*.025*s.erratic);break;
      case 'feinting':g.drive=2+s.erratic;g.crouch=.6;g.rollTarget=-this.side*.065;g.target.copy(this.destination);break;
      case 'coiling':g.crouch=1;g.pitchTarget=.065;g.alert=1.9;break;
      case 'rushing':g.drive=s.rushSpeed*(.55+s.aggression*.3);g.crouch=.8;g.pitchTarget=.095;g.target.copy(this.destination);g.alert=2;break;
      case 'recoiling':g.drive=1.5+s.fear;g.crouch=.6;g.pitchTarget=-.065;g.target.copy(this.destination);g.alert=2;break;
      case 'recovering':g.crouch=.5*(1-Math.min(1,this.age/this.duration));g.rollTarget=sway*.4;g.alert=.7;break;
    }
    if(g.breed==='veil'&&['roaming','stalking','hesitating'].includes(this.state))g.drive*=.55;
    g.crouch*=s.lowering/1000;
    g.abdomenTarget=-Math.min(.30,g.crouch*7*s.abdomen);
    // Keep the entire spindly footprint on the observation table.
    const radius=Math.hypot(g.target.x,g.target.z);
    if(radius>LAB_ARENA.travelRadius){g.target.x*=LAB_ARENA.travelRadius/radius;g.target.z*=LAB_ARENA.travelRadius/radius;}
  }
}
