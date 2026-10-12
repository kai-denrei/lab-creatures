import * as THREE from 'three/webgpu';
import { ANATOMY_COLORS, ArthropodGait } from './gait.ts';

export function createArthropod(){
  const group=new THREE.Group();group.name='Aculis — articulated arthropod';
  const body=new THREE.Group();group.add(body);
  const shell=new THREE.MeshPhysicalNodeMaterial({color:'#78846a',roughness:.38,metalness:.28,clearcoat:.45});
  const ridge=new THREE.MeshStandardNodeMaterial({color:'#b6bd91',roughness:.46,metalness:.22});
  const membrane=new THREE.MeshStandardNodeMaterial({color:'#303932',roughness:.72});
  const eyeMaterial=new THREE.MeshPhysicalNodeMaterial({color:'#472d20',metalness:.5,roughness:.22,clearcoat:1});
  const facetMaterial=new THREE.MeshPhysicalNodeMaterial({color:'#c0783a',metalness:.55,roughness:.29,clearcoat:.65});
  const legMaterials=ANATOMY_COLORS.map(()=>shell.clone());
  const ball=new THREE.SphereGeometry(1,24,16),rod=new THREE.CylinderGeometry(.65,1,1,10);
  const seam=new THREE.TorusGeometry(1,.035,6,40);
  const up=new THREE.Vector3(0,1,0);
  function ellipsoid(parent:THREE.Object3D,position:number[],scale:number[],material:THREE.Material){
    const mesh=new THREE.Mesh(ball,material);mesh.position.set(...position as [number,number,number]);mesh.scale.set(...scale as [number,number,number]);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
  }
  function link(parent:THREE.Object3D,material:THREE.Material,radius:number){
    const mesh=new THREE.Mesh(rod,material);mesh.userData.radius=radius;mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
  }
  function poseLink(mesh:THREE.Mesh,a:THREE.Vector3,b:THREE.Vector3){
    const d=b.clone().sub(a);mesh.position.copy(a).add(b).multiplyScalar(.5);mesh.quaternion.setFromUnitVectors(up,d.clone().normalize());mesh.scale.set(mesh.userData.radius,d.length(),mesh.userData.radius);
  }
  // Narrow three-part thorax with a raised dorsal keel and dark flexible seams.
  ellipsoid(body,[0,0,.01],[.017,.018,.052],membrane);
  for(let i=0;i<3;i++){
    ellipsoid(body,[0,.005,.034-i*.027],[.019-i*.001,.017,.018],shell);
    ellipsoid(body,[0,.019,.034-i*.027],[.0015,.002,.013],ridge);
  }
  // Seven overlapping abdominal plates taper toward a pointed terminal segment.
  const abdomen=new THREE.Group();abdomen.position.set(0,0,-.035);body.add(abdomen);
  ellipsoid(abdomen,[0,-.005,-.04],[.022,.015,.052],membrane);
  for(let i=0;i<7;i++){
    const width=[.024,.029,.03,.028,.024,.018,.009][i];
    const plate=ellipsoid(abdomen,[0,-i*.0015,-i*.015],[width,width*.72,.012],shell);
    plate.rotation.x=-.08;
    const band=new THREE.Mesh(seam,ridge);
    band.position.set(0,-i*.0015,-i*.015+.006);band.scale.set(width*.866,width*.72*.866,.012);
    band.rotation.x=-.08;band.castShadow=true;abdomen.add(band);
    for(const side of [-1,1])ellipsoid(abdomen,[side*width*.95,-i*.0015,-i*.015],[.0018,.0018,.003],membrane);
  }
  const head=new THREE.Group();head.position.set(0,.002,.064);body.add(head);
  ellipsoid(head,[0,0,0],[.021,.017,.021],shell);
  ellipsoid(head,[0,-.006,.019],[.009,.009,.01],membrane);
  for(const side of [-1,1]){
    const eye=new THREE.Group();eye.position.set(side*.017,.006,.005);eye.rotation.z=-side*.2;head.add(eye);
    ellipsoid(eye,[0,0,0],[.013,.016,.016],eyeMaterial);
    // Raised ommatidia cover the outward hemisphere; instanced to keep draw calls low.
    const points:THREE.Vector3[]=[];
    for(let ring=0;ring<14;ring++){
      const theta=.12+ring/13*2.82,n=Math.max(5,Math.round(28*Math.sin(theta)));
      for(let j=0;j<n;j++){
        const phi=2*Math.PI*(j+(ring%2)*.5)/n;
        const normal=new THREE.Vector3(Math.sin(theta)*Math.cos(phi),Math.cos(theta),Math.sin(theta)*Math.sin(phi));
        if(normal.x*side>-.18)points.push(normal);
      }
    }
    const facets=new THREE.InstancedMesh(new THREE.SphereGeometry(1,6,4),facetMaterial,points.length),dummy=new THREE.Object3D();
    points.forEach((normal,i)=>{dummy.position.set(normal.x*.0131,normal.y*.0161,normal.z*.0161);dummy.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),normal);dummy.scale.set(.00165,.00165,.0008);dummy.updateMatrix();facets.setMatrixAt(i,dummy.matrix);facets.setColorAt(i,new THREE.Color().setHSL(.08+(i%5)*.006,.4,.27+(i%7)*.022));});
    facets.castShadow=true;eye.add(facets);
    const mandible=link(head,ridge,.0025);poseLink(mandible,new THREE.Vector3(side*.009,-.008,.017),new THREE.Vector3(side*.004,-.011,.03));
  }
  const antennae=[-1,1].map(side=>({side,links:Array.from({length:12},(_,i)=>link(head,i<2?shell:ridge,.0015*(1-i/15))),base:new THREE.Vector3(side*.009,.011,.015)}));
  const legs=Array.from({length:6},()=>({
    links:legMaterials.slice(0,4).map((m,i)=>link(group,m,[.004,.0035,.0028,.0019][i])),
    joints:Array.from({length:4},()=>ellipsoid(group,[0,0,0],[.0037,.0037,.0037],membrane)),
    tarsi:Array.from({length:3},()=>link(group,legMaterials[4],.0015)),
    claws:Array.from({length:2},()=>link(group,legMaterials[5],.0009)),
  }));
  function update(gait:ArthropodGait){
    body.position.copy(gait.center);body.rotation.set(gait.pitch,gait.heading,gait.roll,'YXZ');
    abdomen.rotation.x=gait.abdomenPitch+Math.sin(gait.time*2)*.015;
    head.rotation.y=Math.sin(gait.time*(.8+gait.alert))*.035;
    for(const antenna of antennae){
      let previous=antenna.base.clone();
      for(let i=0;i<antenna.links.length;i++){
        const t=(i+1)/antenna.links.length,sweep=Math.sin(gait.time*(1.5+gait.alert*2.5)+antenna.side*.9)*(.016+gait.alert*.006);
        const next=new THREE.Vector3(antenna.side*(.009+t*.047)+sweep*t*t,.011+Math.sin(t*Math.PI*.8)*.03,.015+t*.094);
        poseLink(antenna.links[i],previous,next);previous=next;
      }
    }
    legs.forEach((leg,i)=>{
      const points=gait.joints(i);
      leg.links.forEach((mesh,j)=>{poseLink(mesh,points[j],points[j+1]);leg.joints[j].position.copy(points[j]);});
      let previous=points[4];
      const forward=new THREE.Vector3(0,0,1).applyAxisAngle(up,gait.heading);
      for(let j=0;j<3;j++){
        const next=points[4].clone().addScaledVector(forward,(j+1)*.005);next.y-=.002*(j+1);
        poseLink(leg.tarsi[j],previous,next);previous=next;
      }
      for(let j=0;j<2;j++){
        const tip=previous.clone().add(new THREE.Vector3((j===0?-1:1)*.0025,-.001,.004).applyAxisAngle(up,gait.heading));
        poseLink(leg.claws[j],previous,tip);
      }
    });
  }
  function setAnatomy(enabled:boolean){legMaterials.forEach((material,i)=>material.color.set(enabled?ANATOMY_COLORS[i]:'#78846a'));}
  return {group,update,setAnatomy};
}
