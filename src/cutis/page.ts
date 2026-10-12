import '../monster/style.css';
import '../arthropods/style.css';
import './style.css';
import { CUTIS_CONTROLS,CUTIS_PRESETS,CUTIS_PALETTES,applyPalette,selectedPalette,DEFAULT_CONFIG,loadConfig,saveConfig,type CutisKey } from './swarm/config.ts';
import { attachSharing } from '../sharing/panel.ts';
import { createCutisScene } from './scene.ts';
const config=loadConfig(),mobile=matchMedia('(max-width:700px)').matches;
document.body.classList.add('monster-page','cutis-page');document.title='Cutis-Maku — Membrane studies';
const groups=[...new Set(CUTIS_CONTROLS.map(c=>c.group))];
document.querySelector('#app')!.innerHTML=`
<main id="viewport"></main><header class="masthead"><span class="eyebrow">MEMBRANE STUDIES / 004</span><h1>Cutis-Maku<span>.</span></h1><p>Reach. Attach. Pass through.<br>A patient membrane with a violent instinct.</p></header>
<nav class="actions"><a class="back-link" href="./">← Specimens</a><button id="reset">Reset</button></nav><button id="scene-view" aria-pressed="false">Hide controls</button>
<aside class="observation"><span class="eyebrow">OBSERVED BEHAVIOR</span><strong id="creature-state" role="status">Coiling</strong><p id="state-note">A pulse under the skin. A brief warning.</p><span id="cutis-stats"></span></aside>
<details class="motion-panel" ${mobile?'':'open'}><summary>Instinct & membrane <span>Cutis-Maku</span></summary><div class="motion-panel-body">
<label class="lab-select">Observation<select id="cutis-count"><option value="1">Single specimen</option><option value="12">Hunting pack · 12</option><option value="100">Swarm · 100</option>${mobile?'':'<option value="300">Swarm · 300</option>'}</select></label>
<p class="tuning-intro">Drag the red lure or tap the ground. Drag elsewhere to orbit. Heading locks before each reach.</p>
<div class="arthropod-buttons"><button id="cutis-freeze" aria-pressed="false">Freeze motion</button><button id="cutis-auto" aria-pressed="true">Auto lure on</button><button id="cutis-move" aria-pressed="false">Move lure</button></div>
<label class="lab-select">Behavior<select id="cutis-preset"><option value="custom">Custom tuning</option><option value="default">Specimen defaults</option><option value="patient">Patient predator</option><option value="feral">Feral surge</option><option value="drifting">Slow drifting</option></select></label>
<label class="lab-select">Color scheme<select id="cutis-palette"><option value="custom">Custom colors</option>${Object.entries(CUTIS_PALETTES).map(([id,p])=>`<option value="${id}">${p.name}</option>`).join('')}</select></label>
<div class="phase-study"><label for="cutis-phase">Phase study <output id="phase-value">0%</output></label><input id="cutis-phase" type="range" min="0" max="0.999" step="0.001" value="0"><div class="phase-ticks"><button data-phase="0.04">Coil</button><button data-phase="0.38">Seek</button><button data-phase="0.58">Anchor</button><button data-phase="0.75">Transfer</button><button data-phase="0.94">Settle</button></div><p class="tuning-intro">Scrub to freeze the first specimen. Resume motion to continue.</p></div>
${groups.map(group=>`<details class="motion-group" ${group==='Hunt'?'open':''}><summary>${group}</summary>${CUTIS_CONTROLS.filter(c=>c.group===group).map(c=>`<div class="motion-control"><label for="cutis-${c.key}">${c.label}</label><output id="value-${c.key}"></output><input id="cutis-${c.key}" data-setting="${c.key}" type="${c.kind==='color'?'color':'range'}" min="${c.min}" max="${c.max}" step="${c.step}"></div>`).join('')}</details>`).join('')}
<details class="motion-group cutis-debug"><summary>Inspect</summary><label class="lab-select">Surface view<select id="cutis-debug"><option value="0">Membrane & veins</option><option value="1">Color by state</option><option value="2">Stretch heatmap</option></select></label><label><input type="checkbox" id="cutis-cage"> Show projected tesseract</label><label><input type="checkbox" id="cutis-cube"> Force fold geometry</label></details>
<div class="arthropod-buttons"><button id="cutis-defaults">Restore defaults</button></div><p class="tuning-intro">Seeking appendages: 1–3 independent probes. The cup nearest the prey wins; the others retract. Changing the count restarts the search. The slow reach takes almost twice as long as transfer. Even at full urgency, the warning pulse lasts at least 120 ms.</p>
</div></details><footer class="monster-hints"><span><i></i> Drag lure · tap ground</span><span>Drag to orbit · scroll / pinch to zoom</span></footer>
<section id="loading"><div class="loading-card"><h2>Gathering itself.</h2><p id="load-message">Preparing Cutis-Maku</p><pre id="fatal" hidden></pre><a href="./">Return to specimens</a></div></section>`;
const abort=new AbortController(),{signal}=abort;
let lab:ReturnType<typeof createCutisScene>|undefined;
try{
  lab=createCutisScene(document.querySelector<HTMLElement>('#viewport')!,config);const game=lab;
  const panel=document.querySelector<HTMLElement>('.motion-panel')!,preset=document.querySelector<HTMLSelectElement>('#cutis-preset')!,phase=document.querySelector<HTMLInputElement>('#cutis-phase')!,freeze=document.querySelector<HTMLButtonElement>('#cutis-freeze')!;
  const palette=document.querySelector<HTMLSelectElement>('#cutis-palette')!;
  const refresh=()=>{palette.value=selectedPalette(config);for(const c of CUTIS_CONTROLS){const input=document.querySelector<HTMLInputElement>(`#cutis-${c.key}`)!;input.value=c.kind==='color'?`#${Math.round(config[c.key]).toString(16).padStart(6,'0')}`:String(config[c.key]);document.querySelector(`#value-${c.key}`)!.textContent=c.kind==='color'?input.value:`${Number(config[c.key].toFixed(3))} ${c.unit}`;}};
  palette.addEventListener('change',()=>{if(palette.value==='custom')return;applyPalette(config,palette.value as keyof typeof CUTIS_PALETTES);refresh();saveConfig(config);},{signal});
  const changed=()=>{config.seekCount=Math.round(config.seekCount);refresh();saveConfig(config);preset.value='custom';};
  for(const input of panel.querySelectorAll<HTMLInputElement>('[data-setting]'))input.addEventListener('input',()=>{config[input.dataset.setting as CutisKey]=input.type==='color'?parseInt(input.value.slice(1),16):input.valueAsNumber;changed();},{signal});
  preset.addEventListener('change',()=>{if(preset.value==='custom')return;Object.assign(config,preset.value==='default'?DEFAULT_CONFIG:CUTIS_PRESETS[preset.value as keyof typeof CUTIS_PRESETS]);refresh();saveConfig(config);},{signal});
  document.querySelector('#cutis-defaults')!.addEventListener('click',()=>{Object.assign(config,DEFAULT_CONFIG);refresh();saveConfig(config);preset.value='default';},{signal});
  const freezeUI=()=>{freeze.textContent=game.swarm.frozen?'Resume motion':'Freeze motion';freeze.setAttribute('aria-pressed',String(game.swarm.frozen));};
  const scrub=(value:number)=>{game.swarm.scrub(value);freezeUI();};phase.addEventListener('input',()=>scrub(phase.valueAsNumber),{signal});
  for(const button of panel.querySelectorAll<HTMLButtonElement>('[data-phase]'))button.addEventListener('click',()=>scrub(Number(button.dataset.phase)),{signal});
  freeze.addEventListener('click',()=>{game.swarm.frozen=!game.swarm.frozen;freezeUI();},{signal});
  document.querySelector<HTMLSelectElement>('#cutis-count')!.addEventListener('change',event=>{game.setCount(Number((event.target as HTMLSelectElement).value));},{signal});
  for(const [id,method,onText,offText] of [['cutis-auto',(on:boolean)=>game.setAuto(on),'Auto lure on','Auto lure off'],['cutis-move',(on:boolean)=>game.setMove(on),'Placing lure','Move lure']] as const)document.querySelector<HTMLButtonElement>(`#${id}`)!.addEventListener('click',event=>{const button=event.currentTarget as HTMLButtonElement,on=button.getAttribute('aria-pressed')!=='true';button.setAttribute('aria-pressed',String(on));button.textContent=on?onText:offText;method(on);},{signal});
  document.querySelector<HTMLSelectElement>('#cutis-debug')!.addEventListener('change',event=>game.setDebug(Number((event.target as HTMLSelectElement).value)),{signal});
  document.querySelector<HTMLInputElement>('#cutis-cage')!.addEventListener('change',event=>game.setCage((event.target as HTMLInputElement).checked),{signal});document.querySelector<HTMLInputElement>('#cutis-cube')!.addEventListener('change',event=>game.setForce((event.target as HTMLInputElement).checked),{signal});
  document.querySelector('#reset')!.addEventListener('click',()=>{game.reset();freezeUI();},{signal});
  document.querySelector('#scene-view')!.addEventListener('click',event=>{const hidden=document.body.classList.toggle('scene-only'),button=event.currentTarget as HTMLButtonElement;button.textContent=hidden?'Show controls':'Hide controls';button.setAttribute('aria-pressed',String(hidden));},{signal});
  // Inspect is a view setting, not a variable group.
  const inspect=panel.querySelector('.cutis-debug')!;inspect.classList.remove('motion-group');
  attachSharing({panel,family:'cutis-maku',specimen:'cutis-maku',controls:CUTIS_CONTROLS,settings:config,changed,signal,exportCreature:async()=>{const {exportCutis}=await import('./export.ts');await exportCutis({...config});}});inspect.classList.add('motion-group');
  refresh();preset.value=CUTIS_CONTROLS.every(c=>config[c.key]===DEFAULT_CONFIG[c.key])?'default':'custom';
  const notes:Record<string,string>={REST:'Compact and breathing. It waits for the lure to move.',COIL:'A pulse under the skin. A brief warning.',EXTEND:'The membrane feels ahead, sweeping and testing the ground while the body waits.',ANCHOR:'The nearest cup grips. Other probes withdraw; this foothold is now fixed.',TRANSFER:'A slow draw accelerates into a snap. The rear follows through the fixed foothold.',SETTLE:'A small recoil. The body dissolves into another irregular form.'};
  const setText=(selector:string,text:string)=>{const element=document.querySelector(selector)!;if(element.textContent!==text)element.textContent=text;};
  game.renderer.setAnimationLoop(time=>{game.frame(time);const state=game.swarm.getState(0);setText('#creature-state',state);setText('#state-note',notes[state]);phase.value=String(game.swarm.phase[0]);setText('#phase-value',`${Math.round(game.swarm.phase[0]*100)}%`);setText('#cutis-stats',`${game.swarm.count} specimen${game.swarm.count===1?'':'s'} · ${Math.round(game.stats.fps)} fps${game.held?' · lure held':''}`);});
  game.draw();document.querySelector('#loading')!.classList.add('hidden');
  const dispose=()=>{abort.abort();game.dispose();};window.addEventListener('pagehide',event=>{if(!event.persisted)dispose();},{signal});if(import.meta.hot)import.meta.hot.dispose(dispose);
}catch(error){lab?.dispose();document.querySelector('#load-message')!.textContent='Unable to start the membrane study.';const fatal=document.querySelector<HTMLElement>('#fatal')!;fatal.hidden=false;fatal.textContent=error instanceof Error?error.message:String(error);console.error(error);}
