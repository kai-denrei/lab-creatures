import type {Cutisling} from './controller.ts';
import {APPROACHES,CUTISLING_DEFAULTS} from './settings.ts';
import type {CutislingSettings,MembraneApproach} from './settings.ts';

type NumericKey={ [K in keyof CutislingSettings]:CutislingSettings[K] extends number?K:never }[keyof CutislingSettings];
const groups:{name:string;controls:{key:NumericKey;label:string;min:number;max:number;step:number;hint:string}[]}[]=[
  {name:'Flock motion',controls:[
    {key:'freedom',label:'Flock freedom',min:0,max:.5,step:.02,hint:'Retain more of Inago’s spread and coalescence while pursuing prey.'},
    {key:'turbulence',label:'Turbulence',min:0,max:2,step:.1,hint:'Strength of local eddies and uneven flanking motion.'},
    {key:'swirl',label:'Circulation',min:.2,max:1.8,step:.1,hint:'How strongly the flock flows around its prey.'},
    {key:'stride',label:'Stride rhythm',min:.5,max:2,step:.05,hint:'Period of each muscle band’s reach, plant and haul cycle.'},
    {key:'grip',label:'Grip',min:0,max:1,step:.05,hint:'Ground friction and pinning between contractions. Zero glides like before.'},
  ]},
  {name:'Living boundary',controls:[
    {key:'tension',label:'Surface tension',min:0,max:1,step:.05,hint:'Higher tension smooths local dents and pulls the edge together.'},
    {key:'viscosity',label:'Viscosity',min:0,max:1,step:.05,hint:'Higher viscosity makes the skin trail behind the flock.'},
    {key:'edgeDetail',label:'Local edge detail',min:0,max:1,step:.05,hint:'Reveal smaller flock fronts in the silhouette.'},
    {key:'thickness',label:'Skin thickness',min:.04,max:.18,step:.01,hint:'Depth of the tissue above the ground.'},
    {key:'lipWidth',label:'Edge softness',min:.025,max:.14,step:.005,hint:'Width of the rounded outer and feeding edges.'},
  ]},
  {name:'Phagocytosis',controls:[
    {key:'mouthDetail',label:'Mouth irregularity',min:0,max:1.4,step:.1,hint:'How much local flock pressure bends the feeding opening.'},
    {key:'engulfTime',label:'Engulf duration',min:1.5,max:6,step:.25,hint:'Seconds spent covering prey after the loop closes.'},
  ]},
  {name:'Veins',controls:[
    {key:'veinScale',label:'Vein density',min:3,max:12,step:.5,hint:'Scale of the branching pattern across the skin.'},
    {key:'veinWarp',label:'Vein curvature',min:.2,max:1.4,step:.05,hint:'Bend the vein network into winding paths.'},
    {key:'veinContrast',label:'Vein contrast',min:.15,max:1,step:.05,hint:'Darkness of the vessels within the tissue.'},
  ]},
];
const format=(key:NumericKey,value:number)=>key==='engulfTime'?`${value.toFixed(2)} s`:value.toFixed(key==='lipWidth'?3:2);

export function createCutislingPanel(body:Cutisling,refresh:()=>void,signal:AbortSignal){
  const panel=document.createElement('details');panel.className='cutisling-tuning';panel.id='cutisling-tuning';
  panel.innerHTML=`<summary><span>Experiment controls</span><span id="cutisling-mode-label">Flock skin</span></summary>
    <div class="cutisling-tuning-body">
      <label class="cutisling-approach">Membrane approach<select id="cutisling-approach">${APPROACHES.map(a=>`<option value="${a.id}">${a.name}</option>`).join('')}</select></label>
      <p id="cutisling-approach-description">${APPROACHES[0].description}</p>
      <label class="cutisling-check"><input id="cutisling-hunting" type="checkbox" checked> Hunt prey <span>Off: observe the original flock cycle</span></label>
      <fieldset id="cutisling-basic"><legend>Movement</legend></fieldset>
      ${groups.map(group=>`<fieldset><legend>${group.name}</legend>${group.controls.map(c=>`<label title="${c.hint}" for="cutisling-${c.key}">${c.label}<output id="cutisling-${c.key}-value">${format(c.key,body.tuning[c.key])}</output><input id="cutisling-${c.key}" type="range" min="${c.min}" max="${c.max}" step="${c.step}" value="${body.tuning[c.key]}" aria-describedby="cutisling-${c.key}-hint"><span class="cutisling-control-hint" id="cutisling-${c.key}-hint">${c.hint}</span></label>`).join('')}</fieldset>`).join('')}
      <button type="button" id="cutisling-defaults">Restore tuning defaults</button>
      <p class="cutisling-tuning-note">Changes apply live, including while paused. Reset in the bottom bar restarts the same experiment with your settings.</p>
    </div>`;
  const rail=document.createElement('div');rail.className='cutisling-rail';document.body.append(rail);
  rail.append(panel,document.querySelector('.inago-status')!);
  panel.querySelector('#cutisling-basic')!.append(document.querySelector('.inago-settings')!);
  const select=panel.querySelector<HTMLSelectElement>('#cutisling-approach')!;
  const sync=()=>{
    const approach=APPROACHES.find(a=>a.id===body.tuning.approach)!;
    select.value=approach.id;panel.querySelector('#cutisling-mode-label')!.textContent=approach.name;
    panel.querySelector('#cutisling-approach-description')!.textContent=approach.description;
    for(const {controls} of groups)for(const c of controls){
      panel.querySelector<HTMLInputElement>(`#cutisling-${c.key}`)!.value=String(body.tuning[c.key]);
      panel.querySelector(`#cutisling-${c.key}-value`)!.textContent=format(c.key,body.tuning[c.key]);
    }
    panel.querySelector<HTMLInputElement>('#cutisling-hunting')!.checked=body.tuning.hunting;
  };
  select.addEventListener('change',()=>{body.tuning.approach=select.value as MembraneApproach;sync();refresh();},{signal});
  for(const {controls} of groups)for(const c of controls)panel.querySelector<HTMLInputElement>(`#cutisling-${c.key}`)!.addEventListener('input',event=>{
    body.tuning[c.key]=Number((event.target as HTMLInputElement).value);
    panel.querySelector(`#cutisling-${c.key}-value`)!.textContent=format(c.key,body.tuning[c.key]);refresh();
  },{signal});
  panel.querySelector('#cutisling-hunting')!.addEventListener('change',event=>{
    body.tuning.hunting=(event.target as HTMLInputElement).checked;body.reset();refresh();
  },{signal});
  panel.querySelector('#cutisling-defaults')!.addEventListener('click',()=>{
    Object.assign(body.tuning,CUTISLING_DEFAULTS);body.pace=body.spread=body.cohesion=1;
    for(const key of ['pace','spread','cohesion']){
      panel.querySelector<HTMLInputElement>(`#inago-${key}`)!.value='1';panel.querySelector(`#inago-${key}-value`)!.textContent='1.0×';
    }
    body.reset();sync();refresh();
  },{signal});
  signal.addEventListener('abort',()=>rail.remove(),{once:true});
}
