/** Small, uncompressed ZIP writer for portable source/model exports. */
export function createZip(files:{name:string;data:Uint8Array}[]){
  const encoder=new TextEncoder(),parts:Uint8Array[]=[],directory:Uint8Array[]=[];
  let offset=0,directorySize=0;
  const table=new Uint32Array(256);
  for(let i=0;i<256;i++){let c=i;for(let bit=0;bit<8;bit++)c=c&1?0xedb88320^(c>>>1):c>>>1;table[i]=c;}
  for(const file of files){
    if(file.name.startsWith('/')||file.name.split('/').includes('..'))throw new Error('ZIP paths must be relative');
    const name=encoder.encode(file.name),size=file.data.length;
    let crc=0xffffffff;for(const byte of file.data)crc=table[(crc^byte)&255]^(crc>>>8);crc=(crc^0xffffffff)>>>0;
    const local=new Uint8Array(30+name.length),v=new DataView(local.buffer);
    v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(6,0x800,true);v.setUint16(12,0x21,true);
    v.setUint32(14,crc,true);v.setUint32(18,size,true);v.setUint32(22,size,true);v.setUint16(26,name.length,true);local.set(name,30);
    const central=new Uint8Array(46+name.length),c=new DataView(central.buffer);
    c.setUint32(0,0x02014b50,true);c.setUint16(4,20,true);c.setUint16(6,20,true);c.setUint16(8,0x800,true);c.setUint16(14,0x21,true);
    c.setUint32(16,crc,true);c.setUint32(20,size,true);c.setUint32(24,size,true);c.setUint16(28,name.length,true);c.setUint32(42,offset,true);central.set(name,46);
    parts.push(local,file.data);directory.push(central);offset+=local.length+size;directorySize+=central.length;
  }
  const end=new Uint8Array(22),e=new DataView(end.buffer);
  e.setUint32(0,0x06054b50,true);e.setUint16(8,files.length,true);e.setUint16(10,files.length,true);e.setUint32(12,directorySize,true);e.setUint32(16,offset,true);
  const bytes=new Uint8Array(offset+directorySize+end.length);let cursor=0;
  for(const part of [...parts,...directory,end]){bytes.set(part,cursor);cursor+=part.length;}
  return bytes;
}
