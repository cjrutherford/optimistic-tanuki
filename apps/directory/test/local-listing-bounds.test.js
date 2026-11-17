const {test}=require('node:test');const assert=require('node:assert/strict');
const {parseListingBounds}=require('../src/local-listing-bounds');
test('accepts a bounded WGS84 box and canonicalizes its coordinates',()=>{
 assert.deepEqual(parseListingBounds('-83.5,30.5,-82.5,31.5'),{west:-83.5,south:30.5,east:-82.5,north:31.5,canonical:'-83.5,30.5,-82.5,31.5'});
});
test('rejects inverted, out-of-range, excessive and malformed boxes',()=>{
 for(const value of ['-83,31,-84,32','-181,0,-179,1','0,0,3,1','0,0,1,3','0,0,1,1,2','0,NaN,1,1','0,0,Infinity,1',' 0,0,1,1','0,,1,1'])assert.throws(()=>parseListingBounds(value));
});
