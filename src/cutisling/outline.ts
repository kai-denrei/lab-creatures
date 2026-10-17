export type Point=[number,number];
export interface Opening{x:number;z:number;radius:number;coverage:number;gapX?:number;gapZ?:number;gapWidth?:number;time?:number;detail?:number;pressure?:Float64Array}
/** Smooth, invertible tissue shear: unequal advancing lips, never a circular punch-out. */
function openingWarp(time:number){return [1.12+.06*Math.sin(time*.31),.88+.05*Math.sin(time*.27),time*.4,-time*.33];}
function warpPoint(opening:Opening,p:Point):Point{
  if(opening.time===undefined)return p;
  const [sx,sz,px,pz]=openingWarp(opening.time),x=p[0]-opening.x,z=p[1]-opening.z;
  const angle=(Math.atan2(z,x)+Math.PI)/(Math.PI*2)*24,index=Math.floor(angle)%24,t=angle-Math.floor(angle),pressure=opening.pressure;
  const local=pressure?(pressure[index]*(1-t)+pressure[(index+1)%24]*t):0;
  const detail=opening.detail??.7,r=Math.hypot(x,z),fade=Math.exp(-r*r/16),phase=opening.time;
  const ripple=(.09*Math.sin(x*3.7+z*1.9+phase*.8)+.055*Math.sin(z*5.3-x*2.1-phase*1.1)-local*.12)*detail*fade;
  return [opening.x+(x*sx+.18*(Math.sin(z*1.7+px)-Math.sin(px)))*(1+ripple),opening.z+(z*sz+.12*(Math.sin(x*2+pz)-Math.sin(pz)))*(1+ripple)];
}
const cross=(ax:number,az:number,bx:number,bz:number)=>ax*bz-az*bx;
export function polygonArea(points:Point[]){let area=0;for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length];area+=cross(a[0],a[1],b[0],b[1]);}return area*.5;}
export function contains(points:Point[],x:number,z:number){
  let inside=false;
  for(let i=0,j=points.length-1;i<points.length;j=i++){
    const a=points[i],b=points[j];if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])inside=!inside;
  }
  return inside;
}
const smoothMax=(a:number,b:number)=>Math.max(a,b)+Math.max(0,.12-Math.abs(a-b))**2/.48;
export function openingContour(opening:Opening|null,padding=0):Point[]{
  if(!opening||opening.radius<=.002)return [];
  const {x,z}=opening,r=opening.radius+padding,w=(opening.gapWidth??0)+padding;
  if(!opening.gapWidth)return Array.from({length:64},(_,i)=>{const a=i/64*Math.PI*2;return warpPoint(opening,[x+Math.cos(a)*r,z+Math.sin(a)*r]);});
  const gx=opening.gapX??1,gz=opening.gapZ??0,points:Point[]=[];
  const point=(along:number,across:number):Point=>[x+gx*along-gz*across,z+gz*along+gx*across];
  const channel=(s:number,side:number)=>point(s,side*w+.16*(opening.detail??.7)*Math.sin(s*1.8+(opening.time??0)*.6)*Math.min(1,(s-r-.16)*2)*Math.exp(-s*s/60));
  points.push(point(35,w));
  for(let s=8;s>r+.16;s-=.24)points.push(channel(s,1));
  for(let i=24;i>=0;i--){const s=i/24*(r+.16);points.push(point(s,smoothMax(Math.sqrt(Math.max(0,r*r-s*s)),w)));}
  // Smooth the rear of the cup into the two lips, including very wide flanks.
  const rearRadius=smoothMax(r,w);
  for(let i=1;i<=40;i++){const a=Math.PI*.5+i/40*Math.PI;points.push(point(Math.cos(a)*rearRadius,Math.sin(a)*rearRadius));}
  for(let i=1;i<=24;i++){const s=i/24*(r+.16);points.push(point(s,-smoothMax(Math.sqrt(Math.max(0,r*r-s*s)),w)));}
  for(let s=r+.4;s<8;s+=.24)points.push(channel(s,-1));
  points.push(point(35,-w));return points.map(p=>warpPoint(opening,p));
}
/** Polygon difference keeps real boundary loops, including the hole once sealed. */
export function subtractOpening(outer:Point[],cut:Point[]):Point[][]{
  if(polygonArea(outer)<0)outer=[...outer].reverse();
  if(cut.length===0)return [outer];
  if(polygonArea(cut)<0)cut=[...cut].reverse();
  const outerSplits=outer.map(()=>[0,1]),cutSplits=cut.map(()=>[0,1]);
  for(let i=0;i<outer.length;i++){
    const a=outer[i],b=outer[(i+1)%outer.length],dx=b[0]-a[0],dz=b[1]-a[1];
    for(let j=0;j<cut.length;j++){
      const c=cut[j],d=cut[(j+1)%cut.length];
      if(Math.max(a[0],b[0])<Math.min(c[0],d[0])||Math.min(a[0],b[0])>Math.max(c[0],d[0])||Math.max(a[1],b[1])<Math.min(c[1],d[1])||Math.min(a[1],b[1])>Math.max(c[1],d[1]))continue;
      const ex=d[0]-c[0],ez=d[1]-c[1],det=cross(dx,dz,ex,ez);if(Math.abs(det)<1e-10)continue;
      const cx=c[0]-a[0],cz=c[1]-a[1],t=cross(cx,cz,ex,ez)/det,u=cross(cx,cz,dx,dz)/det;
      if(t>=0&&t<=1&&u>=0&&u<=1){outerSplits[i].push(t);cutSplits[j].push(u);}
    }
  }
  const segments:{a:Point;b:Point;used:boolean}[]=[];
  const append=(points:Point[],splits:number[][],other:Point[],reverse:boolean)=>{
    for(let i=0;i<points.length;i++){
      const a=points[i],b=points[(i+1)%points.length],values=splits[i].sort((x,y)=>x-y);
      const at=(t:number):Point=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
      for(let j=0;j<values.length-1;j++){
        if(values[j+1]-values[j]<1e-8)continue;
        const mid=at((values[j]+values[j+1])*.5);if(contains(other,mid[0],mid[1])!==reverse)continue;
        const p=at(values[j]),q=at(values[j+1]);segments.push({a:reverse?q:p,b:reverse?p:q,used:false});
      }
    }
  };
  append(outer,outerSplits,cut,false);append(cut,cutSplits,outer,true);
  const key=(p:Point)=>`${Math.round(p[0]*1e6)},${Math.round(p[1]*1e6)}`,starts=new Map<string,number[]>();
  segments.forEach((s,i)=>{const k=key(s.a);if(!starts.has(k))starts.set(k,[]);starts.get(k)!.push(i);});
  const loops:Point[][]=[];
  for(let i=0;i<segments.length;i++){
    if(segments[i].used)continue;const loop:Point[]=[],first=key(segments[i].a);let index=i,closed=false;
    for(let step=0;step<segments.length;step++){
      const s=segments[index];s.used=true;loop.push(s.a);const end=key(s.b);if(end===first){closed=true;break;}
      const next=starts.get(end)?.find(k=>!segments[k].used);if(next===undefined)break;index=next;
    }
    if(closed&&loop.length>=3&&Math.abs(polygonArea(loop))>1e-5)loops.push(loop);
  }
  return loops;
}
/** Round new junctions where a feeding lip meets the outer skin. */
export function roundContour(points:Point[]):Point[]{
  const rounded:Point[]=[];
  for(let i=0;i<points.length;i++){
    const a=points[(i+points.length-1)%points.length],b=points[i],c=points[(i+1)%points.length],ux=a[0]-b[0],uz=a[1]-b[1],vx=c[0]-b[0],vz=c[1]-b[1],u=Math.hypot(ux,uz),v=Math.hypot(vx,vz);
    if(u<1e-6||v<1e-6)continue;
    if((ux*vx+uz*vz)/(u*v)<-.94){rounded.push(b);continue;}
    const radius=Math.min(.10,u*.35,v*.35),p:Point=[b[0]+ux/u*radius,b[1]+uz/u*radius],q:Point=[b[0]+vx/v*radius,b[1]+vz/v*radius];
    for(let j=0;j<=4;j++){const t=j/4,s=1-t;rounded.push([s*s*p[0]+2*s*t*b[0]+t*t*q[0],s*s*p[1]+2*s*t*b[1]+t*t*q[1]]);}
  }
  return rounded;
}
