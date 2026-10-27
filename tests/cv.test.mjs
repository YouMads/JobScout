import {test} from 'node:test';
import assert from 'node:assert/strict';
import {extractCv,MAX_CV_BYTES} from '../cv.mjs';
import {makePdf} from './pdf-fixture.mjs';
test('PDF CV extraction reads a real text PDF in an isolated worker',async()=>{
 const result=await extractCv(makePdf());assert.match(result.text,/Synthetic Candidate/);assert.match(result.text,/React/);assert.equal(result.totalPages,1);assert.equal(result.truncated,false);
});
test('text CV extraction is bounded and flags truncated text',async()=>{
 const result=await extractCv(Buffer.from('Python and React experience. '.repeat(900)));assert.equal(result.text.length,16000);assert.equal(result.truncated,true);assert.equal(result.totalPages,null);
 await assert.rejects(()=>extractCv(Buffer.alloc(MAX_CV_BYTES+1)),/smaller than 6 MB/);
});
test('unreadable, malformed and empty PDF documents have helpful errors',async()=>{
 await assert.rejects(()=>extractCv(makePdf([])),/No readable CV text/);
 await assert.rejects(()=>extractCv(Buffer.from('%PDF-1.4\nThis is not a valid PDF file.')),/Could not read this PDF/);
 await assert.rejects(()=>extractCv(Buffer.from('PK\x03\x04\0word document')),/Use PDF/);
});
