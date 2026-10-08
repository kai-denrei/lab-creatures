import * as THREE from 'three/webgpu';
import { positionWorld, uniform, smoothstep } from 'three/tsl';
import type { FeedingCycle } from './feeding.ts';
import { tissueColors } from './skin.ts';
import type { SoftBody } from '../physics/soft-body.js';

export function createMonsterAppearance(body:SoftBody,feeding?:FeedingCycle){
  const geometry=body.surface.geometry;
  geometry.setAttribute('color',new THREE.BufferAttribute(tissueColors(body.surface.positions,body.cage.limbCount??6),3));
  const material=new THREE.MeshPhysicalNodeMaterial({vertexColors:true,roughness:.26,metalness:0,transmission:.65,thickness:.012,ior:1.37,
    attenuationColor:'#939b72',attenuationDistance:.035,clearcoat:.65,clearcoatRoughness:.16,side:THREE.DoubleSide});
  const mesh=new THREE.Mesh(geometry,material);mesh.frustumCulled=false;mesh.castShadow=true;mesh.receiveShadow=true;
  if(feeding){
    const center=uniform(new THREE.Vector3()),coverage=uniform(0);
    const skin= smoothstep(.016,.040,positionWorld.xz.distance(center.xz));
    material.transmissionNode=skin.oneMinus().mul(coverage).oneMinus().mul(.65);
    mesh.onBeforeRender=()=>{center.value.copy(feeding.capturedPosition);coverage.value=feeding.skinCoverage*(feeding.phase==='recovering'?feeding.drop:1);};
  }
  return mesh;
}
