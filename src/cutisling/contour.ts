import type {Point} from './outline.ts';
import {polygonArea} from './outline.ts';
/**
 * Marching squares at `iso`. Each crossing is walked with the interior (≥ iso) on its
 * left, so outer loops come out counterclockwise (positive area) and holes clockwise.
 * Edge ids: the horizontal edge from node (i,j) to (i+1,j) is 2·(j·nodes+i); the vertical
 * edge from (i,j) to (i,j+1) is that plus one.
 */
export function traceContours(values:Float32Array,nodes:number,iso:number,cell:number,half:number,minArea=.02):Point[][]{
  const next=new Int32Array(nodes*nodes*2).fill(-1);
  const at=(i:number,j:number)=>values[j*nodes+i];
  let used=0;
  for(let j=0;j<nodes-1;j++)for(let i=0;i<nodes-1;i++){
    const a=at(i,j)>=iso,b=at(i+1,j)>=iso,c=at(i+1,j+1)>=iso,d=at(i,j+1)>=iso;
    const code=(a?1:0)|(b?2:0)|(c?4:0)|(d?8:0);
    if(code===0||code===15)continue;
    const B=(j*nodes+i)*2,R=(j*nodes+i+1)*2+1,T=((j+1)*nodes+i)*2,L=(j*nodes+i)*2+1;
    used++;
    switch(code){
      case 1:next[B]=L;break;case 2:next[R]=B;break;case 4:next[T]=R;break;case 8:next[L]=T;break;
      case 3:next[R]=L;break;case 6:next[T]=B;break;case 12:next[L]=R;break;case 9:next[B]=T;break;
      case 14:next[L]=B;break;case 13:next[B]=R;break;case 11:next[R]=T;break;case 7:next[T]=L;break;
      case 5:{const centre=(at(i,j)+at(i+1,j)+at(i+1,j+1)+at(i,j+1))*.25>=iso;if(centre){next[B]=R;next[T]=L;}else{next[B]=L;next[T]=R;}break;}
      case 10:{const centre=(at(i,j)+at(i+1,j)+at(i+1,j+1)+at(i,j+1))*.25>=iso;if(centre){next[L]=B;next[R]=T;}else{next[R]=B;next[L]=T;}break;}
    }
  }
  if(used===0)return [];
  const point=(edge:number):Point=>{
    const node=edge>>1,i=node%nodes,j=(node-i)/nodes,f0=values[node];
    if((edge&1)===0){const f1=values[node+1],t=(iso-f0)/((f1-f0)||1e-9);return [(i+Math.max(0,Math.min(1,t)))*cell-half,j*cell-half];}
    const f1=values[node+nodes],t=(iso-f0)/((f1-f0)||1e-9);return [i*cell-half,(j+Math.max(0,Math.min(1,t)))*cell-half];
  };
  const loops:Point[][]=[];
  for(let start=0;start<next.length;start++){
    if(next[start]<0)continue;
    const loop:Point[]=[];let edge=start;
    for(let guard=0;guard<next.length&&edge>=0;guard++){
      loop.push(point(edge));const following=next[edge];next[edge]=-1;edge=following;
      if(edge===start)break;
    }
    if(edge!==start||loop.length<4)continue;
    // One smoothing pass removes the grid staircase without leaving the cell band.
    const smoothed=loop.map((p,k):Point=>{const q=loop[(k+loop.length-1)%loop.length],r=loop[(k+1)%loop.length];return [(q[0]+2*p[0]+r[0])*.25,(q[1]+2*p[1]+r[1])*.25];});
    if(Math.abs(polygonArea(smoothed))>=minArea)loops.push(smoothed);
  }
  return loops;
}
