import { CREATURE_VARIANTS } from '../monster/variants.ts';
import { LAB_VARIANTS } from '../arthropods/variants.ts';
export const SPECIMENS=[
  {id:'cutis-maku',name:'Cutis-Maku',family:'Membranes',description:'A veined, living membrane. A slow reach fixes its anchor; the body snaps through and reforms.',url:'?specimen=cutis-maku'},
  ...LAB_VARIANTS.map(v=>({id:v.id,name:v.name,family:v.family==='Membrane'?'Membranes':'Arthropods',description:v.description,url:`?specimen=arthropod-lab&breed=${v.id}`})),
  ...CREATURE_VARIANTS.map(v=>({id:v.id,name:v.name.split(' · ')[0],family:'Soft bodies',description:v.description,url:`?specimen=creature-lab&variant=${v.id}`})),
  {id:'slug',name:'Slug',family:'Crawlers',description:'A low, muscular body with a continuous crawling foot.',url:'?specimen=jelly-baby&creature=slug'},
  {id:'flat-snake',name:'Flat Snake',family:'Crawlers',description:'A flattened, elongated crawler with a rippling body.',url:'?specimen=jelly-baby&creature=flat-snake'},
  {id:'jelly-baby',name:'Jelly Baby',family:'Playground',description:'The original soft-body creature. Walk, jump and stretch.',url:'?specimen=jelly-baby'},
];
