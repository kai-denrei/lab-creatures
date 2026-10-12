export const LAB_VARIANTS=[
  {id:'aculis',name:'Aculis',family:'Arthropod',description:'Six spindly legs, segmented abdomen, compound eyes and paired antennae.'},
  {id:'oculus',name:'Oculus',family:'Arthropod',description:'One compound eye forms the entire head. One antenna, a reduced trunk and six oversized jointed legs.'},
  {id:'monoculus',name:'Monoculus',family:'Arthropod',description:'A minute compound eye and tiny abdomen. Six long jointed legs carry a thin, continuous membrane.'},
  {id:'isopod',name:'Giant Isopod',family:'Arthropod',description:'Broad overlapping armor, fourteen walking legs, two antenna pairs and a tail fan.'},
  {id:'veil',name:'Veil',family:'Membrane',description:'A flat, eyeless sheet, webbed to every tip. Uneven elastic extensions build into sudden bursts.'},
] as const;
export type LabVariant=typeof LAB_VARIANTS[number]['id'];
export function selectedLabVariant(){return LAB_VARIANTS.find(v=>v.id===new URLSearchParams(location.search).get('breed'))??LAB_VARIANTS[0];}
export const LAB_ARENA={radius:1.1,travelRadius:.78,lureRadius:.76};
