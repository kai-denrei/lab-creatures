import { DEFAULT_MOTION, MOTION_CONTROLS, formatMotion, normalizeMotion } from './motion-settings.ts';
import type { MotionSettings, MotionKey } from './motion-settings.ts';

// Migrate only the two revised reach defaults; preserve the other tuned values.
const specimen=new URLSearchParams(location.search).get('specimen')==='creature-lab'?'creature-lab':'nih-dairia';
const storageKey=specimen==='creature-lab'?'creature-lab-motion-v1':'nih-dairia-motion-v3';
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
    const previous=localStorage.getItem(specimen==='creature-lab'?'nih-dairia-motion-v3':'nih-dairia-motion-v2');
    const settings=previous?specimen==='creature-lab'?normalizeMotion(JSON.parse(previous)):{...normalizeMotion(JSON.parse(previous)),reachTime:DEFAULT_MOTION.reachTime,stretch:DEFAULT_MOTION.stretch}:{...DEFAULT_MOTION};
    localStorage.setItem(storageKey,JSON.stringify(settings));return settings;
  }catch{return {...DEFAULT_MOTION};}
}
export function createTuningPanel(settings:MotionSettings){
  const panel=document.createElement('details');panel.className='motion-panel';panel.open=matchMedia('(min-width:1000px)').matches;
  const groups=[...new Set(MOTION_CONTROLS.map(control=>control.group))];
  panel.innerHTML=`<summary>Motion tuning <span>adjust live</span></summary><div class="motion-panel-body">
    <p class="tuning-intro">Drag the lure as you tune. Footwork changes apply on the next step.</p>
    ${groups.map(group=>`<fieldset><legend>${group}</legend>${MOTION_CONTROLS.filter(control=>control.group===group).map(control=>`
      <div class="motion-control"><label for="motion-${control.key}">${control.label}</label><output for="motion-${control.key}" id="value-${control.key}"></output>
      <input type="range" id="motion-${control.key}" data-motion="${control.key}" min="${control.min}" max="${control.max}" step="${control.step}" aria-describedby="hint-${control.key}">
      <p id="hint-${control.key}">${control.hint}</p></div>`).join('')}</fieldset>`).join('')}
    <div class="tuning-actions"><button type="button" id="motion-defaults">Restore defaults</button><button type="button" id="motion-export">Export settings</button><label class="import-motion" for="motion-import">Import settings<input type="file" id="motion-import" accept="application/json,.json"></label><button type="button" id="motion-copy">Copy settings</button><button type="button" id="motion-link">Copy settings link</button><button type="button" id="motion-kit">Download code + settings</button></div>
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
  panel.querySelector('#motion-export')!.addEventListener('click',()=>{
    const url=URL.createObjectURL(new Blob([JSON.stringify({version:1,motion:settings},null,2)],{type:'application/json'}));
    const link=document.createElement('a');link.href=url;link.download='nih-dairia-motion.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    status.textContent='Settings exported. Import this file to restore or share your motion.';
  },{signal});
  const copy=async(value:string,message:string)=>{
    try{await navigator.clipboard.writeText(value);if(!signal.aborted)status.textContent=message;}
    catch{if(signal.aborted)return;const fallback=panel.querySelector<HTMLElement>('.copy-fallback')!;fallback.hidden=false;const textarea=fallback.querySelector('textarea')!;textarea.value=value;textarea.focus();textarea.select();status.textContent='Select and copy the text below.';}
  };
  panel.querySelector('#motion-copy')!.addEventListener('click',()=>{void copy(JSON.stringify({version:1,motion:settings},null,2),'Settings copied as JSON. Paste into another project or a message.');},{signal});
  panel.querySelector('#motion-link')!.addEventListener('click',()=>{const url=new URL(location.href);url.searchParams.set('specimen',specimen);url.searchParams.set('motion',JSON.stringify(settings));void copy(url.href,'Link copied with these settings.');},{signal});
  const kitButton=panel.querySelector<HTMLButtonElement>('#motion-kit')!;
  kitButton.addEventListener('click',async()=>{
    kitButton.disabled=true;const snapshot={...settings};status.textContent='Packaging creature source, physics, model and settings…';
    try{const {exportCreatureKit}=await import('./export-kit.ts');if(signal.aborted)return;await exportCreatureKit(snapshot);if(!signal.aborted)status.textContent='Code + settings downloaded. The ZIP includes a runnable demo and integration instructions.';}
    catch(error){if(!signal.aborted)status.textContent=error instanceof Error?error.message:'Could not export creature code.';}
    finally{kitButton.disabled=false;}
  },{signal});
  const fileInput=panel.querySelector<HTMLInputElement>('#motion-import')!;
  fileInput.addEventListener('change',async()=>{
    const file=fileInput.files?.[0];if(!file)return;
    try{
      if(file.size>32_000)throw new Error('Settings file is too large.');
      const data=JSON.parse(await file.text());
      if(data?.version!==1||!data.motion||typeof data.motion!=='object'||Array.isArray(data.motion)||!MOTION_CONTROLS.every(({key})=>key==='grip'&&data.motion[key]===undefined||typeof data.motion[key]==='number'&&Number.isFinite(data.motion[key])))throw new Error('Choose an exported Nih-Dairia motion settings file.');
      if(signal.aborted)return;
      Object.assign(settings,normalizeMotion(data.motion));refresh();const saved=save();status.textContent=saved?'Motion settings imported and saved.':'Motion settings imported for this session.';
    }catch(error){if(!signal.aborted)status.textContent=error instanceof Error?error.message:'Could not import settings.';}
    fileInput.value='';
  },{signal});
  // Arrow keys operate focused ranges without reaching game keyboard handlers.
  panel.addEventListener('keydown',event=>event.stopPropagation(),{signal});
  refresh();return {dispose:()=>{abort.abort();panel.remove();}};
}
