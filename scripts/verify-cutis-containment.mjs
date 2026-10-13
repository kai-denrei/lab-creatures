// Run in a browser served by Vite. Captures actual GPU-deformed vertices and checks
// core-to-triangle clearance plus odd/even containment, across 100 cycle samples.
export async function verifyContainment(low=false,rolling=false){
 const THREE=await import('three');const {CutisSwarm}=await import('../src/cutis/swarm/controller.ts');const {CUTIS_TIERS,GOROGORO_TIERS}=await import('../src/cutis/swarm/tiers.ts');const {createSwarmGeometry}=await import('../src/cutis/creature/geometry.ts');const {updateMaterial}=await import('../src/cutis/creature/material.ts');
 const swarm=new CutisSwarm({...CUTIS_TIERS[7].values}),model=createSwarmGeometry(swarm),level=model.levels[low?1:0],g=level.geometry;
 const gl=globalThis.document.createElement('canvas').getContext('webgl2');const shader=(type,src)=>{const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s};
 let src=level.material.vertexShader.split('void main(){')[0].replaceAll('attribute ','in ').replaceAll('varying ','out ');src='#version 300 es\nprecision highp float;\nin vec3 position;\n'+src+'\nout vec3 captured;void main(){captured=deform(normalize(position)).xyz;gl_Position=vec4(0,0,0,1);}';
 const program=gl.createProgram();gl.attachShader(program,shader(gl.VERTEX_SHADER,src));gl.attachShader(program,shader(gl.FRAGMENT_SHADER,'#version 300 es\nprecision highp float;out vec4 color;void main(){color=vec4(1);}'));gl.transformFeedbackVaryings(program,['captured'],gl.INTERLEAVED_ATTRIBS);gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));gl.useProgram(program);
 const pos=g.getAttribute('position'),buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,pos.array,gl.STATIC_DRAW);const loc=gl.getAttribLocation(program,'position');gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,3,gl.FLOAT,false,0,0);
 const out=gl.createBuffer(),data=new Float32Array(pos.count*3);gl.bindBuffer(gl.TRANSFORM_FEEDBACK_BUFFER,out);gl.bufferData(gl.TRANSFORM_FEEDBACK_BUFFER,data.byteLength,gl.DYNAMIC_READ);gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER,0,out);
 const set=(name,v)=>{const l=gl.getAttribLocation(program,name);if(l>=0){if(v.length===4)gl.vertexAttrib4fv(l,v);else gl.vertexAttrib3fv(l,v)}};
 function capturePose(){
 set('iOffset',swarm.offset.slice(0,3));set('iHeading',swarm.heading.slice(0,3));set('iPreviousHeading',swarm.previousHeading.slice(0,3));set('iAnchor',swarm.anchor.slice(0,3));set('iState',[swarm.phase[0],swarm.seed[0],swarm.scale[0],swarm.probeCount[0]*4+swarm.chosenProbe[0]]);set('iParams',swarm.params.slice(0,4));for(let j=0;j<3;j++)set('iProbe'+j,swarm['probe'+j].slice(0,3));
 gl.enable(gl.RASTERIZER_DISCARD);gl.beginTransformFeedback(gl.POINTS);gl.drawArrays(gl.POINTS,0,pos.count);gl.endTransformFeedback();gl.disable(gl.RASTERIZER_DISCARD);gl.getBufferSubData(gl.TRANSFORM_FEEDBACK_BUFFER,0,data);
 }
 const triangle=new THREE.Triangle(),point=new THREE.Vector3(),closest=new THREE.Vector3(),hit=new THREE.Vector3(),ray=new THREE.Ray(new THREE.Vector3(),new THREE.Vector3(.923,.231,.308).normalize()),indices=g.index.array,report=[];
 for(const tier of (rolling?GOROGORO_TIERS:CUTIS_TIERS).filter(t=>rolling||t.hard).flatMap(t=>[0,1,2,3].map(seed=>({...t,testSeed:seed})))){
 Object.assign(swarm.config,tier.values);swarm.reset(1);swarm.seed[0]+=tier.testSeed*23.71;swarm.step(1/120,{x:4,z:1});let minimum=Infinity,bad=[],plantedVertices=null;
 for(let phase=0;phase<1;phase+=.01){swarm.scrub(phase);updateMaterial(level.material,swarm.config,tier.testSeed*1.731);for(const [name,u] of Object.entries(level.material.uniforms)){if(typeof u.value==='number')gl.uniform1f(gl.getUniformLocation(program,name),u.value)}
 capturePose();
 if(rolling&&phase>.445&&phase<.695){
   if(!plantedVertices)plantedVertices=data.slice();
   const probe=swarm['probe'+swarm.chosenProbe[0]],angle=probe[0];
   const cap=Math.cos(Math.min(swarm.config.capAngle,swarm.probeCount[0]>1?32:85)*Math.PI/180);
   let checked=0;
   for(let v=0;v<pos.count;v++){
     const x=pos.getX(v),y=pos.getY(v),z=pos.getZ(v),length=Math.hypot(x,y,z);
     const q=Math.max(0,Math.min(1,((Math.sin(angle)*x+Math.cos(angle)*z)/length-cap)/(1-cap)));
     const lead=(q*q*(3-2*q))**2;
     if(lead<.78)continue;
     const k=v*3,drift=Math.hypot(data[k]-plantedVertices[k],data[k+1]-plantedVertices[k+1],data[k+2]-plantedVertices[k+2]);
     if(drift>1e-5)throw Error(`Planted cup slid ${drift} at ${phase} (${tier.id})`);
     checked++;
   }
   if(!checked)throw Error('No suction-cup vertices tested');
 }
 const core=swarm.getCoreContact(0);if(core.radius<=0)continue;point.set(core.center.x,core.center.y,core.center.z);ray.origin.copy(point);let distance=Infinity,hits=[];
 for(let k=0;k<indices.length;k+=3){triangle.a.fromArray(data,indices[k]*3);triangle.b.fromArray(data,indices[k+1]*3);triangle.c.fromArray(data,indices[k+2]*3);triangle.closestPointToPoint(point,closest);distance=Math.min(distance,closest.distanceTo(point));if(ray.intersectTriangle(triangle.a,triangle.b,triangle.c,false,hit))hits.push(hit.distanceTo(point));}
 hits.sort((a,b)=>a-b);const crossings=hits.filter((v,i)=>i===0||v-hits[i-1]>.000001).length;minimum=Math.min(minimum,distance/core.radius);if(distance<core.radius*.999||crossings%2!==1)bad.push({phase:+phase.toFixed(2),ratio:distance/core.radius,crossings});
 }
 if(rolling){
   for(const boundary of [.08,.44,.496,.68,.735,.9]){
     swarm.scrub(boundary-.000001);capturePose();const before=data.slice();
     swarm.scrub(boundary+.000001);capturePose();let jump=0;
     for(let v=0;v<data.length;v+=3)jump=Math.max(jump,Math.hypot(data[v]-before[v],data[v+1]-before[v+1],data[v+2]-before[v+2]));
     if(jump>tier.values.r0*.01)throw Error(`Phase ${boundary} discontinuity: ${jump} (${tier.id})`);
   }
   swarm.scrub(.99999);capturePose();const settled=data.slice();
   swarm.frozen=false;swarm.step(.001,{x:-6,z:-5});capturePose();
   let jump=0;for(let v=0;v<data.length;v+=3)jump=Math.max(jump,Math.hypot(data[v]-settled[v],data[v+1]-settled[v+1],data[v+2]-settled[v+2]));
   if(jump>tier.values.r0*.005)throw Error(`Cycle reset moved the surface by ${jump} (${tier.id})`);
 }
 report.push({tier:tier.id,minimum,bad});
 }model.dispose();gl.deleteBuffer(buffer);gl.deleteBuffer(out);gl.deleteProgram(program);gl.getExtension('WEBGL_lose_context')?.loseContext();if(report.some(r=>r.bad.length))throw new Error(JSON.stringify(report));return report;

}
