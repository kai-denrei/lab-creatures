import * as THREE from 'three';
import type { Inago } from '../inago/controller.ts';
import {contains,openingContour,polygonArea,roundContour,subtractOpening} from './outline.ts';
import type {Opening,Point} from './outline.ts';
import {createTissueEnvelope} from './envelope.ts';
import {createVeinTexture} from './veins.ts';
import {CUTISLING_DEFAULTS} from './settings.ts';
import type {CutislingSettings} from './settings.ts';

/** A continuous tissue volume driven by a small invisible flock. */
export function createCutislingMembrane(body:Inago,lift:(x:number,z:number)=>number=()=>0,opening:()=>Opening|null=()=>null){
  const tuning=(body as Inago & {tuning?:CutislingSettings}).tuning??CUTISLING_DEFAULTS;
  const envelope=createTissueEnvelope(body,tuning),veinTexture=createVeinTexture();
  const positions=new Float32Array(32768*3),normals=new Float32Array(positions.length);
  for(let i=1;i<normals.length;i+=3)normals[i]=1;
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3).setUsage(THREE.DynamicDrawUsage));geometry.setAttribute('normal',new THREE.BufferAttribute(normals,3));
  const material=new THREE.MeshPhysicalMaterial({color:0x80535f,roughness:.42,metalness:.02,clearcoat:.65,clearcoatRoughness:.35,side:THREE.DoubleSide});
  const veinStyle={value:new THREE.Vector3()},tissueTime={value:0},tissueCenter={value:new THREE.Vector2()},tissueScale={value:1};
  material.onBeforeCompile=shader=>{
    shader.uniforms.veinStyle=veinStyle;shader.uniforms.tissueVessels={value:veinTexture};shader.uniforms.tissueTime=tissueTime;shader.uniforms.tissueCenter=tissueCenter;shader.uniforms.tissueScale=tissueScale;
    shader.vertexShader='varying vec3 vTissue;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvTissue=position;');
    shader.fragmentShader=`varying vec3 vTissue;
      uniform vec3 veinStyle;uniform float tissueTime;uniform vec2 tissueCenter;uniform float tissueScale;
      uniform sampler2D tissueVessels;
      float vesselsAt(vec2 p){return texture2D(tissueVessels,p/8.).r;}
    `+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      vec2 tissue=(vTissue.xz-tissueCenter)/tissueScale;
      vec2 warped=tissue*veinStyle.x;
      warped+=vec2(sin(warped.y*1.3+sin(warped.x*.8)),cos(warped.x*1.1+sin(warped.y*.7)))*veinStyle.y;
      float vessel=1.-smoothstep(.022,.095,vesselsAt(warped));
      float capillary=(1.-smoothstep(.012,.055,vesselsAt(warped*2.7+4.)))*.45;
      float flow=.5+.5*sin(tissueTime*2.-length(tissue)*8.);
      float grain=sin(tissue.x*39.+sin(tissue.y*19.))*sin(tissue.y*43.+sin(tissue.x*17.));
      diffuseColor.rgb*=.88+grain*.055+flow*.06;
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.10,.018,.033)+vec3(.055,.008,.012)*flow,max(vessel,capillary)*veinStyle.z);
    `);
  };
  material.customProgramCacheKey=()=> 'cutisling-continuous-veins-v3';
  const skin=new THREE.Mesh(geometry,material);skin.frustumCulled=false;skin.renderOrder=1;
  const bottomPositions=new Float32Array(positions.length),bottomGeometry=new THREE.BufferGeometry();
  bottomGeometry.setAttribute('position',new THREE.BufferAttribute(bottomPositions,3).setUsage(THREE.DynamicDrawUsage));
  const bottomNormals=new Float32Array(normals.length);for(let i=1;i<bottomNormals.length;i+=3)bottomNormals[i]=-1;
  bottomGeometry.setAttribute('normal',new THREE.BufferAttribute(bottomNormals,3));
  const underside=new THREE.Mesh(bottomGeometry,new THREE.MeshStandardMaterial({color:0x583d48,roughness:.55,side:THREE.DoubleSide}));underside.frustumCulled=false;
  const rimPositions=new Float32Array(65536*3),rimNormals=new Float32Array(rimPositions.length),rimGeometry=new THREE.BufferGeometry();
  rimGeometry.setAttribute('position',new THREE.BufferAttribute(rimPositions,3).setUsage(THREE.DynamicDrawUsage));rimGeometry.setAttribute('normal',new THREE.BufferAttribute(rimNormals,3).setUsage(THREE.DynamicDrawUsage));
  // One material and coordinate field cross the cap/lip seam, including while sealing.
  const rimMaterial=material;
  const rim=new THREE.Mesh(rimGeometry,rimMaterial);rim.frustumCulled=false;rim.renderOrder=1;

  const group=new THREE.Group();group.name='Cutisling / continuous veined tissue';group.add(underside,skin,rim);
  let area=0,lastTime=-1,boundaries:Point[][]=[];
  const upload=(geometry:THREE.BufferGeometry,name:string,count:number)=>{const attr=geometry.getAttribute(name) as THREE.BufferAttribute;attr.clearUpdateRanges();attr.addUpdateRange(0,count);attr.needsUpdate=true;};
  function update(force=false){
    // Pause locks tissue, veins and breathing to the same clock as the organism.
    if(body.time===lastTime&&!force)return;const elapsed=body.time-lastTime;lastTime=body.time;
    const height=.012+tuning.thickness+Math.sin(body.time*1.8)*.002,aperture=opening();
    const liftX=aperture?.x??body.centerX,liftZ=aperture?.z??body.centerZ,bulging=lift(liftX,liftZ)>.00001;
    let written=0;
    const vertex=(p:number[])=>{
      positions[written]=p[0];positions[written+1]=p[1];positions[written+2]=p[2];
      normals[written]=p[3];normals[written+1]=p[4];normals[written+2]=p[5];written+=3;
    };
    const tessellate=(vertices:number[][],faces:number[][])=>{
      if(bulging){
        // Split shared edges in the same pass on both neighboring faces. Independent
        // recursive triangles leave T-junctions that tear when lifted into a dome.
        for(let pass=0;pass<9;pass++){
          const mids=new Map<string,number>();let splits=0;
          const midpoint=(a:number,b:number)=>{
            const p=vertices[a],q=vertices[b];
            const near=liftX>=Math.min(p[0],q[0])-.65&&liftX<=Math.max(p[0],q[0])+.65&&liftZ>=Math.min(p[2],q[2])-.65&&liftZ<=Math.max(p[2],q[2])+.65;
            if((p[0]-q[0])**2+(p[2]-q[2])**2<=(near?.14:.5)**2)return -1;
            const key=a<b?`${a}:${b}`:`${b}:${a}`;let index=mids.get(key);
            if(index===undefined){index=vertices.length;vertices.push([(p[0]+q[0])*.5,height,(p[2]+q[2])*.5]);mids.set(key,index);}return index;
          };
          const next:number[][]=[];
          for(const [a,b,c] of faces){
            const ab=midpoint(a,b),bc=midpoint(b,c),ca=midpoint(c,a),mask=(ab>=0?1:0)|(bc>=0?2:0)|(ca>=0?4:0);
            if(mask)splits++;
            if(mask===0)next.push([a,b,c]);
            else if(mask===1)next.push([a,ab,c],[ab,b,c]);
            else if(mask===2)next.push([a,b,bc],[a,bc,c]);
            else if(mask===4)next.push([a,b,ca],[ca,b,c]);
            else if(mask===3)next.push([ab,b,bc],[a,ab,c],[ab,bc,c]);
            else if(mask===6)next.push([bc,c,ca],[a,b,ca],[b,bc,ca]);
            else if(mask===5)next.push([a,ab,ca],[ab,b,c],[ab,c,ca]);
            else next.push([a,ab,ca],[ab,b,bc],[ca,bc,c],[ab,bc,ca]);
          }
          faces=next;if(splits===0)break;
        }
      }
      const samples=vertices.map(p=>{
        const x=p[0],z=p[2],dx=bulging?(lift(x+.005,z)-lift(x-.005,z))/.01:0,dz=bulging?(lift(x,z+.005)-lift(x,z-.005))/.01:0,length=Math.hypot(dx,1,dz);
        return [x,p[1]+lift(x,z),z,-dx/length,1/length,-dz/length];
      });
      for(const face of faces){vertex(samples[face[0]]);vertex(samples[face[2]]);vertex(samples[face[1]]);}
    };
    // The whole flock drives one smoothed contour; no motile geometry or vein graph.
    const outer=envelope();area=polygonArea(outer);
    const lipPadding=tuning.lipWidth*Math.min(1,(aperture?.radius??1)/.25);
    boundaries=subtractOpening(outer,openingContour(aperture,lipPadding)).map(roundContour);
    if(bulging)boundaries=boundaries.map(loop=>loop.flatMap((p,i)=>{
      const q=loop[(i+1)%loop.length],steps=Math.max(1,Math.ceil(Math.hypot(q[0]-p[0],q[1]-p[1])/.14));
      return Array.from({length:steps},(_,j):Point=>[p[0]+(q[0]-p[0])*j/steps,p[1]+(q[1]-p[1])*j/steps]);
    }));
    const outside=boundaries.filter(loop=>polygonArea(loop)>0),holes=boundaries.filter(loop=>polygonArea(loop)<0);
    for(const contour of outside){
      const enclosed=holes.filter(hole=>contains(contour,hole[0][0],hole[0][1]));
      const vertices=[...contour,...enclosed.flat()],faces=THREE.ShapeUtils.triangulateShape(contour.map(p=>new THREE.Vector2(p[0],p[1])),enclosed.map(loop=>loop.map(p=>new THREE.Vector2(p[0],p[1]))));
      tessellate(vertices.map(p=>[p[0],height,p[1]]),faces);
    }
    for(let i=0;i<written;i+=3){bottomPositions[i]=positions[i];bottomPositions[i+1]=.012;bottomPositions[i+2]=positions[i+2];}
    bottomGeometry.setDrawRange(0,written/3);upload(bottomGeometry,'position',written);
    // The contour winding distinguishes outer padding from the inward feeding lip.
    const profiles:number[][][]=[],loops:{start:number;count:number}[]=[];
    for(const boundary of boundaries){
      const start=profiles.length;loops.push({start,count:boundary.length});
      for(let i=0;i<boundary.length;i++){
        const a=boundary[(i+boundary.length-1)%boundary.length],b=boundary[i],c=boundary[(i+1)%boundary.length];
        const ex=b[0]-a[0],ez=b[1]-a[1],fx=c[0]-b[0],fz=c[1]-b[1],el=Math.hypot(ex,ez)||1,fl=Math.hypot(fx,fz)||1;
        let nx=ez/el+fz/fl,nz=-(ex/el+fx/fl);const length=Math.hypot(nx,nz)||1;nx/=length;nz/=length;
        const miter=1/Math.max(.5,nx*fz/fl-nz*fx/fl);
        const roof=height+lift(b[0],b[1]),profile=[[b[0],roof,b[1],0,1,0]];
        const nearMouth=aperture&&Math.hypot(b[0]-aperture.x,b[1]-aperture.z)<aperture.radius+lipPadding+.2;
        // A fixed-width collar folds through itself as the final hole closes.
        const width=nearMouth?lipPadding:tuning.lipWidth;
        for(let j=0;j<=8;j++){const angle=j/8*Math.PI,offset=width*(.85+.15*Math.sin(angle))*miter;profile.push([b[0]+nx*offset,.012+(roof-.019)*(1+Math.cos(angle))*.5,b[1]+nz*offset,nx*Math.sin(angle),Math.cos(angle),nz*Math.sin(angle)]);}
        profile.push([b[0],.012,b[1],0,-1,0]);profiles.push(profile);
      }
    }
    let rimWritten=0;
    const rimTriangle=(a:number[],b:number[],c:number[])=>{for(const p of [a,b,c]){rimNormals[rimWritten]=p[3];rimNormals[rimWritten+1]=p[4];rimNormals[rimWritten+2]=p[5];rimPositions[rimWritten++]=p[0];rimPositions[rimWritten++]=p[1];rimPositions[rimWritten++]=p[2];}};
    for(const loop of loops)for(let i=0;i<loop.count;i++){const a=profiles[loop.start+i],b=profiles[loop.start+(i+1)%loop.count];for(let j=0;j<a.length-1;j++){rimTriangle(a[j],b[j],a[j+1]);rimTriangle(a[j+1],b[j],b[j+1]);}}
    rimGeometry.setDrawRange(0,rimWritten/3);upload(rimGeometry,'position',rimWritten);
    upload(rimGeometry,'normal',rimWritten);
    geometry.setDrawRange(0,written/3);upload(geometry,'position',written);upload(geometry,'normal',written);
    tissueTime.value=body.time;veinStyle.value.set(tuning.veinScale,tuning.veinWarp,tuning.veinContrast);
    // Smooth the material frame independently of changing triangulation and aperture area.
    const blend=elapsed<0||elapsed>.25?1:1-Math.exp(-Math.max(0,elapsed)*3);
    tissueScale.value+=(Math.max(.5,Math.sqrt(area)*.38)-tissueScale.value)*blend;
    const cx=body.x.reduce((sum,v)=>sum+v,0)/body.count,cz=body.z.reduce((sum,v)=>sum+v,0)/body.count;
    tissueCenter.value.x+=(cx-tissueCenter.value.x)*blend;tissueCenter.value.y+=(cz-tissueCenter.value.y)*blend;
  }
  update();
  return {group,skin,underside,rim,update,dispose(){veinTexture.dispose();},get boundaries(){return boundaries;},get area(){return area;}};
}
