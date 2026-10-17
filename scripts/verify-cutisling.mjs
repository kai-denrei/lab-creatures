import assert from 'node:assert/strict';
import {Inago} from '../src/inago/controller.ts';
import {createCutislingMembrane} from '../src/cutisling/membrane.ts';
import {polygonArea,openingContour} from '../src/cutisling/outline.ts';
const body=new Inago(),original=new Inago(),membrane=createCutislingMembrane(body);
function inspect(){
  assert.equal(membrane.boundaries.length,1,'the uncut tissue is one continuous outline');
  const outlineArea=polygonArea(membrane.boundaries[0]);
  const positions=membrane.skin.geometry.attributes.position.array;
  let triangleArea=0;
  for(let i=0;i<membrane.skin.geometry.drawRange.count*3;i+=9){
    triangleArea+=Math.abs((positions[i+3]-positions[i])*(positions[i+8]-positions[i+2])-(positions[i+6]-positions[i])*(positions[i+5]-positions[i+2]))*.5;
  }
  assert(Math.abs(outlineArea-triangleArea)<1e-4,'triangles fill the continuous outline without missing panels');
  const roof=membrane.skin.geometry.attributes.position.array;
  for(let i=1;i<membrane.skin.geometry.drawRange.count*3;i+=3)assert(roof[i]>=.085,'the skin retains its shallow volume');
  assert(membrane.skin.geometry.drawRange.count>0,'the skin never vanishes when there is no opening');
  assert(membrane.rim.geometry.drawRange.count>0&&membrane.underside.geometry.drawRange.count===membrane.skin.geometry.drawRange.count,'rounded lip and underside close the tissue volume');
  for(const mesh of [membrane.skin,membrane.underside,membrane.rim]){
    const {geometry}=mesh,positions=geometry.attributes.position.array;
    assert(geometry.drawRange.count<=geometry.attributes.position.count,'draw ranges fit the buffers');
    for(let i=0;i<geometry.drawRange.count*3;i++)assert(Number.isFinite(positions[i]));
    for(let i=1;i<geometry.drawRange.count*3;i+=3)assert(positions[i]>=.011&&positions[i]<.13,'living skin remains low to the ground');
  }
}
inspect();const initialArea=membrane.area;let spreadArea=0,contractedArea=0;
for(let i=1;i<=18*60;i++){
  body.step(1/60);original.step(1/60);
  if(i%30===0){membrane.update();inspect();}
  if(i===10.5*60)spreadArea=membrane.area;if(i===17*60)contractedArea=membrane.area;
}
assert.deepEqual(body.x,original.x,'the membrane preserves Inago locomotion exactly');assert.deepEqual(body.vz,original.vz);
assert(spreadArea>contractedArea*2,'the membrane expands and contracts with the flock');
body.paused=true;const skin=membrane.skin.geometry.attributes.position.array.slice();body.step(.2);membrane.update();assert.deepEqual(membrane.skin.geometry.attributes.position.array,skin);
body.reset();membrane.update();inspect();assert.equal(membrane.area,initialArea,'reset restores the original sheet');
console.log('PASS Cutisling continuous tissue, finite geometry, exact Inago movement, expansion/contraction, pause and reset',{initialArea,spreadArea,contractedArea});

