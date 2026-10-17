import {smooth} from './feeding-shape.ts';

/** Overlapping contractions: monotone travel with quiet intervals, no position jumps. */
export function muscleProgress(progress:number,strength:number){
  const p=Math.max(0,Math.min(1,progress));
  const even=p*p*p*(10+p*(-15+6*p));
  const contractions=.28*smooth(p/.36)+.39*smooth((p-.25)/.40)+.33*smooth((p-.53)/.47);
  return even+(contractions-even)*strength;
}

/** Different limbs take up slack at different times, but all finish together. */
export function limbPull(travel:number,arm:number,lag:number){
  return Math.max(0,Math.min(1,travel))**(1+lag*(.65+.55*Math.sin(arm*2.37+1)));
}

export function recoveryGather(progress:number){return smooth(progress/.62);}
export function recoveryLimb(progress:number,arm:number,lag:number){
  const start=.64+.14*lag*(.5+.5*Math.sin(arm*2.37+1));
  return smooth((progress-start)/(.98-start));
}

/** Broad asymmetric lobes, continuous across the UV seam and both poles. */
export function coreLobe(x:number,y:number,z:number,time:number,amount:number){
  return 1+amount*(.19*(x*x-z*z)+.16*x*z+.13*x*(1-y*y)-.09*z+.07*y*z
    +.055*Math.sin(time*.83)*x*y+.045*Math.sin(time*.61+1)*z*z);
}
