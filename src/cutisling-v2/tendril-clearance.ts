import type {CutislingV2} from './controller.ts';
import {V2_DEFAULTS} from './settings.ts';
import {smooth} from './feeding-shape.ts';
import {sampleRawTendril} from './tendril-path.ts';

const rows=33,stride=rows*4;
const fields=['time','previousTime','phaseTime','centerX','centerZ','previousCenterX','previousCenterZ','preyX','preyZ','preyRadius',
  'wrap','previousWrap','sheet','previousSheet','wrapRootX','wrapRootZ','anchorTravel','previousAnchorTravel','anchorFromX','anchorFromZ',
  'anchorX','anchorZ','anchorAngle','anchorLength','anchorTime','anchorU','anchorForPrey','chosenProbe','contactTime','feedingMass','predation','tentacleCount'] as const;
const settings=Object.keys(V2_DEFAULTS).filter(k=>typeof V2_DEFAULTS[k as keyof typeof V2_DEFAULTS]!=='string') as (keyof typeof V2_DEFAULTS)[];
type Frame={key:Float64Array;scratch:Float64Array;phase:string;points:Float64Array;order:Int8Array;offset:Float64Array;sample:Float64Array};
const frames=new WeakMap<CutislingV2,[Frame,Frame]>();
function createFrame():Frame{
  const length=fields.length+settings.length+29;
  return {key:new Float64Array(length).fill(NaN),scratch:new Float64Array(length),phase:'',points:new Float64Array(9*stride),order:new Int8Array(9),offset:new Float64Array(rows),sample:new Float64Array(4)};
}
function volume(p:Float64Array,arm:number){
  let result=0;
  for(let j=1;j<rows;j++){const k=arm*stride+j*4;result+=Math.PI*((p[k-1]+p[k+3])*.5)**2*Math.hypot(p[k]-p[k-4],p[k+1]-p[k-3],p[k+2]-p[k-2])*.9;}
  return result;
}
/** Reused sampled curves: local detours around exposed shafts, never a new mesh. */
export function tendrilFrame(body:CutislingV2,interpolate=true){
  let pair=frames.get(body);if(!pair){pair=[createFrame(),createFrame()];frames.set(body,pair);}
  const f=pair[interpolate?1:0],key=f.scratch;let k=0;
  for(const field of fields)key[k++]=Number(body[field]);
  for(const setting of settings)key[k++]=Number(body.tuning[setting]);
  for(const p of body.probes){key[k++]=p.angle;key[k++]=p.previousAngle;key[k++]=p.length;key[k++]=p.previousLength;}
  key[k]=interpolate?body.alpha:1;
  let changed=f.phase!==body.phase;for(let i=0;!changed&&i<key.length;i++)changed=key[i]!==f.key[i];
  if(!changed)return f.points;
  f.key.set(key);f.phase=body.phase;
  const p=f.points,s=body.tuning,sheet=interpolate?body.mix(body.previousSheet,body.sheet):body.sheet;
  const cx=interpolate?body.mix(body.previousCenterX,body.centerX):body.centerX,cz=interpolate?body.mix(body.previousCenterZ,body.centerZ):body.centerZ;
  for(let arm=0;arm<9;arm++){
    if(arm>=body.tentacleCount&&arm<7){p.fill(0,arm*stride,(arm+1)*stride);continue;}
    for(let j=0;j<rows;j++){sampleRawTendril(body,arm,j/32,f.sample,interpolate);p.set(f.sample,arm*stride+j*4);}
  }
  let count=0;f.order[count++]=7;f.order[count++]=8;
  for(let arm=0;arm<body.tentacleCount;arm++)f.order[count++]=arm;
  const travel=interpolate?body.mix(body.previousAnchorTravel,body.anchorTravel):body.anchorTravel;
  const loaded=body.holdingPrey?smooth(travel/.15):1;
  if(s.limbClearance>0&&sheet<.999&&loaded>0){
    const core=.60*s.spread*s.tendrilWidth;
    // A consistent order lets a crowded arm step over a low neighbor or pass
    // underneath a raised one. The two feeding lips deliberately meet to fuse.
    for(let pass=0;pass<2;pass++)for(let order=2;order<count;order++){
      const arm=f.order[order],start=arm*stride;f.offset.fill(0);
      for(let j=1;j<32;j++){
        const a=start+j*4,x=p[a],y=p[a+1],z=p[a+2],radius=p[a+3];if(radius<.001)continue;
        const outside=smooth((Math.hypot(x-cx,z-cz)-core)/(.15*s.spread));
        const pin=1-smooth((j/32-.94)/.06);
        if(outside*pin<.001)continue;
        let above=y,below=y;
        const step=.5*Math.hypot(p[a+4]-p[a-4],p[a+6]-p[a-2]);
        for(let other=0;other<order;other++){
          const bArm=f.order[other];
          for(let q=1;q<rows;q++){
            const b=bArm*stride+q*4,dx=p[b]-p[b-4],dz=p[b+2]-p[b-2],d2=dx*dx+dz*dz;
            if(p[b+3]+p[b-1]<.002||d2<1e-12)continue;
            const along=Math.max(0,Math.min(1,((x-p[b-4])*dx+(z-p[b-2])*dz)/d2));
            const ox=p[b-4]+dx*along,oz=p[b-2]+dz*along,oy=p[b-3]+(p[b+1]-p[b-3])*along;
            const r=radius+p[b-1]+(p[b+3]-p[b-1])*along+.025*s.spread*s.limbClearance;
            const lateral=(x-ox)**2+(z-oz)**2;
            const width=r+Math.min(.25*s.spread,step*.5);
            if(lateral>width*width*2.89)continue;
            // Broad, smooth anticipation avoids a sudden notch at first contact.
            const distance=Math.sqrt(lateral)/width;
            const gap=1.23*r*Math.exp(-distance*distance)*(1-smooth((distance-1.2)/.5));
            if(y<oy&&oy-gap>=.018+radius)below=Math.min(below,oy-gap);
            else above=Math.max(above,oy+gap);
          }
        }
        f.offset[j]=(above>y?above-y:below-y)*outside*pin*(1-sheet)*loaded;
      }
      for(let j=1;j<32;j++){
        let displacement=f.offset[j];
        // Spread positive detours into a rounded arch instead of a sharp kink.
        for(let n=Math.max(1,j-4);n<=Math.min(31,j+4);n++)if(f.offset[n]>0)displacement=Math.max(displacement,f.offset[n]*smooth(1-Math.abs(n-j)/5));
        const pin=1-smooth((j/32-.94)/.06);
        p[start+j*4+1]+=displacement*pin;
      }
    }
  }
  // Long supporters keep their reach; if the flanking arms need tissue, take
  // girth rather than abruptly swallowing their length into the core.
  if(body.holdingPrey&&body.feedingMass>0){
    let original=0;for(let arm=0;arm<body.tentacleCount;arm++)original+=volume(p,arm);
    const feeding=volume(p,7)+volume(p,8),budget=body.feedingMass*(1-sheet)/(1-sheet*.75);
    const available=Math.max(0,budget-feeding),scale=Math.min(1,Math.sqrt(available/(original||1)));
    if(scale<1)for(let arm=0;arm<body.tentacleCount;arm++)for(let j=0;j<rows;j++)p[arm*stride+j*4+3]*=scale;
  }
  return p;
}
export function resolvedTendril(body:CutislingV2,arm:number,u:number,out:Float64Array,interpolate=true){
  if(body.tuning.limbClearance===0&&body.tuning.supportReach<=.3){sampleRawTendril(body,arm,u,out,interpolate);return;}
  const p=tendrilFrame(body,interpolate),v=Math.max(0,Math.min(32,u*32)),j=Math.min(31,Math.floor(v)),f=v-j,k=arm*stride+j*4;
  for(let axis=0;axis<4;axis++)out[axis]=p[k+axis]*(1-f)+p[k+4+axis]*f;
}