const {Cutisling}=await import('../src/cutisling/controller.ts');
const hunter=new Cutisling(),preyStart=[hunter.preyX,hunter.preyZ];
hunter.step(.2);assert.notDeepEqual([hunter.preyX,hunter.preyZ],preyStart,'the lure wanders');
const stages=new Set();let captured=null,checkedCover=false,wideFlanks=false;let previousStage=hunter.feeding;const movement={};
const feedingSkin=createCutislingMembrane(hunter,(x,z)=>hunter.surfaceLift(x,z),()=>hunter.opening);
assert.equal(hunter.count,256,'Cutisling uses a smaller invisible flock');
assert.equal(feedingSkin.group.children.length,3,'only skin, underside and lip are rendered');
for(let frame=0;frame<60*60;frame++){
  hunter.step(1/60);stages.add(hunter.feeding);
  if(frame%15===0){
    feedingSkin.update();
    assert(feedingSkin.skin.geometry.drawRange.count>0,'visible skin persists through hollowing, sealing, absorption and recovery');
    const lipVertices=feedingSkin.boundaries.reduce((n,loop)=>n+loop.length,0)*60;
    assert.equal(feedingSkin.rim.geometry.drawRange.count,lipVertices,'every exposed boundary has a complete rounded profile');
    for(const mesh of [feedingSkin.skin,feedingSkin.rim,feedingSkin.underside]){
      const count=mesh.geometry.drawRange.count;assert(count<=mesh.geometry.attributes.position.count);
      for(let i=0;i<count*3;i++)assert(Number.isFinite(mesh.geometry.attributes.position.array[i]));
      const range=mesh.geometry.attributes.position.updateRanges;assert.equal(range.length,1);assert.equal(range[0].count,count*3,'only the visible buffer range is uploaded');
    }
    if(hunter.locked&&!hunter.sealed){
      const opening=hunter.opening;
      // Inspect the sealed counterpart of the current mouth to measure its shape.
      const points=openingContour({...opening,gapWidth:0}),radii=points.map(p=>Math.hypot(p[0]-opening.x,p[1]-opening.z));
      assert(Math.max(...radii)-Math.min(...radii)>.10,'the feeding opening stays asymmetric, never a perfect circle');
    }
  }
  if(previousStage==='FAN_OUT'&&hunter.feeding==='ENCIRCLE'){assert(hunter.flanksReady(),'both flanks spread wide before closing');wideFlanks=true;}
  if(previousStage==='ENCIRCLE'&&hunter.feeding==='COVER')assert(hunter.surrounded(),'closure begins only after surrounding the prey');
  previousStage=hunter.feeding;
  const speeds=Array.from(hunter.vx,(vx,i)=>Math.hypot(vx,hunter.vz[i]));movement[hunter.feeding]=Math.max(movement[hunter.feeding]??0,speeds.filter(v=>v>.2).length/hunter.count);
  if(hunter.locked&&!captured)captured=[hunter.preyX,hunter.preyZ];
  if(hunter.locked&&hunter.meals===0)assert.deepEqual([hunter.preyX,hunter.preyZ],captured,'captured prey stays put');
  if(!hunter.sealed&&hunter.locked){for(let i=0;i<hunter.count;i++)assert(Math.hypot(hunter.x[i]-hunter.preyX,hunter.z[i]-hunter.preyZ)>=hunter.hollowRadius-1e-8,'unsealed tissue avoids the prey');assert(hunter.opening.gapWidth>0,'an escape gap stays open until a loop closes');assert.equal(hunter.coverage,0);}
  if(hunter.feeding==='COVER'){assert.equal(hunter.preyScale,1,'prey does not shrink before being covered');}
  if(hunter.feeding==='ABSORB'&&!checkedCover){
    feedingSkin.update();const roof=feedingSkin.skin.geometry.attributes.position.array;
    const edges=new Map(),key=i=>[roof[i],roof[i+1],roof[i+2]].map(v=>Math.round(v*1e6)).join(',');
    for(let i=0;i<feedingSkin.skin.geometry.drawRange.count*3;i+=9)for(let j=0;j<3;j++){
      const a=i+j*3,b=i+(j+1)%3*3,ka=key(a),kb=key(b),id=ka<kb?`${ka}/${kb}`:`${kb}/${ka}`;
      const edge=edges.get(id);if(edge)edge.count++;else edges.set(id,{a,b,count:1});
    }
    for(const {a,b,count} of edges.values())if(count===1){
      const x=(roof[a]+roof[b])*.5,z=(roof[a+2]+roof[b+2])*.5;
      let distance=Infinity;
      for(const loop of feedingSkin.boundaries)for(let i=0;i<loop.length;i++){
        const p=loop[i],q=loop[(i+1)%loop.length],dx=q[0]-p[0],dz=q[1]-p[1],t=Math.max(0,Math.min(1,((x-p[0])*dx+(z-p[1])*dz)/(dx*dx+dz*dz)));
        distance=Math.min(distance,Math.hypot(x-p[0]-dx*t,z-p[1]-dz*t));
      }
      assert(distance<1e-5,'all interior dome edges have a matching neighbor; no T-junction tears');
    }
    for(let ix=-8;ix<=8;ix++)for(let iz=-8;iz<=8;iz++){
      const dx=ix*.025,dz=iz*.025;if(dx*dx+dz*dz>=hunter.preyRadius**2)continue;
      const x=hunter.preyX+dx,z=hunter.preyZ+dz;let height=-Infinity;
      for(let i=0;i<feedingSkin.skin.geometry.drawRange.count*3;i+=9){
        const ax=roof[i],az=roof[i+2],bx=roof[i+3],bz=roof[i+5],cx=roof[i+6],cz=roof[i+8];
        const det=(bz-cz)*(ax-cx)+(cx-bx)*(az-cz);if(Math.abs(det)<1e-10)continue;
        const a=((bz-cz)*(x-cx)+(cx-bx)*(z-cz))/det,b=((cz-az)*(x-cx)+(ax-cx)*(z-cz))/det,c=1-a-b;
        if(Math.min(a,b,c)>=-1e-5)height=Math.max(height,a*roof[i+1]+b*roof[i+4]+c*roof[i+7]);
      }
      assert(height>.012+hunter.preyRadius+Math.sqrt(hunter.preyRadius**2-dx*dx-dz*dz),'the actual triangulated skin entirely covers the prey before absorption');
    }
    checkedCover=true;
  }
}
assert(checkedCover);assert(wideFlanks);for(const stage of ['FAN_OUT','ENCIRCLE','COVER','ABSORB','RECOVER'])assert(movement[stage]>.75,`${stage} retains active flock movement`);assert.equal(stages.size,6);assert(hunter.meals>=2,'the hunt repeats after digestion');
hunter.paused=true;const frozen=[hunter.time,hunter.feedingTime,hunter.preyX,hunter.preyZ];hunter.step(.2);assert.deepEqual([hunter.time,hunter.feedingTime,hunter.preyX,hunter.preyZ],frozen);
hunter.reset();assert.equal(hunter.meals,0);assert.equal(hunter.feeding,'HUNT');assert(hunter.autoPrey);
hunter.lure(-3,2);assert(!hunter.autoPrey);assert.deepEqual([hunter.preyX,hunter.preyZ],[-3,2]);
console.log('PASS moving lure, encirclement, full geometric prey coverage before absorption, repeated feeding, pause/reset and placed prey');

