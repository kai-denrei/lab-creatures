import { BufferAttribute, Color, Mesh, MeshPhysicalNodeMaterial } from 'three/webgpu';
import { attribute } from 'three/tsl';
import { SoftBody } from '../physics/soft-body.js';
import { parseCage } from '../physics/cage-model.ts';
import { CrawlerLocomotion } from './locomotion.ts';
import type { CrawlerKind } from './locomotion.ts';
const models={
  slug:[new URL('../assets/model/slug.bin',import.meta.url),new URL('../assets/model/slug.json',import.meta.url)],
  'flat-snake':[new URL('../assets/model/flat-snake.bin',import.meta.url),new URL('../assets/model/flat-snake.json',import.meta.url)],
};
export async function createCrawler(kind:CrawlerKind){
  const [data,metadata]=await Promise.all(models[kind].map(url=>fetch(url)));
  if(!data.ok||!metadata.ok)throw new Error(`Could not load ${kind} geometry`);
  const body=new SoftBody(parseCage(await data.arrayBuffer(),await metadata.json())),rig=new CrawlerLocomotion(body,kind);
  const colors=new Float32Array(body.surface.positions.length),slug=kind==='slug';
  const light=new Color(slug?'#c8aa75':'#92b9af'),dark=new Color(slug?'#645138':'#334e56'),color=new Color();
  for(let i=0;i<colors.length;i+=3){
    const x=body.surface.positions[i],y=body.surface.positions[i+1],z=body.surface.positions[i+2];
    const stripe=slug?Math.exp(-((x/.010)**2))*.65:.4+.35*Math.cos(z*200+x*90);
    color.copy(light).lerp(dark,Math.max(0,Math.min(.85,stripe+y*4)));color.toArray(colors,i);
  }
  body.surface.geometry.setAttribute('color',new BufferAttribute(colors,3));
  const material=new MeshPhysicalNodeMaterial({vertexColors:true,roughness:.22,transmission:slug?.48:.38,thickness:.012,ior:1.36,clearcoat:.65,clearcoatRoughness:.12});
  material.thicknessNode=attribute('opticalThickness','float');
  const mesh=new Mesh(body.surface.geometry,material);mesh.frustumCulled=false;
  return {body,rig,mesh,group:mesh,cameraScale:slug?2:2.8,absorption:slug?[12,24,45]:[30,17,14],update:()=>{},
    dispose:()=>{mesh.geometry.dispose();material.dispose();body.cage.opticalSurface.geometry.dispose();},
  };
}
