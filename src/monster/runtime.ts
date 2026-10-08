import { createRenderer, resizeView } from '../graphics/renderer.ts';
import { SoftBody } from '../physics/soft-body.js';
import { PHYS } from '../physics/constants.js';
import { FixedStepper } from '../game/fixed-step.ts';
import { loadEnvironment } from '../graphics/environment.ts';
import { loadMonsterCage } from './model.ts';
import { MonsterBehavior } from './behavior.ts';
import { createMonsterAppearance } from './appearance.ts';
import { createMonsterInteraction } from './interaction.ts';
import { createSpecimenScene } from './scene.ts';
import { createTuningPanel, loadMotionSettings } from './tuning-panel.ts';
import { selectedVariant } from './variants.ts';
import { AutoLure } from './auto-lure.ts';

export async function startMonster(stage:(message:string)=>void,fail:(reason:unknown)=>void){
  stage('Starting WebGPU');
  const renderer=await createRenderer(fail);renderer.shadowMap.enabled=true;
  renderer.domElement.setAttribute('aria-label','Nih-Dairia specimen. Drag the red lure to attract it. Release it to allow capture and absorption. Touch the creature to provoke a recoil. Drag the table to orbit.');
  document.querySelector('#viewport')!.appendChild(renderer.domElement);
  const set=createSpecimenScene(),{scene,camera,lure,prey}=set;
  stage('Preparing the observation table');
  const environment=await loadEnvironment(renderer,scene);
  scene.environmentIntensity=.4;
  const variant=selectedVariant();
  stage(`Growing ${variant.limbs} limbs`);
  const body=new SoftBody(await loadMonsterCage(variant.id)),behavior=new MonsterBehavior(body,loadMotionSettings());
  const tuning=createTuningPanel(behavior.settings);
  const monster=createMonsterAppearance(body,behavior.feeding);scene.add(monster);
  const autoLure=new AutoLure();
  const input=createMonsterInteraction(camera,renderer.domElement,lure,monster,behavior,autoLure);
  const clock=new FixedStepper(PHYS.step);
  let stopped=false,disposed=false,lastTime=performance.now(),resizeFrame=0;
  const resize=()=>resizeView(renderer,camera,input.controls);
  const observer=new ResizeObserver(()=>{cancelAnimationFrame(resizeFrame);resizeFrame=requestAnimationFrame(resize);});
  observer.observe(document.querySelector('#viewport')!);resize();
  for(let i=0;i<100;i++){behavior.step(PHYS.step);body.step(PHYS.step);}
  body.updateSurface();lure.position.copy(behavior.target);
  stage('Compiling translucent tissue');await renderer.compileAsync(scene,camera);
  stage('Drawing the first frame');renderer.render(scene,camera);
  await (renderer.backend as unknown as {device:GPUDevice}).device.queue.onSubmittedWorkDone();
  const status=document.querySelector('#creature-state')!,note=document.querySelector('#state-note')!;
  const descriptions={listening:'Stillness is part of the hunt.',probing:'It leans toward the stimulus, feet planted.',stalking:'Two arms feel in different directions. The body follows.',enveloping:'The probing arms fan around the lure. Rear legs brace.',recoiling:'It lowers its body and braces against the table.',cradling:'Two arms cup the prey, one side first. The rear legs brace.',covering:'Its feet plant while the torso settles over the prey.',dropping:'The center descends to the table and molds around the prey.',absorbing:'The membrane-covered shape holds, then slowly smooths into the body.',recovering:'The deformation is gone. The creature rises again.',spawning:'Another stimulus appears across the table.'};
  let previousState='';
  lastTime=performance.now();
  await renderer.setAnimationLoop(time=>{
    if(stopped)return;
    try{
      const dt=Math.min(.05,Math.max(0,(time-lastTime)/1000));lastTime=time;
      if(document.hidden){clock.reset();return;}
      const steps=clock.advance(dt,()=>{if(!behavior.feeding.locked&&!behavior.targetHeld){autoLure.step(PHYS.step,behavior.target,behavior.center);if(autoLure.enabled)behavior.stimulus=1;}behavior.step(PHYS.step);body.step(PHYS.step);});
      if(steps){if(!body.isFinite())throw new Error('Nih-Dairia physics produced an invalid state');body.updateSurface();}
      prey.update(behavior.feeding);
      if(previousState!==behavior.state){previousState=behavior.state;status.textContent=behavior.state;note.textContent=descriptions[behavior.state];}
      input.controls.update();renderer.render(scene,camera);
    }catch(error){fail(error);}
  });
  const stop=()=>{stopped=true;void renderer.setAnimationLoop(null);};
  const dispose=()=>{if(disposed)return;disposed=true;stop();input.dispose();tuning.dispose();observer.disconnect();cancelAnimationFrame(resizeFrame);set.dispose();body.cage.opticalSurface.geometry.dispose();environment.dispose();renderer.dispose();};
  window.addEventListener('pagehide',event=>{if(!event.persisted)dispose();});
  if(import.meta.hot)import.meta.hot.dispose(dispose);
  return {stop};
}
