import './style.css';
import { createCutisScene } from '../cutis/scene.ts';
import { GOROGORO_DEFAULT_CONFIG } from '../cutis/swarm/tiers.ts';
import { EvasionGame,startingHunterPosition } from './game.ts';
import { createCapture } from './capture.ts';
import { createReed } from './reed.ts';

document.body.classList.add('evasion-page');document.title='Evasion — Reed vs Gorogoro';
document.querySelector('#app')!.innerHTML=`<main id="evasion-board" aria-label="Evasion game arena"></main>
<header class="evasion-header"><div><span>FIELD TRIAL / 001</span><h1>Evasion.</h1><p>One Reed. Twelve hunters. An opening ahead.</p></div><nav><a href="./">← Specimens</a><button id="evasion-shake">Shake · Space</button><button id="evasion-pause">Pause</button><button id="evasion-restart">Restart</button></nav></header>
<aside class="evasion-hud"><span id="evasion-status" role="status">PREPARING</span><strong id="evasion-time">0.0 s</strong><p id="evasion-contact">Loading Reed…</p><p id="evasion-bloodlust"></p><p id="evasion-shake-note">Space shakes off grip. Red means heat.</p><label>Absorption <progress id="evasion-progress" max="1" value="0"></progress></label></aside>
<footer class="evasion-help"><b>W A S D / Arrow keys</b> Move · <b>Space</b> Shake · <b>Esc</b> Pause · <b>R</b> Restart<br>Appendages slow you. One body slows you. Two bodies sever and consume you. The edge is fatal.<br><span>Reed body radius 0.2 m · 12 predators, each 0.33 m</span></footer>
<div class="evasion-pad" aria-label="Movement controls"><button data-move="ArrowUp" aria-label="Move up">↑</button><button data-move="ArrowLeft" aria-label="Move left">←</button><button data-move="ArrowDown" aria-label="Move down">↓</button><button data-move="ArrowRight" aria-label="Move right">→</button></div>
<section id="evasion-end" hidden><div><span>CONSUMED</span><h2>The hunt is over.</h2><p id="evasion-result"></p><button id="evasion-again">Try again</button></div></section>`;
const config={...GOROGORO_DEFAULT_CONFIG,r0:.33},lab=createCutisScene(document.querySelector<HTMLElement>('#evasion-board')!,config,{interactive:false,elevated:true});
const game=new EvasionGame(),reed=await createReed(game.radius);const capture=createCapture();lab.scene.add(reed.mesh,reed.debris,capture.group);lab.setAuto(false);lab.lure.visible=false;lab.controls.enabled=false;lab.camera.near=.2;lab.camera.updateProjectionMatrix();
const keys=new Set<string>(),abort=new AbortController(),{signal}=abort;
const status=document.querySelector('#evasion-status')!,clock=document.querySelector('#evasion-time')!,contact=document.querySelector('#evasion-contact')!,progress=document.querySelector<HTMLProgressElement>('#evasion-progress')!,end=document.querySelector<HTMLElement>('#evasion-end')!,pause=document.querySelector<HTMLButtonElement>('#evasion-pause')!;
let accumulator=0,last=performance.now(),animation=0;
function reset(){
  keys.clear();game.reset();reed.reset();lab.setCount(12);lab.swarm.scale.fill(1);
  for(let i=0;i<12;i++){const p=startingHunterPosition(i),k=i*3;lab.swarm.offset[k]=p.x;lab.swarm.offset[k+2]=p.z;lab.swarm.phase[i]=0;}
  lab.lure.position.set(0,.048,0);lab.camera.position.set(0,38,10);lab.controls.target.set(0,0,0);lab.controls.update();lab.camera.clearViewOffset();
  reed.mesh.visible=true;end.hidden=true;pause.textContent='Pause';accumulator=0;last=performance.now();
}
function togglePause(){if(game.dead)return;game.paused=!game.paused;keys.clear();pause.textContent=game.paused?'Resume':'Pause';}
window.addEventListener('keydown',event=>{
  if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowLeft','ArrowDown','ArrowRight','Escape','KeyR','Space'].includes(event.code))event.preventDefault();
  if(event.code==='Space'&&!event.repeat)game.shake(lab.swarm);else if(event.code==='Escape'&&!event.repeat)togglePause();else if(event.code==='KeyR'&&!event.repeat)reset();else keys.add(event.code);
},{signal});window.addEventListener('keyup',event=>keys.delete(event.code),{signal});
const suspend=()=>{keys.clear();if(!game.dead&&!game.paused)togglePause();};window.addEventListener('blur',suspend,{signal});document.addEventListener('visibilitychange',()=>{if(document.hidden)suspend();},{signal});
for(const button of document.querySelectorAll<HTMLButtonElement>('[data-move]')){
  button.addEventListener('pointerdown',event=>{event.preventDefault();button.setPointerCapture(event.pointerId);keys.add(button.dataset.move!);},{signal});
  for(const name of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(name,()=>keys.delete(button.dataset.move!),{signal});
}
document.querySelector('#evasion-shake')!.addEventListener('click',()=>game.shake(lab.swarm),{signal});
pause.addEventListener('click',togglePause,{signal});for(const id of ['evasion-restart','evasion-again'])document.getElementById(id)!.addEventListener('click',reset,{signal});
reset();
function frame(now:number){
  const dt=Math.min(.05,(now-last)/1000);last=now;
  const dx=Number(keys.has('KeyD')||keys.has('ArrowRight'))-Number(keys.has('KeyA')||keys.has('ArrowLeft'));
  const dz=Number(keys.has('KeyS')||keys.has('ArrowDown'))-Number(keys.has('KeyW')||keys.has('ArrowUp'));
  if(!game.paused&&!game.dead){accumulator+=dt;while(accumulator>=1/120){lab.lure.position.set(game.x,.048,game.z);lab.swarm.step(game.huntSpeed/120,lab.lure.position);game.step(1/120,dx,dz,lab.swarm,reed.step);accumulator-=1/120;if(game.dead){accumulator=0;break;}}}
  reed.update(game.x,game.z,game.absorption,game.legsCut,game.elapsed,game.y,lab.swarm,game.fallen,game.heat,game.shakePulse);capture.update(game,lab.swarm);
  const framing=Math.max(1,1/lab.camera.aspect);lab.camera.position.set(0,38*framing,10*framing);
  lab.camera.clearViewOffset();lab.draw();status.textContent=game.state;clock.textContent=`${game.elapsed.toFixed(1)} s`;contact.textContent=`${game.bodies} body contacts · ${game.appendages} appendage contacts`;progress.value=game.absorption;
  document.querySelector('#evasion-shake-note')!.textContent=game.overheated?'Too hot to shake — cool down to recover.':'Space shakes off grip. Red means heat.';(document.querySelector('#evasion-shake') as HTMLButtonElement).disabled=game.overheated||game.dead||game.devouring||game.paused;
  document.body.dataset.state=game.state;document.querySelector('#evasion-bloodlust')!.textContent=`Bloodlust ${game.bloodlust} · ${game.huntSpeed.toFixed(2)}× speed · ${12-Array.from(game.fallen).filter(Boolean).length} hunters remain`;
  if(game.dead){end.hidden=false;end.querySelector('span')!.textContent=game.deathReason==='FELL'?'FELL FROM THE PLATFORM':'CONSUMED';document.querySelector('#evasion-result')!.textContent=`You survived ${game.elapsed.toFixed(1)} seconds.`;reed.mesh.visible=false;}
  animation=requestAnimationFrame(frame);
}
animation=requestAnimationFrame(frame);
if(import.meta.hot)import.meta.hot.dispose(()=>{cancelAnimationFrame(animation);abort.abort();reed.dispose();capture.dispose();lab.dispose();});
