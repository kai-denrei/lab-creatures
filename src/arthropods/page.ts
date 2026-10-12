import '../monster/style.css';
import './style.css';
import { ANATOMY_COLORS, LEG_NAMES } from './gait.ts';
import { PREDATOR_CONTROLS, loadPredatorSettings, formatSetting } from './settings.ts';
import { LAB_VARIANTS, selectedLabVariant } from './variants.ts';
const variant=selectedLabVariant();
const initialSettings=loadPredatorSettings(variant.id);
const legend=variant.id==='veil'?['Central sheet','Full webbing','Elastic rim']:variant.id==='isopod'?['Leg base','Basal joint','Upper link','Lower link','Distal foot','Claw']:LEG_NAMES;
const tuningGroups=['Instinct','Attack','Posture','Movement','Lure'];

document.body.classList.add('monster-page','arthropod-page');
document.title=`Creature Lab — ${variant.name}`;
document.querySelector('#app')!.innerHTML=`
  <main id="viewport" aria-label="Arthropod observation table"></main>
  <header class="masthead"><span class="eyebrow">${variant.family.toUpperCase()} STUDIES</span><h1>${variant.name}<span>.</span></h1><p>${variant.description}</p>
    <details class="specimen-menu"><summary>Specimens & families</summary>
      <nav class="specimen-tabs" aria-label="Creature experiments">
        <a href="?specimen=jelly-baby">Jelly Baby</a><a href="?specimen=nih-dairia">Nih-Dairia</a>
        <a href="?specimen=creature-lab">Creature Lab</a><a href="?specimen=arthropod-lab" aria-current="page">Arthropod Lab</a>
      </nav>
      <p class="lineage-note">${variant.description}</p>
    </details>
  </header>
  <nav class="actions" aria-label="Experiment controls"><a class="back-link" href="./">← Specimens</a><button id="reset" title="Reset · R">Reset</button></nav>
  <button id="scene-view" aria-pressed="false">Hide controls</button>
  <aside class="observation"><span class="eyebrow">OBSERVED BEHAVIOR</span><strong id="creature-state" role="status">Observing</strong><p id="state-note">Preparing the specimen.</p></aside>
  <details class="motion-panel" open><summary>Instinct & motion <span id="compact-state">${variant.name.toUpperCase()}</span></summary><div class="motion-panel-body">
    <label class="lab-select" for="lab-breed">Specimen<select id="lab-breed">${LAB_VARIANTS.map(v=>`<option value="${v.id}" ${v.id===variant.id?'selected':''}>${v.name} · ${v.family}</option>`).join('')}</select></label>
    <label class="lab-select" for="lab-mode">Lab mode<select id="lab-mode"><option value="instinct">Instinct & lure</option><option value="walk">Walking study</option></select></label>
    <p id="interaction-hint" class="tuning-intro">Drag the red lure or tap the table to place it. Drag elsewhere to orbit.</p>
    <div class="arthropod-buttons instinct-controls"><button id="autonomy" aria-pressed="true">Instinct on</button><button id="auto-lure" aria-pressed="false">Auto lure off</button><button id="drag-mode" aria-pressed="false">Move lure</button><button id="startle">Startle</button></div>
    <div id="lure-status" role="status" class="tuning-intro">Manual lure</div>
    <div class="arthropod-buttons"><button id="arthropod-walk" aria-pressed="true" hidden>Pause walking</button><button id="arthropod-anatomy" aria-pressed="false">Anatomy colors</button></div>
    <label class="lab-select" for="instinct-preset">Behavior preset<select id="instinct-preset"><option value="custom">Custom</option><option value="balanced">Specimen defaults</option><option value="ambush">Ambush</option><option value="wary">Wary</option><option value="feral">Feral</option></select></label>
    ${tuningGroups.map(group=>`<details class="motion-group" ${group==='Instinct'?'open':''}><summary>${group}</summary>${PREDATOR_CONTROLS.filter(control=>control.group===group).map(control=>`<div class="motion-control"><label for="tuning-${control.key}">${variant.id==='veil'&&control.key==='abdomen'?'Sheet compression':variant.id==='veil'&&control.key==='footLift'?'Rim lift':variant.id==='veil'&&control.key==='turnRate'?'Direction response':control.label}</label><output for="tuning-${control.key}" id="value-${control.key}">${formatSetting(control,initialSettings[control.key])}</output><input id="tuning-${control.key}" data-setting="${control.key}" type="range" min="${control.min}" max="${control.max}" step="${control.step}" value="${initialSettings[control.key]}"></div>`).join('')}</details>`).join('')}
    <div class="arthropod-buttons"><button id="restore-tuning">Restore defaults</button></div>
    <p class="tuning-intro">Tuning is saved for ${variant.name}. ${(variant.id==='oculus'||variant.id==='monoculus')?'Defaults maximize every control except rush duration (1.5 s), recovery (3 s) and foot lift (10 mm).':'Defaults are the previous maxima; sliders extend to twice those values.'} Reset restarts the encounter without changing your controls.</p>
    <h2 class="anatomy-heading">${variant.id==='veil'?'Membrane anatomy':'Leg anatomy'} <span>${variant.id==='veil'?'Center → rim':'Body → foot'}</span></h2>
    <ol id="anatomy-legend">${legend.map((name,i)=>`<li style="--anatomy-color:${ANATOMY_COLORS[i]}"><i></i>${name}</li>`).join('')}</ol>
    <p class="tuning-intro">A procedural predator study. Rushes can miss; the lure remains available for repeated encounters.</p>
  </div></details>
  <footer class="monster-hints"><span><i></i> Drag lure · tap table to place</span><span>Drag to orbit · Pinch / scroll to zoom</span></footer>
  <section id="loading" role="status" aria-live="polite"><div class="loading-card"><div class="jelly-mark"></div><h2>A new kind of life.</h2><p id="load-message">Preparing ${variant.name}</p><pre id="fatal" hidden></pre><button id="retry" hidden>Try again</button><a class="loading-back" href="./">← Return to specimens</a></div></section>`;

