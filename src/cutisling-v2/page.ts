import './style.css';
import * as THREE from 'three';
import {createV2Scene} from './scene.ts';
import {V2_DEFAULTS,serializeV2Settings} from './settings.ts';
import type {V2Settings} from './settings.ts';
import {V2_PALETTES} from './palettes.ts';
import type {V2Palette} from './palettes.ts';

type NumericKey={ [K in keyof V2Settings]:V2Settings[K] extends number?K:never }[keyof V2Settings];
const sliders:{key:NumericKey;label:string;min:number;max:number;step:number;hint:string}[]=[
  {key:'lureSpeed',label:'Lure drift',min:0,max:1.2,step:.02,hint:'Ground speed of the wandering prey. Zero keeps it in place while it can still bounce.'},
  {key:'lureBounce',label:'Lure bounce',min:0,max:1.2,step:.05,hint:'Height of occasional slow hops. Landing sends a stronger vibration through the ground.'},
  {key:'vibrationSense',label:'Vibration instinct',min:0,max:3,step:.1,hint:'How strongly arriving vibrations redirect seeking and the next foothold. Zero isolates unguided exploration.'},
  {key:'pace',label:'Time scale',min:.25,max:1.5,step:.05,hint:'Slow motion helps distinguish jumps from fast movement.'},
  {key:'spread',label:'Spread',min:.6,max:1.4,step:.05,hint:'Size of the collective body.'},
  {key:'neighborRange',label:'Neighbor range',min:.4,max:1.4,step:.05,hint:'Broader neighborhoods coordinate larger groups of particles.'},
  {key:'alignment',label:'Alignment',min:0,max:3,step:.1,hint:'How strongly particles match their neighbors’ velocities.'},
  {key:'separation',label:'Separation',min:0,max:2,step:.1,hint:'How strongly particles avoid crowding.'},
  {key:'turbulence',label:'Turbulence',min:0,max:1.5,step:.05,hint:'Strength of the continuously changing flow field.'},
  {key:'turnSpeed',label:'Flow change speed',min:.1,max:1.5,step:.05,hint:'How quickly local eddies change direction.'},
  {key:'influenceWidth',label:'Influence width',min:.25,max:1.2,step:.05,hint:'How broadly each particle influences the skin; wider blends more fronts.'},
  {key:'response',label:'Tissue response time',min:.04,max:.8,step:.02,hint:'Longer response filters short impulses without freezing the flock.'},
  {key:'reach',label:'Probe reach',min:1.5,max:14,step:.1,hint:'Default 8.4: three times the previous reach. Tune from 1.5 to 14.'},
  {key:'tendrilWidth',label:'Seeking tendril width',min:.5,max:1.5,step:.05,hint:'Rounded roots narrow into fine searching tips.'},
  {key:'branching',label:'Mycelium branches',min:0,max:2,step:.1,hint:'Length and growth of lateral feelers on both searching and engulfing arms; zero removes them.'},
  {key:'seekSweep',label:'Probe sweep',min:0,max:1.5,step:.05,hint:'Sideways feeling motion borrowed from Cutis-Gorogoro’s Extend phase.'},
  {key:'seekRate',label:'Probe frequency',min:.3,max:3,step:.1,hint:'How many searching bends pass along each extension.'},
  {key:'organic',label:'Search irregularity',min:0,max:1.5,step:.05,hint:'Independent timing, reach and smooth random bends for each arm.'},
  {key:'strikeSpeed',label:'Spotted acceleration',min:1,max:6,step:.1,hint:'How strongly the organism speeds up after an appendage finds prey.'},
  {key:'senseDistance',label:'Sense distance',min:0,max:1.5,step:.02,hint:'Distance beyond the tentacle surface that triggers a grip and two new engulfing arms.'},
  {key:'anchorHold',label:'Anchor hold',min:.2,max:1.5,step:.05,hint:'Time the chosen tip grips the ground before drawing the body in.'},
  {key:'anchorPull',label:'Anchor draw time',min:.6,max:3.5,step:.1,hint:'Weight of the body pull. The body must arrive before engulfing arms grow; longer draws feel heavier.'},
  {key:'supportReach',label:'Supporting arm reach',min:.65,max:1,step:.01,hint:'How much length the other arms retain while pulling and flanking. They gather fully only when the feeding sheet forms.'},
  {key:'limbClearance',label:'Tentacle clearance',min:0,max:1.5,step:.05,hint:'Keeps exposed tentacles apart during turns and transitions. Roots may still merge inside the body; zero disables separation for comparison.'},
  {key:'crawlSway',label:'Crawl sway',min:0,max:2,step:.05,hint:'Sideways weight shifts during anchored pulls, with waves through the seeking arms and feeding sheet.'},
  {key:'crawlLift',label:'Crawl lift',min:0,max:1.5,step:.05,hint:'Small rises, dips and rocking through the flat body and limbs. The anchor and prey seal stay planted.'},
  {key:'crawlRate',label:'Crawl rhythm',min:.4,max:2,step:.05,hint:'Speed of the uneven crawling rhythm. Independent of the faster tentacle whip.'},
  {key:'muscleStrength',label:'Muscular contractions',min:0,max:1,step:.05,hint:'Uneven pull, brief holds and renewed effort during each anchored draw. Zero restores an even draw.'},
  {key:'limbLag',label:'Limb delay',min:0,max:1.5,step:.05,hint:'How differently the limbs take up slack and unfold after digestion.'},
  {key:'amorphous',label:'Body irregularity',min:0,max:1.6,step:.05,hint:'Broad asymmetric folds and lobes in the gathered tissue. Zero gives a rounded body.'},
  {key:'recoveryTime',label:'Gather / unfurl time',min:2,max:6,step:.1,hint:'The feeding sheet gathers into a mass first, then the limbs emerge one at a time.'},
  {key:'anchorBulk',label:'Anchor bulk',min:.5,max:2,step:.05,hint:'Thickness of the swollen grip and the tissue gathered around it.'},
  {key:'whipStrength',label:'Tentacle whip',min:0,max:4,step:.05,hint:'Backswing, casting curl and tip lift of the two predatory arms.'},
  {key:'whipFrequency',label:'Whip wave speed',min:.2,max:5,step:.05,hint:'Speed of the undulation travelling from each arm’s root toward its tip.'},
  {key:'whipCurl',label:'Whip curvature',min:0,max:3,step:.05,hint:'Amount and tightness of the bends along each tentacle.'},
  {key:'whipLift',label:'Whip lift',min:0,max:3,step:.05,hint:'How far travelling waves lift the tentacles off the ground.'},
  {key:'whipAsymmetry',label:'Whip asymmetry',min:0,max:2.5,step:.05,hint:'Unequal phase and wave speed between tentacles.'},
  {key:'frenzy',label:'Detection frenzy',min:0,max:5,step:.1,hint:'The surge of speed and writhing immediately after sensing bait.'},
  {key:'flattenTime',label:'Flattening time',min:.35,max:2,step:.05,hint:'Time spent spreading the enclosed tentacles into a digestive surface.'},
  {key:'aggro',label:'Aggro',min:0,max:6,step:.1,hint:'Stronger pursuit, faster preparation and more forceful flanking around prey.'},
  {key:'tension',label:'Surface tension',min:0,max:3,step:.05,hint:'Smooth neighboring regions of the skin.'},
  {key:'veinStrength',label:'Vein contrast',min:0,max:2,step:.05,hint:'Visibility of the branching vessels across the tendrils, grip and feeding surface.'},
  {key:'veinPulse',label:'Vein pulse',min:0,max:3,step:.1,hint:'How strongly each pulse darkens, brightens and widens the veins.'},
  {key:'veinSpeed',label:'Vein pulse speed',min:.3,max:2,step:.05,hint:'Travelling heartbeat speed. Pausing also freezes vein pulses.'},
  {key:'thickness',label:'Thickness',min:.05,max:.5,step:.01,hint:'Thickness of the persistent membrane.'},
];
const toggles:{key:keyof V2Settings;label:string;hint:string}[]=[
  {key:'interpolation',label:'Interpolate motion',hint:'Blend simulation steps at the display’s refresh rate.'},
  {key:'cycle',label:'Extend / retract cycle',hint:'Off holds the three seeking arms extended.'},
  {key:'anchoredLocomotion',label:'Plant footholds',hint:'Seek, anchor, then pull. Off keeps exploration in place; a spotted prey still triggers a grip.'},
  {key:'showParticles',label:'Show particles',hint:'Reveal the drivers to compare their motion with the skin.'},
  {key:'showSkin',label:'Show membrane',hint:'Off isolates particle motion.'},
  {key:'veins',label:'Show veins',hint:'Off separates texture motion from geometry motion.'},
  {key:'followCamera',label:'Follow camera',hint:'Off keeps the camera stationary for easier comparison.'},
  {key:'movingLure',label:'Moving lure',hint:'Wander and occasionally hop. Movement settles once the creature makes contact.'},
  {key:'hunting',label:'Feeding trial',hint:'Restarts the trial. Off keeps the test focused on locomotion.'},
];
document.body.className='cutisling-v2-page';document.title='Cutisling v2 — Motion study';
document.querySelector('#app')!.innerHTML=`<main id="v2-stage"></main>
  <header class="v2-header"><nav><a href="./">← Collection</a><a href="?specimen=cutisling">Cutisling v1 ↗</a></nav><small>COLLECTIVE ORGANISM / SECOND EXPERIMENT</small><h1>Cutisling <em>v2.</em></h1><p>A living surface. A continuous motion.</p></header>
  <aside class="v2-rail"><div class="v2-tools"><span id="v2-copy-status" role="status"></span><button id="v2-copy" title="Copy all current lab values to paste into chat">Copy settings</button></div><textarea id="v2-copy-fallback" aria-label="Settings to copy" readonly hidden></textarea><details id="v2-controls" open><summary>Motion laboratory <span>v2</span></summary><div class="v2-control-body">
    <p class="v2-intro">Feel vibrations → Seek → Anchor → Draw in → Encircle → Digest. The nearest tip anchors, the body gathers forward, then two arms extend to engulf. A fixed seed replays the same organism.</p>
    <label class="v2-select">Organism seed <input id="v2-seed" type="number" min="1" max="999999" step="1" value="${V2_DEFAULTS.seed}"><small>Copied with settings for repeatable trials.</small></label><button id="v2-reroll" class="v2-wide">New organism · random 3–7 arms</button>
    <label class="v2-select">Color scheme <select id="v2-palette">${Object.entries(V2_PALETTES).map(([id,p])=>`<option value="${id}" ${id===V2_DEFAULTS.palette?'selected':''}>${p.label}</option>`).join('')}</select><small>Skin, anchor and veins change together.</small></label>
    <label class="v2-select">Particles <select id="v2-particles">${[64,128,256,512,1024].map(n=>`<option ${n===V2_DEFAULTS.particles?'selected':''}>${n}</option>`).join('')}</select><small>Changing count restarts the same seeded trial.</small></label>
    <label class="v2-select">Simulation rate <select id="v2-rate">${[30,60,120].map(n=>`<option value="${n}" ${n===V2_DEFAULTS.rate?'selected':''}>${n} Hz</option>`).join('')}</select></label>
    <label class="v2-select">Render scale <select id="v2-renderScale">${[.75,1,1.25,1.5,2].map(n=>`<option value="${n}" ${n===V2_DEFAULTS.renderScale?'selected':''}>${n}×</option>`).join('')}</select><small>Lower this to test whether rendering cost causes the stutter.</small></label>
    <fieldset><legend>Isolate the source</legend>${toggles.map(c=>`<label class="v2-toggle"><input type="checkbox" id="v2-${c.key}" ${V2_DEFAULTS[c.key]?'checked':''}><span>${c.label}<small>${c.hint}</small></span></label>`).join('')}</fieldset>
    <fieldset><legend>Motion & tissue</legend>${sliders.map(c=>`<label class="v2-slider" for="v2-${c.key}">${c.label}<output id="v2-${c.key}-value">${V2_DEFAULTS[c.key].toFixed(2)}</output><input type="range" id="v2-${c.key}" min="${c.min}" max="${c.max}" step="${c.step}" value="${V2_DEFAULTS[c.key]}"><small>${c.hint}</small></label>`).join('')}</fieldset>
    <button id="v2-defaults" class="v2-wide">Restore defaults</button><p class="v2-intro">V1 is preserved separately. V2 keeps the same mesh connections and material coordinates throughout each trial.</p>
  </div></details><div class="v2-readout" aria-live="off"><span id="v2-phase">SEEK</span><div><b id="v2-fps">—</b><small>FPS</small><b id="v2-frame-time">—</b><small>p95 ms</small></div><p id="v2-trial">256 particles · 60 Hz · interpolated</p></div></aside>
  <footer class="v2-footer"><p><b>Observe, isolate, compare.</b><span>Drag to orbit · Scroll to zoom · Click to place prey in the feeding trial</span></p><nav><button id="v2-pause">Pause</button><button id="v2-step">Single step</button><button id="v2-reset">Reset trial</button></nav></footer>`;
