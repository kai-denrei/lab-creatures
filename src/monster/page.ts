import './style.css';
import { CREATURE_VARIANTS, selectedVariant } from './variants.ts';
const variant=selectedVariant();
const isCreatureLab=new URLSearchParams(location.search).get('specimen')==='creature-lab';
document.body.classList.add('monster-page');
if(isCreatureLab)document.body.classList.add('creature-lab');
document.title=isCreatureLab?'Creature Lab — lab-creatures':'Nih-Dairia — lab-creatures';
document.querySelector('#app')!.innerHTML=`
  <main id="viewport" aria-label="${isCreatureLab?'Creature Lab':'Nih-Dairia'} observation table"></main>
  <header class="masthead"><span class="eyebrow">${isCreatureLab?'SHARED ANCESTRY / CREATURE STUDIES':'SPECIMEN 02 / FIRST CONTACT'}</span><h1>${isCreatureLab?'Creature Lab':'Nih-Dairia'}<span>.</span></h1><p>${isCreatureLab?'Nih-Dairia lineage · related body plans':'All muscle. All nerve. All aware.'}</p>
    <nav class="specimen-tabs" aria-label="Creature experiments"><a href="?specimen=jelly-baby">Jelly Baby</a><a href="?specimen=nih-dairia" ${!isCreatureLab?'aria-current="page"':''}>Nih-Dairia</a><a href="?specimen=creature-lab" ${isCreatureLab?'aria-current="page"':''}>Creature Lab</a></nav>
    ${isCreatureLab?`<div class="variant-picker"><label for="creature-variant">Body variant</label><select id="creature-variant">${CREATURE_VARIANTS.map(v=>`<option value="${v.id}" ${v.id===variant.id?'selected':''}>${v.name}</option>`).join('')}</select><p>${variant.description}</p></div>`:''}</header>
  <nav class="actions" aria-label="Experiment controls"><a class="back-link" href="./">← Specimens</a><button id="reset" title="Reset · R">Reset</button></nav>
  <aside class="observation"><span class="eyebrow">OBSERVED BEHAVIOR</span><strong id="creature-state" role="status">listening</strong><p id="state-note">Stillness is part of the hunt.</p><button id="autonomy" aria-pressed="true">Instinct on</button> <button id="auto-lure" aria-pressed="false" title="Move the lure automatically. Dragging it returns to manual control.">Auto lure off</button></aside>
  <footer class="monster-hints"><span><i></i> Drag the red lure · release to feed</span><span>Touch the body to provoke it</span><span>Drag table to orbit · Scroll to zoom</span></footer>
  <div class="boss-note">${isCreatureLab?'STALHEART / EVOLUTION STUDIES':'STALHEART / BOSS RESEARCH 001'}</div>
  <section id="loading" role="status" aria-live="polite"><div class="loading-card"><div class="jelly-mark"></div><h2>Something is listening.</h2><p id="load-message">Preparing the specimen</p><pre id="fatal" hidden></pre><button id="retry" hidden>Try again</button><a class="loading-back" href="./">← Return to specimens</a></div></section>`;
document.querySelector<HTMLSelectElement>('#creature-variant')?.addEventListener('change',event=>{
  const url=new URL(location.href);url.searchParams.set('variant',(event.target as HTMLSelectElement).value);url.searchParams.delete('motion');location.assign(url.href);
});
let stage='Loading the experiment',failed=false,game:{stop:()=>void}|undefined;
function fail(reason:unknown){
  if(failed)return;failed=true;game?.stop();
  const error=reason instanceof Error?reason:new Error(String(reason));
  document.querySelector('#loading')!.classList.remove('hidden');document.querySelector('#loading')!.classList.add('failed');
  document.querySelector('#loading h2')!.textContent='Observation interrupted.';
  document.querySelector('#load-message')!.textContent='The experiment could not continue. Details below.';
  const fatal=document.querySelector<HTMLPreElement>('#fatal')!;fatal.hidden=false;
  fatal.textContent=`${stage}\n${error.message}\n\nViewport: ${innerWidth} × ${innerHeight} · DPR ${devicePixelRatio}\n${navigator.userAgent}`;
  document.querySelector<HTMLButtonElement>('#retry')!.hidden=false;console.error(`[Nih-Dairia / ${stage}]`,error);
}
window.addEventListener('error',e=>fail(e.error||e.message));window.addEventListener('unhandledrejection',e=>fail(e.reason));
document.querySelector('#retry')!.addEventListener('click',()=>location.reload());
void import('./runtime.ts').then(({startMonster})=>startMonster(message=>{if(failed)throw new Error('Startup aborted after a GPU failure');stage=message;document.querySelector('#load-message')!.textContent=message;},fail)).then(started=>{game=started;if(failed){game.stop();return;}stage='Observing';document.querySelector('#loading')!.classList.add('hidden');}).catch(fail);
