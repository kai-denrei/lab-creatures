import { Vector3 } from 'three/webgpu';
import type { SoftBody } from '../physics/soft-body.js';
import { MonsterBehavior } from '../monster/behavior.ts';
import type { PlayerRig } from './player-rig.ts';

/** Camera-relative input supplies a nearby direction, never teleports the body. */
export class MonsterPlayer implements PlayerRig {
  readonly move=new Vector3();
  readonly motion:MonsterBehavior;
  onContact:(speed:number,foot:boolean)=>void=()=>{};
  private grabbed=false;
  private elapsed=0;
  private lastContact=-1;
  private lastFoot=new Vector3();
  readonly body:SoftBody;
  constructor(body:SoftBody){
    this.body=body;
    this.motion=new MonsterBehavior(body);
    this.motion.feeding.enabled=false;
    this.motion.active=false;
  }
  // Space is a defensive brace instead of a Jelly Baby hop.
  jump(){if(!this.body.grab)this.motion.disturb();}
  reset(){this.move.set(0,0,0);this.motion.reset();this.motion.active=false;this.grabbed=false;this.elapsed=0;this.lastContact=-1;this.lastFoot.copy(this.body.center);}
  step(h:number){
    this.elapsed+=h;
    if(this.body.grab){this.grabbed=true;this.motion.active=false;return;}
    if(this.grabbed){
      this.motion.gait.reset();this.motion.traction.reset();this.motion.pursuit.reset();this.grabbed=false;
    }
    const moving=this.move.lengthSq()>.001;
    this.motion.active=moving;
    // The target follows the body's actual position, so travel has no arena limit.
    this.motion.target.copy(this.body.center).addScaledVector(this.move,.22);
    this.motion.target.y=.012;
    this.motion.stimulus=moving?1:0;
    this.motion.step(h);
  }
  afterStep(){
    if(this.body.grab||!this.body.grounded)return;
    const impact=-this.motion.velocity.y;
    if(impact>.13&&this.elapsed-this.lastContact>.15){this.onContact(impact,false);this.lastContact=this.elapsed;}
    else if(this.move.lengthSq()>.001&&this.body.center.distanceToSquared(this.lastFoot)>.0004&&this.elapsed-this.lastContact>.18){
      this.onContact(.08+this.motion.velocity.length()*.65,true);this.lastContact=this.elapsed;this.lastFoot.copy(this.body.center);
    }
  }
}
