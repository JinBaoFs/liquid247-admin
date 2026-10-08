import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  emptyDoc,
  hasRichText,
  isSafeLink,
  normalizeRichDoc,
  plainTextToDoc,
  richTextPlain,
} from './rich-text';
import { RichTextView } from './RichTextView';
describe('富文本内容', () => {
  it('纯文本迁移保留换行与字符，HTML 文字不作为标签解释', () => {
    const text = '第一段\n\n<script>alert(1)</script>';
    const doc = plainTextToDoc(text);
    expect(richTextPlain(doc)).toBe(text);
    const html = renderToStaticMarkup(<RichTextView value={doc} />);
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>');
  });
  it('格式内容可保存，空段落与仅格式内容不算正文', () => {
    expect(hasRichText(emptyDoc())).toBe(false);
    expect(
      hasRichText({
        type: 'doc',
        content: [
          { type: 'horizontalRule' },
          { type: 'paragraph', content: [{ type: 'text', text: ' \u200b' }] },
        ],
      }),
    ).toBe(false);
    const doc = normalizeRichDoc({
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '标题' }] },
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: '正文', marks: [{ type: 'bold' }, { type: 'underline' }] },
          ],
        },
      ],
    });
    expect(hasRichText(doc)).toBe(true);
    expect(renderToStaticMarkup(<RichTextView value={doc} />)).toContain(
      '<u><strong>正文</strong></u>',
    );
  });
  it('链接仅允许声明的安全协议，拒绝危险节点与任意属性', () => {
    expect(isSafeLink('https://example.com')).toBe(true);
    expect(isSafeLink('mailto:test@example.com')).toBe(true);
    expect(isSafeLink('javascript:alert(1)')).toBe(false);
    expect(() => normalizeRichDoc({ type: 'doc', content: [{ type: 'script' }] })).toThrow(
      '不支持',
    );
    expect(() =>
      normalizeRichDoc({
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: '链接',
                marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }],
              },
            ],
          },
        ],
      }),
    ).toThrow('链接仅支持');
    const doc = normalizeRichDoc({
      type: 'doc',
      content: [
        { type: 'paragraph', attrs: { onclick: 'bad' }, content: [{ type: 'text', text: '安全' }] },
      ],
    });
    expect(JSON.stringify(doc)).not.toContain('onclick');
  });
});
