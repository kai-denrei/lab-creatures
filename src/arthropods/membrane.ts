import * as THREE from 'three/webgpu';
import { ANATOMY_COLORS, type ArthropodGait } from './gait.ts';

/** A flat closed sheet, webbed continuously to the ends of twelve elastic sectors. */
export function createMembrane(){
  const group=new THREE.Group();group.name='Veil — twelve-lobed membrane';
  const segments=192,rings=28,layer=1+segments*rings,count=layer*2;
  const positions=new Float32Array(count*3),colors=new Float32Array(count*3),indices:number[]=[];
  const vertex=(ring:number,j:number)=>ring===0?0:1+(ring-1)*segments+(j+segments)%segments;
  for(let j=0;j<segments;j++)indices.push(0,vertex(1,j),vertex(1,j+1));
  for(let ring=1;ring<rings;ring++)for(let j=0;j<segments;j++){
    const a=vertex(ring,j),b=vertex(ring+1,j),c=vertex(ring,j+1),d=vertex(ring+1,j+1);indices.push(a,b,c,c,b,d);
  }
  const topCount=indices.length;for(let i=0;i<topCount;i+=3)indices.push(indices[i]+layer,indices[i+2]+layer,indices[i+1]+layer);
  for(let j=0;j<segments;j++){const a=vertex(rings,j),b=vertex(rings,j+1);indices.push(b,a,a+layer,b,a+layer,b+layer);}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));geometry.setIndex(indices);
  const material=new THREE.MeshPhysicalNodeMaterial({color:'#a7b2b4',vertexColors:true,roughness:.82,metalness:0,transmission:0,thickness:.003,ior:1.33,clearcoat:.04,side:THREE.FrontSide});
  const mesh=new THREE.Mesh(geometry,material);mesh.name='Continuous webbed surface';mesh.castShadow=true;mesh.receiveShadow=false;group.add(mesh);
  let anatomy=false;
  function pigment(){
    const color=new THREE.Color();
    for(let side=0;side<2;side++)for(let ring=0;ring<=rings;ring++)for(let j=0;j<(ring?segments:1);j++){
      const s=ring/rings,theta=j/segments*Math.PI*2,index=vertex(ring,j)+side*layer;
      const grain=Math.sin(j*13.3+ring*37.7)*Math.sin(j*2.7-ring*9.1),ribs=Math.pow(.5+.5*Math.cos(theta*12),12);
      if(anatomy)color.set(s<.35?ANATOMY_COLORS[0]:s<.85?ANATOMY_COLORS[1]:ANATOMY_COLORS[2]);
      else color.setHSL(.56+grain*.015,.10+s*.08,.43+grain*.045+ribs*.025);
      color.multiplyScalar(side?.78:1);colors.set(color.toArray(),index*3);
    }
    geometry.attributes.color.needsUpdate=true;
  }
  function update(gait:ArthropodGait){
    const curvature=(gait as ArthropodGait&{curvature?:number[]}).curvature??Array(12).fill(0);
    const tips=gait.legs.map((leg,i)=>{
      const x=leg.foot.x-gait.center.x,z=leg.foot.z-gait.center.z;
      const expected=i/12*Math.PI*2,angle=Math.atan2(x,z);
      return {angle:expected+Math.atan2(Math.sin(angle-expected),Math.cos(angle-expected)),radius:Math.hypot(x,z),y:leg.foot.y};
    });
    for(let side=0;side<2;side++)for(let ring=0;ring<=rings;ring++)for(let j=0;j<(ring?segments:1);j++){
      const s=ring/rings,phase=j/segments*12,near=Math.floor(phase)%12,next=(near+1)%12,f=phase-Math.floor(phase),blend=f*f*(3-2*f);
      const a=tips[near],b=tips[next],nextAngle=b.angle+(next===0?Math.PI*2:0);
      const bend=curvature[near]*(1-f)+curvature[next]*f;
      const angle=a.angle+(nextAngle-a.angle)*f+bend*Math.sin(Math.PI*s);
      // The valleys retain 96.5% of adjacent limb reach: no bare distal limbs.
      const radius=(a.radius+(b.radius-a.radius)*blend)*(1-.035*Math.sin(Math.PI*f)**2)*s*(1+gait.abdomenPitch*.22*Math.sin(Math.PI*s));
      const rim=a.y+(b.y-a.y)*blend;
      const wrinkle=Math.sin(s*29+phase*1.7+gait.time*.8)*.0006*Math.sin(Math.PI*s);
      const height=.008-Math.min(.002,gait.crouch*.06);
      const thickness=.0018+.0007*(1-s);
      const y=height*(1-s)+rim*s+wrinkle-side*thickness;
      const index=vertex(ring,j)+side*layer;
      positions.set([gait.center.x+Math.sin(angle)*radius,Math.max(.001,y),gait.center.z+Math.cos(angle)*radius],index*3);
    }
    geometry.attributes.position.needsUpdate=true;geometry.computeVertexNormals();geometry.computeBoundingSphere();
  }
  pigment();
  return {group,update,setAnatomy:(enabled:boolean)=>{anatomy=enabled;pigment();}};
}
