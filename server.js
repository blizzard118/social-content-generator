import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {types,platforms,guidance} from './config.js';
import {generate, editImage, helpDraft, ServiceError} from './service.js';
import {openAccounts,offers} from './accounts.js';
import {createCheckout,receiveStripeWebhook} from './commerce.js';
const maxMB=Number(process.env.MAX_UPLOAD_MB)||10;
const accounts=openAccounts();
const attempts=new Map();
function currentUser(req){const cookies=Object.fromEntries((req.headers.cookie||'').split(';').map(p=>p.trim().split('=')));return accounts.session(cookies.studio_session)}
function setSession(res,token){res.setHeader('Set-Cookie',`studio_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=604800${process.env.NODE_ENV==='production'?'; Secure':''}`)}
function allowLogin(req){const key=req.socket.remoteAddress||'unknown',now=Date.now();for(const [ip,record] of attempts)if(record.until<=now)attempts.delete(ip);const record=attempts.get(key)||{count:0,until:now+900000};record.count++;attempts.set(key,record);return record.count<=20}
async function readBody(req,max){let data='';for await(const chunk of req){data+=chunk;if(data.length>max)throw Error('Request too large')}return data}
const server=http.createServer(async(req,res)=>{
 res.setHeader('Cache-Control','no-store');
 res.setHeader('X-Content-Type-Options','nosniff');
 res.setHeader('Referrer-Policy','no-referrer');
 res.setHeader('X-Frame-Options','DENY');
 res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');
 res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
 const send=(status,obj)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(obj))};
 try{
 if(req.method==='POST'&&req.url==='/api/stripe-webhook'){const raw=await readBody(req,200000);return receiveStripeWebhook(accounts,Buffer.from(raw,'utf8'),req.headers['stripe-signature'])?send(200,{received:true}):send(400,{error:'Invalid webhook.'})}
 if(req.method==='POST'){
  if(req.headers['sec-fetch-site']==='cross-site')return send(403,{error:'Request not allowed.'});
  if(req.headers.origin){let origin;try{origin=new URL(req.headers.origin)}catch{return send(403,{error:'Request not allowed.'})}if(origin.host!==req.headers.host)return send(403,{error:'Request not allowed.'})}
  if(!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type']||''))return send(415,{error:'Expected JSON.'});
 }
 if(req.method==='GET' && req.url==='/api/config') return send(200,{types,platforms,maxMB,mode:process.env.OPENAI_API_KEY?'live':'demo',offers,checkoutConfigured:Boolean(process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_')&&process.env.STRIPE_WEBHOOK_SECRET)});
 if(req.method==='GET' && req.url==='/api/account'){const user=currentUser(req);return send(200,{user:user?{email:user.email,credits:user.credits}:null})}
 if(req.method==='GET' && req.url==='/api/usage'){const user=currentUser(req);if(!user)return send(401,{error:'Sign in to view credit activity.'});return send(200,{activity:accounts.history(user.id)})}
 if(req.method==='POST' && (req.url==='/api/register'||req.url==='/api/login')){if(!allowLogin(req))return send(429,{error:'Too many attempts. Please wait and try again.'});const input=JSON.parse(await readBody(req,4000));try{const id=req.url==='/api/register'?await accounts.createUser(input.email,input.password):await accounts.login(input.email,input.password);setSession(res,accounts.createSession(id));return send(200,{ok:true})}catch(e){return send(400,{error:e.message})}}
 if(req.method==='POST' && req.url==='/api/logout'){const cookies=Object.fromEntries((req.headers.cookie||'').split(';').map(p=>p.trim().split('=')));accounts.endSession(cookies.studio_session);res.setHeader('Set-Cookie',`studio_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${process.env.NODE_ENV==='production'?'; Secure':''}`);return send(200,{ok:true})}
 if(req.method==='POST' && req.url==='/api/checkout'){const user=currentUser(req);if(!user)return send(401,{error:'Sign in to buy credits.'});const input=JSON.parse(await readBody(req,4000));try{return send(200,{url:await createCheckout(accounts,user,input.offer)})}catch(e){return send(503,{error:e.message})}}
 async function paidCall(operation,fn){const user=currentUser(req);if(!user)return send(401,{error:'Sign in to use credits.'});if(process.env.OPENAI_API_KEY)return send(503,{error:'Live AI is disabled while checkout is in test mode. Test credits cannot pay for live AI requests.'});const id=accounts.reserve(user.id,operation);if(!id)return send(402,{error:'You need 1 credit to continue. Add credits to your account.'});try{const result=await fn();accounts.settle(id,true);return send(200,result)}catch(e){accounts.settle(id,false);return send(502,{error:e instanceof ServiceError?e.message+' Your credit was returned.':'The request could not be completed. Your credit was returned.'})}}

 if(req.method==='POST' && req.url==='/api/help-draft'){
 let data='';for await(const chunk of req){data+=chunk;if(data.length>20000)return send(413,{error:'Please shorten your notes.'})}
 const input=JSON.parse(data);if(!types[input.type]?.includes(input.goal)||!platforms[input.platform]?.includes(input.format)||typeof input.seed!=='string'||input.seed.length>5000||(input.keywords!==undefined&&(typeof input.keywords!=='string'||input.keywords.length>2000))||(!input.seed.trim()&&!(input.keywords||'').trim())||(input.audience!==undefined&&(typeof input.audience!=='string'||input.audience.length>200))||(input.tone!==undefined&&!['','Friendly','Professional','Playful','Informative'].includes(input.tone))||(input.goal==='Other'&&(typeof input.otherGoal!=='string'||!input.otherGoal.trim()||input.otherGoal.length>200)))return send(400,{error:'Please add a few words about your idea.'});
 return paidCall('draft_help',()=>helpDraft(input));
 }
 if(req.method==='POST' && req.url==='/api/edit-image'){
 let data=''; for await(const chunk of req){data+=chunk;if(data.length>maxMB*1024*1024*1.5+50000)return send(413,{error:'That photo is too large.'})}
 const input=JSON.parse(data); const match=typeof input.image==='string'&&input.image.match(/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/);
 if(!match||Buffer.byteLength(match[2],'base64')>maxMB*1024*1024||typeof input.instruction!=='string'||!input.instruction.trim()||input.instruction.length>5000)return send(400,{error:'Choose a JPEG, PNG, or WebP photo and describe the change.'});
 if(!process.env.OPENAI_API_KEY)return send(503,{error:'Photo editing needs a configured API key. Demo mode does not edit images.'});
 return paidCall('photo_edit',()=>editImage(match[1],match[2],input.instruction));
 }
 if(req.method==='POST' && req.url==='/api/generate'){
 let data=''; for await(const chunk of req){data+=chunk;if(data.length>maxMB*1024*1024*1.5+50000) return send(413,{error:'That file is too large.'})}
 const input=JSON.parse(data); if(!types[input.type]?.includes(input.goal)||!platforms[input.platform]?.includes(input.format)||typeof input.description!=='string'||!input.description.trim()||input.description.length>5000||(input.goal==='Other'&&(typeof input.otherGoal!=='string'||!input.otherGoal.trim()||input.otherGoal.length>200))) return send(400,{error:'Please complete the choices and add a short description.'});
 if(input.image && (!/^data:image\/(jpeg|png|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(input.image)||Buffer.byteLength(input.image.split(',')[1],'base64')>maxMB*1024*1024)) return send(400,{error:'Please choose a supported image within the size limit.'});
 return paidCall('drafts',()=>generate({...input, guidance:guidance[input.platform]}));
 }
 if(req.method==='GET') {const path=req.url==='/'?'/index.html':req.url; if(!['/index.html','/app.js','/style.css'].includes(path)) return send(404,{error:'Not found'}); const content=await readFile(new URL('./public'+path,import.meta.url));res.writeHead(200,{'Content-Type':path.endsWith('.html')?'text/html':path.endsWith('.css')?'text/css':'text/javascript'});return res.end(content)}
 send(404,{error:'Not found'});
 }catch(e){send(500,{error:'Something went wrong while creating drafts. Please try again.'})}
});
server.listen(process.env.PORT||3000,process.env.HOST||'127.0.0.1',()=>console.log('Social Post Studio is running'));
