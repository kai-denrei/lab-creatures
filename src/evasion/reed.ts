import * as THREE from 'three';
import { loadMonsterCage } from '../monster/model.ts';
import { SoftBody } from '../physics/soft-body.js';
import { MonsterPlayer } from '../game/monster-player.ts';
import type { CutisSwarm } from '../cutis/swarm/controller.ts';
import { PHYS } from '../physics/constants.js';

/** The lab's physical reach / plant / pull gait, controlled by keyboard intent. */
export type EvasionCreature='reed'|'nih-dairia';
export async function createEvasionCreature(radius:number,kind:EvasionCreature='reed'){
  const body=new SoftBody(await loadMonsterCage(kind)),rig=new MonsterPlayer(body),scale=radius/.015;
  const geometry=body.surface.geometry;
  const material=new THREE.MeshPhysicalMaterial({color:0xc9e6ae,roughness:.32,metalness:0,clearcoat:.8,transparent:true,opacity:.95,side:THREE.DoubleSide});
  const coolColor=new THREE.Color(0xc9e6ae),hotColor=new THREE.Color(0xdf2534);
  const mesh=new THREE.Mesh(geometry,material);mesh.frustumCulled=false;mesh.scale.setScalar(scale);
  const originalIndex=Array.from(geometry.index!.array as Uint32Array),rest=body.surface.positions.slice();
  const limbCount=body.cage.limbCount??(kind==='reed'?4:6);
  const parts=Array.from({length:limbCount+1},()=>[] as number[]);
  for(let i=0;i<originalIndex.length;i+=3){const ids=originalIndex.slice(i,i+3),x=ids.reduce((n,v)=>n+rest[v*3],0)/3,z=ids.reduce((n,v)=>n+rest[v*3+2],0)/3;
    const part=Math.hypot(x,z)<.029?limbCount:(Math.round(Math.atan2(z,x)/(Math.PI*2/limbCount))+limbCount)%limbCount;parts[part].push(...ids);}
  const debris=new THREE.Group(),fragments:{mesh:THREE.Mesh<THREE.BufferGeometry,THREE.MeshPhysicalMaterial>;center:THREE.Vector3}[]=[];
  let accumulator=0,cut=0,struggle=0,lastFragmentTime=0;
  const normalSettings={...rig.motion.settings};
  function reset(){
    rig.reset();Object.assign(rig.motion.settings,normalSettings);accumulator=0;cut=0;struggle=0;lastFragmentTime=0;geometry.setIndex(originalIndex);for(const f of fragments){f.mesh.geometry.dispose();f.mesh.material.dispose();debris.remove(f.mesh);}fragments.length=0;
    for(let i=0;i<100;i++){rig.step(PHYS.step);body.step(PHYS.step);}
    body.updateSurface();
  }
  reset();
  return {mesh,debris,body,rig,reset,limbCount,kind,
    step(dt:number,dx:number,dz:number,speed:number,restrained=false,feedingProgress:number|null=null){
      if(feedingProgress!==null){
        const motion=rig.motion;
        if(motion.feeding.scriptedProgress===null){
          motion.target.copy(motion.torsoCenter);motion.target.y=.012;
          motion.gait.settle();motion.traction.reset();motion.pursuit.reset();
        }
        motion.feeding.scriptedProgress=feedingProgress;motion.active=true;struggle=0;rig.move.set(0,0,0);
        accumulator+=dt;
        while(accumulator>=PHYS.step){motion.step(PHYS.step);body.step(PHYS.step);accumulator-=PHYS.step;}
        return {x:0,z:0};
      }
      if(rig.motion.feeding.scriptedProgress!==null){
        rig.motion.feeding.reset(rig.motion.target);rig.motion.cradle.reset();rig.motion.gait.settle();rig.motion.pursuit.reset();
      }
      if(speed<=0){struggle=0;return {x:0,z:0};}
      struggle=restrained?1:0;
      Object.assign(rig.motion.settings,normalSettings);
      if(struggle){
        rig.motion.settings.stretch*=.5;rig.motion.settings.speed*=.25;
        if(Math.hypot(dx,dz)<.01){dx=Math.sin(rig.motion.time*2.3+.6);dz=Math.cos(rig.motion.time*1.7);}
      }
      const length=Math.max(1,Math.hypot(dx,dz));rig.move.set(dx/length,0,dz/length);
      const x=body.center.x,z=body.center.z;
      // Entanglement slows the entire physical gait, including the planted pull.
      accumulator+=dt*(struggle?.45:Math.min(1,speed/2.1));
      while(accumulator>=PHYS.step){rig.step(PHYS.step);body.step(PHYS.step);rig.afterStep();accumulator-=PHYS.step;}
      const delta={x:(body.center.x-x)*scale,z:(body.center.z-z)*scale};
      if(struggle){const distance=Math.hypot(delta.x,delta.z),limit=speed*dt;if(distance>limit){delta.x*=limit/distance;delta.z*=limit/distance;}}
      return delta;
    },
    update(x:number,z:number,absorption:number,legsCut=0,time=0,y=0,swarm?:CutisSwarm,fallen?:Uint8Array,heat=0,shakePulse=0){
      if(body.surfaceDirty)body.updateSurface();
      material.color.copy(coolColor).lerp(hotColor,Math.min(1,heat));
      const size=scale*(1-absorption*.92);mesh.scale.setScalar(size);
      mesh.position.set(x-body.center.x*size,.012+y,z-body.center.z*size);material.opacity=.95-absorption*.75;
      const tremor=struggle*(1-absorption)*(.6+.4*Math.sin(time*2.7)**2)+shakePulse/.32*4;
      mesh.position.x+=tremor*(Math.sin(time*17)*.007+Math.sin(time*29.3)*.003);
      mesh.position.z+=tremor*(Math.sin(time*13.1)*.006+Math.sin(time*23.7)*.003);
      mesh.position.y+=tremor*(1+Math.sin(time*9.7))*.004;
      while(cut<Math.min(limbCount,legsCut)){
        const pieceGeometry=geometry.clone();pieceGeometry.setIndex(parts[cut]);
        const pieceMaterial=material.clone();pieceMaterial.opacity=.95;
        const piece=new THREE.Mesh(pieceGeometry,pieceMaterial);piece.position.copy(mesh.position);piece.scale.setScalar(scale);debris.add(piece);
        const center=new THREE.Vector3(),vertices=[...new Set(parts[cut])],attribute=pieceGeometry.getAttribute('position');
        for(const id of vertices)center.add(new THREE.Vector3().fromBufferAttribute(attribute,id));
        center.divideScalar(vertices.length).multiplyScalar(scale).add(piece.position);
        fragments.push({mesh:piece,center});cut++;
        geometry.setIndex(parts.filter((_,i)=>i>=cut).flat());
      }
      const dt=Math.max(0,Math.min(.05,time-lastFragmentTime));lastFragmentTime=time;
      // Detached tissue has no autonomous drift or shrink. Only direct contact
      // with a living predator can drag a piece toward its body.
      if(swarm&&dt>0)for(const f of fragments){
        let nearest=-1,distance=Infinity;
        for(let i=0;i<swarm.count;i++){
          if(fallen?.[i])continue;
          const c=swarm.getCoreContact(i).center,d=Math.hypot(c.x-f.center.x,c.z-f.center.z);
          if(d<swarm.configFor(i).r0*swarm.scale[i]+.2&&d<distance){nearest=i;distance=d;}
        }
        if(nearest>=0&&distance>.01){const c=swarm.getCoreContact(nearest).center,amount=Math.min(distance,.25*dt),dx=(c.x-f.center.x)/distance*amount,dz=(c.z-f.center.z)/distance*amount;
          f.center.x+=dx;f.center.z+=dz;f.mesh.position.x+=dx;f.mesh.position.z+=dz;
        }
      }
    },
    dispose(){for(const f of fragments){f.mesh.geometry.dispose();f.mesh.material.dispose();}geometry.dispose();material.dispose();body.cage.opticalSurface.geometry.dispose();},
  };
}
