import type {CutislingV2} from './controller.ts';
import {smooth,loopRadius,loopThickness,LOOP_SWEEP} from './feeding-shape.ts';

import {limbPull,recoveryLimb} from './muscle-motion.ts';

const pinPoint=new Float64Array(4);

function freePose(body:CutislingV2,arm:number,u:number,time:number,angle:number,length:number,cx:number,cz:number,frenzy:number,out:Float64Array){
  const s=body.tuning,extension=smooth((length-.8)/1.6),wave=time*(.85+frenzy*1.8)*s.whipFrequency*(1+.10*s.whipAsymmetry*Math.sin(arm*2))-u*(4.2+s.whipCurl)+arm*2.3;
  const amplitude=Math.min(length*.18,(.38+frenzy*.16)*s.whipStrength*s.seekSweep*s.whipCurl);
  const curl=Math.sin(u*Math.PI)*(amplitude*Math.sin(wave)+amplitude*.3*Math.sin(wave*1.7+arm))*extension;
  // Roots start inside the small tissue junction, so their caps stay buried.
  const rootAngle=arm*Math.PI*2/body.tentacleCount+.7;
  const rootX=.08*s.spread*Math.cos(rootAngle)*(1-u),rootZ=.08*s.spread*Math.sin(rootAngle)*(1-u);
  const radius=loopThickness(u,s.tendrilWidth,s.spread)*(1-smooth((u-.94)/.06));
  const along=u;
  out[0]=cx+rootX+Math.cos(angle)*length*along-Math.sin(angle)*curl;
  out[2]=cz+rootZ+Math.sin(angle)*length*along+Math.cos(angle)*curl;
  out[1]=.018+radius+(.075+frenzy*.08)*s.whipLift*Math.sin(u*Math.PI)**2*(.5+.5*Math.sin(wave))*extension;
  out[3]=radius;
}

