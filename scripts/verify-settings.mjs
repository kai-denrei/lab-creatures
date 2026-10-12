import assert from 'node:assert/strict';
import { defaultSettings, PREDATOR_CONTROLS, loadPredatorSettings, savePredatorSettings } from '../src/arthropods/settings.ts';
import { settingsDocument, readSettings } from '../src/sharing/settings.ts';
import { DEFAULT_MOTION, MOTION_CONTROLS } from '../src/monster/motion-settings.ts';
const defaults=defaultSettings('oculus');
for(const c of PREDATOR_CONTROLS)assert.equal(defaults[c.key],({footLift:10,burst:1.5,recovery:3})[c.key]??c.max,c.key);
const stored=new Map([['oculus-instinct-v2',JSON.stringify({speed:.3})]]);
globalThis.localStorage={getItem:key=>stored.get(key)??null,setItem:(key,value)=>stored.set(key,value)};
assert.deepEqual(loadPredatorSettings('oculus'),defaults,'new Oculus defaults replace the previous generation');
savePredatorSettings({...defaults,fear:.4},'oculus');assert.equal(loadPredatorSettings('oculus').fear,.4,'custom tuning survives reload');
assert.equal(loadPredatorSettings('aculis').speed,1.8,'other specimens retain defaults');
for(const [family,controls,settings] of [['predator',PREDATOR_CONTROLS,defaults],['soft-body',MOTION_CONTROLS,DEFAULT_MOTION]]){
  const serialize=group=>JSON.stringify(settingsDocument(family,'test',controls,settings,group));
  assert.deepEqual(readSettings(serialize('all'),family,controls),settings,'whole specimen roundtrip');
  for(const group of new Set(controls.map(c=>c.group))){
    const partial=readSettings(serialize(group),family,controls,group);
    assert.deepEqual(Object.keys(partial),controls.filter(c=>c.group===group).map(c=>c.key),'group excludes unrelated controls');
    assert.deepEqual(readSettings(serialize('all'),family,controls,group),partial,'extract group from all settings');
    assert.deepEqual(readSettings(serialize(group),family,controls),partial,'whole panel accepts partial group');
  }
  assert.throws(()=>readSettings(serialize('all'),'wrong',controls));
  const invalid=JSON.parse(serialize('all'));delete invalid.values[controls[0].key];assert.throws(()=>readSettings(JSON.stringify(invalid),family,controls));
  const outOfBounds=JSON.parse(serialize('all'));outOfBounds.values[controls[0].key]=1e9;assert.equal(readSettings(JSON.stringify(outOfBounds),family,controls)[controls[0].key],controls[0].max);
  assert.throws(()=>readSettings('{',family,controls));
  assert.throws(()=>readSettings(' '.repeat(64001),family,controls));
}
assert.deepEqual(readSettings(JSON.stringify({version:1,motion:DEFAULT_MOTION}),'soft-body',MOTION_CONTROLS),DEFAULT_MOTION,'legacy file compatibility');
console.log('PASS Oculus defaults, persistence, family isolation, group/whole roundtrip, validation and legacy import');
