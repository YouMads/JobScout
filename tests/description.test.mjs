import {test} from 'node:test';
import assert from 'node:assert/strict';
import {descriptionFields,parseDescription,renderDescription,descriptionExcerpt,jobBlocks,normalizeBlocks} from '../description.mjs';

test('nested encoded provider HTML retains headings, paragraphs and bullet lists',()=>{
 const j=descriptionFields('&amp;lt;p&amp;gt;Build products with Node.js &amp;amp; TypeScript.&amp;lt;/p&amp;gt;&amp;lt;h2&amp;gt;Requirements&amp;lt;/h2&amp;gt;&amp;lt;ul&amp;gt;&amp;lt;li&amp;gt;React experience&amp;lt;/li&amp;gt;&amp;lt;li&amp;gt;Clear communication&amp;lt;/li&amp;gt;&amp;lt;/ul&amp;gt;');
 assert.deepEqual(j.descriptionBlocks,[{type:'paragraph',text:'Build products with Node.js & TypeScript.'},{type:'heading',text:'Requirements'},{type:'list',ordered:false,items:['React experience','Clear communication']}]);
 assert.match(j.description,/React experience\nClear communication/);
});
test('bold standalone headings and ordered lists remain readable',()=>{
 const blocks=parseDescription('<p><strong>What you will do</strong></p><ol><li><p>Design APIs.</p></li><li>Ship features.</li></ol>');
 assert.equal(blocks[0].type,'heading');assert.deepEqual(blocks[1],{type:'list',ordered:true,items:['Design APIs.','Ship features.']});
 assert.match(renderDescription({descriptionBlocks:blocks}),/<h4>What you will do<\/h4><ol><li>Design APIs/);
});
test('plain text, punctuation and tech names survive legacy description fallback',()=>{
 const sentence='Use Node.js, C++, C#, .NET and APIs. Keep all supplied requirements intact.';
 const description=Array(14).fill(sentence).join(' ');
 const blocks=jobBlocks({description});
 assert.ok(blocks.length>1);assert.equal(blocks.map(b=>b.text).join(' '),description);
 assert.match(descriptionExcerpt({description}),/Node\.js/);assert.ok(descriptionExcerpt({description}).length<=260);
 assert.deepEqual(parseDescription('Requirements:\n- TypeScript\n- React'),[{type:'heading',text:'Requirements:'},{type:'list',ordered:false,items:['TypeScript','React']}]);
});
test('external HTML cannot inject scripts, attributes, links, images or styles',()=>{
 const job=descriptionFields('<script>alert(1)</script><style>body{display:none}</style><p onclick="bad()">Work with us <a href="javascript:bad()">today</a></p><img src=x onerror=bad()><iframe src="https://bad.example">hidden</iframe>');
 const html=renderDescription(job);
 assert.equal(html,'<p>Work with us today</p>');
 const imported=renderDescription({descriptionBlocks:[{type:'heading',text:'<img src=x onerror=bad()>'},{type:'list',items:['<script>bad()</script>'],ordered:true}]});
 assert.doesNotMatch(imported,/<img|<script|onerror="/);assert.match(imported,/&lt;script&gt;/);
});
test('card excerpts choose prose and omit heading or list markup',()=>{
 const job=descriptionFields('<h2>About us</h2><p>We build useful software with a small team in Cyprus.</p><h2>Requirements</h2><ul><li>Python</li></ul>');
 assert.equal(descriptionExcerpt(job),'We build useful software with a small team in Cyprus.');
 assert.match(renderDescription({description:''}),/not provided a description/);
});
test('unknown imported blocks are discarded and supported text is bounded',()=>{
 const blocks=normalizeBlocks([{type:'script',text:'bad()'},{type:'paragraph',text:'a'.repeat(100000)},{type:'heading',text:'b'}]);
 assert.equal(blocks.length,1);assert.equal(blocks[0].text.length,80000);
});

test('headings inside source bullet items stay in one clean bullet list',()=>{
 const blocks=parseDescription('<h3>Benefits</h3><ul><li><h3>Remote work</h3></li><li><p>Flexible hours</p></li></ul><ul><li>Health cover</li></ul>');
 assert.deepEqual(blocks,[{type:'heading',text:'Benefits'},{type:'list',ordered:false,items:['Remote work','Flexible hours','Health cover']}]);
});
