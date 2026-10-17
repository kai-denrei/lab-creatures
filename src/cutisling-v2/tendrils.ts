import * as THREE from 'three';
import type {CutislingV2} from './controller.ts';
import {coreLobe,recoveryGather} from './muscle-motion.ts';
import {CORE_FLATNESS,CORE_FOOTPRINT,rootHeight} from './feeding-shape.ts';
import {sampleTendril} from './tendril-path.ts';
import {createV2TissueMaterial} from './tissue-material.ts';

const smooth=(v:number)=>{const t=Math.max(0,Math.min(1,v));return t*t*(3-2*t);};

/** Fixed buffers for 3–7 seeking arms and two additional engulfing arms. */
export function createV2Tendrils(body:CutislingV2){
  const tubes=Array.from({length:45},(_,i)=>({arm:Math.floor(i/5),kind:i%5,steps:i%5===0?32:i%5<3?12:7,sides:i%5===0?10:6,start:0,capStart:0}));
  let count=0;const indices:number[]=[];
  for(const t of tubes){
    t.start=count;
    for(let j=0;j<=t.steps;j++)for(let k=0;k<=t.sides;k++){
      const a=count++,row=t.sides+1;
      if(j<t.steps&&k<t.sides)indices.push(a,a+row,a+1,a+1,a+row,a+row+1);
    }
    t.capStart=count;count+=2;
    for(let n=0;n<t.sides;n++){
      indices.push(t.capStart,t.start+n,t.start+n+1);
      const end=t.start+t.steps*(t.sides+1);
      indices.push(t.capStart+1,end+n+1,end+n);
    }
  }
  const positions=new Float32Array(count*3),uv=new Float32Array(count*2),geometry=new THREE.BufferGeometry();
  for(const t of tubes)for(let j=0;j<=t.steps;j++)for(let k=0;k<=t.sides;k++){
    const i=t.start+j*(t.sides+1)+k,attach=t.kind===1||t.kind===3?.37:.66;
    uv[i*2]=t.arm*.73+(t.kind===0?j/t.steps*3:attach*3+j/t.steps*.6);uv[i*2+1]=k/t.sides;
  }
  geometry.setAttribute('uv',new THREE.BufferAttribute(uv,2));
  geometry.setAttribute('position' ,new THREE.BufferAttribute(positions,3).setUsage(THREE.DynamicDrawUsage));geometry.setIndex(indices);
  const tissue=createV2TissueMaterial(body),{material}=tissue;
  const mesh=new THREE.Mesh(geometry,material);mesh.name='Cutisling v2 / branching seeking tendrils';mesh.frustumCulled=false;
  const core=new THREE.Mesh(new THREE.SphereGeometry(1,32,16),material);
  core.name='Cutisling v2 / blended tissue junction';core.frustumCulled=false;mesh.add(core);
  const corePosition=core.geometry.getAttribute('position'),coreRest=corePosition.array.slice(),coreIndex=core.geometry.index!.array;
  const signedVolume=()=>{
    const p=corePosition.array;let volume=0;
    for(let j=0;j<coreIndex.length;j+=3){
      const a=coreIndex[j]*3,b=coreIndex[j+1]*3,c=coreIndex[j+2]*3;
      volume+=p[a]*(p[b+1]*p[c+2]-p[b+2]*p[c+1])+p[a+1]*(p[b+2]*p[c]-p[b]*p[c+2])+p[a+2]*(p[b]*p[c+1]-p[b+1]*p[c]);
    }return volume;
  };
  const coreVolume=signedVolume();
  const points=new Float64Array(33*4),root=new Float64Array(4),ahead=new Float64Array(4);
  function update(){
    const blend=body.mix(body.previousExploratory,body.exploratory),spread=body.tuning.spread;
    mesh.visible=body.tuning.showSkin&&blend>.002;
    tissue.update();
    const sheet=body.mix(body.previousSheet,body.sheet),travel=body.holdingPrey?body.mix(body.previousAnchorTravel,body.anchorTravel):0,wrap=body.mix(body.previousWrap,body.wrap);
    const baseSize=spread*body.tuning.tendrilWidth;
    const widening=1+.25*sheet,stretch=1+.22*Math.sin(Math.PI*travel)*(1-sheet);
    let cordVolume=0;
    if(!mesh.visible){core.visible=false;return;}
    for(const tube of tubes){
      if(tube.arm<7&&tube.arm>=body.tentacleCount){positions.fill(0,tube.start*3,(tube.capStart+2)*3);continue;}
      const {arm,kind,steps,sides,start}=tube;
      const branch=kind<3?kind:kind-2,attach=branch===1?.37:.66,feeding=arm>=7;
      let side=kind%2===1?1:-1;
      sampleTendril(body,arm,attach,root);sampleTendril(body,arm,attach+.01,ahead);
      const heading=Math.atan2(ahead[2]-root[2],ahead[0]-root[0]);
      if(feeding)side=(-Math.sin(heading)*(root[0]-body.preyX)+Math.cos(heading)*(root[2]-body.preyZ))>=0?1:-1;
      const length=arm>=7?0:body.holdingPrey?body.contactLengths[arm]:body.mix(body.probes[arm].previousLength,body.probes[arm].length);
      const growth=body.tuning.branching*(feeding?
        smooth((wrap-attach*.18)/.28)*(1-smooth((sheet-.18)/.82))*Math.min(1,root[3]/(.10*spread*body.tuning.tendrilWidth)):
        smooth((length-1.3)/2)*(body.holdingPrey?(1-sheet)*(1-.75*travel)*(1-.6*smooth(wrap)):blend));
      const branchLength=(branch===1?.78:.52)*spread*growth;
      const branchAngle=heading+side*(.80+.13*Math.sin((body.holdingPrey&&!feeding?body.contactTime:body.mix(body.previousTime,body.time))*.55+arm*2+branch));
      const bx=Math.cos(branchAngle),bz=Math.sin(branchAngle),fork=kind>=3;
      if(fork){
        const u=.58,bend=side*.16*branchLength*Math.sin(u*Math.PI)*Math.sin(u*3+arm+branch);
        const radius=.07*spread*body.tuning.tendrilWidth*growth*(1-u)**1.35;
        root[0]+=bx*branchLength*u-bz*bend;root[2]+=bz*branchLength*u+bx*bend;
        root[1]=.018+radius+Math.max(0,root[1]-.018-radius)*(1-u)**2;
      }
      for(let j=0;j<=steps;j++){
        const u=j/steps,k=j*4;
        if(kind===0){sampleTendril(body,arm,u,ahead);points.set(ahead,k);continue;}
        const reach=branchLength*(fork?.37:1),a=branchAngle+(fork?-side*.85:0);
        const bend=side*.16*reach*Math.sin(u*Math.PI)*Math.sin(u*3+arm+kind);
        const radius=(fork?.025:.07)*spread*body.tuning.tendrilWidth*growth*(1-u)**1.35;
        points[k]=root[0]+Math.cos(a)*reach*u-Math.sin(a)*bend;
        points[k+2]=root[2]+Math.sin(a)*reach*u+Math.cos(a)*bend;
        points[k+1]=.018+radius+Math.max(0,root[1]-.018-radius)*(1-u)**2;
        points[k+3]=radius;
        if(feeding){
          const dx=points[k]-body.preyX,dz=points[k+2]-body.preyZ,distance=Math.hypot(dx,dz)||1,safe=body.preyRadius+radius+.035;
          if(distance<safe){points[k]=body.preyX+dx/distance*safe;points[k+2]=body.preyZ+dz/distance*safe;}
        }
      }
      if(kind===0)for(let j=1;j<=steps;j++){
        const k=j*4;
        cordVolume+=Math.PI*((points[k-1]+points[k+3])*.5)**2*Math.hypot(points[k]-points[k-4],points[k+1]-points[k-3],points[k+2]-points[k-2])*.9*(1-sheet*.75);
      }
      // Flatten the buried roots with the body, easing back to round cords.
      if(kind===0)for(let j=0;j<=steps;j++)points[j*4+1]=.018+(points[j*4+1]-.018)*rootHeight(j/steps);
      for(let end=0;end<2;end++){
        const k=end*steps*4,p=(tube.capStart+end)*3;
        positions[p]=points[k];positions[p+1]=points[k+1];positions[p+2]=points[k+2];
      }
      for(let j=0;j<=steps;j++){
        const k=j*4,a=Math.max(0,j-1)*4,b=Math.min(steps,j+1)*4;
        const dx=points[b]-points[a],dz=points[b+2]-points[a+2],distance=Math.hypot(dx,dz)||1;
        for(let n=0;n<=sides;n++){
          const angle=n/sides*Math.PI*2,r=points[k+3],p=(start+j*(sides+1)+n)*3;
          positions[p]=points[k]-dz/distance*Math.cos(angle)*r;
          positions[p+1]=points[k+1]+Math.sin(angle)*r*.9*(kind===0?rootHeight(j/steps):1)*(1-body.mix(body.previousSheet,body.sheet)*.75);
          positions[p+2]=points[k+2]+dx/distance*Math.cos(angle)*r;
        }
      }
    }
    // The volume removed from retracting arms accumulates in the core. As the
    // loop grows and flattens, the same reserve flows into the feeding surface.
    let reserve=body.holdingPrey?Math.max(0,body.feedingMass*(1-sheet)-cordVolume):4/3*Math.PI*.68*.38*.64*baseSize**3*(1-sheet);
    if(body.phase==='RECOVER'){
      const progress=body.recoveryProgress();
      // The gathered lump briefly holds tissue before paying it out into limbs.
      reserve=4/3*Math.PI*.68*.38*.64*baseSize**3*recoveryGather(progress)*(1+1.2*Math.sin(Math.PI*progress)**2);
    }
    const size=Math.cbrt(reserve/(4/3*Math.PI*.68*.38*.64));
    const height=size*CORE_FLATNESS/(widening*widening*Math.sqrt(stretch));
    core.visible=height>.001;
    core.position.set(body.mix(body.previousCenterX,body.centerX),.018+.34*height,body.mix(body.previousCenterZ,body.centerZ));
    core.scale.set(.68*size*widening*stretch*CORE_FOOTPRINT,.38*height,.64*size*widening*CORE_FOOTPRINT/Math.sqrt(stretch));
    // Persistent local coordinates avoid rotating the lobes suddenly at a new anchor.
    core.rotation.y=0;
    const clock=body.mix(body.previousTime,body.time),amount=body.tuning.amorphous;
    const effort=body.tuning.muscleStrength*Math.sin(Math.PI*travel)*Math.sin(travel*Math.PI*5);
    for(let i=0;i<corePosition.count;i++){
      const k=i*3,x=coreRest[k],y=coreRest[k+1],z=coreRest[k+2];
      const radius=coreLobe(x,y,z,clock,amount);
      corePosition.setXYZ(i,x*radius*(1+.07*effort),y*radius,z*radius/(1+.07*effort));
    }
    // Keep the same reserve volume while the silhouette changes shape.
    const correction=Math.cbrt(coreVolume/signedVolume());
    for(let i=0;i<corePosition.array.length;i++)corePosition.array[i]*=correction;
    corePosition.needsUpdate=true;core.geometry.computeVertexNormals();
    geometry.attributes.position.needsUpdate=true;geometry.computeVertexNormals();
    const normals=geometry.getAttribute('normal');
    // Match lighting across the buried root / lobed core overlap. Fade back to
    // each cord's own normal outside the junction, avoiding a hard socket seam.
    if(height>.001)for(const tube of tubes){
      if(tube.kind!==0||tube.arm<7&&tube.arm>=body.tentacleCount)continue;
      for(let j=0;j<=tube.steps;j++)for(let n=0;n<=tube.sides;n++){
        const v=tube.start+j*(tube.sides+1)+n,k=v*3;
        const c=Math.cos(core.rotation.y),s=Math.sin(core.rotation.y),dx=positions[k]-core.position.x,dz=positions[k+2]-core.position.z;
        const x=(c*dx-s*dz)/core.scale.x,y=(positions[k+1]-core.position.y)/core.scale.y,z=(s*dx+c*dz)/core.scale.z;
        const q=Math.hypot(x,y,z)||1,nx0=x/q,ny0=y/q,nz0=z/q;
        const radius=coreLobe(nx0,ny0,nz0,clock,amount)*correction,blend=1-smooth((q-radius)/.55);
        if(blend<=0)continue;
        const gx=amount*(.38*nx0+.16*nz0+.13*(1-ny0*ny0)+.055*Math.sin(clock*.83)*ny0);
        const gy=amount*(-.26*nx0*ny0+.07*nz0+.055*Math.sin(clock*.83)*nx0);
        const gz=amount*(-.38*nz0+.16*nx0-.09+.07*ny0+.09*Math.sin(clock*.61+1)*nz0);
        const dot=gx*nx0+gy*ny0+gz*nz0;
        const lx=(nx0-(gx-dot*nx0)/radius)/core.scale.x,ly=(ny0-(gy-dot*ny0)/radius)/core.scale.y,lz=(nz0-(gz-dot*nz0)/radius)/core.scale.z;
        const nx=c*lx+s*lz,ny=ly,nz=-s*lx+c*lz,length=Math.hypot(nx,ny,nz)||1;
        const bx=normals.getX(v)*(1-blend)+nx/length*blend,by=normals.getY(v)*(1-blend)+ny/length*blend,bz=normals.getZ(v)*(1-blend)+nz/length*blend;
        const norm=Math.hypot(bx,by,bz)||1;normals.setXYZ(v,bx/norm,by/norm,bz/norm);
      }
    }
    for(const {start,steps,sides} of tubes)for(let j=0;j<=steps;j++){
      const a=start+j*(sides+1),b=a+sides;
      const x=normals.getX(a)+normals.getX(b),y=normals.getY(a)+normals.getY(b),z=normals.getZ(a)+normals.getZ(b),n=Math.hypot(x,y,z)||1;
      normals.setXYZ(a,x/n,y/n,z/n);normals.setXYZ(b,x/n,y/n,z/n);
    }
  }
  update();return {mesh,geometry,core,update,dispose(){geometry.dispose();core.geometry.dispose();material.dispose();}};
}