document.querySelector<HTMLSelectElement>('#lab-breed')!.addEventListener('change',event=>{const url=new URL(location.href);url.searchParams.set('breed',(event.target as HTMLSelectElement).value);location.assign(url.href);});

if(matchMedia('(max-width:700px), (max-height:520px)').matches)document.querySelector<HTMLDetailsElement>('.motion-panel')!.open=false;
document.querySelector('#scene-view')!.addEventListener('click',event=>{
  const hidden=document.body.classList.toggle('scene-only'),button=event.currentTarget as HTMLButtonElement;
  button.textContent=hidden?'Show controls':'Hide controls';button.setAttribute('aria-pressed',String(hidden));
});
let game:{stop:()=>void}|undefined,failed=false;
function fail(reason:unknown){
  if(failed)return;failed=true;game?.stop();
  document.querySelector('#loading')!.classList.remove('hidden');document.querySelector('#loading')!.classList.add('failed');
  document.querySelector('#loading h2')!.textContent='Observation interrupted.';
  document.querySelector('#load-message')!.textContent='The specimen could not be displayed.';
  const fatal=document.querySelector<HTMLPreElement>('#fatal')!;fatal.hidden=false;fatal.textContent=reason instanceof Error?reason.message:String(reason);
  document.querySelector<HTMLButtonElement>('#retry')!.hidden=false;console.error(reason);
}
window.addEventListener('error',event=>fail(event.error||event.message));
window.addEventListener('unhandledrejection',event=>fail(event.reason));
document.querySelector('#retry')!.addEventListener('click',()=>location.reload());
void import('./runtime.ts').then(({startArthropod})=>startArthropod(message=>{
  if(failed)throw new Error('Startup interrupted');document.querySelector('#load-message')!.textContent=message;
},fail)).then(started=>{game=started;if(failed){game.stop();return;}document.querySelector('#loading')!.classList.add('hidden');}).catch(fail);
