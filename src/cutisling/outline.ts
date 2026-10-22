export type Point=[number,number];
/** Prey hole as seen by the membrane: mask radius, coverage and the rendered prey size for clearance. */
export interface Opening{x:number;z:number;radius:number;coverage:number;preyRadius:number;preyScale:number;time?:number;detail?:number;pressure?:Float64Array}
const cross=(ax:number,az:number,bx:number,bz:number)=>ax*bz-az*bx;
export function polygonArea(points:Point[]){let area=0;for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length];area+=cross(a[0],a[1],b[0],b[1]);}return area*.5;}
export function contains(points:Point[],x:number,z:number){
  let inside=false;
  for(let i=0,j=points.length-1;i<points.length;j=i++){
    const a=points[i],b=points[j];if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])inside=!inside;
  }
  return inside;
}
