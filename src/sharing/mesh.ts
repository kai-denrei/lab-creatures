import * as THREE from 'three/webgpu';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
/** Bake the current pose and instanced facets into portable glTF PBR meshes. */
export async function meshSnapshot(root:THREE.Object3D){
  root.updateWorldMatrix(true,true);
  const output=new THREE.Group();output.name=root.name;
  const materials:THREE.Material[]=[];
  root.traverseVisible(object=>{
    if(!(object instanceof THREE.Mesh))return;
    const convert=(source:THREE.Material,tint?:THREE.Color)=>{
      const p=source as THREE.MeshStandardMaterial;
      const material=new THREE.MeshStandardMaterial({color:p.color??0xffffff,roughness:p.roughness??.5,metalness:p.metalness??0,vertexColors:p.vertexColors,side:p.side,transparent:p.transparent,opacity:p.opacity});
      if(tint)material.color.multiply(tint);materials.push(material);return material;
    };
    const add=(matrix:THREE.Matrix4,tint?:THREE.Color)=>{
      const mesh=new THREE.Mesh(object.geometry,Array.isArray(object.material)?object.material.map(m=>convert(m,tint)):convert(object.material,tint));
      mesh.name=object.name;mesh.matrix.copy(matrix);mesh.matrixAutoUpdate=false;output.add(mesh);
    };
    if(object instanceof THREE.InstancedMesh){
      const matrix=new THREE.Matrix4(),color=new THREE.Color();
      for(let i=0;i<object.count;i++){object.getMatrixAt(i,matrix);if(object.instanceColor)object.getColorAt(i,color);add(matrix.premultiply(object.matrixWorld),object.instanceColor?color:undefined);}
    }else add(object.matrixWorld);
  });
  try{return await new GLTFExporter().parseAsync(output,{binary:true}) as ArrayBuffer;}finally{materials.forEach(m=>m.dispose());}
}
