import { KIT_SOURCES, KIT_ASSETS, kitScaffold } from './kit-files.ts';
import { createZip } from './zip.ts';
import type { CreatureVariant } from './variants.ts';
import type { MotionSettings } from './motion-settings.ts';

const sources=import.meta.glob<string>([
  '../../LICENSE',
  './portable.ts','./behavior.ts','./gait.ts','./pursuit.ts','./motion-settings.ts','./appearance.ts','./model.ts','./auto-lure.ts','./arena.ts','./feeding.ts','./prey.ts','./skin.ts','./traction.ts','./limb-separation.ts','./cradle.ts','./variants.ts',
  '../physics/soft-body.js','../physics/soft-body-kernel.js','../physics/deform-surface.js','../physics/constants.js','../physics/cage-model.ts',
  '../game/fixed-step.ts','../graphics/renderer.ts','../../scripts/native/soft-body-kernel.c','../../scripts/build-kernel.mjs','../../scripts/build-monster.mjs','../../scripts/model-cage.mjs',
],{query:'?raw',import:'default'});
export async function exportCreatureKit(settings:MotionSettings,variant:CreatureVariant='nih-dairia'){
  const encoder=new TextEncoder();
  const files=await Promise.all(Object.entries(sources).map(async([path,read])=>({
    name:path.startsWith('../../')?path.slice(6):path.startsWith('../')?`src/${path.slice(3)}`:`src/monster/${path.slice(2)}`,
    data:encoder.encode(await read()),
  })));
  for(const name of KIT_SOURCES)if(!files.some(file=>file.name===name))throw new Error(`Missing kit source: ${name}`);
  const assets=[new URL('../assets/model/nih-dairia.bin',import.meta.url),new URL('../assets/model/nih-dairia.json',import.meta.url),new URL('../assets/model/brood.bin',import.meta.url),new URL('../assets/model/brood.json',import.meta.url),new URL('../assets/model/reed.bin',import.meta.url),new URL('../assets/model/reed.json',import.meta.url),new URL('../assets/model/crown.bin',import.meta.url),new URL('../assets/model/crown.json',import.meta.url)];
  const binaries=await Promise.all(assets.map(async(url,i)=>{const response=await fetch(url);if(!response.ok)throw new Error('Could not load creature model for export');return {name:KIT_ASSETS[i],data:new Uint8Array(await response.arrayBuffer())};}));
  for(const [name,data] of Object.entries(kitScaffold(settings,variant)))files.push({name,data:encoder.encode(data)});
  const blob=new Blob([createZip([...files,...binaries])],{type:'application/zip'});
  const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='nih-dairia-creature-kit.zip';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
