import * as THREE from 'three/webgpu';
import { PHYS } from '../physics/constants.js';
import { RefractiveLightField } from '../graphics/refractive-light.js';
import { loadEnvironment } from '../graphics/environment.ts';
import { makeTable } from '../graphics/table.ts';
import { Input } from './input.ts';
import { JellySound } from './sound.ts';
import { createRenderer, resizeView } from '../graphics/renderer.ts';
import { OpticalTransport } from '../graphics/transport.ts';
import { createComposite } from '../graphics/composite.ts';
import { createPlayerCreature, selectedPlayerCreature } from './player-creature.ts';
import { FixedStepper } from './fixed-step.ts';

export async function startGame(stage:(s:string)=>void,fail:(e:unknown)=>void) {
  stage('Starting WebGPU');
  const renderer=await createRenderer(fail);
  document.querySelector('#viewport')!.appendChild(renderer.domElement);
  const scene=new THREE.Scene();
  scene.background=new THREE.Color('#e8d9c3');scene.fog=new THREE.Fog('#e8d9c3',2,12);
  const camera=new THREE.PerspectiveCamera(36,1,.001,40);
  camera.position.set(.082,.126,.19);
  stage('Reading the light');
  const environment=await loadEnvironment(renderer,scene);
  const kind=selectedPlayerCreature();
  stage(kind==='nih-dairia'?'Growing the tentacles':'Making a little jelly');
  const actor=await createPlayerCreature(kind),{body,rig}=actor;scene.add(actor.group);
  camera.position.multiplyScalar(actor.cameraScale);
  renderer.domElement.setAttribute('aria-label',`${kind==='nih-dairia'?'Nih-Dairia':'Jelly Baby'}. WASD or arrow keys to walk. Space to ${kind==='nih-dairia'?'brace':'hop'}. Drag the creature to stretch; drag the table to orbit.`);
  const optics=new RefractiveLightField(body.cage.opticalSurface,environment.incoming,actor.absorption);
  const table=await makeTable(optics,environment);scene.add(table.mesh);
  const composite=createComposite(renderer,scene,camera);
  const sound=new JellySound();
  rig.onContact=(speed,foot)=>sound.contact(speed,foot);
  const physicsClock=new FixedStepper(PHYS.step);
  let lastTime=0,disposed=false;
  const reset=()=>{input.recenter();body.reset();physicsClock.reset();};
  const input=new Input(camera,renderer.domElement,body,actor.mesh,rig,sound,reset,actor.cameraScale);
  const transport=new OpticalTransport(optics,body,camera,environment.incoming,fail);
  const resize=()=>resizeView(renderer,camera,input.controls);
  let resizeFrame=0;
  const resizeObserver=new ResizeObserver(()=>{
    cancelAnimationFrame(resizeFrame);resizeFrame=requestAnimationFrame(resize);
  });
  resizeObserver.observe(document.querySelector('#viewport')!);resize();
  document.querySelector('#reset')!.addEventListener('click',event=>{
    reset();if((event as MouseEvent).detail>0)(event.currentTarget as HTMLButtonElement).blur();
  });
  document.querySelector('#sound')!.addEventListener('click',event=>{
    const muted=sound.toggle(),button=document.querySelector('#sound')!;
    button.setAttribute('aria-pressed',String(muted));button.setAttribute('aria-label',muted?'Enable sound':'Mute sound');
    button.classList.toggle('muted',muted);void sound.unlock().catch(()=>{});
    if((event as MouseEvent).detail>0)(event.currentTarget as HTMLButtonElement).blur();
  });
  stage('Settling in');
  // Let contact establish itself before displaying the first frame.
  for(let i=0;i<80;i++){rig.step(PHYS.step);body.step(PHYS.step);}
  body.updateSurface();actor.update();input.update(1);
  optics.update(renderer,body,true);
  await transport.update();
  stage('Compiling the material');
  await renderer.compileAsync(scene,camera);
  stage('Drawing the first frame');
  composite.render();
  // Fence first-frame GPU work so validation/OOM cannot masquerade as a successful boot.
  const backend=renderer.backend as unknown as {device:GPUDevice};
  await backend.device.queue.onSubmittedWorkDone();
  lastTime=performance.now();
  const frame=(time:number)=>{
    if(disposed)return;
    try {
      const dt=Math.min(.05,Math.max(0,(time-lastTime)/1000));lastTime=time;
      if(document.hidden){physicsClock.reset();return;}
      const steps=physicsClock.advance(dt,()=>{
        input.step(PHYS.step);rig.step(PHYS.step);body.step(PHYS.step);input.afterPhysicsStep();rig.afterStep();
      });
      if(steps&&body.surfaceDirty) {
        if(!body.isFinite())throw new Error('The soft-body simulation produced an invalid state');
        body.updateSurface();actor.update();
      }
      input.update(dt);
      transport.follow();
      optics.update(renderer,body);
      table.mesh.position.x=body.center.x;table.mesh.position.z=body.center.z;
      void transport.update().catch(fail);
      composite.render();
    }catch(error){fail(error);}
  };
  await renderer.setAnimationLoop(frame);
  const dispose=()=>{
    if(disposed)return;disposed=true;
    void renderer.setAnimationLoop(null);input.dispose();sound.dispose();transport.dispose();resizeObserver.disconnect();cancelAnimationFrame(resizeFrame);
    composite.dispose();actor.dispose();table.dispose();environment.dispose();optics.dispose();renderer.dispose();
  };
  window.addEventListener('pagehide',event=>{if(!event.persisted)dispose();});
  if(import.meta.hot)import.meta.hot.dispose(dispose);
  return {stop:()=>{disposed=true;input.clear();transport.dispose();void renderer.setAnimationLoop(null);}};
}
