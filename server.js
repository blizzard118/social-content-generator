import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {types,platforms,guidance} from './config.js';
import {generate, editImage} from './service.js';
const maxMB=Number(process.env.MAX_UPLOAD_MB)||10;
const server=http.createServer(async(req,res)=>{
 const send=(status,obj)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(obj))};
 try{
 if(req.method==='GET' && req.url==='/api/config') return send(200,{types,platforms,maxMB,mode:process.env.OPENAI_API_KEY?'live':'demo'});
 if(req.method==='POST' && req.url==='/api/edit-image'){
 let data=''; for await(const chunk of req){data+=chunk;if(data.length>maxMB*1024*1024*1.5+50000)return send(413,{error:'That photo is too large.'})}
 const input=JSON.parse(data); const match=typeof input.image==='string'&&input.image.match(/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/);
 if(!match||Buffer.byteLength(match[2],'base64')>maxMB*1024*1024||typeof input.instruction!=='string'||!input.instruction.trim()||input.instruction.length>5000)return send(400,{error:'Choose a JPEG, PNG, or WebP photo and describe the change.'});
 if(!process.env.OPENAI_API_KEY)return send(503,{error:'Photo editing needs a configured API key. Demo mode does not edit images.'});
 try{return send(200,await editImage(match[1],match[2],input.instruction))}catch{return send(502,{error:'Could not edit the photo. Check your API access and try again.'})}
 }
 if(req.method==='POST' && req.url==='/api/generate'){
 let data=''; for await(const chunk of req){data+=chunk;if(data.length>maxMB*1024*1024*1.5+50000) return send(413,{error:'That file is too large.'})}
 const input=JSON.parse(data); if(!types[input.type]?.includes(input.goal)||!platforms[input.platform]?.includes(input.format)||typeof input.description!=='string'||!input.description.trim()||input.description.length>5000) return send(400,{error:'Please complete the choices and add a short description.'});
 if(input.image && (!/^data:image\/(jpeg|png|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(input.image)||Buffer.byteLength(input.image.split(',')[1],'base64')>maxMB*1024*1024)) return send(400,{error:'Please choose a supported image within the size limit.'});
 const result=await generate({...input, guidance:guidance[input.platform]}); return send(200,result);
 }
 if(req.method==='GET') {const path=req.url==='/'?'/index.html':req.url; if(!['/index.html','/app.js','/style.css'].includes(path)) return send(404,{error:'Not found'}); const content=await readFile(new URL('./public'+path,import.meta.url));res.writeHead(200,{'Content-Type':path.endsWith('.html')?'text/html':path.endsWith('.css')?'text/css':'text/javascript'});return res.end(content)}
 send(404,{error:'Not found'});
 }catch(e){send(500,{error:'Something went wrong while creating drafts. Please try again.'})}
});
server.listen(process.env.PORT||3000,()=>console.log('Social Post Studio is running'));
