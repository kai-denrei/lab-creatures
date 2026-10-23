import assert from 'node:assert/strict';
import {polygonArea,contains} from '../src/cutisling/outline.ts';
import {traceContours} from '../src/cutisling/contour.ts';
const pass=name=>console.log('PASS',name);
// ---- A. contour tracer -------------------------------------------------------
{
  const nodes=61,cell=.1,half=3,values=new Float32Array(nodes*nodes);
  const set=(fn)=>{for(let j=0;j<nodes;j++)for(let i=0;i<nodes;i++)values[j*nodes+i]=fn(i*cell-half,j*cell-half);};
  set((x,z)=>2*Math.exp(-(x*x+z*z)/.8));
  let loops=traceContours(values,nodes,1,cell,half);
  assert.equal(loops.length,1,'one blob gives one loop');
  assert(polygonArea(loops[0])>0,'outer loop is counterclockwise');
  const r=Math.sqrt(.8*Math.log(2));
  assert(Math.abs(polygonArea(loops[0])-Math.PI*r*r)<.06,`loop area matches the analytic disc (${polygonArea(loops[0]).toFixed(3)} vs ${(Math.PI*r*r).toFixed(3)})`);
  assert(contains(loops[0],0,0),'the loop encloses the blob centre');
  set((x,z)=>{const d=Math.hypot(x,z);return d<1.5?2:0;});
  for(let j=0;j<nodes;j++)for(let i=0;i<nodes;i++){const x=i*cell-half,z=j*cell-half;if(Math.hypot(x,z)<.6)values[j*nodes+i]=0;}
  loops=traceContours(values,nodes,1,cell,half);
  assert.equal(loops.length,2,'a ring gives an outer loop and a hole');
  const outer=loops.find(l=>polygonArea(l)>0),hole=loops.find(l=>polygonArea(l)<0);
  assert(outer&&hole,'orientation distinguishes outer loop from hole');
  assert(contains(outer,hole[0][0],hole[0][1]),'the hole lies inside the outer loop');
  set((x,z)=>Math.max(2*Math.exp(-((x-1.2)**2+z*z)/.3),2*Math.exp(-((x+1.2)**2+z*z)/.3)));
  loops=traceContours(values,nodes,1,cell,half);
  assert.equal(loops.length,2,'two separated blobs give two outer loops');
  for(const loop of loops)for(let i=0;i<loop.length;i++){const p=loop[i],q=loop[(i+1)%loop.length];assert(Math.hypot(q[0]-p[0],q[1]-p[1])<.3,'consecutive points stay close');}
  set((x,z)=>Math.hypot(x-2.8,z-2.8)<.05?2:0);
  assert.equal(traceContours(values,nodes,1,cell,half).length,0,'specks below the minimum area are dropped');
  pass('marching squares: orientation, holes, separation, speck removal');
}
import {Inago} from '../src/inago/controller.ts';
import {FieldSkin} from '../src/cutisling/field.ts';
import {CUTISLING_DEFAULTS} from '../src/cutisling/settings.ts';
// ---- B. field skin ----------------------------------------------------------
{
  const body=new Inago(),skin=new FieldSkin(body,{...CUTISLING_DEFAULTS});
  let loops=skin.contours();
  assert.equal(loops.length,1,'the resting flock is one continuous skin');
  assert(polygonArea(loops[0])>3&&polygonArea(loops[0])<14,`resting skin area is plausible for a 1.3 m flock (${polygonArea(loops[0]).toFixed(2)})`);
  assert(contains(loops[0],body.centerX,body.centerZ),'skin encloses the flock centre');
  assert.equal(skin.contours(),loops,'same time returns the cached loops');
  let spreadArea=0,contractedArea=0,maxLoops=0;
  for(let i=1;i<=18*60;i++){body.step(1/60);const l=skin.contours();maxLoops=Math.max(maxLoops,l.filter(x=>polygonArea(x)>0).length);if(i===10.5*60)spreadArea=l.reduce((s,x)=>s+polygonArea(x),0);if(i===17*60)contractedArea=l.reduce((s,x)=>s+polygonArea(x),0);}
  assert(spreadArea>contractedArea*1.6,`the skin spreads with the flock and contracts again (${spreadArea.toFixed(2)} vs ${contractedArea.toFixed(2)})`);
  assert(maxLoops<=3,`free roaming never shatters into more than three pieces (${maxLoops})`);
  const mean=arr=>arr.reduce((a,b)=>a+b,0)/arr.length;
  const hollow={x:mean(body.x),z:mean(body.z),radiusAt:()=>.68,strength:1,cover:0,coverRadius:.9};
  for(let i=0;i<30;i++){body.step(1/60);loops=skin.contours(hollow);}
  assert(loops.some(l=>polygonArea(l)<0),'a full-strength hollow cuts a hole');
  const nearest=l=>Math.min(...l.map(p=>Math.hypot(p[0]-hollow.x,p[1]-hollow.z)));
  const hole=loops.filter(l=>polygonArea(l)<0).sort((a,b)=>nearest(a)-nearest(b))[0];
  assert(nearest(hole)<1,`a hole surrounds the hollow (nearest point ${nearest(hole).toFixed(2)})`);
  for(const p of hole)assert(Math.hypot(p[0]-hollow.x,p[1]-hollow.z)>.5,'the hole keeps the prey clearance');
  for(let i=0;i<30;i++){body.step(1/60);loops=skin.contours({...hollow,strength:0,cover:1});}
  assert(!loops.some(l=>polygonArea(l)<0),'a faded hollow with full cover closes the hole');
  const approaches={};
  for(const approach of ['flock','elastic','viscous']){
    const b=new Inago(),s=new FieldSkin(b,{...CUTISLING_DEFAULTS,approach});
    for(let i=0;i<8*60;i++){b.step(1/60);s.contours();}
    approaches[approach]=Float32Array.from(s.value);
  }
  const diff=(a,b)=>{let d=0;for(let i=0;i<a.length;i++)d+=Math.abs(a[i]-b[i]);return d;};
  assert(diff(approaches.flock,approaches.viscous)>50&&diff(approaches.flock,approaches.elastic)>50,`the three approaches respond differently to the same flock (${diff(approaches.flock,approaches.viscous).toFixed(1)}, ${diff(approaches.flock,approaches.elastic).toFixed(1)})`);
  const perimeter=l=>l.reduce((s,p,i)=>s+Math.hypot(p[0]-l[(i+1)%l.length][0],p[1]-l[(i+1)%l.length][1]),0);
  const compactness=tension=>{const b=new Inago(),s=new FieldSkin(b,{...CUTISLING_DEFAULTS,tension});for(let i=0;i<9*60;i++){b.step(1/60);s.contours();}const l=s.contours();const P=l.reduce((a,x)=>a+perimeter(x),0),A=l.reduce((a,x)=>a+polygonArea(x),0);return P*P/(4*Math.PI*A);};
  assert(compactness(1)<compactness(0)*.98,'tension smooths the spread outline');
  pass('field skin: continuous skin, spread/contract, hollow, cover, approaches, tension');
}
import {Cutisling} from '../src/cutisling/controller.ts';
// ---- C. feeding behavior ----------------------------------------------------
{
  const run=(settings={},seconds=60)=>{const c=new Cutisling();Object.assign(c.tuning,settings);let splitFor=0,worst=0,longestEncircle=0;
    for(let i=1;i<=seconds*60;i++){c.step(1/60);
      if(c.feeding==='ENCIRCLE')longestEncircle=Math.max(longestEncircle,c.feedingTime);
      if(i%6===0&&c.tuning.hunting){const loops=c.contours(),outer=loops.filter(l=>polygonArea(l)>0),inside=outer.filter(l=>contains(l,c.preyX,c.preyZ));
        if(inside.length&&outer.length>1){splitFor+=.1;worst=Math.max(worst,outer.length);}else splitFor=0;
        assert(splitFor<=.25,`skin stayed split ${splitFor.toFixed(1)} s around prey (${worst} pieces) at t=${(i/60).toFixed(1)} feeding=${c.feeding}`);}
    }
    return {meals:c.meals,longestEncircle,c};};
  const base=run();
  assert(base.meals>=1,`defaults feed at least once in 60 s (got ${base.meals})`);
  assert(base.longestEncircle<=22.05,'encircle never exceeds the hard cap');
  const long=run({},180);
  assert(long.meals>=3,`defaults feed three times in 180 s (got ${long.meals})`);
  for(const settings of [{freedom:.5,turbulence:2},{freedom:0,turbulence:0,swirl:.2},{approach:'viscous',viscosity:1},{approach:'elastic',tension:1},{mouthDetail:1.4,edgeDetail:1},{mouthDetail:0,edgeDetail:0}]){
    const r=run(settings);assert(r.meals>=1,`feeds within 60 s at ${JSON.stringify(settings)} (got ${r.meals})`);
  }
  const c=new Cutisling();
  for(let i=0;i<60*60&&c.feeding!=='COVER';i++)c.step(1/60);
  assert.equal(c.feeding,'COVER','reaches cover');
  assert(c.enclosed(),'cover begins only once the skin encloses the prey');
  const o=c.opening;assert(o.radius>=1.05*c.preyRadius-1e-9,'the hole never shrinks below the prey');
  for(let k=0;k<5;k++){const theta=k/5*Math.PI*2;assert(Math.abs(c.hollowAt(theta)-.68)<.68*.2);}
  const radii=Array.from({length:36},(_,k)=>c.hollowAt(k/36*Math.PI*2)),mean=radii.reduce((a,b)=>a+b)/36,cv=Math.sqrt(radii.reduce((a,r)=>a+(r-mean)**2,0)/36)/mean;
  assert(cv>=.03,`the hollow radius is irregular around the prey (cv ${cv.toFixed(3)})`);
  const free=new Cutisling();free.tuning.hunting=false;for(let i=0;i<10*60;i++)free.step(1/60);assert.equal(free.feeding,'HUNT');assert.equal(free.meals,0);
  const a=new Cutisling(),b=new Cutisling();for(let i=0;i<20*60;i++){a.step(1/60);b.step(1/60);}
  assert.deepEqual(Array.from(a.x),Array.from(b.x),'stepping is deterministic');
  a.paused=true;const before=a.time;a.step(1/60);assert.equal(a.time,before,'pause freezes the organism');a.paused=false;a.reset();assert.equal(a.feeding,'HUNT');assert.equal(a.time,0);
  pass('feeding: completes under defaults and extremes, one body around prey, hard cap, irregular hollow, determinism, pause, reset');
}
import {createCutislingMembrane} from '../src/cutisling/membrane.ts';
// ---- D. membrane geometry ----------------------------------------------------
{
  const inspect=(membrane,label)=>{
    const positions=membrane.skin.geometry.attributes.position.array,count=membrane.skin.geometry.drawRange.count*3;
    const outline=membrane.boundaries.reduce((s,l)=>s+polygonArea(l),0);
    let triangles=0;for(let i=0;i<count;i+=9)triangles+=Math.abs((positions[i+3]-positions[i])*(positions[i+8]-positions[i+2])-(positions[i+6]-positions[i])*(positions[i+5]-positions[i+2]))*.5;
    assert(Math.abs(outline-triangles)<2e-3,`${label}: triangles fill the outline (${outline.toFixed(3)} vs ${triangles.toFixed(3)})`);
    for(const mesh of [membrane.skin,membrane.underside,membrane.rim]){
      const {geometry}=mesh,p=geometry.attributes.position.array,n=geometry.drawRange.count*3;
      assert(n<=geometry.attributes.position.count*3,`${label}: draw range fits the buffer`);
      for(let i=0;i<n;i++)assert(Number.isFinite(p[i]),`${label}: finite geometry`);
      for(let i=1;i<n;i+=3)assert(p[i]>=.011&&p[i]<.8,`${label}: tissue stays between the ground and the dome (${p[i].toFixed(3)})`);
    }
  };
  const plain=new Inago(),plainMembrane=createCutislingMembrane(plain);
  assert.equal(plainMembrane.boundaries.length,1,'an Inago body without a controller still gets one skin');
  for(let i=1;i<=6*60;i++){plain.step(1/60);if(i%20===0){plainMembrane.update();inspect(plainMembrane,'plain');}}
  const c=new Cutisling(),membrane=createCutislingMembrane(c,(x,z)=>c.surfaceLift(x,z),()=>c.opening,(x,z)=>c.floorAt(x,z));
  let coverSamples=0,holeChecked=false;const straight=[];
  // Longest stretch of a loop lying within 1.5 cm of one chord: the old carved lips measured metres.
  const longestStraight=loop=>{let best=0;const n=loop.length;
    for(let s=0;s<n;s++){let e=s+2;for(;e<s+n;e++){const a=loop[s%n],b=loop[e%n],dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz)||1e-9;let ok=true;
        for(let m=s+1;m<e;m++){const p=loop[m%n];if(Math.abs((p[0]-a[0])*dz-(p[1]-a[1])*dx)/len>.015){ok=false;break;}}
        if(!ok)break;}
      const a=loop[s%n],b=loop[(e-1)%n];best=Math.max(best,Math.hypot(b[0]-a[0],b[1]-a[1]));}
    return best;};
  for(let i=1;i<=90*60;i++){
    c.step(1/60);if(i%10)continue;membrane.update();inspect(membrane,`t=${(i/60).toFixed(1)} ${c.feeding}`);
    if(i%60===0)for(const loop of c.contours())if(Math.abs(polygonArea(loop))>=1)straight.push(longestStraight(loop));
    if(c.feeding==='ENCIRCLE'&&c.feedingTime>3){const hole=membrane.boundaries.find(l=>polygonArea(l)<0);if(hole){const radii=hole.map(p=>Math.hypot(p[0]-c.preyX,p[1]-c.preyZ)),mean=radii.reduce((a,b)=>a+b)/radii.length,cv=Math.sqrt(radii.reduce((a,r)=>a+(r-mean)**2,0)/radii.length)/mean;assert(cv>=.05,`hole is not a circle (cv ${cv.toFixed(3)})`);holeChecked=true;}}
    if(c.feeding==='COVER'||c.feeding==='ABSORB'){coverSamples++;const rp=c.preyRadius*c.preyScale,cy=.012+rp;
      for(const mesh of [membrane.skin,membrane.rim]){const p=mesh.geometry.attributes.position.array,n=mesh.geometry.drawRange.count*3;
        for(let k=0;k<n;k+=3){const dx=p[k]-c.preyX,dz=p[k+2]-c.preyZ,dy=p[k+1]-cy,d=Math.sqrt(dx*dx+dy*dy+dz*dz);assert(d>=rp+.01-1e-6,`${c.feeding} t=${c.feedingTime.toFixed(2)} ${mesh===membrane.rim?'rim':'cap'}: tissue vertex ${d.toFixed(3)} m from the prey centre is inside the ${rp.toFixed(3)} m prey`);}}}
  }
  assert(holeChecked,'the hole was observed during encircle');
  assert(coverSamples>0,'cover and absorb were observed');
  straight.sort((a,b)=>a-b);const medianStraight=straight[Math.floor(straight.length/2)],maxStraight=straight[straight.length-1];
  assert(medianStraight<1.6&&maxStraight<2.5,`no metre-scale straight edges (median ${medianStraight.toFixed(2)} m, max ${maxStraight.toFixed(2)} m)`);
  assert(c.meals>=1,'the membrane run fed');
  pass('membrane: continuous skin on any body, fills outline, bounded, no circular hole, no metre-scale straight edges, clearance over prey');
}
// ---- E. update cost ----------------------------------------------------------
{
  const c=new Cutisling();for(let i=0;i<20*60;i++)c.step(1/60);
  const t0=performance.now();let n=0;for(let i=0;i<120;i++){c.step(1/60);c.contours();n++;}
  const ms=(performance.now()-t0)/n;console.log(`field+contour ${ms.toFixed(2)} ms per update`);
  if(ms>3)console.warn('WARN update slower than the 3 ms budget');
  pass('update cost measured');
}
import {Muscles} from '../src/cutisling/muscles.ts';
// ---- F. strides -------------------------------------------------------------
{
  const m=new Muscles(4);
  assert.deepEqual(Array.from(m.phase).map(p=>p.toFixed(2)),['0.00','0.37','0.71'],'bands start staggered');
  assert.equal(m.stage(0),'reach');assert.equal(m.stage(1),'plant');assert.equal(m.stage(2),'haul');
  const periods=[];for(let i=0;i<400;i++){m.advance(1/60,1);if(m.phase[0]<1/60/m.period[0])periods.push(m.period[0]);}
  assert(periods.length>=3&&new Set(periods.map(p=>p.toFixed(3))).size>=2,'stride periods are re-seeded each stride');
  for(const p of periods)assert(p>=1.05*.85-1e-9&&p<=1.05*1.15+1e-9,'periods stay within ±15 % of the base');
  m.assign(Float64Array.from([-1,0,1,0]),Float64Array.from([0,0,0,2]),0,0,0,1,.3);
  assert.deepEqual(Array.from(m.band),[0,1,2,1],'bands follow the lateral offset across the heading');
  m.grip(2,1,0);assert.equal(m.gripped[2],1);assert.equal(m.gripBand[2],2);m.release(1);assert.equal(m.gripped[2],1);m.release(2);assert.equal(m.gripped[2],0);
  m.reset();assert.equal(m.phase[1],.37);assert.equal(m.gripped[2],0);
  pass('muscles: staggered clocks, re-seeded periods, band assignment, grip bookkeeping');
}
{
  const travel=(grip)=>{const c=new Cutisling();c.tuning.grip=grip;c.lure(7,0);c.autoPrey=false;
    const start=c.x.reduce((a,b)=>a+b)/c.count;let still=0,total=0;
    for(let i=1;i<=12*60;i++){c.step(1/60);if(i%6)continue;for(let n=0;n<c.count;n++){total++;if(Math.hypot(c.vx[n],c.vz[n])<.05)still++;}}
    return {advance:c.x.reduce((a,b)=>a+b)/c.count-start,stillFraction:still/total,c};};
  const gripped=travel(.85),glide=travel(0);
  assert(gripped.advance>=2,`gripping body still travels (${gripped.advance.toFixed(2)} m)`);
  assert(gripped.stillFraction>=.3,`most drivers hold the ground at any moment (${(gripped.stillFraction*100).toFixed(0)} %)`);
  assert(glide.stillFraction<.1,`grip 0 glides (${(glide.stillFraction*100).toFixed(0)} % still)`);
  assert(glide.advance>=gripped.advance*.8,`grip 0 travels at least as far (${glide.advance.toFixed(2)} vs ${gripped.advance.toFixed(2)})`);
  const c=new Cutisling();c.lure(7,0);c.autoPrey=false;let pinnedChecks=0;
  for(let i=1;i<=20*60;i++){c.step(1/60);for(let n=0;n<c.count;n++)if(c.muscles.gripped[n]){pinnedChecks++;assert(Math.hypot(c.x[n]-c.muscles.gripX[n],c.z[n]-c.muscles.gripZ[n])<1e-3,'gripped drivers stay pinned');}}
  assert(pinnedChecks>1000,`drivers were gripped during travel (${pinnedChecks} checks)`);
  const run=(settings)=>{const c=new Cutisling();Object.assign(c.tuning,settings);for(let i=1;i<=60*60;i++)c.step(1/60);return c.meals;};
  for(const settings of [{stride:.5},{stride:2},{grip:1},{grip:0},{grip:1,freedom:.5,turbulence:2}])assert(run(settings)>=1,`feeds within 60 s at ${JSON.stringify(settings)}`);
  const a=new Cutisling(),b=new Cutisling();for(let i=0;i<15*60;i++){a.step(1/60);b.step(1/60);}
  assert.deepEqual(Array.from(a.x),Array.from(b.x),'strides are deterministic');
  assert.deepEqual(Array.from(a.muscles.phase),Array.from(b.muscles.phase));
  a.reset();assert.equal(a.muscles.phase[0],0);assert.equal(a.muscles.gripped.reduce((s,v)=>s+v,0),0,'reset releases every grip');
  pass('strides: anchored travel, pinned grips, feeding under stride and grip extremes, determinism, reset');
}
