import type {Inago} from '../inago/controller.ts';
import type {Point} from './outline.ts';
import {CUTISLING_DEFAULTS} from './settings.ts';
import type {CutislingSettings} from './settings.ts';

/** All approaches sample the same flock; only their response to its local fronts differs. */
export function createTissueEnvelope(body:Inago,settings:CutislingSettings=CUTISLING_DEFAULTS){
  const count=96,tau=Math.PI*2,raw=new Float64Array(count),smooth=new Float64Array(count),scratch=new Float64Array(count);
  const radius=new Float64Array(count),velocity=new Float64Array(count),target=new Float64Array(count);
  const contour:Point[]=Array.from({length:count*2},()=>[0,0]);
  let lastTime=-Infinity,lastConfig='',cx=0,cz=0;
  return ()=>{
    const config=[settings.approach,settings.viscosity,settings.tension,settings.edgeDetail].join('|');
    if(body.time===lastTime&&config===lastConfig)return contour;
    lastConfig=config;
    let x=0,z=0;
    for(let i=0;i<body.count;i++){x+=body.x[i];z+=body.z[i];}x/=body.count;z/=body.count;
    const dt=body.time-lastTime,reset=dt<0||dt>.25,step=Math.max(1/120,Math.min(.05,dt||1/60));
    const approach=settings.approach,viscosity=settings.viscosity;
    const follow=reset||dt===0?1:1-Math.exp(-step/(.025+viscosity*(approach==='viscous'?.6:.12)));
    cx+=(x-cx)*follow;cz+=(z-cz)*follow;if(reset){cx=x;cz=z;}
    raw.fill(0);
    for(let i=0;i<body.count;i++){
      const dx=body.x[i]-x,dz=body.z[i]-z,r=Math.hypot(dx,dz)+.12;
      const sector=(Math.round(Math.atan2(dz,dx)/tau*count)+count)%count;
      for(let d=-3;d<=3;d++){const index=(sector+d+count)%count;raw[index]=Math.max(raw[index],r*(1-d*d*.023));}
    }
    // Empty angular sectors bridge neighboring fronts, without imposing a convex hull.
    for(let i=0;i<count;i++)if(raw[i]===0){
      let left=1,right=1;while(left<count&&raw[(i-left+count)%count]===0)left++;while(right<count&&raw[(i+right)%count]===0)right++;
      raw[i]=(raw[(i-left+count)%count]*right+raw[(i+right)%count]*left)/(left+right);
    }
    smooth.set(raw);
    const passes=approach==='viscous'?8:approach==='elastic'?4:2;
    for(let pass=0;pass<passes+Math.round(settings.tension*5);pass++){
      for(let i=0;i<count;i++)scratch[i]=(smooth[(i+count-1)%count]+2*smooth[i]+smooth[(i+1)%count])*.25;
      smooth.set(scratch);
    }
    for(let i=0;i<count;i++){
      const detail=settings.edgeDetail*(approach==='viscous'?.22:.7);
      target[i]=smooth[i]+(raw[i]-smooth[i])*detail;
      if(reset||dt===0){radius[i]=target[i];velocity[i]=0;}
      else if(approach==='elastic'){
        // A damped spring ring retains momentum while neighboring fronts pull apart.
        const tension=(radius[(i+count-1)%count]+radius[(i+1)%count]-2*radius[i])*settings.tension*30;
        velocity[i]+=((target[i]-radius[i])*55+tension-velocity[i]*(7+viscosity*15))*step;
        radius[i]=Math.max(target[i]*.55,Math.min(target[i]*1.5,radius[i]+velocity[i]*step));
      }else radius[i]+=(target[i]-radius[i])*follow;
    }
    // Interpolate radii, not polygon corners: rounded lobes without straight chords or overshoot loops.
    for(let i=0;i<count*2;i++){
      const sector=Math.floor(i/2),t=(i%2)*.5,a=radius[(sector+count-1)%count],b=radius[sector],c=radius[(sector+1)%count],d=radius[(sector+2)%count];
      const r=Math.max(.05,.5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t)),angle=i/(count*2)*tau;
      contour[i][0]=cx+Math.cos(angle)*r;contour[i][1]=cz+Math.sin(angle)*r;
    }
    lastTime=body.time;return contour;
  };
}
