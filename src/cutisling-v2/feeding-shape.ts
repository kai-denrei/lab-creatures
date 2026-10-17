/** Shared resting contour: the enclosing cords and the first feeding surface
 * occupy the same place, so fusion can broaden existing tissue instead of pop in. */
export const smooth=(v:number)=>{const t=Math.max(0,Math.min(1,v));return t*t*(3-2*t);};
// Move gathered tissue sideways instead of stacking it vertically.
export const CORE_FLATNESS=.55;
export const CORE_FOOTPRINT=1/Math.sqrt(CORE_FLATNESS);
export const rootHeight=(u:number)=>CORE_FLATNESS+(1-CORE_FLATNESS)*smooth(u/.25);
export const LOOP_SWEEP=Math.PI/.95;
export function loopRadius(angle:number,u:number,spread:number,rootDistance:number){
  const ring=Math.max(.85,spread)+.075*Math.sin(angle*3)+.045*Math.sin(angle*5+.8);
  return rootDistance+(ring-rootDistance)*smooth(u/.32);
}
export function loopThickness(u:number,width:number,spread:number){
  return (.30*(1-u)**1.55+.018)*width*spread;
}
