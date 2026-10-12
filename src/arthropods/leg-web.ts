import * as THREE from 'three/webgpu';
import type { ArthropodGait } from './gait.ts';
/** Six connected sheets follow each articulated leg from the central junction to the foot. */
export function createLegWeb(){
  const order=[0,1,2,5,4,3],radial=24,across=12,columns=order.length*across;
  const positions=new Float32Array((1+radial*columns)*3),indices:number[]=[];
  for(let j=0;j<columns;j++)indices.push(0,1+j,1+(j+1)%columns);
  for(let r=0;r<radial-1;r++)for(let j=0;j<columns;j++){
    const a=1+r*columns+j,b=1+r*columns+(j+1)%columns,c=a+columns,d=b+columns;indices.push(a,c,b,b,c,d);
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3).setUsage(THREE.DynamicDrawUsage));geometry.setIndex(indices);
  const material=new THREE.MeshPhysicalNodeMaterial({color:'#929f99',roughness:.54,metalness:.08,transparent:true,opacity:.66,side:THREE.DoubleSide,depthWrite:false});
  const mesh=new THREE.Mesh(geometry,material);mesh.name='Interleg membrane';mesh.frustumCulled=false;
  const a=new THREE.Vector3(),b=new THREE.Vector3(),p=new THREE.Vector3();
  function update(gait:ArthropodGait){
    const center=gait.local(0,-.004,0),paths=order.map(i=>[center,...gait.joints(i)]);
    positions.set(center.toArray(),0);
    const sample=(path:THREE.Vector3[],t:number,out:THREE.Vector3)=>{const segment=Math.min(path.length-2,Math.floor(t*(path.length-1))),u=t*(path.length-1)-segment;return out.copy(path[segment]).lerp(path[segment+1],u);};
    for(let r=1;r<=radial;r++)for(let j=0;j<columns;j++){
      const sector=Math.floor(j/across),u=(j%across)/across,t=r/radial;
      // Slightly scalloped rim, pinned continuously along every leg.
      const reach=t*(1-.055*Math.sin(Math.PI*u)*Math.pow(t,3));
      sample(paths[sector],reach,a);sample(paths[(sector+1)%order.length],reach,b);p.copy(a).lerp(b,u);
      p.y-=Math.sin(Math.PI*u)*Math.sin(Math.PI*t)*.009;
      p.y+=Math.sin(gait.time*1.4+sector*1.9+t*7)*Math.sin(Math.PI*u)*Math.sin(Math.PI*t)*.001;
      p.y=Math.max(.003,p.y);positions.set(p.toArray(),(1+(r-1)*columns+j)*3);
    }
    geometry.attributes.position.needsUpdate=true;geometry.computeVertexNormals();
  }
  return {mesh,update,setAnatomy:(on:boolean)=>material.color.set(on?'#c8b283':'#929f99')};
}
