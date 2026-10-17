import * as THREE from 'three';
import type {CutislingV2} from './controller.ts';
import {createV2TissueMaterial} from './tissue-material.ts';
import {loopRadius,loopThickness,LOOP_SWEEP} from './feeding-shape.ts';

/** One fixed material lattice. No hull, angular bins, polygon subtraction or retriangulation. */
export function createV2Membrane(body:CutislingV2){
  const segments=128,rings=24,row=rings+1,layer=(segments+1)*row;
  const wallStart=layer*2,vertices=wallStart+4*row;
  const positions=new Float32Array(vertices*3),uv=new Float32Array(vertices*2),indices:number[]=[];
  for(let side=0;side<2;side++)for(let i=0;i<=segments;i++)for(let j=0;j<=rings;j++){
    const index=side*layer+i*row+j,a=i/segments*Math.PI*2,r=j/rings;
    uv[index*2]=Math.cos(a)*r;uv[index*2+1]=Math.sin(a)*r;
    if(i<segments&&j<rings){const a=index,b=index+row,c=index+1,d=index+row+1;
      if(side===0)indices.push(a,b,c,c,b,d);else indices.push(a,c,b,c,d,b);
    }
  }
  // Separate wall vertices keep their normals out of the top surface. They
  // collapse harmlessly when the lips meet, with the same indices throughout.
  for(let end=0;end<2;end++)for(let j=0;j<rings;j++){
    const a=wallStart+end*row*2+j,b=a+1,c=a+row,d=b+row;
    if(end===0)indices.push(a,b,c,b,d,c);else indices.push(a,c,b,b,c,d);
  }
  for(let end=0;end<2;end++)for(let side=0;side<2;side++)for(let j=0;j<=rings;j++){
    const source=side*layer+end*segments*row+j,index=wallStart+end*row*2+side*row+j;
    uv[index*2]=uv[source*2];uv[index*2+1]=uv[source*2+1];
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('normal',new THREE.BufferAttribute(new Float32Array(vertices*3),3));
  geometry.setAttribute('position',new THREE.BufferAttribute(positions,3).setUsage(THREE.DynamicDrawUsage));geometry.setAttribute('uv',new THREE.BufferAttribute(uv,2));geometry.setIndex(indices);
  const tissue=createV2TissueMaterial(body,true),{material}=tissue;
  const mesh=new THREE.Mesh(geometry,material);mesh.frustumCulled=false;mesh.name='Cutisling v2 / persistent material lattice';
  function update(){
    const sheet=body.mix(body.previousSheet,body.sheet);
    tissue.update();mesh.visible=body.tuning.showSkin&&sheet>.001;
    if(!mesh.visible)return;
    const cx=body.preyX,cz=body.preyZ;
    const spread=body.tuning.spread,ring=Math.max(.85,spread);
    const fusing=body.phase==='FLATTEN',recovering=body.phase==='RECOVER';
    const hole=body.mix(body.previousHole,body.hole),gap=0,lift=body.mix(body.previousLift,body.lift);
    const heading=Math.atan2(body.wrapRootZ-cz,body.wrapRootX-cx),rootDistance=Math.hypot(body.wrapRootX-cx,body.wrapRootZ-cz);
    const thickness=body.tuning.thickness*(.55+.45*sheet);
    for(let i=0;i<=segments;i++){
      const angle=body.mouthAngle+i/segments*Math.PI*2,cos=Math.cos(angle),sin=Math.sin(angle);
      let outer=ring+.05+sheet*(body.feedingRadius-ring-.05+spread*(.08*Math.sin(angle*3)+.06*Math.sin(angle*5+.8)));
      let inner=hole*(1+sheet*(.07*Math.sin(angle*3)+.04*Math.sin(angle*2+.9)));
      const delta=Math.abs(Math.atan2(Math.sin(angle-heading),Math.cos(angle-heading))),u=delta/LOOP_SWEEP;
      const cordRadius=loopThickness(u,body.tuning.tendrilWidth,spread)*(1-.4*Math.max(0,1-(Math.PI-delta)/.2));
      if(fusing){
        const center=loopRadius(angle,u,spread,rootDistance);
        const targetOuter=body.feedingRadius+spread*(.08*Math.sin(angle*3)+.06*Math.sin(angle*5+.8));
        const targetInner=.65*(1+.07*Math.sin(angle*3)+.04*Math.sin(angle*2+.9));
        outer=(center+cordRadius)*(1-sheet)+targetOuter*sheet;
        inner=(center-cordRadius)*(1-sheet)+targetInner*sheet;
      }
      if(recovering){
        const gathered=1-sheet,target=.32*spread*body.tuning.tendrilWidth;
        // Shrink the whole footprint into the reformed body; no broad disc vanishes.
        outer=target+(body.feedingRadius+spread*(.08*Math.sin(angle*3)+.06*Math.sin(angle*5+.8))-target)*sheet;
        inner=0;
        outer*=1+.055*Math.sin(angle*3+body.mix(body.previousTime,body.time)*.55)*gathered*sheet;
      }
      const localThickness=fusing?cordRadius*1.9*(1-sheet)+thickness*sheet:thickness;
      for(let j=0;j<=rings;j++){
        const q=j/rings,r=inner+(Math.max(inner+.06,outer)-inner)*q;
        const outside=Math.min(1,(1-q)*rings/1.5),inside=hole>0?Math.min(1,q*rings/1.5+Math.max(0,1-hole/.12)):1;
        const rimRound=Math.sqrt(Math.max(0,1-(1-Math.min(outside,inside))**2));
        const round=fusing?Math.sqrt(Math.max(0,1-(q*2-1)**2))*(1-sheet)+rimRound*sheet:rimRound;
        const dome=lift*Math.exp(-r*r/.20)+(recovering?.10*(1-sheet)*Math.sqrt(Math.max(0,1-q*q)):0);
        for(let side=0;side<2;side++){
          const p=(side*layer+i*row+j)*3;
          positions[p]=cx+cos*r;positions[p+1]=.012+localThickness*.5+(side===0?1:-1)*localThickness*.5*round+dome;positions[p+2]=cz+sin*r;
        }
      }
    }
    for(let end=0;end<2;end++)for(let side=0;side<2;side++)for(let j=0;j<=rings;j++){
      const source=side*layer+end*segments*row+j,index=wallStart+end*row*2+side*row+j;
      positions[index*3]=positions[source*3];positions[index*3+2]=positions[source*3+2];
      const topY=positions[(end*segments*row+j)*3+1],blend=Math.min(1,gap/.02);
      positions[index*3+1]=topY+(positions[source*3+1]-topY)*blend;
    }
    geometry.attributes.position.needsUpdate=true;geometry.computeVertexNormals();
    // Weld shading at the fixed outer rim and, when closed, the material seam.
    const normals=geometry.getAttribute('normal') as THREE.BufferAttribute;
    const average=(a:number,b:number)=>{
      const x=normals.getX(a)+normals.getX(b),y=normals.getY(a)+normals.getY(b),z=normals.getZ(a)+normals.getZ(b),length=Math.hypot(x,y,z)||1;
      normals.setXYZ(a,x/length,y/length,z/length);normals.setXYZ(b,x/length,y/length,z/length);
    };
    for(let i=0;i<=segments;i++){average(i*row+rings,layer+i*row+rings);if(hole>.12)average(i*row,layer+i*row);}
    if(gap<1e-5)for(let j=0;j<=rings;j++)for(let side=0;side<2;side++)average(side*layer+j,side*layer+segments*row+j);
    if(hole<1e-5)for(let side=0;side<2;side++){
      let x=0,y=0,z=0;
      for(let i=0;i<=segments;i++){const k=side*layer+i*row;x+=normals.getX(k);y+=normals.getY(k);z+=normals.getZ(k);}
      const length=Math.hypot(x,y,z)||1;
      for(let i=0;i<=segments;i++)normals.setXYZ(side*layer+i*row,x/length,y/length,z/length);
    }
    normals.needsUpdate=true;mesh.visible=body.tuning.showSkin&&sheet>.001;
  }
  update();return {mesh,geometry,update,dispose(){geometry.dispose();material.dispose();}};
}