const host=document.querySelector<HTMLElement>('#v2-stage')!,lab=createV2Scene(host),{body}=lab;
const abort=new AbortController(),{signal}=abort;
const pause=document.querySelector<HTMLButtonElement>('#v2-pause')!;
let copyTimer:ReturnType<typeof setTimeout>|undefined;
const copyButton=document.querySelector<HTMLButtonElement>('#v2-copy')!;
copyButton.addEventListener('click',async()=>{
  const text=serializeV2Settings(body.tuning),status=document.querySelector<HTMLElement>('#v2-copy-status')!,fallback=document.querySelector<HTMLTextAreaElement>('#v2-copy-fallback')!;
  clearTimeout(copyTimer);fallback.hidden=true;
  try{
    await navigator.clipboard.writeText(text);status.textContent='Copied';
    copyTimer=setTimeout(()=>{status.textContent='';},1800);
  }catch{
    fallback.value=text;fallback.hidden=false;fallback.focus();fallback.select();status.textContent='Select & copy';
  }
},{signal});
const phaseLabels={SEEK:'EXPLORE / SEEK',SPOT:'DIRECTION FOUND',ANCHOR:'ANCHOR / GRIP',TRANSFER:'ANCHOR / DRAW IN',EXTEND2:'FRENZY / FLANK',SURROUND:'ENCIRCLE',FLATTEN:'FUSE / FLATTEN',ENGULF:'PHAGOCYTE',ABSORB:'ABSORB',RECOVER:'RECOVER'};

