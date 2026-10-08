import { writeFileSync } from 'node:fs';
import { Buffer } from 'node:buffer';
import * as THREE from 'three/webgpu';
import { buildCage } from './model-cage.mjs';

for(const [name,halfLength,width,height] of [['slug',.085,.027,.014],['flat-snake',.15,.019,.0055]]){
 const positions=[0,.002,halfLength],indices=[],rings=72,sides=32;
 const taper=t=>name==='slug'?.78+.22*(t+1)/2:.72+.28*(t+1)/2;
 for(let ring=1;ring<rings;ring++){
  const theta=ring/rings*Math.PI,t=Math.cos(theta),r=Math.sin(theta);
  for(let side=0;side<sides;side++){
   const angle=side/sides*Math.PI*2;
   positions.push(width*taper(t)*r*Math.cos(angle),.002+height*r*(1+Math.sin(angle)),halfLength*t);
  }
 }
 const end=positions.length/3;positions.push(0,.002,-halfLength);
 for(let side=0;side<sides;side++){
  const next=(side+1)%sides;indices.push(0,1+side,1+next);
  for(let ring=0;ring<rings-2;ring++){
   const a=1+ring*sides+side,b=1+ring*sides+next;
   indices.push(a,a+sides,b,b,a+sides,b+sides);
  }
  indices.push(end,1+(rings-2)*sides+next,1+(rings-2)*sides+side);
 }
 let volume=0;
 for(let i=0;i<indices.length;i+=3){const a=new THREE.Vector3().fromArray(positions,indices[i]*3),b=new THREE.Vector3().fromArray(positions,indices[i+1]*3),c=new THREE.Vector3().fromArray(positions,indices[i+2]*3);volume+=a.dot(b.cross(c))/6;}
 if(volume<0){for(let i=0;i<indices.length;i+=3)[indices[i+1],indices[i+2]]=[indices[i+2],indices[i+1]];volume=-volume;}
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setIndex(indices);geometry.computeVertexNormals();
 const sdf=p=>{const t=p.z/halfLength,r=Math.sqrt(Math.max(0,1-t*t));return Math.max(Math.abs(t)-1,(p.x/(width*taper(Math.max(-1,Math.min(1,t)))))**2+((p.y-.002-height*r)/height)**2-r*r);};
 const arrays={positions:new Float32Array(positions),normals:geometry.attributes.normal.array,indices:new Uint32Array(indices),...buildCage(positions,1,0,sdf,volume)};
 // Optical and visible surfaces share topology, so thickness interpolation is identity.
 const thicknessIds=new Uint32Array(positions.length),thicknessWeights=new Float32Array(positions.length);
 for(let i=0;i<positions.length/3;i++){thicknessIds[i*3]=i;thicknessWeights[i*3]=1;}
 Object.assign(arrays,{opticalPositions:arrays.positions,opticalNormals:arrays.normals,opticalIndices:arrays.indices,opticalBindingIds:arrays.bindingIds,opticalBindingWeights:arrays.bindingWeights,thicknessIds,thicknessWeights});
 const chunks=[],layout={};let offset=0;
 for(const [key,array] of Object.entries(arrays)){const padding=(8-offset%8)%8;if(padding){chunks.push(Buffer.alloc(padding));offset+=padding;}layout[key]={offset,length:array.length,type:array.constructor.name};chunks.push(Buffer.from(array.buffer,array.byteOffset,array.byteLength));offset+=array.byteLength;}
 writeFileSync(`src/assets/model/${name}.bin`,Buffer.concat(chunks));
 writeFileSync(`src/assets/model/${name}.json`,JSON.stringify({sourceHash:`${name}-crawler-v1`,volume,layout},null,2));
 console.log(name,{vertices:positions.length/3,volume});
}
