import { SPECIMENS } from './catalog/specimens.ts';
import './catalog/style.css';
document.body.classList.add('landing');
document.title='lab-creatures — Specimen library';
const families=['All specimens','Arthropods','Membranes','Soft bodies','Crawlers','Playground'];
document.querySelector('#app')!.innerHTML=`
<header class="catalog-header"><a href="./" class="wordmark">lab-creatures<span> / FIELD COLLECTION</span></a><span class="catalog-tag">${SPECIMENS.length} SPECIMENS · 5 FAMILIES</span></header>
<main class="catalog-main">
<section class="catalog-intro"><div><span class="lab-label">THE LIVING COLLECTION</span><h1>Choose your<br><em>unfamiliar.</em></h1></div><p>Meet a body. Follow an instinct.<br>Open any specimen to observe, tune and explore.</p></section>
<section class="catalog-browser" aria-label="Specimen library">
<div class="catalog-tools"><nav class="family-filters" aria-label="Filter by creature family">${families.map((f,i)=>`<button type="button" data-family="${f}" aria-pressed="${i===0}">${f}<span>${i===0?SPECIMENS.length:SPECIMENS.filter(s=>s.family===f).length}</span></button>`).join('')}</nav><label class="catalog-search"><span class="sr-only">Search specimens</span><input type="search" placeholder="Find a specimen…" aria-label="Search specimens"></label></div>
<div class="catalog-results"><h2 id="collection-label">All specimens</h2><span id="collection-count" role="status">${SPECIMENS.length} specimens</span></div>
<div class="collection-grid">${SPECIMENS.map((s,i)=>`<a class="collection-card" data-id="${s.id}" href="${s.url}" aria-label="Open ${s.name} · ${s.family}"><div class="collection-image"><img src="${import.meta.env.BASE_URL}thumbnails/${s.id}.png" alt="${s.name} specimen" width="640" height="420" ${i>3?'loading="lazy"':''}><span class="collection-number">${String(i+1).padStart(2,'0')}</span><span class="collection-enter" aria-hidden="true">↗</span></div><div class="collection-copy"><span>${s.family}</span><h3>${s.name}</h3><p>${s.description}</p><div class="collection-open">${s.family==='Playground'||s.family==='Crawlers'?'Enter playground':'Open specimen lab'} <span>↗</span></div></div></a>`).join('')}</div>
<p class="collection-empty" hidden>No matching specimens. Try another name or family.</p>
</section></main><footer class="catalog-footer"><span>CREATURE STUDIES / AN EVOLVING COLLECTION</span><span>Inspired by <a href="https://github.com/scottstts/Jelly-Baby">Jelly Baby</a> · <a href="https://github.com/kai-denrei/lab-creatures">Source / GPL-3.0</a></span></footer>`;
let family='All specimens';
const search=document.querySelector<HTMLInputElement>('.catalog-search input')!;
const filter=()=>{
  const query=search.value.trim().toLowerCase();let count=0;
  for(const card of document.querySelectorAll<HTMLElement>('.collection-card')){
    const s=SPECIMENS.find(s=>s.id===card.dataset.id)!;
    card.hidden=!(family==='All specimens'||s.family===family)||!`${s.name} ${s.family} ${s.description}`.toLowerCase().includes(query);if(!card.hidden)count++;
  }
  document.querySelector('#collection-label')!.textContent=family;
  document.querySelector('#collection-count')!.textContent=`${count} specimen${count===1?'':'s'}`;
  document.querySelector<HTMLElement>('.collection-empty')!.hidden=count>0;
};
for(const button of document.querySelectorAll<HTMLButtonElement>('[data-family]'))button.addEventListener('click',()=>{
  family=button.dataset.family!;for(const b of document.querySelectorAll('[data-family]'))b.setAttribute('aria-pressed',String(b===button));filter();
});
search.addEventListener('input',filter);
