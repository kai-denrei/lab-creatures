attribute vec3 iOffset;
attribute vec3 iHeading;
attribute vec3 iPreviousHeading;
attribute vec3 iAnchor;
attribute vec4 iState;
#define iPhase iState.x
#define iSeed iState.y
#define iScale iState.z
attribute vec4 iParams;
attribute vec3 iProbe0,iProbe1,iProbe2;
#define iProbeCount floor(iState.w/4.)
#define iChosenProbe mod(iState.w,4.)
uniform float uHardRadius,uRoll,uLaunchHeight;
uniform float uTime,uRadius,uNoise,uBreath,uRestCube,uCap,uNeck,uDelay,uCore,uForceCube,uSeekSweep,uSeekRate,uAcceleration;
varying vec3 vWorld,vRest,vHeading,vNormal;
varying float vStretch,vPhase,vSeed,vLead;
float hash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
float noise3(vec3 p){vec3 a=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(hash(a),hash(a+vec3(1,0,0)),f.x),mix(hash(a+vec3(0,1,0)),hash(a+vec3(1,1,0)),f.x),f.y),mix(mix(hash(a+vec3(0,0,1)),hash(a+vec3(1,0,1)),f.x),mix(hash(a+vec3(0,1,1)),hash(a+vec3(1,1,1)),f.x),f.y),f.z)*2.-1.;}
vec3 extent4(float theta){
  vec3 extent=vec3(0.);float c=cos(theta),s=sin(theta);
  for(int i=0;i<4;i++){float x=mod(float(i),2.)*2.-1.,w=floor(float(i)/2.)*2.-1.;float xx=x*c-w*s,ww=x*s+w*c;extent=max(extent,vec3(abs(xx),1.,1.)/(2.5-ww));}
  return extent/max(max(extent.x,extent.y),extent.z);
}
vec3 orient(vec3 p){
  vec3 heading=iHeading;
  if(uRoll>.5&&iPhase<.08){
    float from=atan(iPreviousHeading.x,iPreviousHeading.z),to=atan(iHeading.x,iHeading.z);
    float delta=atan(sin(to-from),cos(to-from));
    float angle=from+delta*smoothstep(0.,.08,iPhase);
    heading=vec3(sin(angle),0.,cos(angle));
  }
  return vec3(heading.z*p.x+heading.x*p.z,p.y,-heading.x*p.x+heading.z*p.z);
}
vec3 turn(vec3 p,float angle){float c=cos(angle),s=sin(angle);return vec3(c*p.x+s*p.z,p.y,-s*p.x+c*p.z);}
vec4 probeFor(vec3 n){
  vec4 probe=vec4(iProbe0,0.);float best=turn(n,-iProbe0.x).z;
  if(iProbeCount>1.5){float d=turn(n,-iProbe1.x).z;if(d>best){best=d;probe=vec4(iProbe1,1.);}}
  if(iProbeCount>2.5){float d=turn(n,-iProbe2.x).z;if(d>best)probe=vec4(iProbe2,2.);}
  return probe;
}
vec4 deform(vec3 bodyN){
  vec4 probe=probeFor(bodyN);
  vec3 n=turn(bodyN,-probe.x);

  float phase=uRoll>.5?min(.85,iPhase/.8):iPhase,r=uRadius*iScale,core=mix(1.,.45,uCore);
  float transfer=clamp((phase-.62)/.23,0.,1.);
  float accelerated=pow(transfer,uAcceleration);
  float fold=sin(accelerated*3.14159265);
  vec3 extent=extent4(iSeed*.2+transfer*2.1);
  float rounded=1./pow(pow(abs(bodyN.x)/max(.4,extent.x),6.)+pow(abs(bodyN.y)/max(.4,extent.y),6.)+pow(abs(bodyN.z)/max(.4,extent.z),6.),1./6.);
  float lump=noise3(bodyN*2.6+vec3(iSeed,uTime*uBreath*.26,0.));
  float breathe=sin(uTime*uBreath*6.283+bodyN.x*2.+iSeed)*.026;
  float radius=max(.28,1.+lump*uNoise*1.7+breathe);
  // Rest attractor is deliberately subdued; only a transfer exposes the folded structure.
  float cube=uRoll>.5?0.:max(uForceCube,uRestCube*.12+iParams.y*fold*fold);
  vec3 rest=n*max(mix(radius,rounded,cube),uHardRadius*3.6)*r;
  // Nested cross-sections share their longitudinal coordinates and centerline.
  rest.xy*=core;
  rest.y=rest.y*.82+r*.78;rest.y=max(.012,rest.y);

  vec3 oldRest=rest;
  float cap=iProbeCount>1.5?min(uCap,32.):uCap;
  float lead=smoothstep(cos(radians(cap)),1.,n.z);lead*=lead;
  float seeking=clamp((phase-.10)/.45,0.,1.);
  // Advance, test sideways and briefly retract; the search fully damps before contact.
  float envelope=sin(seeking*3.14159265)*(1.-smoothstep(.78,1.,seeking));
  float wave=seeking*uSeekRate*6.283185+iSeed+probe.z;
  float extension=clamp(seeking+.12*sin(wave)*envelope,0.,1.);
  bool winner=abs(probe.w-iChosenProbe)<.5;
  if(!winner)extension*=1.-smoothstep(.55,.72,phase);
  if(phase<.1){rest.xz*=1.-.14*sin(phase/.1*3.14159265);rest.y*=1.+.06*sin(phase/.1*3.14159265);}
  vec3 extended=oldRest;
  float neck=mix(1.,uNeck,lead*extension);
  float axial=smoothstep(0.,.78,lead);
  float reach=axial*extension;
  float centerY=mix(r*.78,.045,reach);
  extended.x=oldRest.x*neck;
  extended.y=centerY+(oldRest.y-r*.78)*neck;
  extended.z+=(probe.y-oldRest.z)*reach;
  // A bowed stalk survives even after searching stops; traveling bends feel
  // their way sideways, then resolve into the locked contact destination.
  float bow=sin(axial*3.14159265)*extension;
  float feel=axial*envelope;
  extended.x+=r*(.85*bow*sin(iSeed+1.2)+uSeekSweep*feel*
    (sin(wave+(1.-axial)*2.4)+.3*sin(wave*1.73+iSeed+(1.-axial)*4.)));
  extended.y+=r*(.8*bow+.35*feel*(.5+.5*sin(wave*.7+iSeed)));
  // The last cap rings flare into a rounded, shallow cup rather than a blade.
  float cup=smoothstep(.70,.78,lead);
  float cupT=clamp((lead-.78)/.22,0.,1.);
  float disk=sin(cupT*3.14159265);
  float azimuth=atan(n.y,n.x);
  float padRadius=r*.58*disk*extension;
  extended.x+=cos(azimuth)*padRadius*core;
  extended.z+=sin(azimuth)*padRadius*core;
  // Upper and lower cup surfaces have distinct heights, with a fleshy rim.
  float cupY=.018+r*(.16+.12*cos(cupT*3.14159265)*core+.06*disk);
  extended.y=mix(extended.y,cupY+(oldRest.y-r*.78)*.045*core,cup*extension);
  rest=turn(rest,probe.x);extended=turn(extended,probe.x);
  vec3 p=iOffset+orient(phase<.1?rest:extended);
  if(phase>=.62&&phase<.85){
    vec3 chosen=iChosenProbe<.5?iProbe0:iChosenProbe<1.5?iProbe1:iProbe2;
    float delay=clamp((1.-turn(bodyN,-chosen.x).z)*.5,0.,1.)*uDelay;
    // A rigid core and its surrounding body share one transfer clock.
    // Vertex-specific delay could otherwise pull the shell away from the core.
    if(uHardRadius>0.)delay=uDelay*.5;
    float u=clamp((accelerated-delay)/max(.02,1.-uDelay),0.,1.);
    vec3 end=iAnchor+orient(rest);end.y=rest.y;
    vec3 anchor=iAnchor;anchor.y=.014;
    // Incoming tissue still funnels through the foothold, but its settled rim
    // must not be pulled into that point along with the traveling body.
    vec3 control=anchor;
    if(winner){
      vec3 rim=p-anchor;
      // Retain the full cup cross-section, then inflate it as mass arrives.
      // The final rest surface takes over only after the reservoir has filled.
      float deposited=u*u;
      vec3 reservoir=anchor+vec3(rim.x*(1.+2.*u),rim.y*(1.+4.*deposited),rim.z*(1.+2.*u));
      control=mix(anchor,reservoir,cup);
    }
    p=(1.-u)*(1.-u)*p+2.*(1.-u)*u*control+u*u*end;
  }else if(phase>=.85){
    float settle=(phase-.85)/.15;
    float wobble=exp(-6.*settle)*sin(settle*22.);
    rest+=bodyN*r*.045*wobble*iParams.w;
    p=iAnchor+orient(rest);p.y=rest.y;
    p+=iHeading*r*.12*wobble*iParams.w;
  }
  if(uHardRadius>0.){
    float bodyU=clamp((accelerated-uDelay*.5)/max(.02,1.-uDelay),0.,1.);
    vec3 center=mix(iOffset,iAnchor,2.*bodyU-bodyU*bodyU);
    center.y=r*.78*((1.-bodyU)*(1.-bodyU)+bodyU*bodyU)+2.*(1.-bodyU)*bodyU*.014;
    if(phase>=.85){float settle=(phase-.85)/.15;center=iAnchor+iHeading*r*.12*exp(-6.*settle)*sin(settle*22.)*iParams.w;center.y=r*.78;}
    float lift=max(0.,r*uHardRadius*1.3+.018-center.y);center.y+=lift;p.y+=lift;
    // Protect a padded volume around the synchronized core, including the
    // triangles spanning neighboring vertices as withdrawn stalks fold inward.
    vec3 delta=p-center;float distance=length(delta),shell=r*uHardRadius*2.;
    if(distance<shell)p=center+normalize(delta+vec3(0.,.000001,0.))*shell;
  }
  if(uRoll>.5&&iPhase>=.496){
    float t=clamp((iPhase-.68)/.22,0.,1.),carry=clamp((iPhase-.496)/.404,0.,1.);
    float travel=carry*carry*(3.-2.*carry),turning=t*t*(3.-2.*t),landing=clamp((iPhase-.9)/.1,0.,1.);
    float recoil=iPhase>=.9?-r*.12*iParams.w*sin(landing*3.14159265)*exp(-4.*landing):0.;
    float lift=t<.25?sin(t/.25*3.14159265)*r*uLaunchHeight:0.;
    vec3 direction=iAnchor-iOffset;direction.y=0.;direction=length(direction)>.00001?normalize(direction):iHeading;
    vec3 axis=vec3(direction.z,0.,-direction.x);
    float angle=max(1.,floor(iParams.x/(6.2831853*r)+.5))*6.2831853*turning;
    float bodyU=clamp((accelerated-uDelay*.5)/max(.02,1.-uDelay),0.,1.);
    float bodyTravel=2.*bodyU-bodyU*bodyU;
    vec3 center=mix(iOffset,iAnchor,bodyTravel);
    center.y=max(r*.78*((1.-bodyU)*(1.-bodyU)+bodyU*bodyU)+2.*(1.-bodyU)*bodyU*.014,uHardRadius>0.?r*uHardRadius*1.3+.018:0.);
    vec3 local=p-center;
    local=local*cos(angle)+cross(axis,local)*sin(angle)+axis*dot(axis,local)*(1.-cos(angle));
    float squash=sin(landing*3.14159265)*exp(-3.*landing)*.16;local*=vec3(1.+squash*.5,1.-squash,1.+squash*.5);
    p=center+local+direction*(iParams.x*(2.*travel-bodyTravel)+recoil)+vec3(0.,lift,0.);
  }
  if(uRoll>.5&&winner){
    // The planted cup is a world-space constraint, not part of the moving body.
    // Preserve its full rounded rim until the mass passes the foothold, then peel
    // it free into the roll. Neighboring stalk rings stretch toward this grip.
    float planted=smoothstep(.52,.55,phase);
    float release=smoothstep(.70,.76,iPhase);
    float grip=cup*planted*(1.-release);
    vec3 pad=vec3(cos(azimuth)*r*.58*disk*core,
      .018+r*(.16+.12*cos(cupT*3.14159265)*core+.06*disk),
      sin(azimuth)*r*.58*disk*core);
    vec3 fixedCup=iAnchor+orient(turn(pad,probe.x));fixedCup.y=pad.y;
    p=mix(p,fixedCup,grip);
  }
  p.y=max(.009,p.y)+iOffset.y;
  float stretch=1.+lead*extension*probe.y/max(.01,r)*(1.-smoothstep(.66,.85,phase))+fold*2.;
  return vec4(p,stretch);
}
void main(){
  vec3 n=normalize(position),axis=abs(n.y)<.95?vec3(0,1,0):vec3(1,0,0);
  vec3 tangent=normalize(cross(axis,n)),bitangent=cross(n,tangent);
  vec4 p=deform(n);
  vec3 a=deform(normalize(n+tangent*.012)).xyz-p.xyz,b=deform(normalize(n+bitangent*.012)).xyz-p.xyz;
  vec3 normal=cross(a,b);vNormal=dot(normal,normal)>1e-14?normalize(mat3(modelMatrix)*normal):vec3(0,1,0);
  vWorld=(modelMatrix*vec4(p.xyz,1.)).xyz;
  vRest=n;vHeading=iHeading;vLead=pow(smoothstep(cos(radians(iProbeCount>1.5?min(uCap,32.):uCap)),1.,turn(n,-probeFor(n).x).z),2.);vSeed=iSeed;vPhase=iPhase;vStretch=p.w;
  gl_Position=projectionMatrix*modelViewMatrix*vec4(p.xyz,1.);
}