const loop=new Cutisling();loop.preyX=0;loop.preyZ=0;
for(let i=0;i<loop.count;i++){const angle=i%8*Math.PI/4;loop.x[i]=Math.cos(angle);loop.z[i]=Math.sin(angle);}
assert(!loop.surrounded(),'separate clumps in eight directions cannot capture');
for(let i=0;i<loop.count;i++){const angle=(i%48)/47*5.25;loop.x[i]=Math.cos(angle);loop.z[i]=Math.sin(angle);}
assert(!loop.surrounded(),'a horseshoe with an escape gap cannot capture');
for(let i=0;i<loop.count;i++){const angle=(i%48)/48*Math.PI*2;loop.x[i]=Math.cos(angle);loop.z[i]=Math.sin(angle);}
assert(loop.surrounded(),'a locally connected chain winding around prey closes the loop');
console.log('PASS persistent caps, rounded profiles on all boundaries, invisible drivers, irregular openings and bounded GPU uploads');
console.log('PASS hollow contact boundary and connected-loop requirement, including disconnected clumps and open horseshoe');

// Different boundary solvers follow identical motile trajectories, with distinct responses.
const experiments=['flock','elastic','viscous'].map(approach=>{
  const body=new Cutisling();body.tuning.approach=approach;body.tuning.hunting=false;
  return {body,skin:createCutislingMembrane(body,(x,z)=>body.surfaceLift(x,z),()=>body.opening)};
});
for(let frame=0;frame<720;frame++)for(const {body,skin} of experiments){body.step(1/60);skin.update();}
for(const {body,skin} of experiments){
  assert.equal(body.feeding,'HUNT');assert.equal(body.meals,0);assert.equal(body.opening.radius,0,'free flock mode has no artificial prey hole');
  assert.deepEqual(body.x,experiments[0].body.x,'changing the membrane solver preserves the underlying flock motion');
  for(const mesh of [skin.skin,skin.rim,skin.underside])assert(mesh.geometry.drawRange.count<=mesh.geometry.attributes.position.count);
}
assert.notDeepEqual(experiments[0].skin.boundaries,experiments[1].skin.boundaries,'elastic lag differs from direct flock following');
assert.notDeepEqual(experiments[0].skin.boundaries,experiments[2].skin.boundaries,'viscous smoothing differs from direct flock following');
const experiment=experiments[0];experiment.body.paused=true;
const topBefore=experiment.skin.skin.geometry.attributes.position.array[1];
experiment.body.tuning.thickness=.16;experiment.skin.update(true);
assert(experiment.skin.skin.geometry.attributes.position.array[1]>topBefore+.05,'paused adjustments rebuild the surface');
experiment.body.reset();assert.equal(experiment.body.tuning.thickness,.16,'reset preserves experiment settings');
for(const {skin} of experiments)skin.dispose();

