const test=require('node:test');const assert=require('node:assert/strict');const {generateKeyPairSync,createHash,sign}=require('node:crypto');
const {verifyProviderGrant}=require('../src/provider-policy-authority');
const asset='https://overturemaps-us-west-2.s3.us-west-2.amazonaws.com/release/2026-10-21.0/theme=places/type=place/example.parquet';
const keypair=generateKeyPairSync('ed25519'),other=generateKeyPairSync('ed25519');
const now=Date.now(),subject='11111111-1111-4111-8111-111111111111';
const claims={version:'s4-private-source-v1',policyId:'a'.repeat(64),subject,assetSha256:createHash('sha256').update(asset).digest('hex'),etag:'abc',methods:['GET','HEAD'],maxCostCents:1,issuedAt:now-1000,expiresAt:now+60000};
const token=(payload=claims,key=keypair.privateKey)=>{const encoded=Buffer.from(JSON.stringify(payload)).toString('base64url');return {payload:encoded,signature:sign(null,Buffer.from(encoded),key).toString('base64url')};};
const attempt={attemptId:'22222222-2222-4222-8222-222222222222',asset,etag:'abc',method:'GET'};
test('accepts only a trusted signed source-specific, cost-bounded and unexpired grant',()=>{
 const verified=verifyProviderGrant(keypair.publicKey,token(),attempt);assert.equal(verified.policyId,claims.policyId);assert.equal(verified.subject,subject);assert.equal(verified.maxCostCents,1);
 assert.throws(()=>verifyProviderGrant(keypair.publicKey,token(claims,other.privateKey),attempt),/signature/i);
 assert.throws(()=>verifyProviderGrant(keypair.publicKey,token({...claims,expiresAt:now-1}),attempt),/expired|time/i);
 assert.throws(()=>verifyProviderGrant(keypair.publicKey,token({...claims,maxCostCents:0}),attempt),/grant/i);
 assert.throws(()=>verifyProviderGrant(keypair.publicKey,token(),{...attempt,asset:asset.replace('example','other')}),/source/i);
 assert.throws(()=>verifyProviderGrant(keypair.publicKey,token(),{...attempt,etag:'other'}),/source/i);
 assert.throws(()=>verifyProviderGrant(keypair.publicKey,token({...claims,methods:['HEAD']}),attempt),/method/i);
 assert.throws(()=>verifyProviderGrant(keypair.publicKey,token({...claims,extra:true}),attempt),/grant/i);
});
