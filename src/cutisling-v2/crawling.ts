import type {CutislingV2} from './controller.ts';

/** A slow, unequal rhythm shared by the body, limbs and feeding surface. */
export function crawlWave(time:number,offset:number,rate:number){
  const phase=time*rate*2.6+offset;
  return .76*Math.sin(phase)+.24*Math.sin(phase*1.63+.8);
}

/** Zero displacement and velocity at both ends of a committed foothold pull. */
export function crawlSway(progress:number,phase:number,rate:number){
  const p=Math.max(0,Math.min(1,progress));
  return Math.sin(Math.PI*p)**2*(.78*Math.sin(p*Math.PI*4*rate+phase)+.22*Math.sin(p*Math.PI*7*rate+phase*.6));
}

export function crawlLift(body:CutislingV2,time:number){
  const wave=crawlWave(time,body.tuning.seed%97*.1,body.tuning.crawlRate);
  return .07*body.tuning.spread*body.tuning.crawlLift*(.5+.5*wave)**2;
}

/** The gripping pose holds its weight, then takes up the live crawling rhythm. */
export function coreCrawlLift(body:CutislingV2,time:number,travel:number){
  const live=crawlLift(body,time);
  return body.holdingPrey?crawlLift(body,body.contactTime)*(1-travel)+live*travel:live;
}