/** Small feelers shorten into their parent before crossing another main shaft. */
export function branchRoom(body:CutislingV2,arm:number,x:number,y:number,z:number,angle:number,length:number,radius:number){
  if(body.tuning.limbClearance<=0||length<.02)return 1;
  const p=tendrilFrame(body),s=body.tuning,cx=body.mix(body.previousCenterX,body.centerX),cz=body.mix(body.previousCenterZ,body.centerZ);
  let room=1;
  for(let j=1;j<=6;j++){
    const u=j/6,px=x+Math.cos(angle)*length*u,pz=z+Math.sin(angle)*length*u,r=radius*(1-u)**1.35;
    if(Math.hypot(px-cx,pz-cz)<.72*s.spread*s.tendrilWidth)continue;
    const py=.018+r+Math.max(0,y-.018-r)*(1-u)**2;
    for(let other=0;other<9;other++){
      if(other===arm||other>=body.tentacleCount&&other<7)continue;
      for(let n=1;n<rows;n++){
        const k=other*stride+n*4,dx=p[k]-p[k-4],dy=p[k+1]-p[k-3],dz=p[k+2]-p[k-2],d2=dx*dx+dy*dy+dz*dz;
        if(d2<1e-10||p[k-1]+p[k+3]<.002)continue;
        const t=Math.max(0,Math.min(1,((px-p[k-4])*dx+(py-p[k-3])*dy+(pz-p[k-2])*dz)/d2));
        const distance=Math.hypot(px-p[k-4]-dx*t,py-p[k-3]-dy*t,pz-p[k-2]-dz*t);
        const margin=r+p[k-1]+(p[k+3]-p[k-1])*t+.06*s.spread*s.limbClearance;
        room=Math.min(room,1-(1-u*.75)*smooth((margin-distance)/(.08*s.spread)));
      }
    }
  }
  return room;
}
