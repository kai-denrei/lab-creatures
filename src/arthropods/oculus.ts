import { createLegWeb } from './leg-web.ts';
import * as THREE from 'three/webgpu';
import { ANATOMY_COLORS, type ArthropodGait } from './gait.ts';

/** A single ocular head and antenna on a reduced body, carried by oversized legs. */
export function createOculus(variant:'oculus'|'monoculus'='oculus'){
  const monoculus=variant==='monoculus';
  const group=new THREE.Group();group.name=monoculus?'Monoculus':'Oculus';
  const body=new THREE.Group();body.name=monoculus?'Tiny abdomen':'Reduced trunk';group.add(body);
  const shell=new THREE.MeshPhysicalNodeMaterial({color:'#444b57',metalness:.38,roughness:.38,clearcoat:.4});
  const tendon=new THREE.MeshStandardNodeMaterial({color:'#171e25',roughness:.6});
  const bone=new THREE.MeshPhysicalNodeMaterial({color:'#a1b7ab',roughness:.35,metalness:.2});
  const sclera=new THREE.MeshPhysicalNodeMaterial({color:'#322719',roughness:.32,metalness:.35});
  const facetMaterial=new THREE.MeshPhysicalNodeMaterial({color:'#b38842',roughness:.29,metalness:.55,clearcoat:.65});
  const ball=new THREE.SphereGeometry(1,32,24),rod=new THREE.CylinderGeometry(.5,1,1,12),up=new THREE.Vector3(0,1,0);
  const materials=ANATOMY_COLORS.map(()=>bone.clone());
  function oval(parent:THREE.Object3D,position:number[],scale:number[],material:THREE.Material){const mesh=new THREE.Mesh(ball,material);mesh.position.fromArray(position);mesh.scale.fromArray(scale);mesh.castShadow=true;parent.add(mesh);return mesh;}
  function link(parent:THREE.Object3D,material:THREE.Material,radius:number){const mesh=new THREE.Mesh(rod,material);mesh.userData.radius=radius;mesh.castShadow=true;parent.add(mesh);return mesh;}
  function pose(mesh:THREE.Mesh,a:THREE.Vector3,b:THREE.Vector3){const d=b.clone().sub(a);mesh.position.copy(a).add(b).multiplyScalar(.5);mesh.quaternion.setFromUnitVectors(up,d.clone().normalize());mesh.scale.set(mesh.userData.radius,d.length(),mesh.userData.radius);}
  if(monoculus)oval(body,[0,0,-.004],[.005,.006,.009],shell);
  else {oval(body,[0,0,0],[.010,.012,.025],shell);
    for(let i=0;i<3;i++)oval(body,[0,.001,-.016-i*.007],[.011-i*.002,.010-i*.001,.006],shell);}
  const head=new THREE.Group();head.name='Single eye — entire head';head.position.set(0,.006,.033);head.rotation.x=-.18;body.add(head);
  if(monoculus){head.scale.setScalar(.25);head.position.set(0,.002,.011);}
  const globe=oval(head,[0,0,0],[.024,.024,.024],sclera);globe.name='Eye globe';
  // One continuous compound eye: facets wrap the whole ocular head.
  const count=700,facets=new THREE.InstancedMesh(new THREE.SphereGeometry(1,6,4),facetMaterial,count);
  facets.name='Compound eye facets';facets.castShadow=true;
  const dummy=new THREE.Object3D(),normal=new THREE.Vector3(),color=new THREE.Color(),axis=new THREE.Vector3(0,0,1);
  for(let i=0;i<count;i++){
    const y=1-2*(i+.5)/count,r=Math.sqrt(1-y*y),angle=i*Math.PI*(3-Math.sqrt(5));
    normal.set(Math.cos(angle)*r,y,Math.sin(angle)*r);
    dummy.position.copy(normal).multiplyScalar(.024);
    dummy.quaternion.setFromUnitVectors(axis,normal);dummy.scale.set(.00165,.00165,.00085);dummy.updateMatrix();
    facets.setMatrixAt(i,dummy.matrix);color.setHSL(.095+.025*Math.sin(i*2.4),.48,.30+.10*(normal.y+1)/2);facets.setColorAt(i,color);
  }
  head.add(facets);
  const antenna=new THREE.Group();antenna.name='Single antenna';body.add(antenna);
  const feeler=Array.from({length:16},(_,i)=>link(antenna,bone,.0016*(1-i/20)));
  const legs=Array.from({length:6},()=>({
    links:materials.slice(0,4).map((material,i)=>link(group,material,[.003,.0025,.002,.0014][i])),
    joints:Array.from({length:4},()=>oval(group,[0,0,0],[.003,.003,.003],tendon)),
    feet:[link(group,materials[4],.0011),link(group,materials[5],.0007)],
  }));
  const web=monoculus?createLegWeb():undefined;if(web)group.add(web.mesh);
  function update(gait:ArthropodGait){
    web?.update(gait);
    body.position.copy(gait.center);body.rotation.set(gait.pitch,gait.heading,gait.roll,'YXZ');
    head.rotation.y=Math.sin(gait.time*.65)*.10;head.rotation.x=-.18+gait.abdomenPitch*.15;
    let previous=new THREE.Vector3(.003,.013,.008);
    for(let i=0;i<feeler.length;i++){
      const t=(i+1)/feeler.length;
      const next=new THREE.Vector3(.003+t*.025+Math.sin(gait.time*(1+gait.alert)+.5)*t*t*.022,.013+Math.sin(t*Math.PI*.8)*.075,.008+t*.125);
      pose(feeler[i],previous,next);previous=next;
    }
    legs.forEach((leg,i)=>{
      const points=gait.joints(i);leg.links.forEach((mesh,j)=>{pose(mesh,points[j],points[j+1]);leg.joints[j].position.copy(points[j]);});
      const toe=points[4].clone().add(new THREE.Vector3(0,-.004,.013).applyAxisAngle(up,gait.heading));
      const claw=toe.clone().add(new THREE.Vector3(0,-.003,.005).applyAxisAngle(up,gait.heading));pose(leg.feet[0],points[4],toe);pose(leg.feet[1],toe,claw);
    });
  }
  return {group,update,setAnatomy:(enabled:boolean)=>{materials.forEach((m,i)=>m.color.set(enabled?ANATOMY_COLORS[i]:'#a1b7ab'));web?.setAnatomy(enabled);}};
}
