const test=require('node:test');
const assert=require('node:assert/strict');
const {getOrCreateListingIdentities,findListingIdentity}=require('../src/listing-identity');
const scan='a'.repeat(64),town='00000000-0000-4000-8000-000000000005',id='00000000-0000-4000-8000-000000000006';
test('creates stable identities for source rows and rejects malformed database results',async()=>{
 const db={query:async(sql,args)=>{assert.match(sql,/ON CONFLICT/);assert.deepEqual(args,[town,[scan],['1']]);return [{id,scanId:scan,sourceFileRowNumber:'1'}]}};
 assert.deepEqual(await getOrCreateListingIdentities(db,town,[{scanId:scan,row:'1'}]),[{id,scanId:scan,row:'1'}]);
 await assert.rejects(getOrCreateListingIdentities({query:async()=>[{id:'broken',scanId:scan,sourceFileRowNumber:'1'}]},town,[{scanId:scan,row:'1'}]),/identity/i);
});
test('identity lookup is scoped to the town and malformed IDs are rejected',async()=>{
 const db={query:async(sql,args)=>{assert.deepEqual(args,[town,id]);return [{scanId:scan,sourceFileRowNumber:'1'}]}};
 assert.deepEqual(await findListingIdentity(db,town,id),{scanId:scan,row:'1'});
 await assert.rejects(findListingIdentity(db,town,'bad'),/identity/i);
 assert.equal(await findListingIdentity({query:async()=>[]},town,id),null);
});
