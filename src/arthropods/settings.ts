import type { LabVariant } from './variants.ts';
export const PREDATOR_CONTROLS=[
  {key:'speed',label:'Overall pace',min:.3,max:3.6,step:.1,value:1.8,unit:'×',group:'Movement'},
  {key:'turnRate',label:'Turn speed',min:.4,max:5,step:.1,value:2.5,unit:'×',group:'Movement'},
  {key:'footLift',label:'Foot lift',min:8,max:70,step:1,value:35,unit:' mm',group:'Movement'},
  {key:'detection',label:'Notice radius',min:100,max:1000,step:10,value:500,unit:' mm',group:'Instinct'},
  {key:'fear',label:'Fear / startle',min:0,max:4,step:.1,value:2,unit:'×',group:'Instinct'},
  {key:'hesitation',label:'Hesitation',min:.15,max:6,step:.05,value:3,unit:' s',group:'Instinct'},
  {key:'aggression',label:'Aggression',min:0,max:4,step:.1,value:2,unit:'×',group:'Instinct'},
  {key:'erratic',label:'Feints / unpredictability',min:0,max:4,step:.1,value:2,unit:'×',group:'Instinct'},
  {key:'rushSpeed',label:'Rush speed',min:1.5,max:12,step:.1,value:6,unit:'×',group:'Attack'},
  {key:'burst',label:'Rush duration',min:.2,max:3.2,step:.05,value:1.6,unit:' s',group:'Attack'},
  {key:'recovery',label:'Recovery pause',min:.2,max:6,step:.1,value:3,unit:' s',group:'Attack'},
  {key:'lowering',label:'Body lowering',min:0,max:76,step:1,value:38,unit:' mm',group:'Posture'},
  {key:'abdomen',label:'Abdomen tuck',min:0,max:3,step:.1,value:1.5,unit:'×',group:'Posture'},
  {key:'lureSpeed',label:'Auto lure speed',min:.2,max:4,step:.1,value:2,unit:'×',group:'Lure'},
  {key:'lureRange',label:'Auto lure range',min:80,max:560,step:10,value:280,unit:' mm',group:'Lure'},
] as const;
export type SettingKey=typeof PREDATOR_CONTROLS[number]['key'];
export type PredatorSettings=Record<SettingKey,number>;
export const DEFAULT_SETTINGS=Object.fromEntries(PREDATOR_CONTROLS.map(control=>[control.key,control.value])) as PredatorSettings;
export const PRESETS:Record<string,Partial<PredatorSettings>>={
  ambush:{fear:1,hesitation:1.3,aggression:1.3,erratic:.6,rushSpeed:5,burst:.65,recovery:1.4,lowering:34,abdomen:1.1},
  wary:{fear:1.8,hesitation:2,aggression:.55,erratic:.8,rushSpeed:3,burst:.45,recovery:1.8,lowering:24,abdomen:.8},
  feral:{fear:.7,hesitation:.35,aggression:1.9,erratic:1.8,rushSpeed:5.5,burst:1,recovery:.45,lowering:32,abdomen:1.3},
};
export function defaultSettings(breed:LabVariant='aculis'):PredatorSettings{
  return (breed==='oculus'||breed==='monoculus')?{...Object.fromEntries(PREDATOR_CONTROLS.map(c=>[c.key,c.max])),footLift:10,burst:1.5,recovery:3} as PredatorSettings:{...DEFAULT_SETTINGS};
}
const storageKey=(breed:LabVariant)=>`${breed}-instinct-v${breed==='oculus'?3:2}`;
export function sanitizeSettings(value:unknown,breed:LabVariant='aculis'):PredatorSettings{
  const result=defaultSettings(breed);
  if(value&&typeof value==='object')for(const control of PREDATOR_CONTROLS){
    const n=(value as Record<string,unknown>)[control.key];
    if(typeof n==='number'&&Number.isFinite(n))result[control.key]=Math.max(control.min,Math.min(control.max,n));
  }
  return result;
}
export function loadPredatorSettings(breed:LabVariant='aculis'){try{return sanitizeSettings(JSON.parse(localStorage.getItem(storageKey(breed))||'null'),breed);}catch{return defaultSettings(breed);}}
export function savePredatorSettings(settings:PredatorSettings,breed:LabVariant='aculis'){try{localStorage.setItem(storageKey(breed),JSON.stringify(settings));}catch{/* Controls still work when storage is unavailable. */}}
export function formatSetting(control:typeof PREDATOR_CONTROLS[number],value:number){return `${Number(value.toFixed(2))}${control.unit}`;}