// Sweep the full engulfment, especially onset and the tiny opening immediately before sealing.
for(const approach of ['flock','elastic','viscous']){
  const b=new Cutisling();b.tuning.approach=approach;
  for(let i=0;i<3600&&b.feeding!=='COVER';i++)b.step(1/60);
  assert.equal(b.feeding,'COVER');
  const skin=createCutislingMembrane(b,(x,z)=>b.surfaceLift(x,z),()=>b.opening);
  assert.strictEqual(skin.skin.material,skin.rim.material,'the vein field continues across the feeding lip');
  let lastLift=0;
  for(let i=0;i<=120;i++){
    b.feeding='COVER';b.feedingTime=b.tuning.engulfTime*i/120;b.time+=1/60;
    b.tuning.lipWidth=.14;b.tuning.mouthDetail=1.4;b.tuning.edgeDetail=1;
    skin.update();
    const lift=b.surfaceLift(b.preyX,b.preyZ);
    assert(lift-lastLift<.025,'the mound rises continuously without a sudden onset jump');lastLift=lift;
    let triangleArea=0;const positions=skin.skin.geometry.attributes.position.array;
    for(let j=0;j<skin.skin.geometry.drawRange.count*3;j+=9)triangleArea+=Math.abs((positions[j+3]-positions[j])*(positions[j+8]-positions[j+2])-(positions[j+6]-positions[j])*(positions[j+5]-positions[j+2]))*.5;
    const expectedArea=skin.boundaries.reduce((sum,loop)=>sum+polygonArea(loop),0);
    assert(Math.abs(expectedArea-triangleArea)<1e-4,'the entire phagocytosis surface stays filled, including final hole closure');
    for(const mesh of [skin.skin,skin.rim,skin.underside]){
      const {geometry}=mesh;assert(geometry.drawRange.count>0&&geometry.drawRange.count<=geometry.attributes.position.count);
      for(let j=0;j<geometry.drawRange.count*3;j++)assert(Number.isFinite(geometry.attributes.position.array[j]));
    }
  }
  skin.dispose();
}
console.log('PASS distinct membrane approaches, free flock, live paused tuning, continuous engulfment and extreme lip/edge settings');
