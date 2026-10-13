import { CREATURE_VARIANTS } from '../monster/variants.ts';
import { LAB_VARIANTS } from '../arthropods/variants.ts';
export const SPECIMENS=[
  {id:'evasion-game',name:'Evasion Game',family:'Playground',description:'Control Reed with WASD. Escape twelve rolling Gorogoro: avoid slowing appendages, body pins and phagocytosis.',url:'?specimen=evasion-game'},
  {id:'cutis-gorogoro',name:'Cutis-gorogoro',family:'Membranes',description:'A pearl-bearing membrane that launches from its foothold, rolls another full reach, and recoils into rest.',url:'?specimen=cutis-gorogoro'},
  {id:'cutis-maku-pearl',name:'Cutis-Maku · Pearl',family:'Membranes',description:'The eight belt tiers with smaller pearl spheres inside every hard-bodied creature.',url:'?specimen=cutis-maku-pearl'},
  {id:'cutis-maku-k',name:'Cutis-Maku-K',family:'Membranes',description:'Eight belt tiers: small, pale soft bodies through black membranes carrying a rigid red core.',url:'?specimen=cutis-maku-k'},
  {id:'cutis-maku',name:'Cutis-Maku',family:'Membranes',description:'A veined, living membrane. A slow reach fixes its anchor; the body snaps through and reforms.',url:'?specimen=cutis-maku'},
  ...LAB_VARIANTS.map(v=>({id:v.id,name:v.name,family:v.family==='Membrane'?'Membranes':'Arthropods',description:v.description,url:`?specimen=arthropod-lab&breed=${v.id}`})),
  ...CREATURE_VARIANTS.map(v=>({id:v.id,name:v.name.split(' · ')[0],family:'Soft bodies',description:v.description,url:`?specimen=creature-lab&variant=${v.id}`})),
  {id:'slug',name:'Slug',family:'Crawlers',description:'A low, muscular body with a continuous crawling foot.',url:'?specimen=jelly-baby&creature=slug'},
  {id:'flat-snake',name:'Flat Snake',family:'Crawlers',description:'A flattened, elongated crawler with a rippling body.',url:'?specimen=jelly-baby&creature=flat-snake'},
  {id:'jelly-baby',name:'Jelly Baby',family:'Playground',description:'The original soft-body creature. Walk, jump and stretch.',url:'?specimen=jelly-baby'},
];
