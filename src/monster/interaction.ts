import * as THREE from 'three/webgpu';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { MonsterBehavior } from './behavior.ts';
import type { AutoLure } from './auto-lure.ts';
import { ARENA } from './arena.ts';

export function createMonsterInteraction(camera:THREE.PerspectiveCamera,canvas:HTMLCanvasElement,lure:THREE.Mesh,monster:THREE.Mesh,behavior:MonsterBehavior,autoLure:AutoLure){
  const abort=new AbortController(),signal=abort.signal;
  const controls=new OrbitControls(camera,canvas);
  controls.target.set(0,.015,0);controls.enablePan=false;controls.enableDamping=true;
  controls.minDistance=.22;controls.maxDistance=2.2;controls.maxPolarAngle=1.25;controls.update();
  const ray=new THREE.Raycaster(),pointer=new THREE.Vector2(),plane=new THREE.Plane(new THREE.Vector3(0,1,0),-.012),hit=new THREE.Vector3();
  let dragging:number|null=null,touchDrag=false;
  const dragButton=document.querySelector<HTMLButtonElement>('#drag-mode')!;
  dragButton.addEventListener('click',()=>{touchDrag=!touchDrag;dragButton.setAttribute('aria-pressed',String(touchDrag));dragButton.textContent=touchDrag?'Camera mode':'Move prey';},{signal});
  const aim=(e:PointerEvent)=>{const r=canvas.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,1-(e.clientY-r.top)/r.height*2);camera.updateMatrixWorld();ray.setFromCamera(pointer,camera);};
  const place=(e:PointerEvent)=>{aim(e);if(ray.ray.intersectPlane(plane,hit)){const radius=Math.hypot(hit.x,hit.z);if(radius>ARENA.lureRadius){hit.x*=ARENA.lureRadius/radius;hit.z*=ARENA.lureRadius/radius;}behavior.target.copy(hit);behavior.stimulus=1;}};
  const autoButton=document.querySelector<HTMLButtonElement>('#auto-lure')!;
  const showAuto=()=>{autoButton.setAttribute('aria-pressed',String(autoLure.enabled));autoButton.textContent=autoLure.enabled?'Auto lure on':'Auto lure off';};
  autoButton.addEventListener('click',()=>{autoLure.enabled=!autoLure.enabled;showAuto();},{signal});
  canvas.addEventListener('pointerdown',e=>{
    if(e.button!==0||dragging!==null||e.pointerType==='touch'&&!touchDrag)return;aim(e);
    // A generous proxy keeps the small lure selectable on touch screens.
    const sphere=new THREE.Sphere(lure.position,.019);
    if(!behavior.feeding.locked&&lure.visible&&ray.ray.intersectsSphere(sphere)){dragging=e.pointerId;behavior.targetHeld=true;controls.enabled=false;canvas.setPointerCapture(e.pointerId);e.stopImmediatePropagation();place(e);canvas.classList.add('grabbing');}
    else if(ray.intersectObject(monster).length){behavior.disturb();}
  },{capture:true,signal});
  canvas.addEventListener('pointermove',e=>{if(e.pointerId===dragging)place(e);},{signal});
  const release=()=>{dragging=null;behavior.targetHeld=false;controls.enabled=true;canvas.classList.remove('grabbing');};
  const releasePointer=(e:PointerEvent)=>{if(e.pointerId===dragging)release();};
  window.addEventListener('pointerup',releasePointer,{signal});window.addEventListener('pointercancel',releasePointer,{signal});
  canvas.addEventListener('lostpointercapture',releasePointer,{signal});window.addEventListener('blur',release,{signal});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)release();},{signal});
  const reset=()=>{behavior.reset();autoLure.reset();release();};
  document.querySelector('#reset')!.addEventListener('click',reset,{signal});
  document.querySelector('#autonomy')!.addEventListener('click',e=>{behavior.active=!behavior.active;const button=e.currentTarget as HTMLButtonElement;button.setAttribute('aria-pressed',String(behavior.active));button.textContent=behavior.active?'Instinct on':'Instinct off';},{signal});
  window.addEventListener('keydown',e=>{if(e.code==='KeyR'&&!e.repeat&&!(e.target instanceof HTMLElement&&e.target.closest('input,select,textarea,button')))reset();},{signal});
  const status=document.querySelector<HTMLElement>('#motion-status')!;
  const update=()=>{const text=!behavior.active?'Instinct paused — tap Instinct to resume':behavior.targetHeld?'Prey held — release to resume':behavior.feeding.locked?`${autoLure.enabled?'Auto waiting':'Feeding'} · ${behavior.feeding.phase}`:`${autoLure.enabled?'Auto chasing':'Manual prey'} · ${behavior.pursuit.phase}`;if(status.textContent!==text)status.textContent=text;};
  return {controls,update,dispose:()=>{abort.abort();controls.dispose();}};
}
