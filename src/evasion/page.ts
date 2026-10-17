import './style.css';
import * as THREE from 'three';
import { createCutisScene } from '../cutis/scene.ts';
import { GOROGORO_DEFAULT_CONFIG } from '../cutis/swarm/tiers.ts';
import { EvasionGame,startingHunterPosition } from './game.ts';
import { createCapture } from './capture.ts';
import { createEvasionCreature,type EvasionCreature } from './reed.ts';

document.body.classList.add('evasion-page');document.title='Evasion — Reed / Nih-Dairia vs Gorogoro';
document.querySelector('#app')!.innerHTML=`<main id="evasion-board" aria-label="Evasion game arena"></main>
<header class="evasion-header"><div><span>FIELD TRIAL / 001</span><h1>Evasion.</h1><p>Survive. Feed. Clear all twelve hunters.</p></div><nav><label class="evasion-creature">Play as (new run)<select id="evasion-creature"><option value="reed">Reed</option><option value="nih-dairia">Nih-Dairia</option></select></label><a href="./">← Specimens</a><button id="evasion-eat">Eat · E</button><button id="evasion-shake">Shake · Space</button><button id="evasion-pause">Pause</button><button id="evasion-restart">Restart</button></nav></header>
<aside class="evasion-hud"><span id="evasion-status" role="status">PREPARING</span><strong id="evasion-time">0.0 s</strong><p id="evasion-contact">Loading Reed…</p><p id="evasion-bloodlust"></p><p id="evasion-growth"></p><label><span id="evasion-energy-label">Energy</span><progress id="evasion-energy" max="1" value="1"></progress></label><p id="evasion-shake-note"></p><label><span id="evasion-progress-label">Capture danger</span><progress id="evasion-progress" max="1" value="0"></progress></label></aside>
<footer class="evasion-help"><b>W A S D / Arrow keys</b> Move · <b>E / Click victim</b> Eat · <b>Space</b> Shake · <b>Esc</b> Pause · <b>R</b> Restart<br>Center over an isolated hunter to eat. Move to abandon.<br>Shake costs 48% energy and releases one hunter. Redder means slower. The edge is fatal.<br><span>Meals build strength. Clear all 12 to win.</span></footer>
<div class="evasion-pad" aria-label="Movement controls"><button data-move="ArrowUp" aria-label="Move up">↑</button><button data-move="ArrowLeft" aria-label="Move left">←</button><button data-move="ArrowDown" aria-label="Move down">↓</button><button data-move="ArrowRight" aria-label="Move right">→</button></div>
<section id="evasion-end" hidden><div><span>CONSUMED</span><h2>The hunt is over.</h2><p id="evasion-result"></p><button id="evasion-again">Try again</button></div></section>`;
const config={...GOROGORO_DEFAULT_CONFIG,r0:.33},lab=createCutisScene(document.querySelector<HTMLElement>('#evasion-board')!,config,{interactive:false,elevated:true});
const game=new EvasionGame();
const [reedActor,nihActor]=await Promise.all([createEvasionCreature(game.radius,'reed'),createEvasionCreature(game.radius,'nih-dairia')]);
const actors={reed:reedActor,'nih-dairia':nihActor},selector=document.querySelector<HTMLSelectElement>('#evasion-creature')!;
const initial=new URLSearchParams(location.search).get('creature');selector.value=initial==='nih-dairia'?'nih-dairia':'reed';
let reed=actors[selector.value as EvasionCreature];
const capture=createCapture();for(const actor of Object.values(actors)){lab.scene.add(actor.mesh,actor.debris);actor.mesh.visible=false;}lab.scene.add(capture.group);lab.setAuto(false);lab.lure.visible=false;lab.controls.enabled=false;lab.controls.maxDistance=200;lab.camera.near=.2;lab.camera.far=250;lab.camera.updateProjectionMatrix();
const keys=new Set<string>(),abort=new AbortController(),{signal}=abort;
const status=document.querySelector('#evasion-status')!,clock=document.querySelector('#evasion-time')!,contact=document.querySelector('#evasion-contact')!,progress=document.querySelector<HTMLProgressElement>('#evasion-progress')!,end=document.querySelector<HTMLElement>('#evasion-end')!,pause=document.querySelector<HTMLButtonElement>('#evasion-pause')!;
let accumulator=0,last=performance.now(),animation=0;
function reset(){
  keys.clear();game.reset();game.limbCount=reed.limbCount;for(const actor of Object.values(actors)){actor.reset();actor.mesh.visible=actor===reed;actor.debris.visible=actor===reed;}lab.setCount(12);lab.swarm.scale.fill(1);
  for(let i=0;i<12;i++){const p=startingHunterPosition(i),k=i*3;lab.swarm.offset[k]=p.x;lab.swarm.offset[k+2]=p.z;lab.swarm.phase[i]=0;}
  lab.lure.position.set(0,.048,0);lab.camera.position.set(0,38,10);lab.controls.target.set(0,0,0);lab.controls.update();lab.camera.clearViewOffset();
  reed.mesh.visible=true;end.hidden=true;pause.textContent='Pause';accumulator=0;last=performance.now();
}
function togglePause(){if(game.dead||game.won)return;game.paused=!game.paused;keys.clear();pause.textContent=game.paused?'Resume':'Pause';}
window.addEventListener('keydown',event=>{
  if(event.target instanceof HTMLElement&&event.target.closest('select'))return;
  if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowLeft','ArrowDown','ArrowRight','Escape','KeyR','Space','KeyE'].includes(event.code))event.preventDefault();
  if(event.code==='KeyE'&&!event.repeat)eat();else if(event.code==='Space'&&!event.repeat)game.shake(lab.swarm);else if(event.code==='Escape'&&!event.repeat)togglePause();else if(event.code==='KeyR'&&!event.repeat)reset();else keys.add(event.code);
},{signal});window.addEventListener('keyup',event=>keys.delete(event.code),{signal});
const suspend=()=>{keys.clear();if(!game.dead&&!game.won&&!game.paused)togglePause();};window.addEventListener('blur',suspend,{signal});document.addEventListener('visibilitychange',()=>{if(document.hidden)suspend();},{signal});
for(const button of document.querySelectorAll<HTMLButtonElement>('[data-move]')){
  button.addEventListener('pointerdown',event=>{event.preventDefault();button.setPointerCapture(event.pointerId);keys.add(button.dataset.move!);},{signal});
  for(const name of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(name,()=>keys.delete(button.dataset.move!),{signal});
}
document.querySelector('#evasion-shake')!.addEventListener('click',()=>game.shake(lab.swarm),{signal});
pause.addEventListener('click',togglePause,{signal});for(const id of ['evasion-restart','evasion-again'])document.getElementById(id)!.addEventListener('click',reset,{signal});
selector.addEventListener('change',()=>{selector.blur();reed=actors[selector.value as EvasionCreature];const url=new URL(location.href);url.searchParams.set('creature',reed.kind);history.replaceState(null,'',url);reset();},{signal});
function eat(target?:number){if(game.eat(lab.swarm,target))keys.clear();}
document.querySelector('#evasion-eat')!.addEventListener('click',()=>eat(),{signal});
const pickRay=new THREE.Raycaster(),pointer=new THREE.Vector2(),pickSphere=new THREE.Sphere(),hit=new THREE.Vector3();
lab.renderer.domElement.addEventListener('click',event=>{
  const rect=lab.renderer.domElement.getBoundingClientRect();pointer.set((event.clientX-rect.left)/rect.width*2-1,1-(event.clientY-rect.top)/rect.height*2);pickRay.setFromCamera(pointer,lab.camera);
  let chosen=-1,nearest=Infinity;
  for(let i=0;i<lab.swarm.count;i++)if(!game.removed[i]){
    const center=lab.swarm.getCoreContact(i).center;pickSphere.center.set(center.x,center.y,center.z);pickSphere.radius=lab.swarm.configFor(i).r0*lab.swarm.scale[i];
    if(pickRay.ray.intersectSphere(pickSphere,hit)){const d=hit.distanceTo(pickRay.ray.origin);if(d<nearest){nearest=d;chosen=i;}}
  }
  if(chosen>=0)eat(chosen);
},{signal});
reset();
function frame(now:number){
  const dt=Math.min(.05,(now-last)/1000);last=now;
  const dx=Number(keys.has('KeyD')||keys.has('ArrowRight'))-Number(keys.has('KeyA')||keys.has('ArrowLeft'));
  const dz=Number(keys.has('KeyS')||keys.has('ArrowDown'))-Number(keys.has('KeyW')||keys.has('ArrowUp'));
  if(!game.paused&&!game.dead&&!game.won){accumulator+=dt;while(accumulator>=1/120){lab.lure.position.set(game.x,.048,game.z);game.advanceHunters(1/120,lab.swarm);game.step(1/120,dx,dz,lab.swarm,(dt,x,z,speed)=>reed.step(dt,x,z,speed,game.bodies>=game.pinThreshold||game.devouring,game.feedingTarget>=0?game.feedingProgress:null));accumulator-=1/120;if(game.dead||game.won){accumulator=0;break;}}}
  reed.update(game.x,game.z,game.absorption,game.legsCut,game.elapsed,game.y,lab.swarm,game.removed,game.heat,game.shakePulse);capture.update(game,lab.swarm);
  const framing=Math.max(1,1/lab.camera.aspect);lab.camera.position.set(0,38*framing,10*framing);
  lab.camera.clearViewOffset();
  // Compress the victim only for drawing; contact geometry stays stable during the meal.
  const victim=game.feedingTarget,scale=victim>=0?lab.swarm.scale[victim]:1,altitude=victim>=0?lab.swarm.offset[victim*3+1]:0;
  if(victim>=0){const absorbed=Math.max(0,(game.feedingProgress-.35)/.65);lab.swarm.scale[victim]=scale*(1-.92*absorbed);lab.swarm.offset[victim*3+1]=altitude+absorbed*.2;}
  lab.draw();
  if(victim>=0){lab.swarm.scale[victim]=scale;lab.swarm.offset[victim*3+1]=altitude;}
  status.textContent=game.state;clock.textContent=`${game.elapsed.toFixed(1)} s`;contact.textContent=`${game.bodies} body grips · ${game.appendages} appendage grips`;
  const feeding=game.feedingTarget>=0,candidate=game.feedingCandidate(lab.swarm),remaining=game.remaining(lab.swarm);
  progress.value=feeding?game.feedingProgress:game.devouring?game.absorption:game.capture;
  document.querySelector('#evasion-progress-label')!.textContent=feeding?`Feeding · ${Math.max(0,game.feedingDuration-game.feedingTime).toFixed(1)} s${game.bodies||game.appendages?' (slowed)':''}`:game.devouring?'Being absorbed':'Capture danger';
  document.querySelector<HTMLProgressElement>('#evasion-energy')!.value=game.energy;
  document.querySelector('#evasion-energy-label')!.textContent=`Energy · ${Math.round(game.energy*100)}%${game.overheated?' · exhausted':''}`;
  document.querySelector('#evasion-growth')!.textContent=`${game.meals} meals · ${game.strength>=1?'Predator':game.meals>=3?'Turning the tide':'Prey'} · ${game.pinThreshold} bodies can pin you`;
  const action=document.querySelector<HTMLButtonElement>('#evasion-shake')!;
  action.textContent='Shake · Space';
  document.querySelector<HTMLButtonElement>('#evasion-eat')!.disabled=!game.canAct()||feeding;
  selector.title='Switch creature and start a new run';
  action.disabled=!game.canAct();
  document.querySelector('#evasion-shake-note')!.textContent=candidate>=0&&!feeding&&game.canAct()&&game.bodies<game.pinThreshold?(game.energy<.12?'Too exhausted to feed. Recover to 12% energy.':`Centered: press E or click the hunter to eat (${(5-3*game.strength).toFixed(1)} s). Nearby hunters can interrupt.`):game.notice;
  document.body.dataset.state=game.state;document.querySelector('#evasion-bloodlust')!.textContent=`${remaining} / 12 hunters remain · hunt speed ${game.huntSpeed.toFixed(2)}× · distress ${Math.round(game.pressure*100)}%`;
  if(game.dead||game.won){
    end.hidden=false;end.querySelector('span')!.textContent=game.won?'ARENA CLEARED':game.deathReason==='FELL'?'FELL FROM THE PLATFORM':'CONSUMED';
    end.querySelector('h2')!.textContent=game.won?'The prey became the predator.':'The hunt is over.';
    document.querySelector('#evasion-result')!.textContent=`${game.won?'Cleared in':'Survived'} ${game.elapsed.toFixed(1)} seconds · ${game.meals} hunters consumed.`;
    reed.mesh.visible=game.won;
  }
  animation=requestAnimationFrame(frame);
}
animation=requestAnimationFrame(frame);
if(import.meta.hot)import.meta.hot.dispose(()=>{cancelAnimationFrame(animation);abort.abort();Object.values(actors).forEach(actor=>actor.dispose());capture.dispose();lab.dispose();});
