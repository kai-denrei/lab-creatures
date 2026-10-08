import * as THREE from 'three/webgpu';
import { createPrey } from './prey.ts';
import { ARENA } from './arena.ts';

export function createSpecimenScene(){
  const scene=new THREE.Scene();scene.background=new THREE.Color('#1c2422');
  scene.fog=new THREE.Fog('#1c2422',1.4,4);
  const camera=new THREE.PerspectiveCamera(38,1,.001,8);camera.position.set(.52,.86,1.0);
  const table=new THREE.Mesh(new THREE.CylinderGeometry(ARENA.radius,ARENA.radius+.007,.015,128),new THREE.MeshStandardNodeMaterial({color:'#63695f',roughness:.79,metalness:.2}));
  table.position.y=-.008;table.receiveShadow=true;scene.add(table);
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(10,10),new THREE.MeshStandardNodeMaterial({color:'#242d28',roughness:.9}));
  ground.rotation.x=-Math.PI/2;ground.position.y=-.017;ground.receiveShadow=true;scene.add(ground);
  for(const radius of [.1,.2,.3,.4,.5]){
    const ring=new THREE.Mesh(new THREE.RingGeometry(radius-.00025,radius+.00025,128),new THREE.MeshBasicNodeMaterial({color:'#a6ad8b',transparent:true,opacity:.17,depthWrite:false}));
    ring.rotation.x=-Math.PI/2;ring.position.y=.0001;scene.add(ring);
  }
  const key=new THREE.DirectionalLight('#e3e6ca',3);key.position.set(-.35,1,.25);key.castShadow=true;
  key.shadow.mapSize.set(2048,2048);key.shadow.camera.left=-.65;key.shadow.camera.right=.65;key.shadow.camera.top=.65;key.shadow.camera.bottom=-.65;key.shadow.camera.near=.01;key.shadow.camera.far=3;key.shadow.bias=-.0002;key.shadow.normalBias=.0003;scene.add(key);
  const rim=new THREE.DirectionalLight('#9dbac0',1.4);rim.position.set(.2,.08,-.2);scene.add(rim);
  scene.add(new THREE.HemisphereLight('#b6c8bd','#303326',1.5));
  const prey=createPrey(),lure=prey.mesh;scene.add(lure);
  return {scene,camera,lure,prey,dispose:()=>{scene.traverse(object=>{if(object instanceof THREE.Mesh){object.geometry.dispose();const materials=Array.isArray(object.material)?object.material:[object.material];materials.forEach(m=>m.dispose());}});key.shadow.dispose();}};
}
