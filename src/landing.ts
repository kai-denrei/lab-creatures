export {};
document.body.classList.add('landing');
document.title='lab-creatures — Evolving unfamiliar life';
document.querySelector('#app')!.innerHTML=`
  <header class="lab-nav"><a href="./" class="wordmark">lab-creatures</a><span class="nav-note">AN INTERACTIVE CREATURE LAB</span><a href="?specimen=creature-lab">Creature Lab ↗</a></header>
  <main class="lab-main">
    <section class="intro"><div class="intro-top"><span class="lab-label">CREATURE STUDIES / 001</span><span class="lab-label">SOFT BODIES. STRANGE INSTINCTS.</span></div>
      <h1>Shared ancestry.<br>Unfamiliar <em>life.</em></h1>
      <div class="intro-bottom"><p>Sensing, hunting, feeding. Bodies shaped by instinct.<br>A growing ecosystem of interactive creature experiments.</p><a href="#specimens" class="round-arrow" aria-label="Explore the specimens">↓</a></div>
    </section>
    <div id="specimens" class="specimen-grid">
      <section class="specimen-card monster-card" aria-labelledby="monster-title">
        <div class="card-meta"><span>01 / THE ANCESTOR</span><span class="status-dot">NIH-DAIRIA</span></div>
        <div class="monster-portrait" aria-hidden="true"><svg viewBox="0 0 600 430"><defs><radialGradient id="flesh"><stop stop-color="#242d27"/><stop offset=".4" stop-color="#8b9380"/><stop offset="1" stop-color="#cbd0a7"/></radialGradient><filter id="shadow"><feDropShadow dx="0" dy="18" stdDeviation="12" flood-opacity=".65"/></filter></defs><g transform="translate(300 225) rotate(-14)" filter="url(#shadow)"><path fill="url(#flesh)" stroke="#c0c4a1" stroke-width="1.2" d="M-28-36C-86-80-92-149-39-188C-66-128-31-98 7-60C31-52 61-144 161-139C80-113 83-54 47-23C90-11 172-73 231-23C171-43 101 19 57 25C83 77 161 89 177 160C138 119 52 113 20 56C-12 100 3 164-75 192C-37 133-62 89-36 38C-101 55-145 110-212 77C-152 72-115 1-49-6Z"/><g fill="none" stroke="#293c33" opacity=".7"><path stroke-width="3" d="M0 4Q-82-90-39-188M0 4Q51-107 161-139M0 4Q117-39 231-23M0 4Q67 103 177 160M0 4Q-42 111-75 192M0 4Q-125 84-212 77"/><path d="M-20-29l-27-9m9-20 6-24m-17-10-14-12M42-52l18 6m5-32 23-5M87-14l17 15m27-25 19 9M54 67l-3 19m28 6 20-2M-29 72l-17 16m18 33 13 18M-78 35l-25-8m-16 32-19-3"/></g></g></svg></div>
        <div class="card-copy"><span class="lab-label">ALL MUSCLE. ALL NERVE. ALL AWARE.</span><h2 id="monster-title">Nih-Dairia<span>.</span></h2><p>Six limbs. No face. No fixed front.<br>An unfamiliar intelligence beneath the membrane.</p><a class="enter-link" href="?specimen=nih-dairia">Enter the experiment <span>↗</span></a></div>
      </section>
    <section class="specimen-card lineage-card"><div class="card-copy"><span class="lab-label">02 / THE EVOLVING FAMILY</span><h2>Creature Lab<span>.</span></h2><p>Cousins and siblings from one ecosystem.<br>Explore the ancestor as we develop distinct evolutionary paths.</p><a class="enter-link" href="?specimen=creature-lab">Open Creature Lab <span>↗</span></a></div></section>
    </div>
    <section class="research-note"><span class="lab-label">BEYOND THE TABLETOP</span><div><h2>An instinct today.<br>A Stalheart boss tomorrow.</h2><p>Nih-Dairia begins here as a creature study: sensing, reaching, and gathering itself around a target. These experiments will inform a future boss for Stalheart.</p><span class="research-tag">RESEARCH SPECIMEN / NOT YET IN STALHEART</span></div></section>
  </main><footer class="lab-footer"><span>LAB-CREATURES / CREATURE STUDIES</span><span>Inspired by <a href="https://github.com/scottstts/Jelly-Baby">Jelly Baby by scottstts</a> · <a href="?specimen=jelly-baby">Original playground</a> · <a href="https://github.com/kai-denrei/lab-creatures">Source / GPL-3.0</a></span></footer>`;
