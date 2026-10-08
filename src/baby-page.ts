import './style.css';
import { selectedPlayerCreature, PLAYER_CREATURES } from './game/player-creature.ts';
const creature=selectedPlayerCreature(),isMonster=creature!=='jelly-baby',creatureName=PLAYER_CREATURES.find(item=>item.id===creature)!.name;
document.title=`${creatureName} playground — lab-creatures`;

document.querySelector<HTMLDivElement>('#app')!.innerHTML=`
  <main id="viewport" aria-label="Creature playground"></main>
  <header class="masthead"><span class="eyebrow">a small, soft world</span><h1>${creatureName.toLowerCase()}<span>.</span></h1><label class="player-picker" for="player-creature">Play as<select id="player-creature">${PLAYER_CREATURES.map(item=>`<option value="${item.id}" ${item.id===creature?'selected':''}>${item.name}</option>`).join('')}</select></label></header>
  <nav class="actions" aria-label="Game controls">
    <button id="sound" class="icon-button" aria-label="Mute sound" aria-pressed="false" title="Sound">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M11 5 6 9H3v6h3l5 4V5Z"/><path class="sound-waves" d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/><path class="sound-off" d="m15 9 6 6m0-6-6 6"/></svg>
    </button>
    <button id="reset" class="icon-button" aria-label="Reset creature" title="Reset · R">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4.5 8a8 8 0 1 1-.1 8M4 3v6h6"/></svg>
    </button>
  </nav>
  <footer class="desktop-hints" aria-label="Keyboard controls">
    <span><kbd>W</kbd><span class="key-row"><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></span></span><span class="hint-label">wander</span>
    <span class="separator"></span><kbd class="space-key">space</kbd><span class="hint-label">${isMonster?'brace':'hop'}</span>
    <span class="separator"></span><svg class="mouse" viewBox="0 0 20 25" fill="none" stroke="currentColor"><rect x="3.5" y="1.5" width="13" height="21" rx="6.5"/><path d="M10 5v5"/></svg><span class="hint-label">orbit · grab</span>
  </footer>
  <div class="specimen"><span></span> ${isMonster?`${creatureName} &nbsp; / &nbsp; player controlled`:'lime &nbsp; / &nbsp; 7 cm of happiness'}</div>
  <div class="touch-controls" aria-label="Touch controls">
    <div class="dpad"><button data-control="KeyW" aria-label="Walk forward">↑</button><button data-control="KeyA" aria-label="Walk left">←</button><button data-control="KeyS" aria-label="Walk backward">↓</button><button data-control="KeyD" aria-label="Walk right">→</button></div>
    <button class="jump" data-control="Space" aria-label="${isMonster?'Brace':'Jump'}"><svg viewBox="0 0 28 28" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 21V6m-6 6 6-6 6 6M6 24h16"/></svg><span>${isMonster?'brace':'hop'}</span></button>
  </div>
  <section id="loading" role="status" aria-live="polite"><div class="loading-card"><div class="jelly-mark"></div><h2>A little life.</h2><p id="load-message">Warming up the world</p><pre id="fatal" hidden></pre><button id="retry" hidden>Try again</button></div></section>
`;

document.querySelector('#player-creature')!.addEventListener('change',event=>{
  const url=new URL(location.href);url.searchParams.set('creature',(event.target as HTMLSelectElement).value);location.assign(url.href);
});

let stage='Loading the game',failed=false,game:{stop:()=>void}|undefined;
function fail(reason:unknown) {
  if(failed)return;failed=true;game?.stop();
  const error=reason instanceof Error?reason:new Error(String(reason));
  document.querySelector('#loading')!.classList.remove('hidden');
  document.querySelector('#loading')!.classList.add('failed');
  document.querySelector('h2')!.textContent='A little hiccup.';
  document.querySelector('#load-message')!.textContent='The game couldn’t start. Details below.';
  const fatal=document.querySelector<HTMLPreElement>('#fatal')!;fatal.hidden=false;
  fatal.textContent=`${stage}\n${error.message}\n\nViewport: ${innerWidth} × ${innerHeight} · DPR ${devicePixelRatio}\n${navigator.userAgent}`;
  document.querySelector<HTMLButtonElement>('#retry')!.hidden=false;
  console.error(`[Jelly Baby / ${stage}]`,error);
}
window.addEventListener('error',event=>fail(event.error||event.message));
window.addEventListener('unhandledrejection',event=>fail(event.reason));
document.querySelector('#retry')!.addEventListener('click',()=>location.reload());

// One observed chain covers imports, initialization, compilation, warmup and first render.
void import('./game/runtime.ts').then(({startGame})=>startGame(message=>{
  if(failed)throw new Error('Startup aborted after a GPU failure');
  stage=message;document.querySelector('#load-message')!.textContent=message;
},fail)).then(started=>{
  game=started;
  if(failed){game.stop();return;}
  stage='Playing';document.querySelector('#loading')!.classList.add('hidden');
}).catch(fail);
