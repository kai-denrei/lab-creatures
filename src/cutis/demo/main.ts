import GUI from 'three/addons/libs/lil-gui.module.min.js';
import { createCutisScene } from '../scene.ts';
import { CUTIS_CONTROLS,CUTIS_PALETTES,applyPalette,selectedPalette } from '../swarm/config.ts';
import preset from './preset.ts';
const config={...preset};
const host=document.querySelector<HTMLElement>('#viewport')!,lab=createCutisScene(host,config),gui=new GUI({title:'Cutis-Maku'});
const views={palette:selectedPalette(config),count:1,freeze:false,phase:0,autoLure:true,moveLure:false,cage:false,forceCube:false,view:0};
gui.add(views,'palette',Object.fromEntries(Object.entries(CUTIS_PALETTES).map(([id,p])=>[p.name,id]))).name('Color scheme').onChange((key:string)=>{applyPalette(config,key as keyof typeof CUTIS_PALETTES);gui.controllersRecursive().forEach(c=>c.updateDisplay());});
gui.add(views,'count',[1,12,100,300]).onChange((n:number)=>lab.setCount(n));gui.add(views,'freeze').onChange((v:boolean)=>lab.swarm.frozen=v);gui.add(views,'phase',0,.999,.001).onChange((n:number)=>{lab.swarm.scrub(n);views.freeze=true;});gui.add(views,'autoLure').onChange((v:boolean)=>lab.setAuto(v));gui.add(views,'moveLure').onChange((v:boolean)=>lab.setMove(v));gui.add(views,'cage').onChange((v:boolean)=>lab.setCage(v));gui.add(views,'forceCube').onChange((v:boolean)=>lab.setForce(v));gui.add(views,'view',{Membrane:0,State:1,Stretch:2}).onChange((n:number)=>lab.setDebug(n));
for(const group of new Set(CUTIS_CONTROLS.map(c=>c.group))){const folder=gui.addFolder(group);for(const c of CUTIS_CONTROLS.filter(c=>c.group===group)){if(c.kind==='color')folder.addColor(config,c.key).name(c.label);else folder.add(config,c.key,c.min,c.max,c.step).name(c.label);}folder.close();}
lab.renderer.setAnimationLoop(time=>lab.frame(time));
