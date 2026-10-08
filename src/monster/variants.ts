export const CREATURE_VARIANTS=[
  {id:'nih-dairia',name:'Nih-Dairia · ancestor',limbs:6,description:'Six limbs and a balanced abdomen. The reference body plan.'},
  {id:'brood',name:'Brood · heavy abdomen',limbs:6,description:'Six limbs, a broader abdomen and thicker tissue. A heavy-bodied relative.'},
  {id:'reed',name:'Reed · four limbs',limbs:4,description:'Four limbs and a reduced, thin abdomen. A spare, open silhouette.'},
  {id:'crown',name:'Crown · eight limbs',limbs:8,description:'Eight limbs around a wider core. More support points and a denser silhouette.'},
] as const;
export type CreatureVariant=typeof CREATURE_VARIANTS[number]['id'];
export function selectedVariant(){
  const params=new URLSearchParams(location.search);
  return CREATURE_VARIANTS.find(v=>params.get('specimen')==='creature-lab'&&v.id===params.get('variant'))??CREATURE_VARIANTS[0];
}
