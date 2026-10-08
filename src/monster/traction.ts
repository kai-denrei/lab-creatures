import type { SoftBody } from '../physics/soft-body.js';
import type { SpiderGait } from './gait.ts';
import type { TentaclePursuit } from './pursuit.ts';

/** World-space adhesion belongs to actual planted contacts, never airborne feet. */
export class GroundTraction {
  readonly weights:Float64Array;
  supports=0;
  private anchors:Float64Array;
  private held:Uint8Array;
  private limbs:Int8Array;
  private grounded=new Uint8Array(6);
  constructor(body:SoftBody){
    this.weights=new Float64Array(body.mass.length);this.anchors=new Float64Array(body.x.length);
    this.held=new Uint8Array(body.mass.length);this.limbs=new Int8Array(body.mass.length).fill(-1);
    for(let i=0;i<body.mass.length;i++)if(Math.hypot(body.rest[i*3],body.rest[i*3+2])>.071)this.limbs[i]=(Math.round(Math.atan2(body.rest[i*3+2],body.rest[i*3])/(Math.PI/3))+6)%6;
  }
  reset(){this.held.fill(0);this.weights.fill(0);this.supports=0;}
  prepare(body:SoftBody,gait:SpiderGait,pursuit:TentaclePursuit,enabled:boolean){
    this.grounded.fill(0);this.weights.fill(0);this.supports=0;
    for(let i=0;i<this.limbs.length;i++)if(this.limbs[i]>=0&&body.contact[i]>0)this.grounded[this.limbs[i]]=1;
    for(let leg=0;leg<6;leg++){
      const probe=leg===pursuit.lead?pursuit.reach:leg===pursuit.secondLead?pursuit.secondReach:0;
      if(enabled&&this.grounded[leg]&&gait.planted[leg]&&probe<.2)this.supports++;
    }
    for(let i=0;i<this.limbs.length;i++){
      const leg=this.limbs[i],probe=leg===pursuit.lead?pursuit.reach:leg===pursuit.secondLead?pursuit.secondReach:0;
      const hold=enabled&&leg>=0&&this.grounded[leg]&&gait.planted[leg]&&probe<.2;
      if(!hold){this.held[i]=0;continue;}
      const j=i*3;
      if(!this.held[i]){this.anchors[j]=body.x[j];this.anchors[j+2]=body.x[j+2];this.held[i]=1;}
      this.weights[i]=1;
    }
  }
  apply(body:SoftBody,h:number,grip:number){
    const damping=Math.exp(-80*grip*h);
    for(let i=0;i<this.weights.length;i++)if(this.weights[i]){
      for(const axis of [0,2]){
        const j=i*3+axis,error=this.anchors[j]-body.x[j];
        body.velocity[j]=body.velocity[j]*damping+Math.max(-.12,Math.min(.12,error*24))*(1-damping);
      }
    }
  }
}
