import { writeFileSync } from 'node:fs';
import { Buffer } from 'node:buffer';
import * as THREE from 'three/webgpu';
import { buildCage } from './model-cage.mjs';

// Elevated body, raised knees and descending distal legs. Height follows actual
// radius, so the membrane between the roots stays aloft instead of forming a skirt.
const model=process.argv[2]??'nih-dairia';
const profiles={'nih-dairia':{limbs:6,abdomen:.021,thickness:.0065},brood:{limbs:6,abdomen:.031,thickness:.010},reed:{limbs:4,abdomen:.015,thickness:.005},crown:{limbs:8,abdomen:.023,thickness:.0055},ovum:{limbs:6,abdomen:.026,thickness:.006,bulge:.026},sept:{limbs:7,abdomen:.021,thickness:.006},filament:{limbs:6,abdomen:.007,thickness:.0038,power:7},globulifer:{limbs:6,abdomen:.020,thickness:.006,dorsal:true}};
const profile=profiles[model];if(!profile)throw new Error('Unknown creature profile');
const angles=profile.limbs===7?196:192,rings=24,positions=[],indices=[];
const radius=a=>profile.abdomen+(.088-profile.abdomen)*Math.pow((1+Math.cos(a*profile.limbs))/2,profile.power??4);
const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
const height=r=>r<.046?.044+.012*smooth(r/.046):.056-.054*smooth((r-.046)/.042);
const thickness=(r,x=0,z=0)=>(profile.thickness+(profile.bulge??0)*Math.sqrt(Math.max(0,1-(x/.047)**2-(z/.019)**2)))*Math.sqrt(Math.max(0,1-r*r));
for(const side of [1,-1])for(let r=0;r<=rings;r++)for(let a=0;a<angles;a++) {
  const rho=Math.max(.0001,r/rings),angle=a/angles*Math.PI*2;
  const reach=radius(angle)*rho;
  positions.push(Math.cos(angle)*reach,height(reach)+side*thickness(rho,Math.cos(angle)*reach,Math.sin(angle)*reach),Math.sin(angle)*reach);
}
const layer=(rings+1)*angles;
for(let side=0;side<2;side++)for(let r=0;r<rings;r++)for(let a=0;a<angles;a++) {
  const i=side*layer+r*angles+a,j=side*layer+r*angles+(a+1)%angles;
  if(side===0)indices.push(i,j,i+angles,j,j+angles,i+angles);
  else indices.push(i,i+angles,j,j,i+angles,j+angles);
}
// Weld the shared rim and tiny center rings, then orient outward.
const welded=[],map=new Map(),remap=[];
positions.forEach((_,i)=>{if(i%3)return;const p=positions.slice(i,i+3);const key=p.map(x=>Math.round(x*1e8)).join(',');
  if(!map.has(key)){map.set(key,welded.length/3);welded.push(...p);}remap.push(map.get(key));});
const triangles=[];
for(let i=0;i<indices.length;i+=3){const t=indices.slice(i,i+3).map(x=>remap[x]);if(new Set(t).size===3)triangles.push(...t);}
// Close each center with a fan.
for(let side=0;side<2;side++)for(let a=1;a<angles-1;a++) {
  const ids=[remap[side*layer],remap[side*layer+a],remap[side*layer+a+1]];
  triangles.push(...(side===0?ids.toReversed():ids));
}
const geometry=new THREE.BufferGeometry();
geometry.setAttribute('position',new THREE.Float32BufferAttribute(welded,3));geometry.setIndex(triangles);geometry.computeVertexNormals();
let volume=0;
for(let i=0;i<triangles.length;i+=3){const a=new THREE.Vector3().fromArray(welded,triangles[i]*3),b=new THREE.Vector3().fromArray(welded,triangles[i+1]*3),c=new THREE.Vector3().fromArray(welded,triangles[i+2]*3);volume+=a.dot(b.cross(c))/6;}
if(volume<0){for(let i=0;i<triangles.length;i+=3)[triangles[i+1],triangles[i+2]]=[triangles[i+2],triangles[i+1]];geometry.setIndex(triangles);geometry.computeVertexNormals();volume=-volume;}
const sdf=p=>{const reach=Math.hypot(p.x,p.z),rho=reach/radius(Math.atan2(p.z,p.x));return Math.max((rho-1)*.03,Math.abs(p.y-height(reach))-thickness(Math.min(1,rho),p.x,p.z));};
const arrays={positions:new Float32Array(welded),normals:geometry.attributes.normal.array,indices:new Uint32Array(triangles),...buildCage(welded,1,0,sdf,volume)};
// The first experiment uses the same surface for its optional optical interface.
Object.assign(arrays,{opticalPositions:arrays.positions,opticalNormals:arrays.normals,opticalIndices:arrays.indices,opticalBindingIds:arrays.bindingIds,opticalBindingWeights:arrays.bindingWeights,
  thicknessIds:new Uint32Array(welded.length),thicknessWeights:new Float32Array(welded.length)});
const chunks=[],layout={};let offset=0;
for(const [name,array] of Object.entries(arrays)){const padding=(8-offset%8)%8;if(padding){chunks.push(Buffer.alloc(padding));offset+=padding;}layout[name]={offset,length:array.length,type:array.constructor.name};chunks.push(Buffer.from(array.buffer,array.byteOffset,array.byteLength));offset+=array.byteLength;}
writeFileSync(`src/assets/model/${model}.bin`,Buffer.concat(chunks));
writeFileSync(`src/assets/model/${model}.json`,JSON.stringify({sourceHash:`${model}-spider-v3`,limbCount:profile.limbs,dorsal:profile.dorsal??false,volume,layout},null,2));
console.log({vertices:welded.length/3,triangles:triangles.length/3,volume});
