import { execSync } from 'node:child_process';
import { defineConfig } from 'vite';

function buildId(){
  try{
    const sha=execSync('git rev-parse --short HEAD',{encoding:'utf8'}).trim();
    const dirty=execSync('git status --porcelain',{encoding:'utf8'}).trim()?'*':'';
    const started=new Date().toTimeString().slice(0,5);
    return `${sha}${dirty} ${started}`;
  }catch{return 'no-git';}
}

export default defineConfig({base:'./',define:{__BUILD_ID__:JSON.stringify(buildId())}});
