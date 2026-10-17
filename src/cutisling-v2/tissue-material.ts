import * as THREE from 'three';
import type {CutislingV2} from './controller.ts';
import {createVeinTexture} from '../cutisling/veins.ts';
import {V2_PALETTES} from './palettes.ts';

let texture:THREE.DataTexture|undefined,references=0;
/** One baked network, shared by the matte cords, core, grip and digestive skin.
 * Pulses travel through material coordinates; no geometry or texture is rebuilt. */
export function createV2TissueMaterial(body:CutislingV2,sheet=false){
  texture??=createVeinTexture();references++;
  const uniforms={
    v2Veins:{value:texture},v2VeinColor:{value:new THREE.Color()},v2VeinStrength:{value:0},
    v2Pulse:{value:0},v2Clock:{value:0},v2Feeding:{value:0},
  };
  const material=new THREE.MeshPhysicalMaterial({roughness:.96,metalness:0,clearcoat:0,specularIntensity:.18,side:THREE.DoubleSide});
  material.onBeforeCompile=shader=>{
    Object.assign(shader.uniforms,uniforms);
    shader.vertexShader='varying vec2 vTissue;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvTissue=uv;');
    shader.fragmentShader=`varying vec2 vTissue;
      uniform sampler2D v2Veins;uniform vec3 v2VeinColor;
      uniform float v2VeinStrength,v2Pulse,v2Clock,v2Feeding;\n`+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      vec2 p=${sheet?'vTissue*12.':'vec2(vTissue.x*6.,vTissue.y*8.)'};
      p+=vec2(sin(p.y*0.785398+sin(p.x*.7)),cos(p.x*.9))*.55;
      float phase=v2Clock*6.283185+${sheet?'length(vTissue)*5.':'-vTissue.x*2.2'};
      float beat=pow(.5+.5*sin(phase),6.)+.3*pow(.5+.5*sin(phase-1.2),10.);
      float swell=beat*v2Pulse*(.75+.25*v2Feeding);
      float d=texture2D(v2Veins,p/8.).r,detail=texture2D(v2Veins,p*2./8.).r;
      float line=max(1.-smoothstep(.018,.065+.025*swell,d),(1.-smoothstep(.01,.048+.014*swell,detail))*.45);
      float contrast=clamp(line*v2VeinStrength*(.38+.27*swell),0.,.92);
      vec3 blood=v2VeinColor*(.8+.35*min(swell,1.8));
      diffuseColor.rgb=mix(diffuseColor.rgb,blood,contrast);`);
  };
  material.customProgramCacheKey=()=>`cutisling-v2-pulsing-${sheet?'sheet':'cord'}`;
  function update(){
    const palette=V2_PALETTES[body.tuning.palette];material.color.setHex(palette.skin);uniforms.v2VeinColor.value.setHex(palette.veins);
    uniforms.v2VeinStrength.value=body.tuning.veins?body.tuning.veinStrength:0;
    uniforms.v2Pulse.value=body.tuning.veinPulse;
    uniforms.v2Clock.value=body.mix(body.previousTime,body.time)*body.tuning.veinSpeed;
    uniforms.v2Feeding.value=body.predation;
  }
  let disposed=false;
  material.addEventListener('dispose',()=>{if(disposed)return;disposed=true;if(--references===0){texture?.dispose();texture=undefined;}});
  update();return {material,uniforms,update};
}
