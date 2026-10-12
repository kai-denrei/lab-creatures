export type Variable={key:string;group:string;min:number;max:number;unit:string;optional?:boolean};
export type SettingsDocument={schema:'lab-creatures/settings';version:1;family:string;specimen:string;group:string;units:Record<string,string>;values:Record<string,number>};
export function settingsDocument(family:string,specimen:string,controls:readonly Variable[],values:Record<string,number>,group='all'):SettingsDocument{
  const selected=controls.filter(c=>group==='all'||c.group===group);
  return {schema:'lab-creatures/settings',version:1,family,specimen,group,units:Object.fromEntries(selected.map(c=>[c.key,c.unit.trim()])),values:Object.fromEntries(selected.map(c=>[c.key,values[c.key]]))};
}
/** Validate the entire payload before applying anything. Partial groups never reset other values. */
export function readSettings(text:string,family:string,controls:readonly Variable[],group='all'):Record<string,number>{
  if(text.length>64000)throw new Error('Settings are too large.');
  const data=JSON.parse(text);
  // Accept existing Nih-Dairia exports as well as the common format.
  const legacy=family==='soft-body'&&data?.version===1&&data.motion&&data.schema===undefined;
  if(!legacy&&(data?.schema!=='lab-creatures/settings'||data.version!==1||data.family!==family))throw new Error('Use settings from this creature family.');
  if(!legacy&&group!=='all'&&data.group!=='all'&&data.group!==group)throw new Error(`Choose ${group} settings or all settings.`);
  const values=legacy?data.motion:data.values;
  if(!values||typeof values!=='object'||Array.isArray(values))throw new Error('Missing settings values.');
  const selected=controls.filter(c=>(group==='all'?legacy||data.group==='all'||c.group===data.group:c.group===group));
  if(!selected.length)throw new Error('Unknown settings group.');
  const result:Record<string,number>={};
  for(const c of selected){
    const value=values[c.key];
    if(c.optional&&value===undefined)continue;
    if(legacy&&['grip','sweep'].includes(c.key)&&value===undefined)continue;
    if(typeof value!=='number'||!Number.isFinite(value))throw new Error(`Missing or invalid ${c.key}.`);
    result[c.key]=Math.max(c.min,Math.min(c.max,value));
  }
  return result;
}
export function download(data:BlobPart,name:string,type='application/json'){
  const url=URL.createObjectURL(new Blob([data],{type})),link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