const sync=()=>{
  for(const c of sliders){document.querySelector<HTMLInputElement>(`#v2-${c.key}`)!.value=String(body.tuning[c.key]);document.querySelector(`#v2-${c.key}-value`)!.textContent=body.tuning[c.key].toFixed(2);}
  for(const c of toggles)document.querySelector<HTMLInputElement>(`#v2-${c.key}`)!.checked=Boolean(body.tuning[c.key]);
  for(const key of ['particles','rate','renderScale','palette'] as const)document.querySelector<HTMLSelectElement>(`#v2-${key}`)!.value=String(body.tuning[key]);
  document.querySelector<HTMLInputElement>('#v2-seed')!.value=String(body.tuning.seed);
  pause.textContent=body.paused?'Resume':'Pause';
};
for(const c of sliders)document.querySelector(`#v2-${c.key}`)!.addEventListener('input',e=>{body.tuning[c.key]=Number((e.target as HTMLInputElement).value);document.querySelector(`#v2-${c.key}-value`)!.textContent=body.tuning[c.key].toFixed(2);},{signal});
for(const c of toggles)document.querySelector(`#v2-${c.key}`)!.addEventListener('change',e=>{
  const key=c.key as 'interpolation'|'cycle'|'anchoredLocomotion'|'showParticles'|'showSkin'|'veins'|'followCamera'|'hunting'|'movingLure';body.tuning[key]=(e.target as HTMLInputElement).checked;
  if(key==='hunting')body.reset();
},{signal});
document.querySelector('#v2-particles')!.addEventListener('change',e=>body.setCount(Number((e.target as HTMLSelectElement).value)),{signal});
document.querySelector('#v2-rate')!.addEventListener('change',e=>body.setRate(Number((e.target as HTMLSelectElement).value)),{signal});
document.querySelector('#v2-renderScale')!.addEventListener('change',e=>{body.tuning.renderScale=Number((e.target as HTMLSelectElement).value);lab.setRenderScale();},{signal});
document.querySelector('#v2-palette')!.addEventListener('change',e=>{body.tuning.palette=(e.target as HTMLSelectElement).value as V2Palette;},{signal});
const reset=()=>{body.reset();lab.controls.target.set(4,0,1);lab.camera.position.set(13,16,19);last=performance.now();};
document.querySelector('#v2-reroll')!.addEventListener('click',()=>{body.tuning.seed=1+Math.floor(Math.random()*999999);reset();sync();},{signal});
document.querySelector('#v2-seed')!.addEventListener('change',e=>{body.tuning.seed=Math.max(1,Math.min(999999,Math.round(Number((e.target as HTMLInputElement).value)||V2_DEFAULTS.seed)));reset();sync();},{signal});
pause.addEventListener('click',()=>{body.paused=!body.paused;sync();},{signal});
document.querySelector('#v2-step')!.addEventListener('click',()=>{body.stepOne();sync();},{signal});
document.querySelector('#v2-reset')!.addEventListener('click',reset,{signal});
document.querySelector('#v2-defaults')!.addEventListener('click',()=>{Object.assign(body.tuning,V2_DEFAULTS);reset();lab.setRenderScale();sync();},{signal});
const ray=new THREE.Raycaster(),pointer=new THREE.Vector2(),plane=new THREE.Plane(new THREE.Vector3(0,1,0),0),hit=new THREE.Vector3();let downX=0,downY=0;
rendererEvents();
function rendererEvents(){
  lab.renderer.domElement.addEventListener('pointerdown',e=>{downX=e.clientX;downY=e.clientY;},{signal});
  lab.renderer.domElement.addEventListener('pointerup',e=>{if(!body.tuning.hunting||Math.hypot(e.clientX-downX,e.clientY-downY)>5)return;const rect=lab.renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,1-(e.clientY-rect.top)/rect.height*2);ray.setFromCamera(pointer,lab.camera);if(ray.ray.intersectPlane(plane,hit))body.placePrey(hit.x,hit.z);},{signal});
}
window.addEventListener('resize',lab.resize,{signal});
window.addEventListener('keydown',e=>{if(e.target instanceof HTMLElement&&e.target.closest('input,select,textarea,button,summary'))return;if(e.code==='Space'){e.preventDefault();body.paused=!body.paused;sync();}else if(e.code==='KeyR')reset();},{signal});
document.addEventListener('visibilitychange',()=>{last=performance.now();frameTimes.length=0;},{signal});
let last=performance.now(),hudTime=last,animation=0;const frameTimes:number[]=[];
function frame(now:number){
  const dt=(now-last)/1000;last=now;
  if(!document.hidden){body.step(dt);lab.draw(dt);frameTimes.push(dt*1000);if(frameTimes.length>120)frameTimes.shift();}
  if(now-hudTime>500){hudTime=now;
    const sorted=[...frameTimes].sort((a,b)=>a-b),average=frameTimes.reduce((n,t)=>n+t,0)/(frameTimes.length||1);
    document.querySelector('#v2-fps')!.textContent=average?(1000/average).toFixed(0):'—';document.querySelector('#v2-frame-time')!.textContent=sorted.length?sorted[Math.floor(sorted.length*.95)].toFixed(1):'—';
    const label=body.phase==='SEEK'?`${body.instinct>.12?'VIBRATION / ORIENT':'SEEK'} ×${body.tentacleCount}`:body.phase==='SPOT'&&!body.anchorForPrey?'FOOTHOLD FOUND':body.phase==='TRANSFER'&&body.anchorForPrey?'ANCHOR / DRAW IN':body.phase==='RECOVER'?(body.recoveryProgress()<.64?'GATHER / REFORM':'UNFURL'):phaseLabels[body.phase];
    document.querySelector('#v2-phase')!.textContent=body.paused?'PAUSED':`${label}${body.tuning.hunting?` · ${body.meals} absorbed`:''}`;
    document.querySelector('#v2-trial')!.textContent=`${body.tentacleCount}${body.holdingPrey&&body.wrap>0?' + 2 feeding':''} tentacles · ${body.count} particles · ${body.tuning.rate} Hz · ${body.tuning.interpolation?'interpolated':'unblended'}`;
  }
  animation=requestAnimationFrame(frame);
}
animation=requestAnimationFrame(frame);
if(import.meta.hot)import.meta.hot.dispose(()=>{cancelAnimationFrame(animation);abort.abort();clearTimeout(copyTimer);lab.dispose();});
