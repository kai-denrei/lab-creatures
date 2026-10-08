import * as THREE from 'three/webgpu';
import { attribute, uniform, mix } from 'three/tsl';
import { tissueColors } from './skin.ts';
import type { FeedingCycle } from './feeding.ts';

export const PREY_SHAPES=['sphere','cube','prism','dodecahedron'] as const;
export type PreyShape=typeof PREY_SHAPES[number];
export function preyGeometry(shape:PreyShape):THREE.BufferGeometry{
  switch(shape){
    case 'sphere':return new THREE.SphereGeometry(.011,24,16);
    case 'cube':return new THREE.BoxGeometry(.022,.022,.022);
    case 'prism':return new THREE.CylinderGeometry(.013,.013,.022,3);
    case 'dodecahedron':return new THREE.DodecahedronGeometry(.013);
  }
}
// Convex face planes let the physical membrane follow the same outline as
// the rendered prey, including the prism corners and polyhedron facets.
const profiles=new Map<PreyShape,THREE.Plane[]>();
function planes(shape:PreyShape){
  if(profiles.has(shape))return profiles.get(shape)!;
  const geometry=preyGeometry(shape),p=geometry.getAttribute('position'),indices=geometry.index;
  const result:THREE.Plane[]=[],a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();
  for(let i=0;i<(indices?.count??p.count);i+=3){
    a.fromBufferAttribute(p,indices?indices.getX(i):i);b.fromBufferAttribute(p,indices?indices.getX(i+1):i+1);c.fromBufferAttribute(p,indices?indices.getX(i+2):i+2);
    const plane=new THREE.Plane().setFromCoplanarPoints(a,b,c);
    if(plane.constant>0)plane.negate();
    if(!result.some(other=>other.normal.distanceToSquared(plane.normal)<1e-8&&Math.abs(other.constant-plane.constant)<1e-6))result.push(plane);
  }
  geometry.dispose();profiles.set(shape,result);return result;
}
export function preyImprint(shape:PreyShape,x:number,z:number){
  if(shape==='sphere')return Math.pow(Math.max(0,1-(Math.hypot(x,z)/.020)**2),1.3);
  x/=1.3;z/=1.3;
  let lower=-Infinity,upper=Infinity;
  for(const {normal:n,constant} of planes(shape)){
    const offset=-constant-n.x*x-n.z*z;
    if(Math.abs(n.y)<1e-6){if(offset<0)return 0;}
    else if(n.y>0)upper=Math.min(upper,offset/n.y);
    else lower=Math.max(lower,offset/n.y);
  }
  if(upper<lower)return 0;
  return .7*Math.max(0,Math.min(1,(upper+.011)/.022));
}
function wrappedGeometry(shape:PreyShape){
  const geometry=preyGeometry(shape);
  geometry.setAttribute('skinColor',new THREE.BufferAttribute(tissueColors(geometry.getAttribute('position').array),3));
  return geometry;
}
export function createPrey(){
  const coverage=uniform(0),red=new THREE.Color('#c94d38');
  // One precompiled material blends the original surface into opaque tissue.
  // No transparent overlay, material swap, or geometry shrink during ingestion.
  const material=new THREE.MeshPhysicalNodeMaterial({metalness:.45,roughness:.3,emissive:'#751e16',emissiveIntensity:.2,
    ior:1.37,clearcoatRoughness:.16});
  material.clearcoatNode=coverage.mul(.65);
  material.colorNode=mix(uniform(red),attribute('skinColor','vec3'),coverage);
  const mesh=new THREE.Mesh(wrappedGeometry('sphere'),material);
  mesh.castShadow=true;mesh.receiveShadow=true;let shape:PreyShape='sphere';
  return {mesh,update(feeding:FeedingCycle){
    if(shape!==feeding.shape){shape=feeding.shape;mesh.geometry.dispose();mesh.geometry=wrappedGeometry(shape);}
    const wrap=feeding.skinCoverage;coverage.value=wrap;
    material.metalness=.45*(1-wrap);material.roughness=.3-.04*wrap;
    material.emissiveIntensity=.2*(1-wrap);
    mesh.position.copy(feeding.preyPosition);mesh.scale.setScalar(feeding.scale);mesh.visible=feeding.visible;
  }};
}
