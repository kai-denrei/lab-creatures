import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CutisSwarm } from './swarm/controller.ts';
import { createHardCores } from './creature/hard-core.ts';
import { createSwarmGeometry } from './creature/geometry.ts';
import type { CutisConfig } from './swarm/config.ts';
export function createCutisScene(host:HTMLElement,config:CutisConfig){
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setSize(host.clientWidth,host.clientHeight);renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;host.append(renderer.domElement);
  renderer.domElement.setAttribute('aria-label','Cutis-Maku observation arena. Drag the red lure or tap the ground. Drag elsewhere to orbit.');
  const scene=new THREE.Scene();scene.background=new THREE.Color('#171c1a');
  const camera=new THREE.PerspectiveCamera(38,1,.01,100);camera.position.set(-2.5,1.8,3.6);
  const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(.15,.2,0);controls.enableDamping=true;controls.minDistance=.55;controls.maxDistance=32;controls.maxPolarAngle=Math.PI*.46;
  scene.add(new THREE.HemisphereLight('#d0d6c0','#282720',2));const key=new THREE.DirectionalLight('#ffffff',3);key.position.set(-2,5,3);scene.add(key);
  const floor=new THREE.Mesh(new THREE.CircleGeometry(12,128),new THREE.MeshStandardMaterial({color:'#343c35',roughness:.86}));floor.rotation.x=-Math.PI/2;floor.position.y=-.002;scene.add(floor);
  const grid=new THREE.GridHelper(24,48,'#586151','#454e43');grid.position.y=.001;(grid.material as THREE.Material).transparent=true;(grid.material as THREE.Material).opacity=.22;scene.add(grid);
  const lure=new THREE.Mesh(new THREE.SphereGeometry(.045,20,12),new THREE.MeshStandardMaterial({color:'#e25b3b',emissive:'#942c18',emissiveIntensity:.6}));lure.position.set(1.3,.048,.6);scene.add(lure);
  const swarm=new CutisSwarm(config),model=createSwarmGeometry(swarm);scene.add(model.group);const hardCores=createHardCores(swarm);scene.add(hardCores.group);
  // Quiet contact shadows support the translucent shader without per-instance shadow maps.
  const shadowMaterial=new THREE.ShaderMaterial({transparent:true,depthWrite:false,vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);}',fragmentShader:'varying vec2 vUv;void main(){float r=length(vUv-.5)*2.;gl_FragColor=vec4(.015,.019,.014,(1.-smoothstep(.1,1.,r))*.42);}'});
  const shadows=new THREE.InstancedMesh(new THREE.PlaneGeometry(2,2),shadowMaterial,300);shadows.frustumCulled=false;shadows.renderOrder=0;scene.add(shadows);const dummy=new THREE.Object3D();
  const cageGeometry=new THREE.BufferGeometry(),cagePositions=new Float32Array(64*3);cageGeometry.setAttribute('position',new THREE.BufferAttribute(cagePositions,3));const cage=new THREE.LineSegments(cageGeometry,new THREE.LineBasicMaterial({color:'#efbc6d',transparent:true,opacity:.7}));cage.visible=false;cage.frustumCulled=false;scene.add(cage);
  const edges:[number,number][]=[];for(let i=0;i<16;i++)for(let bit=0;bit<4;bit++){const j=i^(1<<bit);if(i<j)edges.push([i,j]);}
  const verts=Array.from({length:16},()=>new THREE.Vector3());
  let autoLure=true,moveLure=false,held=false,activePointer=-1,downX=0,downY=0,debug=0,force=false,lureTime=0,stopped=false;
  const ray=new THREE.Raycaster(),pointer=new THREE.Vector2(),ground=new THREE.Plane(new THREE.Vector3(0,1,0),0),point=new THREE.Vector3(),abort=new AbortController(),{signal}=abort;
  const rayAt=(event:PointerEvent)=>{const r=renderer.domElement.getBoundingClientRect();pointer.set((event.clientX-r.left)/r.width*2-1,1-(event.clientY-r.top)/r.height*2);ray.setFromCamera(pointer,camera);};
  const place=(event:PointerEvent)=>{rayAt(event);if(ray.ray.intersectPlane(ground,point)){point.clampLength(0,10);lure.position.set(point.x,.048,point.z);}};
  const release=()=>{held=false;controls.enabled=true;if(activePointer>=0&&renderer.domElement.hasPointerCapture(activePointer))renderer.domElement.releasePointerCapture(activePointer);activePointer=-1;};
  renderer.domElement.addEventListener('pointerdown',event=>{downX=event.clientX;downY=event.clientY;rayAt(event);if(moveLure||ray.intersectObject(lure).length){event.stopImmediatePropagation();controls.enabled=false;held=true;activePointer=event.pointerId;renderer.domElement.setPointerCapture(event.pointerId);place(event);}},{signal,capture:true});
  renderer.domElement.addEventListener('pointermove',event=>{if(held&&event.pointerId===activePointer){event.stopImmediatePropagation();place(event);}},{signal,capture:true});
  renderer.domElement.addEventListener('pointerup',event=>{if(held){event.stopImmediatePropagation();place(event);release();}else if(Math.hypot(event.clientX-downX,event.clientY-downY)<5)place(event);},{signal,capture:true});
  renderer.domElement.addEventListener('pointercancel',release,{signal});renderer.domElement.addEventListener('lostpointercapture',release,{signal});window.addEventListener('blur',release,{signal});document.addEventListener('visibilitychange',()=>{if(document.hidden)release();},{signal});
  const resize=()=>{const w=host.clientWidth,h=host.clientHeight;camera.aspect=w/Math.max(1,h);camera.setViewOffset(w,h,w>900?w*.1:0,0,w,h);camera.updateProjectionMatrix();renderer.setSize(w,h);};window.addEventListener('resize',resize,{signal});resize();
  function setCount(count:number){swarm.reset(count);const distance=count===1?4.6:Math.max(7,Math.sqrt(count)*1.1);camera.position.set(-distance*.45,distance*.55,distance*.7);controls.target.set(0,.15,0);controls.update();}
  function draw(){
    hardCores.update();
    model.update(camera,host.clientHeight,debug,force);shadows.count=swarm.count;
    for(let i=0;i<swarm.count;i++){const p=swarm.position(i);dummy.position.set(p[0],.002,p[2]);dummy.rotation.set(-Math.PI/2,0,0);dummy.scale.setScalar(swarm.configFor(i).r0*swarm.scale[i]*1.2);dummy.updateMatrix();shadows.setMatrixAt(i,dummy.matrix);}shadows.instanceMatrix.needsUpdate=true;
    if(cage.visible){const phase=swarm.phase[0],theta=swarm.seed[0]*.2+Math.max(0,Math.min(1,(phase-.62)/.23))*2.1,c=Math.cos(theta),s=Math.sin(theta),p=swarm.position(0),r=swarm.configFor(0).r0;for(let i=0;i<16;i++){const x=(i&1)?1:-1,y=(i&2)?1:-1,z=(i&4)?1:-1,w=(i&8)?1:-1,xx=x*c-w*s,ww=x*s+w*c;verts[i].set(xx/(2.5-ww)*r+p[0],y/(2.5-ww)*r+r*.78,z/(2.5-ww)*r+p[2]);}let k=0;for(const [a,b] of edges){cagePositions.set(verts[a].toArray(),k);k+=3;cagePositions.set(verts[b].toArray(),k);k+=3;}cageGeometry.attributes.position.needsUpdate=true;}
    controls.update();renderer.render(scene,camera);
  }
  let last=performance.now(),accumulator=0,frames=0,fpsTime=last,fps=0;
  const stats={fps:0,draws:0,high:0,low:0};
  function frame(now:number){if(stopped)return;const dt=Math.min(.05,(now-last)/1000);last=now;if(!document.hidden){accumulator+=dt;while(accumulator>=1/120){if(autoLure&&!held&&!swarm.frozen){lureTime+=1/120;const range=swarm.count===1?1.5:Math.max(2,Math.sqrt(swarm.count)*.3);lure.position.set(Math.sin(lureTime*.18+.9)*range,.048,Math.cos(lureTime*.26)*range*.7);}swarm.step(1/120,lure.position);accumulator-=1/120;}draw();frames++;if(now-fpsTime>700){fps=frames*1000/(now-fpsTime);frames=0;fpsTime=now;}stats.fps=fps;stats.draws=renderer.info.render.calls;stats.high=model.levels.filter(l=>!l.low).reduce((n,l)=>n+l.count,0);stats.low=model.levels.filter(l=>l.low).reduce((n,l)=>n+l.count,0);}else accumulator=0;}
  return {renderer,scene,camera,controls,swarm,model,hardCores,lure,stats,draw,frame,setCount,setMixedPack:(on:boolean)=>swarm.setMixed(on),get held(){return held;},setAuto:(on:boolean)=>autoLure=on,setMove:(on:boolean)=>{moveLure=on;renderer.domElement.style.cursor=on?'crosshair':'';},setDebug:(value:number)=>debug=value,setForce:(on:boolean)=>force=on,setCage:(on:boolean)=>cage.visible=on,reset:()=>{release();swarm.reset();lureTime=0;},dispose:()=>{stopped=true;renderer.setAnimationLoop(null);abort.abort();release();controls.dispose();model.dispose();hardCores.dispose();scene.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();const materials=Array.isArray(o.material)?o.material:[o.material];materials.forEach(m=>m.dispose());}});cageGeometry.dispose();(cage.material as THREE.Material).dispose();renderer.dispose();renderer.domElement.remove();}};
}
