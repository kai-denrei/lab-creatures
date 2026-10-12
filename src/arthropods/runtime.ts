import { attachSharing } from '../sharing/panel.ts';
import * as THREE from 'three/webgpu';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createRenderer, resizeView } from '../graphics/renderer.ts';
import { createSpecimenScene } from '../monster/scene.ts';
import { loadEnvironment } from '../graphics/environment.ts';
import { VeilGait } from './veil-gait.ts';
import { ArthropodGait } from './gait.ts';
import { createArthropod } from './model.ts';
import { createOculus } from './oculus.ts';
import { createIsopod } from './isopod.ts';
import { createMembrane } from './membrane.ts';
import { selectedLabVariant, LAB_ARENA } from './variants.ts';
import { PredatorInstinct, STATE_NOTES, VEIL_STATE_NOTES } from './instinct.ts';
import { defaultSettings, PREDATOR_CONTROLS, PRESETS, formatSetting, loadPredatorSettings, savePredatorSettings } from './settings.ts';
import { createArthropodInteraction } from './interaction.ts';

export async function startArthropod(stage:(message:string)=>void,fail:(reason:unknown)=>void){
  const variant=selectedLabVariant(),DEFAULT_SETTINGS=defaultSettings(variant.id);
  stage('Starting WebGPU');
  const renderer=await createRenderer(fail);renderer.shadowMap.enabled=true;
  renderer.domElement.setAttribute('aria-label',`${variant.name} predator lab. Drag the red lure or tap the table to place it. Drag elsewhere to orbit, scroll or pinch to zoom.`);
  document.querySelector('#viewport')!.appendChild(renderer.domElement);
  const set=createSpecimenScene(LAB_ARENA.radius),{scene,camera,lure}=set;lure.position.set(.10,.012,.17);
  camera.position.set(.68,.76,1.06);
  const controls=new OrbitControls(camera,renderer.domElement);
  controls.target.set(0,.04,0);controls.enableDamping=true;controls.enablePan=false;controls.minDistance=.22;controls.maxDistance=2.5;
  const gait=variant.id==='veil'?new VeilGait():new ArthropodGait(variant.id),creature=(variant.id==='oculus'||variant.id==='monoculus')?createOculus(variant.id):variant.id==='isopod'?createIsopod():variant.id==='veil'?createMembrane():createArthropod(),settings=loadPredatorSettings(variant.id);scene.add(creature.group);
  const instinct=new PredatorInstinct(gait,settings);
  const abort=new AbortController(),{signal}=abort;
  let stopped=false,disposed=false,environment:Awaited<ReturnType<typeof loadEnvironment>>|undefined;
  let mode='instinct',autoWalk=true,autoLure=false,lureTime=0,elapsed=0,accumulator=0,lastTime=performance.now(),framingScale=1;
  const marker=new THREE.Mesh(new THREE.RingGeometry(.008,.01,32),new THREE.MeshBasicNodeMaterial({color:'#d7b589',side:THREE.DoubleSide}));
  marker.rotation.x=-Math.PI/2;marker.position.y=.0007;marker.visible=false;scene.add(marker);
  const walk=document.querySelector<HTMLButtonElement>('#arthropod-walk')!,anatomy=document.querySelector<HTMLButtonElement>('#arthropod-anatomy')!;
  const autonomy=document.querySelector<HTMLButtonElement>('#autonomy')!,autoButton=document.querySelector<HTMLButtonElement>('#auto-lure')!;
  const status=document.querySelector('#creature-state')!,note=document.querySelector('#state-note')!,compact=document.querySelector('#compact-state')!,lureStatus=document.querySelector('#lure-status')!;
  const preset=document.querySelector<HTMLSelectElement>('#instinct-preset')!;
  const text=(element:Element,value:string)=>{if(element.textContent!==value)element.textContent=value;};
  const showState=()=>{
    const state=mode==='instinct'?(instinct.active?instinct.state:'Instinct paused'):!gait.walking?'Observing':autoWalk?'Exploring':Math.hypot(gait.center.x-gait.target.x,gait.center.z-gait.target.z)<.026?'Arrived':'Walking to target';
    text(status,state);text(compact,state);
    text(note,mode==='instinct'?(instinct.active?(variant.id==='veil'?VEIL_STATE_NOTES:STATE_NOTES)[instinct.state]:'Feet settle. Toggle Instinct to resume the encounter.'):!gait.walking?'Feet settle. Antennae continue sensing.':'Tap the table to guide it.');
    text(walk,gait.walking?'Pause walking':'Resume walking');walk.setAttribute('aria-pressed',String(gait.walking));
    text(autonomy,instinct.active?'Instinct on':'Instinct off');autonomy.setAttribute('aria-pressed',String(instinct.active));
    text(autoButton,autoLure?'Auto lure on':'Auto lure off');autoButton.setAttribute('aria-pressed',String(autoLure));
    text(lureStatus,input.held?(autoLure?'Lure held · auto pauses until release':'Lure held'):autoLure?'Auto lure · figure-eight path':'Manual lure · drag or tap the table');
    document.querySelector<HTMLButtonElement>('#startle')!.disabled=!instinct.active;
  };
  const input=createArthropodInteraction(camera,renderer.domElement,controls,lure,point=>{
    if(mode==='instinct')lure.position.copy(point);
    else {gait.target.copy(point);autoWalk=false;gait.walking=true;marker.position.set(point.x,.0007,point.z);marker.visible=true;}
  });
  const syncTuning=()=>{
    for(const control of PREDATOR_CONTROLS){
      document.querySelector<HTMLInputElement>(`#tuning-${control.key}`)!.value=String(settings[control.key]);
      text(document.querySelector(`#value-${control.key}`)!,formatSetting(control,settings[control.key]));
    }
  };
  for(const control of PREDATOR_CONTROLS)document.querySelector<HTMLInputElement>(`#tuning-${control.key}`)!.addEventListener('input',event=>{
    settings[control.key]=Number((event.target as HTMLInputElement).value);preset.value='custom';syncTuning();savePredatorSettings(settings,variant.id);
  },{signal});
  attachSharing({panel:document.querySelector<HTMLElement>('.motion-panel')!,family:'predator',specimen:variant.id,controls:PREDATOR_CONTROLS,settings,signal,changed:()=>{preset.value='custom';syncTuning();savePredatorSettings(settings,variant.id);},exportCreature:async()=>{const {exportPredator}=await import('./export.ts');await exportPredator(variant.id,{...settings},creature.group);}});
  preset.value=PREDATOR_CONTROLS.every(c=>settings[c.key]===DEFAULT_SETTINGS[c.key])?'balanced':'custom';
  preset.addEventListener('change',()=>{
    if(preset.value==='custom')return;
    Object.assign(settings,preset.value==='balanced'?DEFAULT_SETTINGS:PRESETS[preset.value]);syncTuning();savePredatorSettings(settings,variant.id);
  },{signal});
  document.querySelector('#restore-tuning')!.addEventListener('click',()=>{Object.assign(settings,DEFAULT_SETTINGS);preset.value='balanced';syncTuning();savePredatorSettings(settings,variant.id);},{signal});
  autonomy.addEventListener('click',()=>{instinct.active=!instinct.active;if(instinct.active)instinct.reset();showState();},{signal});
  autoButton.addEventListener('click',()=>{autoLure=!autoLure;showState();},{signal});
  document.querySelector('#startle')!.addEventListener('click',()=>{instinct.disturb(lure.position);showState();},{signal});
  walk.addEventListener('click',()=>{gait.walking=!gait.walking;showState();},{signal});
  anatomy.addEventListener('click',()=>{
    const enabled=anatomy.getAttribute('aria-pressed')!=='true';anatomy.setAttribute('aria-pressed',String(enabled));creature.setAnatomy(enabled);
    document.querySelector('#anatomy-legend')!.classList.toggle('colored',enabled);
  },{signal});
  document.querySelector<HTMLSelectElement>('#lab-mode')!.addEventListener('change',event=>{
    mode=(event.target as HTMLSelectElement).value;input.release();gait.reset();instinct.reset();autoWalk=true;elapsed=0;marker.visible=false;
    gait.walking=mode==='walk'||instinct.active;lure.visible=mode==='instinct';walk.hidden=mode==='instinct';
    document.querySelector<HTMLElement>('.instinct-controls')!.hidden=mode!=='instinct';
    (lureStatus as HTMLElement).hidden=mode!=='instinct';
    text(document.querySelector('#interaction-hint')!,mode==='instinct'?'Drag the red lure or tap the table to place it. Drag elsewhere to orbit.':'Tap the table to choose a destination. Drag to orbit; scroll or pinch to inspect.');
    showState();
  },{signal});
  const resize=()=>{
    const scale=innerWidth<700?1.12:1;
    camera.position.sub(controls.target).multiplyScalar(scale/framingScale).add(controls.target);framingScale=scale;
    resizeView(renderer,camera,controls);
  };
  const reset=()=>{
    input.release();gait.reset();instinct.reset();elapsed=0;lureTime=0;autoWalk=true;marker.visible=false;gait.walking=mode==='walk'||instinct.active;lure.position.set(.10,.012,.17);
    camera.position.set(.68,.76,1.06);controls.target.set(0,.04,0);framingScale=1;resize();showState();
  };
  document.querySelector('#reset')!.addEventListener('click',reset,{signal});
  window.addEventListener('keydown',event=>{if(event.code==='KeyR'&&!event.repeat&&!(event.target instanceof HTMLElement&&event.target.closest('input,button,select,textarea')))reset();},{signal});
  window.addEventListener('resize',resize,{signal});resize();
  const stop=()=>{stopped=true;void renderer.setAnimationLoop(null);};
  const dispose=()=>{if(disposed)return;disposed=true;stop();abort.abort();input.dispose();controls.dispose();set.dispose();environment?.dispose();renderer.dispose();};
  window.addEventListener('pagehide',event=>{if(!event.persisted)dispose();},{signal});
  if(import.meta.hot)import.meta.hot.dispose(dispose);
  try{
    stage('Lighting the specimen');environment=await loadEnvironment(renderer,scene);scene.environmentIntensity=.55;
    creature.update(gait);showState();
    stage('Preparing predatory instinct');await renderer.compileAsync(scene,camera);
    renderer.render(scene,camera);await (renderer.backend as unknown as {device:GPUDevice}).device.queue.onSubmittedWorkDone();
    lastTime=performance.now();
    const lureGoal=new THREE.Vector3();
    await renderer.setAnimationLoop(time=>{
      if(stopped)return;
      try{
        const dt=Math.min(.05,Math.max(0,(time-lastTime)/1000));lastTime=time;
        if(document.hidden){accumulator=0;return;}
        accumulator+=dt;
        while(accumulator>=1/120){
          if(mode==='instinct'){
            if(autoLure&&!input.held){
              lureTime+=1/120*settings.lureSpeed;
              const range=settings.lureRange/1000;
              lureGoal.set(Math.sin(lureTime*.6)*range,.012,Math.sin(lureTime*1.2+.8)*range*.6);
              const delta=lureGoal.clone().sub(lure.position),length=delta.length();
              if(length>0)lure.position.addScaledVector(delta,Math.min(1,.07*settings.lureSpeed/120/length));
            }
            instinct.step(1/120,lure.position);
          }else {
            gait.speed=settings.speed;gait.turnRate=settings.turnRate;gait.footLift=settings.footLift/1000;
            gait.drive=1;gait.facing=null;gait.crouch=0;gait.pitchTarget=0;gait.rollTarget=0;gait.abdomenTarget=0;gait.alert=0;
            if(gait.walking)elapsed+=1/120;
            if(autoWalk)gait.target.set(Math.sin(elapsed*.23)*.4,0,Math.cos(elapsed*.19)*.4);
          }
          gait.step(1/120);accumulator-=1/120;
        }
        creature.update(gait);showState();controls.update();renderer.render(scene,camera);
      }catch(error){stop();fail(error);}
    });
  }catch(error){dispose();throw error;}
  return {stop};
}
