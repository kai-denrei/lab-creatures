import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Inago } from './controller.ts';
import { Cutisling } from '../cutisling/controller.ts';
import { createCutislingMembrane } from '../cutisling/membrane.ts';

export function createInagoScene(host:HTMLElement,variant:'inago'|'cutisling'='inago'){
  const organism=variant==='cutisling'?new Cutisling():new Inago(),feeding=organism instanceof Cutisling?organism:null,scene=new THREE.Scene();scene.background=new THREE.Color(0x090c0e);scene.fog=new THREE.FogExp2(0x090c0e,.024);
  const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.35;
  renderer.domElement.setAttribute('aria-label','Inago, one dark ground organism flowing through hundreds of crawling fragments. Click the floor to attract it.');host.append(renderer.domElement);
  const camera=new THREE.PerspectiveCamera(42,1,.05,120);camera.position.set(5.5,9,11.5);
  const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.target.set(0,0,0);controls.minDistance=4;controls.maxDistance=35;controls.maxPolarAngle=Math.PI*.47;
  scene.add(new THREE.HemisphereLight(0xbacbd2,0x11100d,2));
  const cold=new THREE.DirectionalLight(0xc4dbe4,4.2);cold.position.set(-4,8,-5);scene.add(cold);
  const warm=new THREE.DirectionalLight(0xe28a59,2.3);warm.position.set(6,3,4);scene.add(warm);
  const floor=new THREE.Mesh(new THREE.CircleGeometry(11,128),new THREE.MeshStandardMaterial({color:0x45443e,roughness:.96,metalness:.06}));floor.rotation.x=-Math.PI/2;floor.position.y=-.008;scene.add(floor);
  const plinth=new THREE.Mesh(new THREE.CylinderGeometry(11,11.2,.3,128),new THREE.MeshStandardMaterial({color:0x181b1b,roughness:.8}));plinth.position.y=-.17;scene.add(plinth);
  const rim=new THREE.Mesh(new THREE.TorusGeometry(10.98,.016,6,128),new THREE.MeshBasicMaterial({color:0x817768}));rim.rotation.x=Math.PI/2;scene.add(rim);
  const marks=new THREE.Group();scene.add(marks);
  const lineMaterial=new THREE.LineBasicMaterial({color:0x817c70,transparent:true,opacity:.23});
  for(const radius of [3,6,9]){
    const points=Array.from({length:129},(_,i)=>new THREE.Vector3(Math.cos(i/128*Math.PI*2)*radius,.002,Math.sin(i/128*Math.PI*2)*radius));
    marks.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),lineMaterial));
  }
  const motiles=feeding?null:createMotiles(scene,organism.count);
  const lure=new THREE.Mesh(new THREE.RingGeometry(.09,.12,32),new THREE.MeshBasicMaterial({color:0xee9463,side:THREE.DoubleSide}));lure.rotation.x=-Math.PI/2;lure.position.y=.012;lure.visible=false;scene.add(lure);
  const membrane=feeding?createCutislingMembrane(organism,(x,z)=>feeding.surfaceLift(x,z),()=>feeding.opening,(x,z)=>feeding.floorAt(x,z)):null;if(membrane)scene.add(membrane.group);
  const prey=feeding?new THREE.Mesh(new THREE.SphereGeometry(feeding.preyRadius,32,20),new THREE.MeshStandardMaterial({color:0xe7b76d,emissive:0xa65a19,emissiveIntensity:.3,roughness:.48})):null;if(prey)scene.add(prey);
  renderer.domElement.setAttribute('aria-label',`${variant==='cutisling'?'Cutisling, a flock connected by a continuous veined membrane':'Inago, a collective ground organism'}. Click the floor to attract it.`);
  const pose=new THREE.Object3D(),color=new THREE.Color();
  if(motiles)for(let i=0;i<organism.count;i++){const {armor}=motiles;color.setHSL(.56,.08,.10+organism.seed[i]*.09);armor.setColorAt(i,color);}if(motiles)motiles.armor.instanceColor!.needsUpdate=true;
  function draw(follow=true){
    membrane?.update();
    if(follow){let x=0,z=0;for(let i=0;i<organism.count;i++){x+=organism.x[i]/organism.count;z+=organism.z[i]/organism.count;}const dx=(x-controls.target.x)*.035,dz=(z-controls.target.z)*.035;controls.target.x+=dx;controls.target.z+=dz;camera.position.x+=dx;camera.position.z+=dz;}
    if(motiles){const {armor,ridges,seams,legs,shadows}=motiles;
    for(let i=0;i<organism.count;i++){
      const angle=organism.angle[i],size=.75+organism.seed[i]*.45,speed=Math.hypot(organism.vx[i],organism.vz[i]);
      const beat=organism.time*(14+speed*9)+organism.seed[i]*31,bob=Math.sin(beat)*.004*Math.min(1,speed);
      pose.position.set(organism.x[i],.053+bob,organism.z[i]);pose.rotation.set(0,angle,Math.sin(beat*.5)*.045);pose.scale.setScalar(size);pose.updateMatrix();armor.setMatrixAt(i,pose.matrix);ridges.setMatrixAt(i,pose.matrix);
      pose.position.x+=Math.sin(angle)*.05;pose.position.z+=Math.cos(angle)*.05;pose.position.y+=.031;pose.scale.set(size,1,size);pose.updateMatrix();seams.setMatrixAt(i,pose.matrix);
      for(let j=0;j<6;j++){
        const side=j<3?-1:1,row=j%3,along=(row-1)*.06,step=Math.sin(beat+row*2.1+(side<0?Math.PI:0))*Math.min(1,speed)*.35;
        pose.position.set(organism.x[i]+Math.cos(angle)*side*.03+Math.sin(angle)*along,.047,organism.z[i]-Math.sin(angle)*side*.03+Math.cos(angle)*along);
        pose.position.y+=Math.max(0,Math.sin(beat+row))*Math.min(1,speed)*.012;pose.rotation.set(0,angle+(row-1)*side*.35+step,0);pose.scale.set(side*size,1,size);pose.updateMatrix();legs.setMatrixAt(i*6+j,pose.matrix);
      }
      pose.position.set(organism.x[i],.001,organism.z[i]);pose.rotation.set(-Math.PI/2,0,-angle);pose.scale.set(size*.65,size*1.25,1);pose.updateMatrix();shadows.setMatrixAt(i,pose.matrix);
    }
    for(const mesh of [armor,ridges,seams,legs,shadows])mesh.instanceMatrix.needsUpdate=true;
    }
    if(prey&&feeding){prey.visible=feeding.tuning.hunting&&feeding.preyScale>0;prey.scale.setScalar(feeding.preyScale);prey.position.set(feeding.preyX,.012+feeding.preyRadius*feeding.preyScale,feeding.preyZ);}
    lure.visible=!feeding&&!!organism.target;if(organism.target)lure.position.set(organism.target.x,.012,organism.target.z);
    controls.update();renderer.render(scene,camera);
  }
  const resize=()=>{camera.aspect=host.clientWidth/Math.max(1,host.clientHeight);camera.updateProjectionMatrix();renderer.setSize(host.clientWidth,host.clientHeight);};resize();
  return {organism,membrane,scene,camera,controls,renderer,draw,resize,dispose(){
    membrane?.dispose();controls.dispose();scene.traverse(object=>{if(object instanceof THREE.Mesh||object instanceof THREE.Line){object.geometry.dispose();const materials=Array.isArray(object.material)?object.material:[object.material];materials.forEach(m=>m.dispose());if(object instanceof THREE.InstancedMesh)object.dispose();}});renderer.dispose();renderer.domElement.remove();
  }};
}

