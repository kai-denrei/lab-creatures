import * as THREE from 'three/webgpu';
import { ANATOMY_COLORS, type ArthropodGait } from './gait.ts';

/** Thick curved band with a swept trailing edge, shared by the dorsal plates. */
function armorGeometry(){
  const p:number[]=[],indices:number[]=[],cols=32,rows=6,stride=cols+1,layer=stride*(rows+1);
  for(let side=0;side<2;side++)for(let row=0;row<=rows;row++)for(let col=0;col<=cols;col++){
    const angle=(col/cols-.5)*Math.PI*.96,v=row/rows;
    p.push(Math.sin(angle)*(1-.04*Math.cos(v*Math.PI*2)),Math.cos(angle)+Math.sin(v*Math.PI)*.09-side*.10,(v-.5)-.22*Math.sin(angle)**2);
  }
  for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
    const a=row*stride+col,b=a+1,c=a+stride,d=c+1;
    indices.push(a,c,b,b,c,d,a+layer,b+layer,c+layer,b+layer,d+layer,c+layer);
  }
  const border:number[]=[];
  for(let col=0;col<=cols;col++)border.push(col);
  for(let row=1;row<=rows;row++)border.push(row*stride+cols);
  for(let col=cols-1;col>=0;col--)border.push(rows*stride+col);
  for(let row=rows-1;row>0;row--)border.push(row*stride);
  for(let i=0;i<border.length;i++){const a=border[i],b=border[(i+1)%border.length];indices.push(a,b,a+layer,b,b+layer,a+layer);}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(p,3));geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
}
export function createIsopod(){
  const group=new THREE.Group();group.name='Giant Isopod';const body=new THREE.Group();group.add(body);
  const shell=new THREE.MeshPhysicalNodeMaterial({color:'#9c8f8c',roughness:.53,metalness:.12,clearcoat:.22});
  const edge=new THREE.MeshStandardNodeMaterial({color:'#c1b2a4',roughness:.58});
  const dark=new THREE.MeshStandardNodeMaterial({color:'#3d353e',roughness:.74});
  const eyes=new THREE.MeshPhysicalNodeMaterial({color:'#171820',roughness:.18,metalness:.4,clearcoat:1});
  const ball=new THREE.SphereGeometry(1,24,16),rod=new THREE.CylinderGeometry(.6,1,1,10),plate=armorGeometry();
  const up=new THREE.Vector3(0,1,0),legMaterials=ANATOMY_COLORS.map(()=>shell.clone());
  function oval(parent:THREE.Object3D,x:number,y:number,z:number,sx:number,sy:number,sz:number,material:THREE.Material){const mesh=new THREE.Mesh(ball,material);mesh.position.set(x,y,z);mesh.scale.set(sx,sy,sz);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;}
  function link(parent:THREE.Object3D,material:THREE.Material,radius:number){const mesh=new THREE.Mesh(rod,material);mesh.userData.radius=radius;mesh.castShadow=true;parent.add(mesh);return mesh;}
  function pose(mesh:THREE.Mesh,a:THREE.Vector3,b:THREE.Vector3){const delta=b.clone().sub(a);mesh.position.copy(a).add(b).multiplyScalar(.5);mesh.scale.set(mesh.userData.radius,delta.length(),mesh.userData.radius);mesh.quaternion.setFromUnitVectors(up,delta.normalize());}
  oval(body,0,-.006,-.005,.057,.016,.102,dark);
  for(let i=0;i<7;i++){
    const width=.058+Math.sin(i/6*Math.PI)*.012;
    const segment=new THREE.Mesh(plate,shell);segment.position.set(0,0,.069-i*.023);segment.scale.set(width,.025,.026);segment.castShadow=true;segment.receiveShadow=true;body.add(segment);
    // Broad pointed epimera on both flanks, visibly distinct from walking legs.
    for(const side of [-1,1]){const flange=oval(body,side*(width-.003),-.002,.063-i*.023,.014,.004,.019,edge);flange.rotation.y=side*.35;}
  }
  const tail=new THREE.Group();tail.position.z=-.091;body.add(tail);
  for(let i=0;i<5;i++){const segment=new THREE.Mesh(plate,shell);segment.position.z=-i*.010;segment.scale.set(.048-i*.004,.015-i*.0015,.012);segment.castShadow=true;tail.add(segment);}
  oval(tail,0,-.001,-.062,.034,.008,.027,shell);
  for(const side of [-1,1]){const fan=oval(tail,side*.033,-.002,-.061,.021,.004,.03,edge);fan.rotation.y=-side*.4;}
  const head=new THREE.Group();head.position.set(0,.001,.104);body.add(head);
  oval(head,0,0,0,.046,.021,.03,shell);
  for(const side of [-1,1]){
    const eye=oval(head,side*.037,.009,.013,.012,.012,.010,eyes);eye.rotation.z=-side*.3;
    for(let i=0;i<3;i++){const jaw=link(head,edge,.002);pose(jaw,new THREE.Vector3(side*(.012-i*.003),-.009,.02),new THREE.Vector3(side*.003,-.013,.035+i*.002));}
  }
  const antennae=[-1,1].flatMap(side=>[0,1].map(short=>({side,short,links:Array.from({length:10},(_,i)=>link(head,edge,(short?.001:.0016)*(1-i*.075)))})));
  const legs=Array.from({length:14},()=>({links:Array.from({length:4},(_,i)=>link(group,legMaterials[i],[.004,.0037,.003,.0025][i])),feet:[link(group,legMaterials[4],.0019),link(group,legMaterials[5],.0011)],joints:Array.from({length:4},()=>oval(group,0,0,0,.0035,.0035,.0035,dark))}));
  function update(gait:ArthropodGait){
    body.position.copy(gait.center);body.rotation.set(gait.pitch,gait.heading,gait.roll,'YXZ');tail.rotation.x=gait.abdomenPitch*.35;
    for(const antenna of antennae){let previous=new THREE.Vector3(antenna.side*(antenna.short?.012:.025),.004,.025);
      for(let i=0;i<antenna.links.length;i++){const t=(i+1)/10,span=antenna.short?.04:.105;
        const next=new THREE.Vector3(antenna.side*((antenna.short?.012:.025)+t*span*.55)+Math.sin(gait.time*(1+gait.alert)+antenna.side)*t*t*.012,.004+Math.sin(t*Math.PI)*.012,.025+t*span);
        pose(antenna.links[i],previous,next);previous=next;}
    }
    legs.forEach((leg,i)=>{const points=gait.joints(i);leg.links.forEach((mesh,j)=>{pose(mesh,points[j],points[j+1]);leg.joints[j].position.copy(points[j]);});
      const toe=points[4].clone().add(new THREE.Vector3(gait.legs[i].side*.003,-.004,.009).applyAxisAngle(up,gait.heading));
      const claw=toe.clone().add(new THREE.Vector3(0,-.003,.005).applyAxisAngle(up,gait.heading));pose(leg.feet[0],points[4],toe);pose(leg.feet[1],toe,claw);
    });
  }
  return {group,update,setAnatomy:(enabled:boolean)=>legMaterials.forEach((material,i)=>material.color.set(enabled?ANATOMY_COLORS[i]:'#9c8f8c'))};
}
