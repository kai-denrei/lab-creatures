import { Vector3 } from 'three/webgpu';
import { ARENA } from './arena.ts';

/** Bounded, smooth figure-eight stimulus. Manual grabbing switches it off. */
export class AutoLure {
  enabled=false;
  private time=0;
  private destination=new Vector3();
  reset(){this.time=0;}
  step(h:number,target:Vector3,creature:Vector3){
    if(!this.enabled||h<=0)return;
    const distance=Math.hypot(target.x-creature.x,target.z-creature.z);
    this.time+=h*(distance>.22?.35:1);
    const phase=this.time*.45;
    this.destination.set(Math.sin(phase)*.34,ARENA.lureHeight,Math.sin(phase*2+.6)*.18);
    const radius=Math.hypot(this.destination.x,this.destination.z);
    if(radius>ARENA.lureRadius)this.destination.multiplyScalar(ARENA.lureRadius/radius);
    this.destination.y=ARENA.lureHeight;
    const delta=this.destination.sub(target),length=delta.length();
    const speed=distance>.22?.025:.105;
    if(length>0)target.addScaledVector(delta,Math.min(1,speed*h/length));
  }
}