/** Cutisling never allocates or draws the Inago carapaces and appendages. */
function createMotiles(scene:THREE.Scene,count:number){
  // Faceted overlapping carapaces form a single moving, granular silhouette.
  const hull=new THREE.IcosahedronGeometry(1,1);hull.scale(.052,.037,.125);
  const armor=new THREE.InstancedMesh(hull,new THREE.MeshStandardMaterial({color:0x292d30,metalness:.65,roughness:.38,flatShading:true}),count);armor.frustumCulled=false;scene.add(armor);
  const ridgeGeometry=new THREE.ConeGeometry(.028,.13,3);ridgeGeometry.rotateX(Math.PI/2);ridgeGeometry.translate(0,.035,0);
  const ridges=new THREE.InstancedMesh(ridgeGeometry,new THREE.MeshStandardMaterial({color:0x101517,metalness:.45,roughness:.45}),count);ridges.frustumCulled=false;scene.add(ridges);
  const seams=new THREE.InstancedMesh(new THREE.BoxGeometry(.022,.006,.037),new THREE.MeshStandardMaterial({color:0x693823,emissive:0x6c2914,emissiveIntensity:.6,roughness:.5}),count);seams.frustumCulled=false;scene.add(seams);
  const legGeometry=new THREE.BufferGeometry();legGeometry.setAttribute('position',new THREE.Float32BufferAttribute([
    0,0,0,.072,.028,.012,.068,.036,.002, .068,.036,.002,.072,.028,.012,.11,-.047,.037,
  ],3));legGeometry.computeVertexNormals();
  const legs=new THREE.InstancedMesh(legGeometry,new THREE.MeshStandardMaterial({color:0x141a1c,metalness:.35,roughness:.65,side:THREE.DoubleSide}),count*6);legs.frustumCulled=false;scene.add(legs);
  const shadows=new THREE.InstancedMesh(new THREE.CircleGeometry(.13,12),new THREE.MeshBasicMaterial({color:0x070a0a,transparent:true,opacity:.24,depthWrite:false}),count);shadows.frustumCulled=false;scene.add(shadows);
  return {armor,ridges,seams,legs,shadows};
}
