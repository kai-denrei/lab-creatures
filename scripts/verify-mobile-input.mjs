import assert from 'node:assert/strict';
import { PerspectiveCamera, Mesh, Vector3 } from 'three/webgpu';
import { createMonsterInteraction } from '../src/monster/interaction.ts';
import { AutoLure } from '../src/monster/auto-lure.ts';

// Minimal event surface exercises the real interaction module without a browser/GPU.
class Surface {
 listeners=new Map();style={};classList={add(){},remove(){}};attrs={};
 clientWidth=400;clientHeight=800;
 addEventListener(type,fn,options={}){
  const list=this.listeners.get(type)||[];list.push({fn,capture:options.capture});this.listeners.set(type,list);
  options.signal?.addEventListener('abort',()=>this.removeEventListener(type,fn),{once:true});
 }
 removeEventListener(type,fn){this.listeners.set(type,(this.listeners.get(type)||[]).filter(item=>item.fn!==fn));}
 emit(type,values={}){
  let stopped=false;
  const event={type,button:0,pointerId:1,pointerType:'touch',clientX:200,clientY:400,pageX:200,pageY:400,currentTarget:this,preventDefault(){},stopImmediatePropagation(){stopped=true;},...values};
  for(const {fn} of [...this.listeners.get(type)||[]].sort((a,b)=>Number(!!b.capture)-Number(!!a.capture))){fn(event);if(stopped)break;}
 }
 setAttribute(key,value){this.attrs[key]=value;}
 setPointerCapture(){}releasePointerCapture(){}
 getRootNode(){return this.ownerDocument;}
 getBoundingClientRect(){return {left:0,top:0,width:400,height:800};}
}
const doc=new Surface(),win=new Surface(),canvas=new Surface(),buttons=new Map();
canvas.ownerDocument=doc;doc.querySelector=id=>{if(!buttons.has(id))buttons.set(id,new Surface());return buttons.get(id);};
globalThis.document=doc;globalThis.window=win;
const camera=new PerspectiveCamera(40,.5,.001,5);camera.position.set(0,.7,1);
const lure=new Mesh(),monster=new Mesh();lure.position.set(0,.015,0);lure.updateMatrixWorld();
const auto=new AutoLure();auto.enabled=true;
const behavior={target:new Vector3(),center:new Vector3(),targetHeld:false,stimulus:0,active:true,feeding:{locked:false,phase:'hunting'},pursuit:{phase:'reach'},disturb(){},reset(){this.targetHeld=false;}};
const input=createMonsterInteraction(camera,canvas,lure,monster,behavior,auto);
canvas.emit('pointerdown');
assert.equal(behavior.targetHeld,false,'default touch is camera control, even on the lure');
assert.equal(auto.enabled,true);
doc.emit('pointerup');win.emit('pointerup');
doc.querySelector('#drag-mode').emit('click');
canvas.emit('pointerdown');
assert.equal(behavior.targetHeld,true,'explicit prey tool grabs the lure');
assert.equal(auto.enabled,true,'dragging must preserve the auto preference');
assert.equal(input.controls.enabled,false);
win.emit('pointerup',{pointerId:9});
assert.equal(behavior.targetHeld,true,'another finger or slider release must not end the drag');
win.emit('pointercancel');
assert.equal(behavior.targetHeld,false);
assert.equal(input.controls.enabled,true);
assert.equal(auto.enabled,true);
const before=behavior.target.clone();auto.step(.1,behavior.target,behavior.center);
assert(behavior.target.distanceTo(before)>0,'auto resumes moving after release');
canvas.emit('pointerdown');win.emit('blur');assert.equal(behavior.targetHeld,false);
behavior.feeding.locked=true;input.update();assert.match(doc.querySelector('#motion-status').textContent,/Auto waiting/);
doc.querySelector('#auto-lure').emit('click');assert.equal(auto.enabled,false);
input.dispose();
console.log('PASS — touch camera mode, deliberate prey drag, auto resume, pointer cancellation, feeding status');
