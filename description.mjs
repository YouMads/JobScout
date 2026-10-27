// Convert provider HTML into plain data. No provider markup or attributes reach the DOM.
const entities = {amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' ',rsquo:'’',lsquo:'‘',rdquo:'”',ldquo:'“',ndash:'–',mdash:'—',bull:'•',hellip:'…',middot:'·',euro:'€',pound:'£',copy:'©',reg:'®',trade:'™',zwj:'',zwnj:''};
export function decodeEntities(value) {
  let out = String(value ?? '');
  for (let pass = 0; pass < 4; pass++) {
    const next = out.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, name) => {
      if (name[0] !== '#') return entities[name.toLowerCase()] ?? whole;
      const n = name[1].toLowerCase() === 'x' ? parseInt(name.slice(2),16) : Number(name.slice(1));
      return n > 0 && n <= 0x10ffff && !(n >= 0xd800 && n <= 0xdfff) ? String.fromCodePoint(n) : '';
    });
    if (next === out) break;
    out = next;
  }
  return out;
}
const clean = value => String(value ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u200b\ufeff]/g,'').replace(/\s+/g,' ').trim();
const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const shortHeading = s => s.length <= 110 && !/[.!?]$/.test(s);
function paragraphs(value) {
  // Older saved jobs have no HTML structure. Break long text only at sentence boundaries.
  const sentences = value.split(/(?<=[.!?])\s+(?=[A-Z0-9"'“‘])/u);
  const result = []; let paragraph = '';
  for (const sentence of sentences) {
    if (paragraph.length > 420 && paragraph.length + sentence.length > 700) { result.push(clean(paragraph)); paragraph = ''; }
    paragraph += (paragraph ? ' ' : '') + sentence;
  }
  if (clean(paragraph)) result.push(clean(paragraph));
  return result;
}
export function parseDescription(value) {
  let html = decodeEntities(String(value ?? '').slice(0,160000))
    .replace(/<!--[\s\S]*?-->/g,'')
    .replace(/<(script|style|iframe|object|svg|template)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,'');
  const isHTML = /<\/?[a-z][a-z0-9]*\b[^>]*>/i.test(html);
  if (!isHTML) {
    const blocks = []; let list;
    for (const line of html.split(/\n+/).map(clean).filter(Boolean)) {
      const bullet = line.match(/^(?:[-*•▪‣]|\d+[.)])\s+(.+)/);
      if (bullet) {
        const ordered = /^\d/.test(line);
        if (!list || list.ordered !== ordered) { list = {type:'list',ordered,items:[]}; blocks.push(list); }
        list.items.push(bullet[1]);
      } else {
        list = null;
        const title = line.replace(/^#{1,6}\s+/, '');
        if ((title !== line || /:$/.test(line)) && shortHeading(title)) blocks.push({type:'heading',text:title});
        else blocks.push(...paragraphs(line).map(text => ({type:'paragraph',text})));
      }
    }
    return normalizeBlocks(blocks);
  }
  html = html.replace(/<p\b[^>]*>\s*<(strong|b)\b[^>]*>([\s\S]*?)<\/\1>\s*<\/p>/gi, (whole, tag, inner) => shortHeading(clean(inner.replace(/<[^>]*>/g,''))) ? `<h3>${inner}</h3>` : whole);
  const blocks = [], stack = [];
  let buffer = '', type = 'paragraph', item = false, currentList = null;
  function flush() {
    const content = clean(buffer); buffer = '';
    if (!content) return;
    if (item) {
      const ordered = stack.at(-1) === 'ol';
      if (!currentList || blocks.at(-1) !== currentList || currentList.ordered !== ordered) { currentList = {type:'list',ordered,items:[]}; blocks.push(currentList); }
      currentList.items.push(content);
    } else {
      currentList = null;
      const heading = type === 'heading' || (/:$/.test(content) && shortHeading(content));
      blocks.push(...(heading ? [{type:'heading',text:content}] : paragraphs(content).map(text => ({type:'paragraph',text}))));
    }
  }
  for (const token of html.split(/(<[^>]*>)/g)) {
    if (!token.startsWith('<') || !token.endsWith('>')) { buffer += token; continue; }
    const m = token.match(/^<\s*(\/?)\s*([a-z][a-z0-9]*)\b/i);
    if (!m) continue;
    const closing = Boolean(m[1]), tag = m[2].toLowerCase();
    if (tag === 'li') {
      flush(); item = !closing; type = 'paragraph';
    } else if (tag === 'ul' || tag === 'ol') {
      flush(); item = false;
      if (closing) stack.pop(); else stack.push(tag);
      currentList = null;
    } else if (/^h[1-6]$/.test(tag)) {
      if (item) buffer += ' ';
      else { flush(); type = closing ? 'paragraph' : 'heading'; }
    } else if (/^(p|div|section|article|br|hr|tr|blockquote)$/.test(tag)) {
      if (item) buffer += ' '; else flush();
    } else if (tag === 'td' || tag === 'th') buffer += ' ';
  }
  flush();
  return normalizeBlocks(blocks);
}
export function normalizeBlocks(value) {
  if (!Array.isArray(value)) return [];
  const blocks = []; let remaining = 80000;
  for (const block of value.slice(0,350)) {
    if (!block || typeof block !== 'object' || remaining <= 0) continue;
    if (block.type === 'list' && Array.isArray(block.items)) {
      const items = [];
      for (const raw of block.items.slice(0,300)) {
        if (typeof raw !== 'string' || remaining <= 0) continue;
        const text = clean(raw).slice(0,Math.min(6000,remaining));
        if (text) { items.push(text); remaining -= text.length; }
      }
      if (items.length) {
        const previous = blocks.at(-1), ordered = block.ordered === true;
        if (previous?.type === 'list' && previous.ordered === ordered) previous.items.push(...items);
        else blocks.push({type:'list',ordered,items});
      }
    } else if (['heading','paragraph'].includes(block.type) && typeof block.text === 'string') {
      const text = clean(block.text).slice(0,remaining);
      if (text) { blocks.push({type:block.type,text}); remaining -= text.length; }
    }
  }
  return blocks;
}
export function descriptionFields(value) {
  const descriptionBlocks = parseDescription(value);
  const description = descriptionBlocks.map(b => b.type === 'list' ? b.items.join('\n') : b.text).join('\n\n');
  return {description,descriptionBlocks};
}
export function jobBlocks(job) {
  const structured = normalizeBlocks(job.descriptionBlocks);
  return structured.length ? structured : parseDescription(job.description);
}
export function descriptionExcerpt(job) {
  const blocks = jobBlocks(job);
  const opening = blocks.find(b => b.type === 'paragraph' && b.text.length >= 45)?.text
    || blocks.find(b => b.type === 'paragraph')?.text || blocks.find(b => b.type === 'list')?.items[0] || '';
  return opening.length <= 260 ? opening : opening.slice(0,257).replace(/\s+\S*$/,'') + '…';
}
export function renderDescription(job) {
  const blocks = jobBlocks(job);
  if (!blocks.length) return '<p class="description-empty">This source has not provided a description. Open the original listing for details.</p>';
  return blocks.map(b => {
    if (b.type === 'heading') return `<h4>${escape(b.text)}</h4>`;
    if (b.type === 'list') { const tag = b.ordered ? 'ol' : 'ul'; return `<${tag}>${b.items.map(item => `<li>${escape(item)}</li>`).join('')}</${tag}>`; }
    return `<p>${escape(b.text)}</p>`;
  }).join('');
}
