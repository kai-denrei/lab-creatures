import * as THREE from 'three/webgpu';
import { MarchingCubes } from 'three/addons/objects/MarchingCubes.js';
import type { SoftBody } from '../physics/soft-body.js';
import type { FeedingCycle } from './feeding.ts';
import { tissueColors } from './skin.ts';

const smooth=(x:number)=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
/** One fused, wet tissue volume. Contact feeds a lower pool, successive folds
 * pile upward, and the advancing lips meet over the stationary prey. */
export function createBiomassFlow(body:SoftBody,feeding:FeedingCycle){
  const material=new THREE.MeshPhysicalNodeMaterial({vertexColors:true,roughness:.22,metalness:0,transmission:.18,thickness:.009,ior:1.37,clearcoat:1,clearcoatRoughness:.12,attenuationColor:'#939b72',attenuationDistance:.035});
  const mesh=new MarchingCubes(40,material,false,true,16000);
  mesh.name='Ovum / accumulating contact tissue';mesh.scale.setScalar(.055);mesh.visible=false;mesh.frustumCulled=false;mesh.castShadow=true;mesh.receiveShadow=true;
  const anchor=new THREE.Vector3();let lastRevision=-1,lastMass=-1;
  const add=(x:number,y:number,z:number,radius:number)=>{
    if(radius<.001)return;
    mesh.addBall(.5+x/.11,.5+y/.11,.5+z/.11,(radius/.11)**2*92,12);
  };
  function update(){
    const mass=feeding.viscous?feeding.biomass:0;
    mesh.visible=mass>.005&&feeding.locked;
    if(!mesh.visible){lastMass=-1;return;}
    if(lastRevision===body.surfaceRevision&&lastMass===mass)return;
    lastRevision=body.surfaceRevision;lastMass=mass;
    mesh.position.copy(feeding.capturedPosition);mesh.reset();
    const heading=feeding.contactDirection,p=body.surface.positions;
    let nearest=Infinity;
    for(let i=0;i<p.length;i+=6){
      const x=p[i]-mesh.position.x,y=p[i+1]-mesh.position.y,z=p[i+2]-mesh.position.z;
      const distance=x*x+y*y+z*z;
      if(distance<nearest){nearest=distance;anchor.set(x,y,z);}
    }
    // A broad root stays embedded in the physical skin; all flowing folds fuse
    // into that root, so no unattached droplets appear around the meal.
    const nearX=-heading.x*.016,nearZ=-heading.z*.016;
    for(let i=0;i<4;i++){const t=i/3;add(anchor.x*(1-t)+nearX*t,anchor.y*(1-t)-.003*t,anchor.z*(1-t)+nearZ*t,.007+mass*.005);}
    const spread=smooth(mass/.65),stack=smooth((mass-.12)/.65);
    for(const side of [-1,1])for(let i=0;i<9;i++){
      const along=i/8,arrival=smooth((spread-along*.75)/.25);if(arrival===0)continue;
      const angle=Math.PI-side*along*Math.PI;
      const radius=.012+Math.sin(angle)*.002;
      const x=heading.x*Math.cos(angle)*radius-heading.z*Math.sin(angle)*radius;
      const z=heading.z*Math.cos(angle)*radius+heading.x*Math.sin(angle)*radius;
      // Three overlapping folds arrive at different times and accumulate upward.
      for(let layer=0;layer<3;layer++){
        const load=smooth((mass-layer*.16-along*.18)/.38)*arrival;
        const y=-.006+layer*.006*stack+Math.sin(along*Math.PI)*.002;
        add(x*(1-layer*.12*stack),y,z*(1-layer*.12*stack),(.004+load*.005)*Math.sqrt(load));
      }
    }
    // The last material flows across the roof only after the lateral folds meet.
    const roof=smooth((mass-.55)/.45);
    add(0,.007+roof*.004,0,.016*roof);
    mesh.update();
    const positions=mesh.geometry.getAttribute('position').array,colors=mesh.geometry.getAttribute('color').array;
    // MarchingCubes owns fixed buffers; clamp the wet pool to the tabletop.
    for(let i=1;i<mesh.count*3;i+=3)positions[i]=Math.max(positions[i],(.001-mesh.position.y)/.055);
    const pigments=tissueColors(positions.subarray(0,mesh.count*3));colors.set(pigments);
    mesh.geometry.attributes.position.needsUpdate=true;mesh.geometry.attributes.color.needsUpdate=true;
  }
  return {mesh,update};
}
