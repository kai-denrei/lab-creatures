import * as THREE from 'three';

/** Bake periodic cell borders once; two filtered samples replace 18 searches per pixel. */
export function createVeinTexture(){
  const size=256,cells=8,data=new Uint8Array(size*size);
  const centers=Array.from({length:cells*cells},(_,i)=>{
    const x=i%cells,y=Math.floor(i/cells),hash=(a:number)=>{const n=Math.sin(a)*43758.5453;return n-Math.floor(n);};
    return [hash(x*127.1+y*311.7),hash(x*269.5+y*183.3)];
  });
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const px=(x+.5)/size*cells,py=(y+.5)/size*cells,cx=Math.floor(px),cy=Math.floor(py);
    let first=10,second=10;
    for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
      const center=centers[(cx+dx+cells)%cells+((cy+dy+cells)%cells)*cells];
      const d=(cx+dx+center[0]-px)**2+(cy+dy+center[1]-py)**2;
      if(d<first){second=first;first=d;}else second=Math.min(second,d);
    }
    data[y*size+x]=Math.min(255,Math.round((second-first)*255));
  }
  const texture=new THREE.DataTexture(data,size,size,THREE.RedFormat);
  texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
  texture.magFilter=THREE.LinearFilter;texture.minFilter=THREE.LinearMipmapLinearFilter;texture.generateMipmaps=true;texture.needsUpdate=true;
  return texture;
}
