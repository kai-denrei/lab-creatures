import './style.css';
import './landing.css';
if(import.meta.env.DEV){
  // Commit and dirty marker, refreshed from the dev server so a stale tab is visible at a glance.
  const badge=document.createElement('div');badge.className='dev-build';badge.textContent=`dev ${__BUILD_ID__}`;badge.title='Local development build: commit and dirty marker (* = uncommitted changes), refreshed every 10 s';document.body.append(badge);
  const refresh=async()=>{try{const {id,at}=await (await fetch('__build-id',{cache:'no-store'})).json() as {id:string;at:string};badge.textContent=`dev ${id} · ${at.slice(11,16)}Z`;}catch{/* Production builds have no endpoint. */}};
  void refresh();setInterval(()=>{void refresh();},10000);
}
async function openPage(){
  const specimen=new URLSearchParams(location.search).get('specimen');
  if(specimen==='cutisling-v2'){await import('./cutisling-v2/page.ts');}
  else if(specimen==='inago'||specimen==='cutisling'){await import('./inago/page.ts');}
  else if(specimen==='evasion-game'){await import('./evasion/page.ts');}
  else if(specimen==='jelly-baby'){
    document.body.classList.add('baby-playground');
    await import('./baby-page.ts');
    document.querySelector('.actions')!.insertAdjacentHTML('afterbegin','<a class="back-link" href="./">← Specimens</a>');
    document.querySelector('.loading-card')!.insertAdjacentHTML('beforeend','<a class="index-return" href="./">← Return to specimens</a>');
  }else if((specimen==='cutis-maku'||specimen==='cutis-maku-k'||specimen==='cutis-maku-pearl'||specimen==='cutis-gorogoro')){await import('./cutis/page.ts');}
  else if(specimen==='arthropod-lab'){await import('./arthropods/page.ts');}
  else if(specimen==='nih-dairia'||specimen==='creature-lab'){await import('./monster/page.ts');}
  else {await import('./landing.ts');}
}
void openPage().catch(error=>{
  const app=document.querySelector('#app')!;
  app.innerHTML='<section id="loading"><div class="loading-card"><h2>Unable to open the lab.</h2><p id="route-error"></p><a href="./">Return to specimens</a></div></section>';
  document.querySelector('#route-error')!.textContent=error instanceof Error?error.message:String(error);
  console.error('Page loading failed',error);
});
