/** Shared skin/contact colors; changing palette never rebuilds geometry or shaders. */
export const V2_PALETTES={
  cinder:{label:'Cinder / rust',skin:0x343d3b,veins:0x78352a},
  abyss:{label:'Abyss / cold veins',skin:0x263c48,veins:0x5f8782},
  carrion:{label:'Carrion / old ivory',skin:0x777157,veins:0x322a20},
  oxblood:{label:'Oxblood / charcoal',skin:0x4b242b,veins:0x171e21},
  bruise:{label:'Bruise / violet',skin:0x40364f,veins:0x181d2b},
};
export type V2Palette=keyof typeof V2_PALETTES;
