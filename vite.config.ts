import { execSync } from 'node:child_process';
import { defineConfig } from 'vite';

/** Current commit plus a dirty marker, read from git on every request so the badge never goes stale. */
function buildId(){
  try{
    const sha=execSync('git rev-parse --short HEAD',{encoding:'utf8'}).trim();
    const dirty=execSync('git status --porcelain',{encoding:'utf8'}).trim()?'*':'';
    return `${sha}${dirty}`;
  }catch{return 'no-git';}
}

export default defineConfig({
  base:'./',
  define:{__BUILD_ID__:JSON.stringify(buildId())},
  plugins:[{
    name:'dev-build-id',
    configureServer(server){
      server.middlewares.use('/__build-id',(_request,response)=>{response.setHeader('Content-Type','application/json');response.setHeader('Cache-Control','no-store');response.end(JSON.stringify({id:buildId(),at:new Date().toISOString()}));});
    },
  }],
});
