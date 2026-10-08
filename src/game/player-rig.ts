import type { Vector3 } from 'three/webgpu';

/** Shared input contract; each body plan owns its physical locomotion. */
export interface PlayerRig {
  readonly move:Vector3;
  onContact:(speed:number,foot:boolean)=>void;
  jump():void;
  reset():void;
  step(h:number):void;
  afterStep():void;
}
