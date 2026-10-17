import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {CutislingV2} from './controller.ts';
import {createV2Membrane} from './membrane.ts';
import {V2_PALETTES} from './palettes.ts';
import {createV2Tendrils} from './tendrils.ts';
import {createV2Vibrations} from './vibrations.ts';

export function createV2Scene(host:HTMLElement){
  const body=new CutislingV2(),scene=new THREE.Scene();scene.background=new THREE.Color(0x101616);
  const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,body.tuning.renderScale));
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;host.append(renderer.domElement);
  renderer.domElement.setAttribute('aria-label','Cutisling v2 motion experiment. Drag to orbit; click the ground to place prey when feeding is enabled.');
  const camera=new THREE.PerspectiveCamera(42,1,.05,100);camera.position.set(13,16,19);
  const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.target.set(4,0,1);controls.minDistance=3;controls.maxDistance=65;controls.maxPolarAngle=Math.PI*.47;
  scene.add(new THREE.HemisphereLight(0xe2d7e5,0x33382a,2));
  const key=new THREE.DirectionalLight(0xd4e3e7,3.3);key.position.set(-5,8,3);scene.add(key);
  const fill=new THREE.DirectionalLight(0xa9b4b5,1.4);fill.position.set(4,4,-4);scene.add(fill);
  const floor=new THREE.Mesh(new THREE.CircleGeometry(26,96),new THREE.MeshStandardMaterial({color:0x353d37,roughness:.94}));floor.rotation.x=-Math.PI/2;floor.position.y=-.015;scene.add(floor);
  const lines=new THREE.LineBasicMaterial({color:0x879282,transparent:true,opacity:.14});
  for(const radius of [6,12,18,24])scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(Array.from({length:97},(_,i)=>new THREE.Vector3(Math.cos(i/96*Math.PI*2)*radius,-.005,Math.sin(i/96*Math.PI*2)*radius))),lines));
  const membrane=createV2Membrane(body);scene.add(membrane.mesh);
  const tendrils=createV2Tendrils(body);scene.add(tendrils.mesh);
  const particlePositions=new Float32Array(1024*3),particleGeometry=new THREE.BufferGeometry();particleGeometry.setAttribute('position',new THREE.BufferAttribute(particlePositions,3).setUsage(THREE.DynamicDrawUsage));
  const points=new THREE.Points(particleGeometry,new THREE.PointsMaterial({color:0xf5c886,size:.045,depthTest:false,transparent:true,opacity:.85}));points.frustumCulled=false;points.renderOrder=2;scene.add(points);
  const vibrations=createV2Vibrations(body);scene.add(vibrations.group);
  const lureShadow=new THREE.Mesh(new THREE.CircleGeometry(1,32),new THREE.MeshBasicMaterial({color:0x131b18,transparent:true,opacity:.2,depthWrite:false}));
  lureShadow.name='Cutisling v2 / lure shadow';lureShadow.rotation.x=-Math.PI/2;scene.add(lureShadow);
  const prey=new THREE.Mesh(new THREE.SphereGeometry(body.preyRadius,24,16),new THREE.MeshStandardMaterial({color:0xe7b76d,emissive:0xa65a19,emissiveIntensity:.22,roughness:.5}));prey.name='Cutisling v2 / moving lure';scene.add(prey);
  // The settled tip swells into a substantial fleshy grip, then merges
  // into the arriving body. Its world position never follows the body.
  const foothold=new THREE.Mesh(new THREE.SphereGeometry(1,24,16),tendrils.mesh.material);
  foothold.name='Cutisling v2 / anchored contact';scene.add(foothold);
  function draw(dt=0){
    vibrations.update();membrane.update();
    tendrils.update();
    foothold.visible=body.anchorVisible&&body.tuning.showSkin&&body.anchorGrip>.001;
    if(foothold.visible){
      const grip=body.anchorGrip,bulk=body.tuning.anchorBulk;
      const footprint=(.28+.19*bulk)*body.tuning.spread*grip;
      const radius=body.anchorForPrey?Math.min(footprint,Math.max(.06,Math.hypot(body.anchorX-body.preyX,body.anchorZ-body.preyZ)-body.preyRadius-.04)):footprint,height=(.07+.19*bulk)*grip;
      foothold.position.set(body.anchorX,.012+height*.8,body.anchorZ);
      foothold.scale.set(radius,height*.8,radius*.88);
      foothold.rotation.y=-body.mouthAngle;
      foothold.material.color.setHex(V2_PALETTES[body.tuning.palette].skin);
    }
    points.visible=body.tuning.showParticles;
    if(points.visible){for(let i=0;i<body.count;i++){particlePositions[i*3]=body.mix(body.previousX[i],body.x[i]);particlePositions[i*3+1]=.16;particlePositions[i*3+2]=body.mix(body.previousZ[i],body.z[i]);}particleGeometry.setDrawRange(0,body.count);particleGeometry.attributes.position.needsUpdate=true;}
    const scale=body.mix(body.previousPreyScale,body.preyScale);prey.visible=body.tuning.hunting&&scale>0;prey.scale.setScalar(scale);const x=body.mix(body.lure.previousX,body.lure.x),z=body.mix(body.lure.previousZ,body.lure.z),bounce=body.mix(body.lure.previousHeight,body.lure.height);
    prey.position.set(x,.012+body.preyRadius*scale+bounce,z);
    lureShadow.visible=prey.visible;lureShadow.position.set(x,.003,z);lureShadow.scale.setScalar((body.preyRadius*.85+bounce*.18)*scale);lureShadow.material.opacity=.22/(1+bounce*2);
    if(body.tuning.followCamera&&!body.paused){const blend=1-Math.exp(-dt*2),dx=(body.mix(body.previousCenterX,body.centerX)-controls.target.x)*blend,dz=(body.mix(body.previousCenterZ,body.centerZ)-controls.target.z)*blend;controls.target.x+=dx;controls.target.z+=dz;camera.position.x+=dx;camera.position.z+=dz;}
    controls.update();renderer.render(scene,camera);
  }
  const resize=()=>{camera.aspect=host.clientWidth/Math.max(1,host.clientHeight);camera.updateProjectionMatrix();renderer.setSize(host.clientWidth,host.clientHeight);};resize();
  return {body,scene,camera,controls,renderer,membrane,draw,resize,setRenderScale(){renderer.setPixelRatio(Math.min(devicePixelRatio,body.tuning.renderScale));resize();},dispose(){
    controls.dispose();membrane.dispose();particleGeometry.dispose();points.material.dispose();
    scene.traverse(object=>{if((object instanceof THREE.Mesh||object instanceof THREE.Line)&&object!==membrane.mesh){object.geometry.dispose();if(Array.isArray(object.material))object.material.forEach(m=>m.dispose());else object.material.dispose();}});
    renderer.dispose();renderer.domElement.remove();
  }};
}
