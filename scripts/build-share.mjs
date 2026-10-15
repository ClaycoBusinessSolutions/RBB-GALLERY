#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, pbkdf2Sync, createCipheriv } from 'node:crypto';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const out=path.join(root,'build/share');
const password=process.env.RBB_SHARE_PASSWORD;
if(!password)throw new Error('Set RBB_SHARE_PASSWORD before building. The password is not saved.');
const mime={'.txt':'text/plain; charset=utf-8','.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.gif':'image/gif','.avif':'image/avif','.ico':'image/x-icon','.woff':'font/woff','.woff2':'font/woff2','.ttf':'font/ttf','.otf':'font/otf','.mp4':'video/mp4','.webm':'video/webm','.wasm':'application/wasm','.bin':'application/octet-stream'};
const salt=randomBytes(24),iterations=600000;
const key=pbkdf2Sync(password,salt,iterations,32,'sha256');
const files=[];
async function collect(relative){
 const target=path.join(root,relative),stat=await fs.lstat(target).catch(()=>null);
 if(!stat)return;
 if(stat.isSymbolicLink())throw new Error(`Symbolic links are not allowed in the share package: ${relative}`);
 if(stat.isDirectory()){for(const name of(await fs.readdir(target)).sort())await collect(`${relative}/${name}`);return;}
 if(mime[path.extname(relative).toLowerCase()]&&!/^(?:test|tests|node_modules|build|\.git)(\/|$)/.test(relative))files.push(relative);
}
for(const name of ['index.html','styles.css','museum-menu.css','styles','src','vendor','assets'])await collect(name);
if(!files.includes('index.html'))throw new Error('Presentation index.html is missing.');
await fs.rm(out,{recursive:true,force:true});await fs.mkdir(path.join(out,'blobs'),{recursive:true});
async function seal(bytes,aad){
 const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);cipher.setAAD(Buffer.from(aad));
 const ciphertext=Buffer.concat([cipher.update(bytes),cipher.final(),cipher.getAuthTag()]);
 const blob=`blobs/${randomBytes(18).toString('hex')}.bin`;await fs.writeFile(path.join(out,blob),ciphertext);
 return{blob,iv:iv.toString('base64')};
}
const entries={};let bytes=0;
for(const relative of files){const data=await fs.readFile(path.join(root,relative));bytes+=data.length;entries[relative]={...await seal(data,relative),type:mime[path.extname(relative).toLowerCase()],size:data.length};}
const catalog=await seal(Buffer.from(JSON.stringify({version:1,entries})),'rbb-share-catalog-v1');
const manifest={version:1,build:randomBytes(12).toString('hex'),kdf:{name:'PBKDF2',hash:'SHA-256',iterations,salt:salt.toString('base64')},cipher:'AES-GCM',catalog};
await fs.writeFile(path.join(out,'manifest.json'),JSON.stringify(manifest));
for(const name of ['index.html','gate.js','gate.css','sw.js'])await fs.copyFile(path.join(root,'sharing',name),path.join(out,name));
await fs.writeFile(path.join(out,'.nojekyll'),'');
key.fill(0);
console.log(JSON.stringify({output:out,files:files.length,protectedBytes:bytes,encrypted:true,publicFiles:['index.html','gate.js','gate.css','sw.js','manifest.json','.nojekyll','blobs/*.bin']}));
