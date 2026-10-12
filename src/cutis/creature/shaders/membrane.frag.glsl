uniform float uTime,uPulse,uVeinWidth,uCore,uDebug,uLow;
uniform vec3 uSkin,uVein,uGlow;
varying vec3 vWorld,vRest,vHeading,vNormal;
varying float vStretch,vPhase,vSeed,vLead;
vec3 hash3(vec3 p){return fract(sin(vec3(dot(p,vec3(127.1,311.7,74.7)),dot(p,vec3(269.5,183.3,246.1)),dot(p,vec3(113.5,271.9,124.6))))*43758.5453);}
float veinField(vec3 p){
  vec3 cell=floor(p),f=fract(p);float first=10.,second=10.;
  for(int z=-1;z<=1;z++)for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){
    vec3 g=vec3(float(x),float(y),float(z));vec3 q=g+hash3(cell+g)-f;float d=dot(q,q);
    if(d<first){second=first;first=d;}else if(d<second)second=d;
  }
  return sqrt(second)-sqrt(first);
}
void main(){
  vec3 N=normalize(vNormal);if(!gl_FrontFacing)N=-N;
  vec3 V=normalize(cameraPosition-vWorld),L=normalize(vec3(-.5,1.,.7));
  float rim=pow(1.-abs(dot(N,V)),3.);
  float thick=1./vStretch;
  vec3 warped=vRest*7.2+sin(vRest.yzx*7.+sin(vRest.zxy*11.)*.5+vSeed)*.48+vSeed;
  float field=uCore>.5?1.:veinField(warped);
  float vein=1.-smoothstep(uVeinWidth/sqrt(vStretch),uVeinWidth/sqrt(vStretch)+.023,field);
  float fine=uLow>.5||uCore>.5?0.:(1.-smoothstep(.025,.065,veinField(warped*2.1)))*.32;
  vein=max(vein,fine);
  float pulse=pow(.5+.5*sin(vRest.z*9.-uTime*uPulse*(vPhase>=.62?-1.:1.)),7.);
  float gate=vPhase<.1?1.:vPhase<.55?.12:vPhase<.62?1.:vPhase<.85?.6:.08;
  pulse=max(pulse,step(.55,vPhase)*(1.-step(.62,vPhase))*vLead);
  vec3 veinColor=mix(uSkin*.78,uVein,thick);
  vec3 color=mix(uSkin,veinColor,vein*mix(.5,.94,thick));
  if(uLow<.5)N=normalize(N+vec3(dFdx(field),dFdy(field),0.)*.14);
  float diffuse=max(0.,(dot(N,L)+.45)/1.45);
  float back=pow(max(0.,dot(V,-L)),3.)*(1.-thick);
  float spec=pow(max(0.,dot(N,normalize(L+V))),100.);
  color*=.12+diffuse*.45;color+=uSkin*back*.32+vec3(1.,.91,.8)*spec*.95+rim*.17;
  vec3 reflected=reflect(-V,N);
  float window=pow(max(0.,dot(reflected,normalize(vec3(-.4,1.,.7)))),32.);
  color+=vec3(.85,.93,1.)*window*.9+uGlow*pulse*gate*vein*.7;
  float alpha=(mix(.25,.85,thick)+rim*.19)*(gl_FrontFacing?.75:.4);
  if(uCore>.5){vec3 coreTint=min(uVein,uSkin*.45);color=mix(coreTint*.28,coreTint*.9,diffuse)+uGlow*pulse*.06;alpha=1.;}
  if(uDebug>.5&&uDebug<1.5){color=vPhase<.1?vec3(.9,.65,.2):vPhase<.55?vec3(.3,.7,.8):vPhase<.62?vec3(.95,.3,.2):vPhase<.85?vec3(.7,.35,.9):vec3(.45,.8,.4);alpha=.9;}
  if(uDebug>1.5){color=mix(vec3(.1,.3,.8),vec3(1.,.2,.05),clamp((vStretch-1.)/5.,0.,1.));alpha=.95;}
  gl_FragColor=vec4(color,clamp(alpha,0.,1.));
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
