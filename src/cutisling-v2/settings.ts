import type {V2Palette} from './palettes.ts';
export const V2_DEFAULTS={
  particles:256,rate:60,pace:1,spread:.6,alignment:1.4,separation:1.4,
  neighborRange:.75,turbulence:1.15,turnSpeed:.65,
  influenceWidth:.6,response:.24,tension:0,thickness:.07,aggro:6,
  reach:8.4,seekSweep:1.2,seekRate:1.4,organic:1,strikeSpeed:6,anchorHold:.2,anchorPull:2.5,
  senseDistance:.5,anchorBulk:.5,whipStrength:4,whipFrequency:1.3,palette:'cinder' as V2Palette,
  tendrilWidth:1,branching:1,seed:571519,frenzy:5,whipCurl:2,whipLift:3,whipAsymmetry:2.5,flattenTime:.6,
  recoveryTime:3.4,amorphous:1.6,muscleStrength:1,limbLag:1.5,
  supportReach:.88,limbClearance:1,
  crawlSway:1,crawlLift:1,crawlRate:1,
  movingLure:true,lureSpeed:1.2,lureBounce:1.2,vibrationSense:3,
  interpolation:true,cycle:true,anchoredLocomotion:true,hunting:true,showParticles:false,showSkin:true,
  veinStrength:1,veinPulse:.2,veinSpeed:2,
  veins:true,followCamera:true,renderScale:1.25,
};
export type V2Settings=typeof V2_DEFAULTS;

/** Full snapshot: unchanged switches matter when reproducing a pasted trial. */
export function serializeV2Settings(settings:V2Settings){
  return JSON.stringify({specimen:'cutisling-v2',settings:{...settings}});
}
