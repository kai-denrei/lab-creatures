import { parseCage } from '../physics/cage-model.ts';
import type { ModelManifest } from '../physics/cage-model.ts';
const models={
  'nih-dairia':[new URL('../assets/model/nih-dairia.bin',import.meta.url),new URL('../assets/model/nih-dairia.json',import.meta.url)],
  brood:[new URL('../assets/model/brood.bin',import.meta.url),new URL('../assets/model/brood.json',import.meta.url)],
  reed:[new URL('../assets/model/reed.bin',import.meta.url),new URL('../assets/model/reed.json',import.meta.url)],
  crown:[new URL('../assets/model/crown.bin',import.meta.url),new URL('../assets/model/crown.json',import.meta.url)],
};
export async function loadMonsterCage(variant:keyof typeof models='nih-dairia'){
  const [binary,metadata]=await Promise.all([
    fetch(models[variant][0]),
    fetch(models[variant][1]),
  ]);
  if(!binary.ok||!metadata.ok)throw new Error('Could not load Nih-Dairia geometry');
  return parseCage(await binary.arrayBuffer(),await metadata.json() as ModelManifest);
}
