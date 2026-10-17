import * as THREE from 'three';
import type {CutislingV2} from './controller.ts';
import {WAVE_SPEED,WAVE_LIFETIME} from './lure.ts';

/** A bounded pool of ground ripples. Origins stay where each contact happened. */
export function createV2Vibrations(body:CutislingV2){
  const group=new THREE.Group();group.name='Cutisling v2 / lure vibrations';
  const geometry=new THREE.BufferGeometry().setFromPoints(Array.from({length:64},(_,i)=>new THREE.Vector3(Math.cos(i/64*Math.PI*2),0,Math.sin(i/64*Math.PI*2))));
  const rings=body.lure.waves.map(()=>{
    const ring=new THREE.LineLoop(geometry,new THREE.LineBasicMaterial({color:0xe6bd78,transparent:true,opacity:0,depthWrite:false}));
    ring.frustumCulled=false;group.add(ring);return ring;
  });
  function update(){
    group.visible=body.tuning.hunting;
    const time=body.mix(body.previousTime,body.time);
    for(let i=0;i<rings.length;i++){
      const wave=body.lure.waves[i],age=time-wave.time,ring=rings[i];
      ring.visible=age>=0&&age<WAVE_LIFETIME;
      if(!ring.visible)continue;
      const radius=Math.max(.05,age*WAVE_SPEED);
      ring.position.set(wave.x,.018,wave.z);ring.scale.set(radius,1,radius);
      ring.material.opacity=(.18+.38*wave.strength)*(1-age/WAVE_LIFETIME)**1.6*Math.min(1,age/.12);
    }
  }
  update();return {group,update};
}
