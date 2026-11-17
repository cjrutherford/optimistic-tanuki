const test=require('node:test');
const assert=require('node:assert/strict');
const {validateLinkRequest,validateLinkDecision}=require('../src/listing-business-link');
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const request={townId:id(1),listingId:id(2),businessCommunityId:id(3),ownerId:id(4),requestId:id(5)};
test('a claim requires explicit valid town, listing, business page, owner and request identities',()=>{
 assert.deepEqual(validateLinkRequest(request),request);
 for(const field of Object.keys(request))assert.throws(()=>validateLinkRequest({...request,[field]:'bad'}),/link/i);
 assert.throws(()=>validateLinkRequest({...request,ownerId:undefined}),/link/i);
});
test('review decisions require a reviewer and a public HTTPS evidence URL for approval',()=>{
 const value={...request,reviewerId:id(6),decision:'approve',evidenceUrl:'https://example.org/business'};
 assert.deepEqual(validateLinkDecision(value),value);
 for(const evidenceUrl of ['http://example.org/','https://127.0.0.1/','https://local/','https://user@example.org/'])assert.throws(()=>validateLinkDecision({...value,evidenceUrl}),/link/i);
 assert.throws(()=>validateLinkDecision({...value,reviewerId:'bad'}),/link/i);
 assert.throws(()=>validateLinkDecision({...value,decision:'maybe'}),/link/i);
});
