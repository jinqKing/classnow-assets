import {createHash} from 'node:crypto';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const PKU=path.join(ROOT,'pku-3d','v1.0.0');
const CAMPUS_SOURCE=path.join(PKU,'data','campus.json');
const CAMPUS_RUNTIME=path.join(PKU,'data','campus.runtime.json');
const SCENE_SOURCE=path.join(PKU,'assets','runtime','scene','manifest.json');
const SCENE_RUNTIME=path.join(PKU,'assets','runtime','scene','manifest.runtime.json');
const VENDOR=path.join(PKU,'vendor-manifest.json');

const readJson=async file=>JSON.parse(await readFile(file,'utf8'));
const compact=value=>JSON.stringify(value);
const hash=buffer=>createHash('sha256').update(buffer).digest('hex');

function runtimeFeature(feature){
  const source=feature?.properties||{};
  const properties={};
  for(const key of ['pickId','label','name','aliases','centre','bounds','height']){
    if(source[key]!==undefined)properties[key]=source[key];
  }
  return{properties};
}

function runtimeMesh(mesh){
  const output={
    vertexCount:mesh.vertexCount,
    buffer:{chunk:mesh.buffer.chunk,offset:mesh.buffer.offset,length:mesh.buffer.length},
  };
  if(mesh.detailWidth)output.detailWidth=mesh.detailWidth;
  if(mesh.indexType)output.indexType=mesh.indexType;
  if(mesh.ranges)output.ranges=mesh.ranges;
  if(mesh.indices)output.indices={chunk:mesh.indices.chunk,offset:mesh.indices.offset};
  return output;
}

function runtimeBucket(bucket){
  return{
    key:bucket.key,
    mesh:bucket.mesh,
    count:bucket.count,
    data:{chunk:bucket.data.chunk,offset:bucket.data.offset,length:bucket.data.length},
    spatial:{chunk:bucket.spatial.chunk,offset:bucket.spatial.offset,length:bucket.spatial.length},
  };
}

async function writeRuntime(file,value){
  const body=Buffer.from(compact(value));
  await mkdir(path.dirname(file),{recursive:true});
  await writeFile(file,body);
  return{path:path.relative(PKU,file).replaceAll('\\','/'),bytes:body.length,sha256:hash(body)};
}

const campus=await readJson(CAMPUS_SOURCE);
const scene=await readJson(SCENE_SOURCE);

const campusRuntime={
  version:campus.version,
  sourceHash:campus.sourceHash,
  frame:campus.frame,
  features:(campus.features||[]).map(runtimeFeature),
};

const sceneRuntime={
  version:scene.version,
  stats:scene.stats,
  campus:{registryIds:scene.campus?.registryIds||[]},
  sourceHash:scene.sourceHash,
  meshes:(scene.meshes||[]).map(runtimeMesh),
  buckets:(scene.buckets||[]).map(runtimeBucket),
  chunks:scene.chunks,
  atlas:scene.atlas,
  packedStats:scene.packedStats,
};

const runtimeMetadata=[
  await writeRuntime(CAMPUS_RUNTIME,campusRuntime),
  await writeRuntime(SCENE_RUNTIME,sceneRuntime),
];

const vendor=await readJson(VENDOR);
vendor.runtimeMetadata=runtimeMetadata;
await writeFile(VENDOR,JSON.stringify(vendor,null,2)+'\n','utf8');

for(const item of runtimeMetadata)console.log(`${item.path}: ${item.bytes} bytes sha256=${item.sha256}`);