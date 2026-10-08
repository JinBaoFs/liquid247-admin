export interface RichMark {
  type: 'bold' | 'italic' | 'underline' | 'strike' | 'link';
  attrs?: { href: string };
}
export interface RichNode {
  type: string;
  text?: string;
  attrs?: { level?: number; start?: number };
  marks?: RichMark[];
  content?: RichNode[];
}
export interface RichDoc extends RichNode {
  type: 'doc';
  content: RichNode[];
}
export const emptyDoc = (): RichDoc => ({ type: 'doc', content: [{ type: 'paragraph' }] });
export function isSafeLink(value: string): boolean {
  return /^(https?:\/\/|mailto:)/i.test(value.trim()) && !/[\u0000-\u0020]/.test(value.trim());
}
export function plainTextToDoc(value: string): RichDoc {
  return {
    type: 'doc',
    content: String(value || '')
      .split(/\r?\n/)
      .map((text) => ({
        type: 'paragraph',
        ...(text ? { content: [{ type: 'text', text }] } : {}),
      })),
  };
}
const blockTypes = new Set([
  'paragraph',
  'heading',
  'bulletList',
  'orderedList',
  'blockquote',
  'horizontalRule',
]);
export function normalizeRichDoc(value: unknown): RichDoc {
  if (!value || typeof value !== 'object' || (value as RichNode).type !== 'doc')
    throw new Error('正文格式无效');
  let count = 0;
  const node = (raw: unknown, depth: number): RichNode => {
    if (++count > 10000 || depth > 30 || !raw || typeof raw !== 'object')
      throw new Error('正文结构无效');
    const n = raw as RichNode;
    const out: RichNode = { type: n.type };
    if (
      ![
        'doc',
        'paragraph',
        'heading',
        'text',
        'hardBreak',
        'bulletList',
        'orderedList',
        'listItem',
        'blockquote',
        'horizontalRule',
      ].includes(n.type)
    )
      throw new Error('正文含不支持的格式');
    if (n.type === 'text') {
      if (typeof n.text !== 'string' || !n.text.length) throw new Error('正文文本节点无效');
      out.text = n.text;
      if (n.marks) {
        if (!Array.isArray(n.marks)) throw new Error('正文格式无效');
        out.marks = n.marks.map((m) => {
          if (!['bold', 'italic', 'underline', 'strike', 'link'].includes(m.type))
            throw new Error('正文含不支持的格式');
          if (m.type === 'link') {
            if (!m.attrs || typeof m.attrs.href !== 'string' || !isSafeLink(m.attrs.href))
              throw new Error('链接仅支持 HTTP、HTTPS 或邮箱地址');
            return { type: 'link', attrs: { href: m.attrs.href.trim() } };
          }
          return { type: m.type };
        });
      }
      return out;
    }
    if (n.type === 'heading') {
      if (![2, 3].includes(n.attrs?.level || 0)) throw new Error('仅支持二级和三级标题');
      out.attrs = { level: n.attrs!.level };
    }
    if (n.type === 'orderedList')
      out.attrs = {
        start:
          Number.isSafeInteger(n.attrs?.start) && Number(n.attrs?.start) > 0 ? n.attrs!.start : 1,
      };
    if (n.content !== undefined) {
      if (!Array.isArray(n.content)) throw new Error('正文结构无效');
      out.content = n.content.map((c) => node(c, depth + 1));
    }
    const children = out.content || [];
    if (['hardBreak', 'horizontalRule'].includes(n.type) && children.length)
      throw new Error('正文结构无效');
    if (
      ['paragraph', 'heading'].includes(n.type) &&
      children.some((c) => !['text', 'hardBreak'].includes(c.type))
    )
      throw new Error('段落结构无效');
    if (
      ['doc', 'blockquote', 'listItem'].includes(n.type) &&
      children.some((c) => !blockTypes.has(c.type))
    )
      throw new Error('正文结构无效');
    if (
      ['bulletList', 'orderedList'].includes(n.type) &&
      (!children.length || children.some((c) => c.type !== 'listItem'))
    )
      throw new Error('列表结构无效');
    if (n.type === 'listItem' && children[0]?.type !== 'paragraph')
      throw new Error('列表项结构无效');
    return out;
  };
  const result = node(value, 0) as RichDoc;
  if (!result.content?.length) return emptyDoc();
  return result;
}
export function richTextPlain(doc: RichNode): string {
  if (doc.type === 'text') return doc.text || '';
  if (doc.type === 'hardBreak') return '\n';
  const separator = ['doc', 'blockquote', 'listItem', 'bulletList', 'orderedList'].includes(
    doc.type,
  )
    ? '\n'
    : '';
  return (doc.content || []).map(richTextPlain).join(separator);
}
export function hasRichText(doc: RichNode): boolean {
  return richTextPlain(doc).replace(/[\s\u200B-\u200D\uFEFF]/g, '').length > 0;
}
