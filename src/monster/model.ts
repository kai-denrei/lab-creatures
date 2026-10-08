import { parseCage } from '../physics/cage-model.ts';
import type { ModelManifest } from '../physics/cage-model.ts';
export async function loadMonsterCage(){
  const [binary,metadata]=await Promise.all([
    fetch(new URL('../assets/model/nih-dairia.bin',import.meta.url)),
    fetch(new URL('../assets/model/nih-dairia.json',import.meta.url)),
  ]);
  if(!binary.ok||!metadata.ok)throw new Error('Could not load Nih-Dairia geometry');
  return parseCage(await binary.arrayBuffer(),await metadata.json() as ModelManifest);
}
