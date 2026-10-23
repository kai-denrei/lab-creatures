export type MembraneApproach='flock'|'elastic'|'viscous';
export const CUTISLING_DEFAULTS={
  approach:'flock' as MembraneApproach,
  hunting:true,
  freedom:.22,
  turbulence:1,
  swirl:1,
  stride:1,
  grip:.85,
  tension:.3,
  viscosity:.35,
  edgeDetail:.75,
  thickness:.10,
  lipWidth:.075,
  mouthDetail:.7,
  engulfTime:3,
  veinScale:7,
  veinWarp:.85,
  veinContrast:.75,
};
export type CutislingSettings=typeof CUTISLING_DEFAULTS;
export const APPROACHES=[
  {id:'flock',name:'Flock skin',description:'Local flock fronts tug directly on the skin. Quick, uneven and restless.'},
  {id:'elastic',name:'Elastic web',description:'A spring boundary stretches behind the flock and recoils as fronts regroup.'},
  {id:'viscous',name:'Viscous sheet',description:'Local density flows through a slower boundary, with soft folds and trailing lobes.'},
] as const;
