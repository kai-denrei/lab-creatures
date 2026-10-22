import type {CutislingV2} from './controller.ts';
import {smooth,loopRadius,loopThickness,LOOP_SWEEP} from './feeding-shape.ts';

import {crawlLift,crawlWave,coreCrawlLift} from './crawling.ts';
import {resolvedTendril} from './tendril-clearance.ts';
import {limbPull,recoveryLimb} from './muscle-motion.ts';

const pinPoint=new Float64Array(4);

function freePose(body:CutislingV2,arm:number,u:number,time:number,angle:number,length:number,cx:number,cz:number,frenzy:number,out:Float64Array){
  const s=body.tuning,extension=smooth((length-.8)/1.6),wave=time*(.85+frenzy*1.8)*s.whipFrequency*(1+.10*s.whipAsymmetry*Math.sin(arm*2))-u*(4.2+s.whipCurl)+arm*2.3;
  const amplitude=Math.min(length*.18,(.38+frenzy*.16)*s.whipStrength*s.seekSweep*s.whipCurl);
  const crawling=crawlWave(time,arm*1.87-u*6,s.crawlRate),envelope=Math.sin(u*Math.PI)**2;
  const curl=Math.sin(u*Math.PI)*(amplitude*Math.sin(wave)+amplitude*.3*Math.sin(wave*1.7+arm))*extension
    +.13*s.spread*s.crawlSway*envelope*crawling*extension;
  // Roots start inside the small tissue junction, so their caps stay buried.
  const rootAngle=arm*Math.PI*2/body.tentacleCount+.7;
  const rootX=.08*s.spread*Math.cos(rootAngle)*(1-u),rootZ=.08*s.spread*Math.sin(rootAngle)*(1-u);
  const radius=loopThickness(u,s.tendrilWidth,s.spread)*(1-smooth((u-.94)/.06));
  const along=u;
  out[0]=cx+rootX+Math.cos(angle)*length*along-Math.sin(angle)*curl;
  out[2]=cz+rootZ+Math.sin(angle)*length*along+Math.cos(angle)*curl;
  out[1]=.018+radius+(.075+frenzy*.08)*s.whipLift*Math.sin(u*Math.PI)**2*(.5+.5*Math.sin(wave))*extension;
  out[1]+=crawlLift(body,time)*(1-u)+.07*s.spread*s.crawlLift*envelope*(.5+.5*crawling)**2*extension;
  out[3]=radius;
}

/** Shared visible/sensing curve. Slots 7 and 8 are newly sprouted feeding arms. */
export function sampleRawTendril(body:CutislingV2,arm:number,u:number,out:Float64Array,interpolate=true){
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
    const bend=(.16*s.whipStrength*s.whipCurl*Math.sin(wave)+.13*s.crawlSway*crawlWave(time,arm*1.87-u*6,s.crawlRate))*disturbance;
    const sweep=LOOP_SWEEP*smooth(wrap)*u;
    // Keep both flanks on their own side while casting; only the thin tips unite.
    const guarded=s.limbClearance>0?Math.max(-sweep*.45,Math.min(sweep*.45,bend*growth)):bend*growth;
    const angle=heading+side*(sweep+guarded);
    const radius=rootDistance+(loopRadius(angle,u,s.spread,rootDistance)-rootDistance)*growth;
    out[0]=body.preyX+Math.cos(angle)*radius;out[2]=body.preyZ+Math.sin(angle)*radius;
    const tubeRadius=loopThickness(u,s.tendrilWidth,s.spread)*growth;
    const safe=body.preyRadius+tubeRadius+.025;
    if(radius<safe){out[0]=body.preyX+Math.cos(angle)*safe;out[2]=body.preyZ+Math.sin(angle)*safe;}
    out[3]=tubeRadius*(1-smooth((sheet-.12)/.88))*(1-smooth((u-.94)/.06));
    out[1]=.018+out[3]*(1-sheet*.75)+.16*s.whipStrength*s.whipLift*disturbance**2*(.5+.5*Math.sin(wave))*growth*(1-sheet);
    out[1]+=(coreCrawlLift(body,time,interpolate?body.mix(body.previousAnchorTravel,body.anchorTravel):body.anchorTravel)*(1-u)
      +.09*s.spread*s.crawlLift*disturbance**2*(.5+.5*crawlWave(time,arm*1.87-u*6,s.crawlRate))**2)*growth*(1-sheet)*(1-smooth((wrap-.65)/.35));
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
      const shortening=(1-s.supportReach);
      const retain=1-shortening*limbPull(travel,arm,s.limbLag*s.muscleStrength)-.24*shortening*smooth(wrap);
      out[0]=cx+(out[0]-body.anchorFromX)*retain;
      out[2]=cz+(out[2]-body.anchorFromZ)*retain;
      // Backward raking bends and alternate release give the long supporters work to do.
      const drive=Math.max(0,(s.supportReach-.25)/.75)*travel;
      const dx=body.drawX-body.anchorFromX,dz=body.drawZ-body.anchorFromZ,distance=Math.hypot(dx,dz)||1;
      const stroke=.22*s.spread*drive*u*Math.sin(Math.PI*travel)*crawlWave(time,arm*2.1,s.crawlRate);
      out[0]-=dx/distance*stroke;out[2]-=dz/distance*stroke;
    }
    // Independent contractions continue down the held limbs without moving the grip.
    const envelope=Math.sin(Math.PI*u)**2,phase=arm*1.87-u*6;
    const now=crawlWave(time,phase,s.crawlRate),then=crawlWave(body.contactTime,phase,s.crawlRate);
    const angle=body.probes[arm].angle,curl=.10*s.spread*s.crawlSway*envelope*(now-then)*travel;
    out[0]-=Math.sin(angle)*curl;out[2]+=Math.cos(angle)*curl;
    const rise=.06*s.spread*s.crawlLift*envelope*((.5+.5*now)**2-(.5+.5*then)**2)*travel;
    out[1]=Math.max(.018+out[3],out[1]+rise+(crawlLift(body,time)-crawlLift(body,body.contactTime))*(1-u)*travel);
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
    const travel=interpolate?body.mix(body.previousAnchorTravel,body.anchorTravel):body.anchorTravel;
    // Straighten the loaded arm as its root arrives. A cubic root translation
    // folded the middle backwards when the body approached its own planted tip.
    const rx=out[0]-(body.anchorFromX+(body.anchorX-body.anchorFromX)*u);
    const rz=out[2]-(body.anchorFromZ+(body.anchorZ-body.anchorFromZ)*u);
    out[0]=cx+(body.anchorX-cx)*u+rx*(1-.9*travel);
    out[2]=cz+(body.anchorZ-cz)*u+rz*(1-.9*travel);
    out[1]+=(crawlLift(body,time)-crawlLift(body,body.anchorTime))*(1-pin);
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

/** Resolved centerlines are shared by rendering, sensing and anchor selection. */
export function sampleTendril(body:CutislingV2,arm:number,u:number,out:Float64Array,interpolate=true){
  resolvedTendril(body,arm,u,out,interpolate);
}
