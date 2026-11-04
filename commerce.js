import {offers,verifyStripeSignature} from './accounts.js';
export async function createCheckout(accounts,user,offerKey){
 const offer=offers[offerKey];if(!offer)throw Error('Choose a valid option.');
 const key=process.env.STRIPE_SECRET_KEY,secret=process.env.STRIPE_WEBHOOK_SECRET;
 if(!key||!secret)throw Error('Checkout is not configured yet.');
 if(!key.startsWith('sk_test_'))throw Error('Only Stripe test mode is enabled while this payment flow is being tested.');
 const base=process.env.PUBLIC_BASE_URL||'http://localhost:3000';let url;try{url=new URL(base)}catch{throw Error('Checkout is not configured yet.')}
 if(url.origin!==base.replace(/\/$/,'')||!['http:','https:'].includes(url.protocol)||(url.protocol==='http:'&&!['localhost','127.0.0.1'].includes(url.hostname)))throw Error('Checkout is not configured yet.');
 const params=new URLSearchParams({mode:'payment','payment_method_types[0]':'card',client_reference_id:user.id,success_url:`${url.origin}/?checkout=success`,cancel_url:`${url.origin}/?checkout=cancelled`,'line_items[0][price_data][currency]':'usd','line_items[0][price_data][unit_amount]':String(offer.cents),'line_items[0][price_data][product_data][name]':offer.label,'line_items[0][quantity]':'1'});
 const response=await fetch('https://api.stripe.com/v1/checkout/sessions',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/x-www-form-urlencoded'},body:params});if(!response.ok)throw Error('Could not start checkout. Please try again.');const result=await response.json();if(typeof result.id!=='string'||!/^cs_test_[a-zA-Z0-9_]+$/.test(result.id)||typeof result.url!=='string'||new URL(result.url).protocol!=='https:'||new URL(result.url).hostname!=='checkout.stripe.com')throw Error('Could not start checkout. Please try again.');accounts.savePayment(result.id,user.id,offerKey);return result.url;
}
export function receiveStripeWebhook(accounts,raw,signature){if(!verifyStripeSignature(raw,signature,process.env.STRIPE_WEBHOOK_SECRET))return false;let event;try{event=JSON.parse(raw.toString('utf8'))}catch{return false}if(event.livemode!==false)return false;if(event.type==='checkout.session.completed')accounts.confirmPayment(event.data?.object||{});return true}
