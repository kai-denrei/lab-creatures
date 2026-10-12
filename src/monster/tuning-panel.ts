import type { Object3D } from 'three/webgpu';
import { attachSharing } from '../sharing/panel.ts';
import { selectedVariant } from './variants.ts';
import { DEFAULT_MOTION, MOTION_CONTROLS, formatMotion, normalizeMotion } from './motion-settings.ts';
import type { MotionSettings, MotionKey } from './motion-settings.ts';

// Migrate only the two revised reach defaults; preserve the other tuned values.
const specimen=new URLSearchParams(location.search).get('specimen')==='creature-lab'?'creature-lab':'nih-dairia';
const variant=selectedVariant();
const storageKey=specimen==='creature-lab'?`creature-lab-motion-v1${variant.id==='nih-dairia'?'':`-${variant.id}`}`:'nih-dairia-motion-v3';
export function loadMotionSettings(){
  const url=new URL(location.href),shared=url.searchParams.get('motion');
  if(shared){
    try{
      const settings=normalizeMotion(JSON.parse(shared));
      try{localStorage.setItem(storageKey,JSON.stringify(settings));}catch{/* Session use still works. */}
      url.searchParams.delete('motion');history.replaceState(null,'',url);return settings;
    }catch{/* Invalid shared values do not replace the local draft. */}
  }
  try{
    const current=localStorage.getItem(storageKey);if(current)return normalizeMotion(JSON.parse(current));
    const previous=localStorage.getItem(specimen==='creature-lab'?(variant.id==='nih-dairia'?'nih-dairia-motion-v3':'creature-lab-motion-v1'):'nih-dairia-motion-v2');
    const settings=previous?specimen==='creature-lab'?normalizeMotion(JSON.parse(previous)):{...normalizeMotion(JSON.parse(previous)),reachTime:DEFAULT_MOTION.reachTime,stretch:DEFAULT_MOTION.stretch}:{...DEFAULT_MOTION};
    localStorage.setItem(storageKey,JSON.stringify(settings));return settings;
  }catch{return {...DEFAULT_MOTION};}
}
export function createTuningPanel(settings:MotionSettings,model?:Object3D){
  const panel=document.createElement('details');panel.className='motion-panel';panel.open=matchMedia('(min-width:1000px)').matches;
  const groups=[...new Set(MOTION_CONTROLS.map(control=>control.group))];
  panel.innerHTML=`<summary>Motion tuning <span>adjust live</span></summary><div class="motion-panel-body">
    <p class="tuning-intro">Drag the lure as you tune. Footwork changes apply on the next step. Long reach and pause durations deliberately slow the chase. Pinch the scene to zoom; use Move prey to drag on touch screens.</p>
    ${groups.map(group=>`<details class="motion-group"><summary>${group}</summary>${MOTION_CONTROLS.filter(control=>control.group===group).map(control=>`
      <div class="motion-control"><label for="motion-${control.key}">${control.label}</label><output for="motion-${control.key}" id="value-${control.key}"></output>
      <input type="range" id="motion-${control.key}" data-motion="${control.key}" min="${control.min}" max="${control.max}" step="${control.step}" aria-describedby="hint-${control.key}">
      <p id="hint-${control.key}">${control.hint}</p></div>`).join('')}</details>`).join('')}
    <div class="tuning-actions"><button type="button" id="motion-defaults">Restore defaults</button><button type="button" id="motion-link">Copy settings link</button></div>
    <label class="copy-fallback" hidden>Press Ctrl/Cmd+C to copy<textarea readonly aria-label="Settings to copy"></textarea></label>
    <p class="tuning-status" role="status" aria-live="polite">Settings stay in this browser. Reset restarts the creature without changing your tuning.</p></div>`;
  document.querySelector('#app')!.appendChild(panel);
  const abort=new AbortController(),signal=abort.signal,status=panel.querySelector('.tuning-status')!;
  const controls=Array.from(panel.querySelectorAll<HTMLInputElement>('[data-motion]'));
  const refresh=()=>controls.forEach(input=>{
    const key=input.dataset.motion as MotionKey;input.value=String(settings[key]);
    const formatted=formatMotion(key,settings[key]);input.setAttribute('aria-valuetext',formatted);panel.querySelector(`#value-${key}`)!.textContent=formatted;
  });
  const save=()=>{try{localStorage.setItem(storageKey,JSON.stringify(settings));return true;}catch{return false;}};
  for(const input of controls){
    input.addEventListener('input',()=>{const key=input.dataset.motion as MotionKey;Object.assign(settings,normalizeMotion({...settings,[key]:input.valueAsNumber}));refresh();},{signal});
    input.addEventListener('change',()=>{status.textContent=save()?'Saved in this browser.':'Applied for this session. Browser storage is unavailable.';},{signal});
  }
  panel.querySelector('#motion-defaults')!.addEventListener('click',()=>{Object.assign(settings,DEFAULT_MOTION);refresh();const saved=save();status.textContent=saved?'Default motion restored and saved.':'Default motion restored for this session.';},{signal});
  const copy=async(value:string,message:string)=>{
    try{await navigator.clipboard.writeText(value);if(!signal.aborted)status.textContent=message;}
    catch{if(signal.aborted)return;const fallback=panel.querySelector<HTMLElement>('.copy-fallback')!;fallback.hidden=false;const textarea=fallback.querySelector('textarea')!;textarea.value=value;textarea.focus();textarea.select();status.textContent='Select and copy the text below.';}
  };
  panel.querySelector('#motion-link')!.addEventListener('click',()=>{const url=new URL(location.href);url.searchParams.set('specimen',specimen);url.searchParams.set('motion',JSON.stringify(settings));void copy(url.href,'Link copied with these settings.');},{signal});
  attachSharing({panel,family:'soft-body',specimen:variant.id,controls:MOTION_CONTROLS.map(c=>({...c,unit:c.unit==='mm'?'m':c.unit==='ms'?'s':c.unit})),settings,signal,changed:()=>{refresh();save();},exportCreature:async()=>{const {exportCreatureKit}=await import('./export-kit.ts');await exportCreatureKit({...settings},variant.id,model);}});
  // Arrow keys operate focused ranges without reaching game keyboard handlers.
  panel.addEventListener('keydown',event=>event.stopPropagation(),{signal});
  refresh();return {dispose:()=>{abort.abort();panel.remove();}};
}
