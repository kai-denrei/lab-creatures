import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { TextEncoder } from 'node:util';
import { KIT_SOURCES, KIT_ASSETS, kitScaffold } from '../src/monster/kit-files.ts';
import { DEFAULT_MOTION, MOTION_CONTROLS, normalizeMotion } from '../src/monster/motion-settings.ts';
import { CREATURE_VARIANTS } from '../src/monster/variants.ts';
import { createZip } from '../src/monster/zip.ts';

let settings=DEFAULT_MOTION,variant='nih-dairia';
if(process.argv[2]){
  const preset=JSON.parse(readFileSync(process.argv[2],'utf8'));
  if(preset?.version!==1||!preset.motion||!MOTION_CONTROLS.every(({key})=>['grip','sweep'].includes(key)&&preset.motion[key]===undefined||typeof preset.motion[key]==='number'&&Number.isFinite(preset.motion[key])))throw new Error('Expected an exported Nih-Dairia motion settings file');
  settings=normalizeMotion(preset.motion);
  if(preset.variant){if(!CREATURE_VARIANTS.some(v=>v.id===preset.variant))throw new Error('Unknown creature variant');variant=preset.variant;}
}
const files=[...KIT_SOURCES,...KIT_ASSETS].map(name=>({name,data:new Uint8Array(readFileSync(name))}));
for(const [name,data] of Object.entries(kitScaffold(settings,variant)))files.push({name,data:new TextEncoder().encode(data)});
mkdirSync('dist-exports',{recursive:true});writeFileSync('dist-exports/nih-dairia-creature-kit.zip',createZip(files));
console.log('Exported dist-exports/nih-dairia-creature-kit.zip');
