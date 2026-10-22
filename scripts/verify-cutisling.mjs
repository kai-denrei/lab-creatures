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
