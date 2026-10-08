import { parseCage } from './cage-model.ts';
import type { ModelManifest } from './cage-model.ts';
export { parseCage as parseBabyCage } from './cage-model.ts';
export type { ModelManifest } from './cage-model.ts';

export async function loadBabyCage() {
  const [binary,metadata]=await Promise.all([
    fetch(new URL('../assets/model/jelly-baby.bin',import.meta.url)),
    fetch(new URL('../assets/model/jelly-baby.json',import.meta.url)),
  ]);
  if(!binary.ok||!metadata.ok)throw new Error('Could not load the reference jelly mesh');
  return parseCage(await binary.arrayBuffer(),await metadata.json() as ModelManifest);
}
