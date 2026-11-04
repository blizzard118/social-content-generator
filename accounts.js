import {DatabaseSync} from 'node:sqlite';
import {mkdirSync,chmodSync} from 'node:fs';
import {scrypt as scryptCallback,randomBytes,createHash,createHmac,timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
const scrypt=promisify(scryptCallback);
export const offers={single:{label:'Try one',credits:1,cents:99},starter:{label:'Starter',credits:5,cents:399},creator:{label:'Creator',credits:15,cents:999},business:{label:'Business',credits:40,cents:1999}};
const hash=v=>createHash('sha256').update(v).digest('hex');
export function openAccounts(dir=process.env.DATA_DIR||'data'){
 mkdirSync(dir,{recursive:true,mode:0o700});const db=new DatabaseSync(`${dir}/studio.sqlite`);chmodSync(`${dir}/studio.sqlite`,0o600);db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
 CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,email TEXT NOT NULL UNIQUE,salt TEXT NOT NULL,password_hash TEXT NOT NULL,credits INTEGER NOT NULL DEFAULT 0 CHECK(credits>=0));
 CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),expires INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS payments(session_id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),offer TEXT NOT NULL,credits INTEGER NOT NULL,cents INTEGER NOT NULL,credited INTEGER NOT NULL DEFAULT 0);
 CREATE TABLE IF NOT EXISTS reservations(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),operation TEXT NOT NULL,status TEXT NOT NULL,created INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS ledger(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),kind TEXT NOT NULL,amount INTEGER NOT NULL,created INTEGER NOT NULL);`);
 function transaction(fn){db.exec('BEGIN IMMEDIATE');try{const result=fn();db.exec('COMMIT');return result}catch(e){db.exec('ROLLBACK');throw e}}
 async function createUser(email,password){email=typeof email==='string'?email.trim().toLowerCase():'';if(email.length>254||!/^([^\s@]+)@([^\s@]+)\.([^\s@]+)$/.test(email)||typeof password!=='string'||password.length<12||password.length>256)throw Error('Enter a valid email and a password of at least 12 characters.');const salt=randomBytes(16).toString('hex'), derived=(await scrypt(password,salt,64)).toString('hex'),id=randomBytes(16).toString('hex');try{db.prepare('INSERT INTO users(id,email,salt,password_hash) VALUES(?,?,?,?)').run(id,email,salt,derived)}catch{throw Error('Unable to create this account. If you already have one, sign in.')}return id}
 async function login(email,password){const row=db.prepare('SELECT * FROM users WHERE email=?').get(typeof email==='string'?email.trim().toLowerCase():'');const salt=row?.salt||'00000000000000000000000000000000';const derived=await scrypt(typeof password==='string'?password.slice(0,256):'',salt,64);const expected=Buffer.from(row?.password_hash||'0'.repeat(128),'hex');if(!row||!timingSafeEqual(derived,expected))throw Error('Email or password was not recognized.');return row.id}
 function createSession(id){const token=randomBytes(32).toString('base64url');db.prepare('DELETE FROM sessions WHERE expires < ?').run(Date.now());db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(hash(token),id,Date.now()+7*86400000);return token}
 function session(token){if(!token||token.length>100)return null;return db.prepare('SELECT users.id,users.email,users.credits FROM sessions JOIN users ON users.id=sessions.user_id WHERE sessions.token_hash=? AND sessions.expires>?').get(hash(token),Date.now())||null}
 function endSession(token){if(token)db.prepare('DELETE FROM sessions WHERE token_hash=?').run(hash(token))}
 function reserve(userId,operation){return transaction(()=>{const r=db.prepare('UPDATE users SET credits=credits-1 WHERE id=? AND credits>=1').run(userId);if(!r.changes)return null;const id=randomBytes(16).toString('hex');db.prepare('INSERT INTO reservations VALUES(?,?,?,?,?)').run(id,userId,operation,'pending',Date.now());return id})}
 function settle(id,success){transaction(()=>{const row=db.prepare('SELECT * FROM reservations WHERE id=? AND status=?').get(id,'pending');if(!row)return;db.prepare('UPDATE reservations SET status=? WHERE id=?').run(success?'completed':'refunded',id);if(success)db.prepare('INSERT INTO ledger VALUES(?,?,?,?,?)').run(id,row.user_id,row.operation,-1,Date.now());else db.prepare('UPDATE users SET credits=credits+1 WHERE id=?').run(row.user_id)})}
 function savePayment(sessionId,userId,offer){const o=offers[offer];db.prepare('INSERT INTO payments VALUES(?,?,?,?,?,0)').run(sessionId,userId,offer,o.credits,o.cents)}
 function confirmPayment(session){return transaction(()=>{const p=db.prepare('SELECT * FROM payments WHERE session_id=?').get(session.id);if(!p||p.credited||session.payment_status!=='paid'||session.amount_total!==p.cents||session.currency!=='usd'||session.client_reference_id!==p.user_id)return false;db.prepare('UPDATE payments SET credited=1 WHERE session_id=?').run(session.id);db.prepare('UPDATE users SET credits=credits+? WHERE id=?').run(p.credits,p.user_id);db.prepare('INSERT INTO ledger VALUES(?,?,?,?,?)').run(session.id,p.user_id,'purchase',p.credits,Date.now());return true})}
 function history(userId){return db.prepare('SELECT kind,amount,created FROM ledger WHERE user_id=? ORDER BY created DESC LIMIT 30').all(userId)}
 return {db,createUser,login,createSession,session,endSession,reserve,settle,savePayment,confirmPayment,history};
}
export function verifyStripeSignature(raw,signature,secret,now=Date.now()){
 if(!secret||!signature)return false;const parts=signature.split(',').map(x=>x.trim().split('='));const stamp=parts.find(x=>x[0]==='t')?.[1];if(!/^\d+$/.test(stamp||'')||Math.abs(now/1000-Number(stamp))>300)return false;const expected=createHmac('sha256',secret).update(`${stamp}.`).update(raw).digest();return parts.filter(x=>x[0]==='v1'&&/^[a-f0-9]{64}$/i.test(x[1]||'')).some(x=>timingSafeEqual(Buffer.from(x[1],'hex'),expected));
}
