import { LAB_ARENA } from './variants.ts';
import * as THREE from 'three/webgpu';
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/** Capture lure drags before OrbitControls sees the pointer. Ordinary drags still orbit. */
export function createArthropodInteraction(camera:THREE.PerspectiveCamera,canvas:HTMLCanvasElement,controls:OrbitControls,lure:THREE.Mesh,onPlace:(point:THREE.Vector3)=>void){
  const abort=new AbortController(),{signal}=abort;
  const ray=new THREE.Raycaster(),plane=new THREE.Plane(new THREE.Vector3(0,1,0),-.012),hit=new THREE.Vector3();
  let press:{id:number;x:number;y:number;dragged:boolean}|null=null,dragging:number|null=null,moveMode=false;
  const dragButton=document.querySelector<HTMLButtonElement>('#drag-mode')!;
  const aim=(e:PointerEvent)=>{const rect=canvas.getBoundingClientRect();camera.updateMatrixWorld();ray.setFromCamera(new THREE.Vector2((e.clientX-rect.left)/rect.width*2-1,1-(e.clientY-rect.top)/rect.height*2),camera);};
  const place=(e:PointerEvent)=>{
    aim(e);if(!ray.ray.intersectPlane(plane,hit))return;
    const radius=Math.hypot(hit.x,hit.z);if(radius>LAB_ARENA.lureRadius){hit.x*=LAB_ARENA.lureRadius/radius;hit.z*=LAB_ARENA.lureRadius/radius;}
    onPlace(hit);
  };
  const release=()=>{
    const pointer=dragging;dragging=null;press=null;controls.enabled=true;canvas.classList.remove('grabbing');
    if(pointer!==null&&canvas.hasPointerCapture(pointer))canvas.releasePointerCapture(pointer);
  };
  dragButton.addEventListener('click',()=>{moveMode=!moveMode;dragButton.setAttribute('aria-pressed',String(moveMode));dragButton.textContent=moveMode?'Camera mode':'Move lure';release();},{signal});
  canvas.addEventListener('pointerdown',e=>{
    if(!e.isPrimary||e.button!==0){press=null;return;}
    press={id:e.pointerId,x:e.clientX,y:e.clientY,dragged:false};aim(e);
    if(lure.visible&&(moveMode||ray.ray.intersectsSphere(new THREE.Sphere(lure.position,.021)))){
      dragging=e.pointerId;controls.enabled=false;canvas.setPointerCapture(e.pointerId);e.stopImmediatePropagation();canvas.classList.add('grabbing');place(e);
    }
  },{capture:true,signal});
  canvas.addEventListener('pointermove',e=>{
    if(press&&Math.hypot(e.clientX-press.x,e.clientY-press.y)>6)press.dragged=true;
    if(e.pointerId===dragging)place(e);
  },{signal});
  canvas.addEventListener('pointerup',e=>{
    if(e.pointerId===dragging){release();return;}
    if(press?.id!==e.pointerId)return;
    const tapped=!press.dragged;press=null;
    if(tapped){aim(e);if(ray.ray.intersectPlane(plane,hit)&&Math.hypot(hit.x,hit.z)<LAB_ARENA.radius)place(e);}
  },{signal});
  canvas.addEventListener('pointercancel',release,{signal});canvas.addEventListener('lostpointercapture',release,{signal});
  window.addEventListener('pointerup',e=>{if(e.pointerId===dragging)release();},{signal});
  window.addEventListener('blur',release,{signal});document.addEventListener('visibilitychange',()=>{if(document.hidden)release();},{signal});
  return {get held(){return dragging!==null;},release,dispose:()=>{release();abort.abort();}};
}
