import * as THREE from 'three/webgpu';
import { createPrey } from './prey.ts';
import { ARENA } from './arena.ts';

export function createSpecimenScene(arenaRadius:number=ARENA.radius){
  const scene=new THREE.Scene();scene.background=new THREE.Color('#1c2422');
  scene.fog=new THREE.Fog('#1c2422',1.4,4);
  const camera=new THREE.PerspectiveCamera(38,1,.001,8);camera.position.set(.52,.86,1.0);
  const table=new THREE.Mesh(new THREE.CylinderGeometry(arenaRadius,arenaRadius+.007,.015,128),new THREE.MeshStandardNodeMaterial({color:'#63695f',roughness:.79,metalness:.2}));
  table.position.y=-.008;table.receiveShadow=true;scene.add(table);
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(10,10),new THREE.MeshStandardNodeMaterial({color:'#242d28',roughness:.9}));
  ground.rotation.x=-Math.PI/2;ground.position.y=-.017;ground.receiveShadow=true;scene.add(ground);
  for(let radius=.1;radius<arenaRadius;radius+=.1){
    const ring=new THREE.Mesh(new THREE.RingGeometry(radius-.00025,radius+.00025,128),new THREE.MeshBasicNodeMaterial({color:'#a6ad8b',transparent:true,opacity:.17,depthWrite:false}));
    ring.rotation.x=-Math.PI/2;ring.position.y=.0001;scene.add(ring);
  }
  const key=new THREE.DirectionalLight('#e3e6ca',3);key.position.set(-.35,1,.25);key.castShadow=true;
  key.shadow.mapSize.set(2048,2048);const shadowExtent=arenaRadius+.1;key.shadow.camera.left=-shadowExtent;key.shadow.camera.right=shadowExtent;key.shadow.camera.top=shadowExtent;key.shadow.camera.bottom=-shadowExtent;key.shadow.camera.near=.01;key.shadow.camera.far=3;key.shadow.bias=-.0002;key.shadow.normalBias=.0003;scene.add(key);
  const rim=new THREE.DirectionalLight('#9dbac0',1.4);rim.position.set(.2,.08,-.2);scene.add(rim);
  scene.add(new THREE.HemisphereLight('#b6c8bd','#303326',1.5));
  const prey=createPrey(),lure=prey.mesh;scene.add(lure);
  return {scene,camera,lure,prey,dispose:()=>{scene.traverse(object=>{if(object instanceof THREE.Mesh){object.geometry.dispose();const materials=Array.isArray(object.material)?object.material:[object.material];materials.forEach(m=>m.dispose());}});key.shadow.dispose();}};
}
