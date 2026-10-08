import { Fragment, type ReactNode } from 'react';
import { normalizeRichDoc, plainTextToDoc, type RichNode } from './rich-text';
function renderNode(node: RichNode, key: number): ReactNode {
  const children = (node.content || []).map(renderNode);
  if (node.type === 'text') {
    let text: ReactNode = node.text;
    for (const [i, mark] of (node.marks || []).entries()) {
      const k = key + '-' + i;
      text =
        mark.type === 'bold' ? (
          <strong key={k}>{text}</strong>
        ) : mark.type === 'italic' ? (
          <em key={k}>{text}</em>
        ) : mark.type === 'underline' ? (
          <u key={k}>{text}</u>
        ) : mark.type === 'strike' ? (
          <s key={k}>{text}</s>
        ) : (
          <a key={k} href={mark.attrs?.href} target="_blank" rel="noopener noreferrer">
            {text}
          </a>
        );
    }
    return <Fragment key={key}>{text}</Fragment>;
  }
  switch (node.type) {
    case 'doc':
      return <Fragment key={key}>{children}</Fragment>;
    case 'paragraph':
      return <p key={key}>{children.length ? children : <br />}</p>;
    case 'heading':
      return node.attrs?.level === 2 ? (
        <h2 key={key}>{children}</h2>
      ) : (
        <h3 key={key}>{children}</h3>
      );
    case 'hardBreak':
      return <br key={key} />;
    case 'bulletList':
      return <ul key={key}>{children}</ul>;
    case 'orderedList':
      return (
        <ol key={key} start={node.attrs?.start}>
          {children}
        </ol>
      );
    case 'listItem':
      return <li key={key}>{children}</li>;
    case 'blockquote':
      return <blockquote key={key}>{children}</blockquote>;
    case 'horizontalRule':
      return <hr key={key} />;
    default:
      return null;
  }
}
export function RichTextView({ value, plainText = '' }: { value?: unknown; plainText?: string }) {
  let doc;
  try {
    doc = normalizeRichDoc(value);
  } catch {
    doc = plainTextToDoc(plainText);
  }
  return <div className="rich-content">{renderNode(doc, 0)}</div>;
}
