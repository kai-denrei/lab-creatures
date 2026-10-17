import './style.css';
import './landing.css';
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
