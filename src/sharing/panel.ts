import './style.css';
import { download, readSettings, settingsDocument, type Variable } from './settings.ts';
export function attachSharing(options:{panel:HTMLElement;family:string;specimen:string;controls:readonly Variable[];settings:Record<string,number>;changed:()=>void;signal:AbortSignal;exportCreature?:()=>Promise<void>}){
  const {panel,family,specimen,controls,settings,changed,signal}=options;
  const section=document.createElement('section');section.className='settings-sharing';
  section.innerHTML='<h2>Save & share</h2><p>Copy a group or the whole specimen. Paste here to restore it. Tuning stays in this browser.</p><div class="share-actions"><button data-share="copy">Copy all</button><button data-share="paste">Paste settings</button><button data-share="json">Export JSON</button><label>Import JSON<input type="file" accept=".json,application/json" aria-label="Import settings JSON"></label></div><div class="paste-editor" hidden><label>Settings JSON<textarea spellcheck="false" aria-label="Settings JSON"></textarea></label><div class="share-actions"><button data-share="apply">Apply settings</button><button data-share="close">Close</button></div></div><p class="share-status" role="status" aria-live="polite"></p>';
  panel.querySelector('.motion-panel-body')!.append(section);
  const status=section.querySelector('.share-status')!,editor=section.querySelector<HTMLElement>('.paste-editor')!,area=section.querySelector('textarea')!;
  let targetGroup='all';
  const serialized=(group:string)=>JSON.stringify(settingsDocument(family,specimen,controls,settings,group),null,2);
  const show=(text:string)=>{status.textContent=text;};
  const paste=(group:string)=>{targetGroup=group;editor.hidden=false;area.value='';area.focus();show(`Paste ${group==='all'?'specimen or group':group} JSON, then apply.`);};
  const copy=async(group:string)=>{
    const value=serialized(group);
    try{await navigator.clipboard.writeText(value);if(!signal.aborted)show(`${group==='all'?'All settings':group} copied.`);}
    catch{if(signal.aborted)return;targetGroup=group;editor.hidden=false;area.value=value;area.focus();area.select();show('Press Ctrl/Cmd+C to copy the selected JSON.');}
  };
  const apply=(value:string,group:string)=>{try{const incoming=readSettings(value,family,controls,group);Object.assign(settings,incoming);changed();show('Settings applied. Values outside slider limits were clamped.');editor.hidden=true;}catch(error){show(error instanceof Error?error.message:'Could not read settings.');}};
  section.querySelector('[data-share="copy"]')!.addEventListener('click',()=>{void copy('all');},{signal});
  section.querySelector('[data-share="paste"]')!.addEventListener('click',()=>paste('all'),{signal});
  section.querySelector('[data-share="apply"]')!.addEventListener('click',()=>apply(area.value,targetGroup),{signal});
  section.querySelector('[data-share="close"]')!.addEventListener('click',()=>{editor.hidden=true;},{signal});
  section.querySelector('[data-share="json"]')!.addEventListener('click',()=>download(serialized('all'),`${specimen}-settings.json`),{signal});
  const file=section.querySelector<HTMLInputElement>('input[type=file]')!;
  file.addEventListener('change',async()=>{const selected=file.files?.[0];if(!selected)return;try{if(selected.size>64000)throw new Error('Settings are too large.');const text=await selected.text();if(!signal.aborted)apply(text,'all');}catch(error){show(error instanceof Error?error.message:'Could not read file.');}file.value='';},{signal});
  for(const group of panel.querySelectorAll<HTMLElement>('.motion-group')){
    const name=group.querySelector('summary')!.textContent!.trim(),actions=document.createElement('div');actions.className='share-actions group-sharing';
    actions.innerHTML='<button>Copy group</button><button>Paste group</button>';group.append(actions);
    const [copyButton,pasteButton]=actions.querySelectorAll('button');copyButton.setAttribute('aria-label',`Copy ${name}`);pasteButton.setAttribute('aria-label',`Paste ${name}`);
    copyButton.addEventListener('click',()=>{void copy(name);},{signal});pasteButton.addEventListener('click',()=>{paste(name);editor.scrollIntoView({block:'nearest'});},{signal});
  }
  if(options.exportCreature){const button=document.createElement('button');button.textContent='Export creature ZIP';section.querySelector('.share-actions')!.append(button);button.addEventListener('click',async()=>{button.disabled=true;show('Packaging creature…');try{await options.exportCreature!();show('Creature exported with settings and integration instructions.');}catch(error){show(error instanceof Error?error.message:'Export failed.');}finally{button.disabled=false;}},{signal});}
  section.addEventListener('keydown',event=>event.stopPropagation(),{signal});
}
