import * as THREE from 'three';
import type { EvasionGame } from './game.ts';
import type { CutisSwarm } from '../cutis/swarm/controller.ts';
/** Adhesive tissue bridges visibly stretch between predator and captured prey. */
export function createCapture(){
  const group=new THREE.Group(),geometry=new THREE.CylinderGeometry(1,1,1,8),material=new THREE.MeshPhysicalMaterial({color:0x97717b,transparent:true,opacity:.65,roughness:.3,clearcoat:1});
  const links=Array.from({length:12},()=>{const mesh=new THREE.Mesh(geometry,material);group.add(mesh);return mesh;});
  const skin=new THREE.Mesh(new THREE.SphereGeometry(1,32,20),new THREE.MeshPhysicalMaterial({color:0x463637,transparent:true,opacity:.5,roughness:.2,clearcoat:1,wireframe:false}));group.add(skin);
  const a=new THREE.Vector3(),b=new THREE.Vector3(),direction=new THREE.Vector3(),up=new THREE.Vector3(0,1,0);
  return {group,update(game:EvasionGame,swarm:CutisSwarm){
    links.forEach((mesh,i)=>{mesh.visible=!game.falling&&!game.dead&&!game.fallen[i]&&(game.bodyGrip[i]>0||game.armGrip[i]>0);if(!mesh.visible)return;
      const center=swarm.getCoreContact(i).center;a.set(center.x,center.y,center.z);b.set(game.x,.14,game.z);direction.subVectors(b,a);
      mesh.position.copy(a).add(b).multiplyScalar(.5);mesh.quaternion.setFromUnitVectors(up,direction.clone().normalize());const thickness=game.bodyGrip[i]>0?.09:.028;mesh.scale.set(thickness,direction.length(),thickness);
    });
    skin.visible=game.devouring&&!game.dead;skin.position.set(game.x,.16,game.z);const cover=Math.min(1,game.devourTime/2),size=.2+cover*.16-game.absorption*.26;skin.scale.set(size,size*.8,size);skin.material.opacity=.15+cover*.45;
  },dispose(){geometry.dispose();material.dispose();skin.geometry.dispose();skin.material.dispose();}};
}
