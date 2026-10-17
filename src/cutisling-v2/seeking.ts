const clamp=(v:number)=>Math.max(0,Math.min(1,v));
const smooth=(v:number)=>{const t=clamp(v);return t*t*(3-2*t);};

/** CPU adaptation of Cutis-Gorogoro's EXTEND envelope and travelling feelers
 * (cutis/creature/shaders/membrane.vert.glsl). Each probe has its own wave. */
export function seekingPose(progress:number,probe:number,sweep:number,rate:number){
  const t=clamp(progress),seed=probe*2.17+.8;
  const envelope=Math.sin(t*Math.PI)*(1-smooth((t-.78)/.22));
  const wave=t*rate*Math.PI*2+seed;
  return {
    extension:clamp(t+.12*Math.sin(wave)*envelope),
    sweep:sweep*envelope*(Math.sin(wave)+.3*Math.sin(wave*1.73+seed)),
  };
}

/** Seeded, smoothly interpolated random targets: reproducible trials without
 * per-frame random impulses or a shared repeating wave for all three arms. */
export function seekRandom(seed:number){const n=Math.sin(seed*127.1+17.7)*43758.5453;return n-Math.floor(n);}
export function seekNoise(time:number,seed:number){
  const k=Math.floor(time),f=time-k,u=f*f*f*(f*(f*6-15)+10);
  return (seekRandom(seed+k*19.19)*(1-u)+seekRandom(seed+(k+1)*19.19)*u)*2-1;
}
