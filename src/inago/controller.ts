export type InagoPhase='MOVE'|'SPREAD'|'COALESCE';
const hash=(n:number)=>{const v=Math.sin(n*127.1+17.7)*43758.5453;return v-Math.floor(v);};
const clamp=(v:number,min:number,max:number)=>Math.max(min,Math.min(max,v));
/** One distributed body: local alignment/separation, one shared intention and cycle. */
export class Inago{
  get count():number{return 768;}
  readonly x=new Float64Array(this.count);readonly z=new Float64Array(this.count);
  readonly vx=new Float64Array(this.count);readonly vz=new Float64Array(this.count);
  readonly angle=new Float64Array(this.count);readonly seed=Float64Array.from({length:this.count},(_,i)=>hash(i+9));
  private nextX=new Float64Array(this.count);private nextZ=new Float64Array(this.count);
  private heads=new Int32Array(1600);private next=new Int32Array(this.count);
  time=0;centerX=0;centerZ=0;heading=0;radius=1.3;
  pace=1;spread=1;cohesion=1;paused=false;
  target:{x:number;z:number;blend?:number}|null=null;
  get phase():InagoPhase{const t=this.time%18;return t<6?'MOVE':t<11?'SPREAD':'COALESCE';}
  get phaseProgress(){const t=this.time%18;return t<6?t/6:t<11?(t-6)/5:(t-11)/7;}
  get cycle(){return Math.floor(this.time/18)+1;}
  reset(){
    this.time=0;this.centerX=0;this.centerZ=0;this.heading=0;this.radius=1.3;this.target=null;
    for(let i=0;i<this.count;i++){
      const a=i*2.39996323,r=Math.sqrt((i+.5)/this.count)*1.3;
      this.x[i]=Math.cos(a)*r;this.z[i]=Math.sin(a)*r;this.vx[i]=0;this.vz[i]=0;this.angle[i]=a;
    }
  }
  constructor(){this.reset();}
  lure(x:number,z:number){const length=Math.max(1,Math.hypot(x,z)/7);this.target={x:x/length,z:z/length};}
  /** Local exposure hook for future enemy integration; motiles have no separate health. */
  contactAt(x:number,z:number,radius=.2){
    let density=0;
    for(let i=0;i<this.count;i++){const d=Math.hypot(x-this.x[i],z-this.z[i]);if(d<radius+.09)density+=1-d/(radius+.09);}
    return {density,exposure:Math.min(1,density/8)};
  }
  step(dt:number){
    if(this.paused||dt<=0)return;
    // Fixed substeps keep steering stable after tab stalls and caller frame-rate changes.
    let remaining=Math.min(dt,.25)*this.pace;
    while(remaining>1e-9){const h=Math.min(1/60,remaining);this.advance(h);remaining-=h;}
  }
  /** Optional shared steering field; local flock forces remain active in every behavior. */
  protected steering(_i:number,_x:number,_z:number):{x:number;z:number;blend?:number}|null{void _i;void _x;void _z;return null;}
  private advance(dt:number){
    this.time+=dt;
    const phase=this.phase,spread=phase==='SPREAD',coalesce=phase==='COALESCE';
    const destination=this.target??{x:Math.sin(this.time*.105+.8)*4.6,z:Math.cos(this.time*.077+1.1)*4.6};
    const dx=destination.x-this.centerX,dz=destination.z-this.centerZ,d=Math.hypot(dx,dz);
    if(d>.02){const angle=Math.atan2(dz,dx);this.heading+=Math.atan2(Math.sin(angle-this.heading),Math.cos(angle-this.heading))*(1-Math.exp(-dt*2));}
    const speed=Math.min(d*1.1,phase==='MOVE'?1.25:spread?.3:.12);
    const flowX=Math.cos(this.heading)*speed,flowZ=Math.sin(this.heading)*speed;
    this.centerX+=flowX*dt;this.centerZ+=flowZ*dt;
    const desiredRadius=spread?4.2*this.spread:coalesce?1.05:1.9;
    this.radius+=(desiredRadius-this.radius)*(1-Math.exp(-dt*(coalesce?.75:1)));
    this.heads.fill(-1);
    for(let i=0;i<this.count;i++){
      const ix=clamp(Math.floor((this.x[i]+12)/.6),0,39),iz=clamp(Math.floor((this.z[i]+12)/.6),0,39),cell=ix+iz*40;
      this.next[i]=this.heads[cell];this.heads[cell]=i;
    }
    for(let i=0;i<this.count;i++){
      const x=this.x[i],z=this.z[i],ix=clamp(Math.floor((x+12)/.6),0,39),iz=clamp(Math.floor((z+12)/.6),0,39);
      let repelX=0,repelZ=0,alignX=0,alignZ=0,neighbors=0;
      for(let zz=Math.max(0,iz-1);zz<=Math.min(39,iz+1);zz++)for(let xx=Math.max(0,ix-1);xx<=Math.min(39,ix+1);xx++){
        for(let j=this.heads[xx+zz*40];j>=0;j=this.next[j]){
          if(j===i)continue;
          const ax=x-this.x[j],az=z-this.z[j],d2=ax*ax+az*az;
          if(d2<.36){alignX+=this.vx[j];alignZ+=this.vz[j];neighbors++;}
          if(d2<.0225&&d2>1e-9){const strength=(.15-Math.sqrt(d2))/d2;repelX+=ax*strength;repelZ+=az*strength;}
        }
      }
      const radialX=x-this.centerX,radialZ=z-this.centerZ,r=Math.hypot(radialX,radialZ)||.001;
      const theta=Math.atan2(radialZ,radialX),wave=Math.sin(theta*3-this.time*.9+r*1.1);
      // Three broad lobes split and reconnect through local neighbor alignment.
      const lobe=this.heading+(i%3)*Math.PI*2/3+Math.sin(this.time*.35)*.45;
      const branch=spread?this.radius*.58:0;
      const homeX=this.centerX+Math.cos(lobe)*branch,homeZ=this.centerZ+Math.sin(lobe)*branch;
      const extent=this.radius*(.75+.25*this.seed[i])*(1+.15*wave);
      const outward=spread&&r<extent?2.15:0;
      const pull=Math.max(0,r-extent)*1.5*this.cohesion+(coalesce?.55:.15)*this.cohesion;
      const curl=(coalesce?.6:.3)+wave*.25;
      const drift=this.time*(.6+this.seed[i]*.3)+this.seed[i]*18;
      let ax=flowX*2.5+(homeX-x)*pull+radialX/r*outward-radialZ/r*curl+repelX*.7+Math.sin(drift)*.18;
      let az=flowZ*2.5+(homeZ-z)*pull+radialZ/r*outward+radialX/r*curl+repelZ*.7+Math.cos(drift*1.13)*.18;
      const intent=this.steering(i,x,z);
      if(intent){const blend=intent.blend??1;ax+=(intent.x+repelX*.7+Math.sin(drift)*.35-ax)*blend;az+=(intent.z+repelZ*.7+Math.cos(drift*1.13)*.35-az)*blend;}
      if(neighbors){ax+=(alignX/neighbors-this.vx[i])*1.8;az+=(alignZ/neighbors-this.vz[i])*1.8;}
      ax-=this.vx[i]*1.6;az-=this.vz[i]*1.6;
      const acceleration=Math.max(1,Math.hypot(ax,az)/9);ax/=acceleration;az/=acceleration;
      let vx=this.vx[i]+ax*dt,vz=this.vz[i]+az*dt;
      const cap=2.4+this.seed[i]*.5,limit=Math.max(1,Math.hypot(vx,vz)/cap);vx/=limit;vz/=limit;
      this.nextX[i]=vx;this.nextZ[i]=vz;
    }
    for(let i=0;i<this.count;i++){
      this.vx[i]=this.nextX[i];this.vz[i]=this.nextZ[i];this.x[i]+=this.vx[i]*dt;this.z[i]+=this.vz[i]*dt;
      const distance=Math.hypot(this.x[i],this.z[i]);
      if(distance>10.8){this.x[i]*=10.8/distance;this.z[i]*=10.8/distance;const outward=(this.vx[i]*this.x[i]+this.vz[i]*this.z[i])/10.8;if(outward>0){this.vx[i]-=this.x[i]/10.8*outward*1.5;this.vz[i]-=this.z[i]/10.8*outward*1.5;}}
      if(Math.hypot(this.vx[i],this.vz[i])>.03){const angle=Math.atan2(this.vx[i],this.vz[i]);this.angle[i]+=Math.atan2(Math.sin(angle-this.angle[i]),Math.cos(angle-this.angle[i]))*(1-Math.exp(-dt*10));}
    }
  }
}