/** Shared visible/sensing curve. Slots 7 and 8 are newly sprouted feeding arms. */
export function sampleTendril(body:CutislingV2,arm:number,u:number,out:Float64Array,interpolate=true){
  const s=body.tuning,p=body.probes[arm];
  const cx=interpolate?body.mix(body.previousCenterX,body.centerX):body.centerX,cz=interpolate?body.mix(body.previousCenterZ,body.centerZ):body.centerZ;
  const time=interpolate?body.mix(body.previousTime,body.time):body.time;
  const wrap=interpolate?body.mix(body.previousWrap,body.wrap):body.wrap;
  const sheet=interpolate?body.mix(body.previousSheet,body.sheet):body.sheet;
  if(arm>=7){
    const active=body.holdingPrey&&(body.phase==='EXTEND2'||body.phase==='SURROUND'||body.phase==='FLATTEN'||body.phase==='ENGULF'||body.phase==='ABSORB');
    const side=arm===7?1:-1,growth=active?smooth(wrap/.22):0;
    const heading=Math.atan2(body.wrapRootZ-body.preyZ,body.wrapRootX-body.preyX);
    const rootDistance=Math.hypot(body.wrapRootX-body.preyX,body.wrapRootZ-body.preyZ);
    const wave=time*(2+s.frenzy)*s.whipFrequency-u*(5+s.whipCurl*2)+arm*(1.7+s.whipAsymmetry);
    const disturbance=Math.sin(u*Math.PI)*(1-smooth((wrap-.65)/.35));
    const bend=.16*s.whipStrength*s.whipCurl*Math.sin(wave)*disturbance;
    const angle=heading+side*(LOOP_SWEEP*smooth(wrap)*u+bend*growth);
    const radius=rootDistance+(loopRadius(angle,u,s.spread,rootDistance)-rootDistance)*growth;
    out[0]=body.preyX+Math.cos(angle)*radius;out[2]=body.preyZ+Math.sin(angle)*radius;
    const tubeRadius=loopThickness(u,s.tendrilWidth,s.spread)*growth;
    const safe=body.preyRadius+tubeRadius+.025;
    if(radius<safe){out[0]=body.preyX+Math.cos(angle)*safe;out[2]=body.preyZ+Math.sin(angle)*safe;}
    out[3]=tubeRadius*(1-smooth((sheet-.12)/.88))*(1-smooth((u-.94)/.06));
    out[1]=.018+out[3]*(1-sheet*.75)+.16*s.whipStrength*s.whipLift*disturbance**2*(.5+.5*Math.sin(wave))*growth*(1-sheet);
    return;
  }
  if(body.holdingPrey){
    // Retain the captured curve as material coordinates. Its root follows the
    // arriving body while the actual anchor tip remains planted under tension.
    const k=u*32,j=Math.min(31,Math.floor(k)),f=k-j,offset=(arm*33+j)*4;
    for(let axis=0;axis<4;axis++)out[axis]=body.attackPaths[offset+axis]*(1-f)+body.attackPaths[offset+4+axis]*f;
    const travel=interpolate?body.mix(body.previousAnchorTravel,body.anchorTravel):body.anchorTravel;
    if(arm===body.chosenProbe){
      const residualX=out[0]-(body.anchorFromX+(body.anchorX-body.anchorFromX)*u);
      const residualZ=out[2]-(body.anchorFromZ+(body.anchorZ-body.anchorFromZ)*u);
      out[0]=cx+(body.anchorX-cx)*u+residualX*(1-.8*travel);
      out[2]=cz+(body.anchorZ-cz)*u+residualZ*(1-.8*travel);
    }else{
      const retain=1-.75*limbPull(travel,arm,s.limbLag*s.muscleStrength)-.18*smooth(wrap);
      out[0]=cx+(out[0]-body.anchorFromX)*retain;
      out[2]=cz+(out[2]-body.anchorFromZ)*retain;
    }
    // Remaining cords feed into the arriving body, then into the broad sheet.
    out[0]=out[0]*(1-sheet)+cx*sheet;out[2]=out[2]*(1-sheet)+cz*sheet;
    const retained=Math.sqrt(1-sheet)*(1-.30*travel*smooth(u))*(1-.25*smooth(wrap));
    out[3]*=retained;out[1]=.018+(out[1]-.018)*retained;
    return;
  }
  const angle=interpolate?body.mix(p.previousAngle,p.angle):p.angle,length=interpolate?body.mix(p.previousLength,p.length):p.length;
  const grip=arm===body.chosenProbe?body.anchorGrip:0;
  if(arm===body.chosenProbe&&body.anchorVisible){
    freePose(body,arm,u,body.anchorTime,body.anchorAngle,body.anchorLength,body.anchorFromX,body.anchorFromZ,0,out);
    freePose(body,arm,body.anchorU,body.anchorTime,body.anchorAngle,body.anchorLength,body.anchorFromX,body.anchorFromZ,0,pinPoint);
    const pin=smooth(u/Math.max(.015,body.anchorU));
    out[0]+=(body.anchorX-pinPoint[0])*pin;out[2]+=(body.anchorZ-pinPoint[2])*pin;
    const pull=1-pin;
    out[0]+=(cx-body.anchorFromX)*pull;out[2]+=(cz-body.anchorFromZ)*pull;
  }else{
    freePose(body,arm,u,time,angle,length,cx,cz,body.predation*s.frenzy,out);
  }
  if(body.phase==='RECOVER'){
    const growth=recoveryLimb(body.recoveryProgress(interpolate),arm,s.limbLag);
    out[0]=cx+(out[0]-cx)*growth;out[2]=cz+(out[2]-cz)*growth;
    out[3]*=growth;out[1]=.018+(out[1]-.018)*growth;
  }
  if(grip){const bulk=.14*grip*s.anchorBulk*s.tendrilWidth*s.spread*Math.exp(-(((u-body.anchorU)/.13)**2));out[3]+=bulk;out[1]+=bulk;}
}
