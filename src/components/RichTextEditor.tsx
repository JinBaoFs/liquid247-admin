import { useEffect, useRef, useState } from 'react';
import { useEditor, useEditorState, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { App, Button, Input, Modal, Select, Tooltip } from 'antd';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  List,
  ListOrdered,
  Quote,
  Link2,
  Unlink,
  Minus,
  RemoveFormatting,
  Undo2,
  Redo2,
} from 'lucide-react';
import {
  emptyDoc,
  isSafeLink,
  normalizeRichDoc,
  richTextPlain,
  type RichDoc,
} from '../content/rich-text';
interface Props {
  value?: RichDoc;
  onChange?: (value: RichDoc) => void;
  id?: string;
  disabled?: boolean;
}
export default function RichTextEditor({ value, onChange, id, disabled = false }: Props) {
  const { message } = App.useApp();
  const callback = useRef(onChange);
  callback.current = onChange;
  const [linkOpen, setLinkOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [linkError, setLinkError] = useState('');
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        codeBlock: false,
        code: false,
        link: {
          openOnClick: false,
          autolink: false,
          linkOnPaste: true,
          protocols: ['http', 'https', 'mailto'],
          isAllowedUri: (href, ctx) => isSafeLink(href) && ctx.defaultValidate(href),
        },
      }),
    ],
    content: value || emptyDoc(),
    editable: !disabled,
    editorProps: {
      attributes: {
        role: 'textbox',
        'aria-label': '正文',
        'aria-multiline': 'true',
        ...(id ? { id } : {}),
      },
    },
    onUpdate: ({ editor }) => callback.current?.(normalizeRichDoc(editor.getJSON())),
  });
  const state = useEditorState({
    editor,
    selector: ({ editor }) =>
      editor
        ? {
            bold: editor.isActive('bold'),
            italic: editor.isActive('italic'),
            underline: editor.isActive('underline'),
            strike: editor.isActive('strike'),
            bulletList: editor.isActive('bulletList'),
            orderedList: editor.isActive('orderedList'),
            blockquote: editor.isActive('blockquote'),
            link: editor.isActive('link'),
            heading: editor.isActive('heading', { level: 2 })
              ? 'h2'
              : editor.isActive('heading', { level: 3 })
                ? 'h3'
                : 'p',
            undo: editor.can().undo(),
            redo: editor.can().redo(),
            characters: richTextPlain(editor.getJSON()).replace(/\n/g, '').length,
          }
        : null,
  });
  useEffect(() => {
    if (
      editor &&
      value &&
      JSON.stringify(normalizeRichDoc(editor.getJSON())) !== JSON.stringify(normalizeRichDoc(value))
    )
      editor.commands.setContent(value, { emitUpdate: false });
  }, [editor, value]);
  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [editor, disabled]);
  if (!editor) return <div className="rich-editor-loading">正在加载编辑器…</div>;
  const tools = [
    {
      label: '加粗',
      icon: Bold,
      active: state?.bold,
      action: () => editor.chain().focus().toggleBold().run(),
    },
    {
      label: '斜体',
      icon: Italic,
      active: state?.italic,
      action: () => editor.chain().focus().toggleItalic().run(),
    },
    {
      label: '下划线',
      icon: Underline,
      active: state?.underline,
      action: () => editor.chain().focus().toggleUnderline().run(),
    },
    {
      label: '删除线',
      icon: Strikethrough,
      active: state?.strike,
      action: () => editor.chain().focus().toggleStrike().run(),
    },
    {
      label: '无序列表',
      icon: List,
      active: state?.bulletList,
      action: () => editor.chain().focus().toggleBulletList().run(),
    },
    {
      label: '有序列表',
      icon: ListOrdered,
      active: state?.orderedList,
      action: () => editor.chain().focus().toggleOrderedList().run(),
    },
    {
      label: '引用',
      icon: Quote,
      active: state?.blockquote,
      action: () => editor.chain().focus().toggleBlockquote().run(),
    },
    {
      label: '插入链接',
      icon: Link2,
      active: state?.link,
      action: () => {
        setUrl(editor.getAttributes('link').href || '');
        setLinkError('');
        setLinkOpen(true);
      },
    },
    {
      label: '移除链接',
      icon: Unlink,
      disabled: !state?.link,
      action: () => editor.chain().focus().extendMarkRange('link').unsetLink().run(),
    },
    {
      label: '分隔线',
      icon: Minus,
      action: () => editor.chain().focus().setHorizontalRule().run(),
    },
    {
      label: '清除格式',
      icon: RemoveFormatting,
      action: () => editor.chain().focus().unsetAllMarks().clearNodes().run(),
    },
    {
      label: '撤销',
      icon: Undo2,
      disabled: !state?.undo,
      action: () => editor.chain().focus().undo().run(),
    },
    {
      label: '重做',
      icon: Redo2,
      disabled: !state?.redo,
      action: () => editor.chain().focus().redo().run(),
    },
  ];
  return (
    <div className={'rich-editor ' + (disabled ? 'disabled' : '')}>
      <div className="rich-toolbar" role="toolbar" aria-label="正文格式工具栏">
        <Select
          aria-label="段落格式"
          value={state?.heading || 'p'}
          disabled={disabled}
          options={[
            { value: 'p', label: '正文' },
            { value: 'h2', label: '二级标题' },
            { value: 'h3', label: '三级标题' },
          ]}
          onChange={(v) =>
            v === 'p'
              ? editor.chain().focus().setParagraph().run()
              : editor
                  .chain()
                  .focus()
                  .toggleHeading({ level: v === 'h2' ? 2 : 3 })
                  .run()
          }
        />
        {tools.map((tool, index) => (
          <Tooltip title={tool.label} key={tool.label}>
            <Button
              aria-label={tool.label}
              aria-pressed={!!tool.active}
              type="text"
              className={tool.active ? 'is-active' : ''}
              disabled={disabled || !!tool.disabled}
              icon={<tool.icon size={15} />}
              onMouseDown={(e) => e.preventDefault()}
              onClick={tool.action}
            />
          </Tooltip>
        ))}
      </div>
      <EditorContent editor={editor} className="rich-content" />
      <div className="rich-editor-footer">
        <span>支持粘贴文本与格式内容</span>
        <span>{state?.characters || 0} 字</span>
      </div>
      <Modal
        title="插入链接"
        open={linkOpen}
        onCancel={() => setLinkOpen(false)}
        okText="应用链接"
        cancelText="取消"
        onOk={() => {
          if (!isSafeLink(url)) {
            setLinkError('请输入 http://、https:// 或 mailto: 开头的有效链接');
            return;
          }
          const chain = editor.chain().focus().extendMarkRange('link');
          const applied =
            editor.state.selection.empty && !state?.link
              ? chain
                  .insertContent({
                    type: 'text',
                    text: url.trim(),
                    marks: [{ type: 'link', attrs: { href: url.trim() } }],
                  })
                  .run()
              : chain.setLink({ href: url.trim() }).run();
          if (applied) setLinkOpen(false);
          else message.error('链接应用失败，请重试');
        }}
      >
        <label className="rich-link-label" htmlFor="rich-link-url">
          链接地址
        </label>
        <Input
          id="rich-link-url"
          autoFocus
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            setLinkError('');
          }}
          placeholder="https://example.com"
          status={linkError ? 'error' : undefined}
        />
        {linkError && <p className="rich-link-error">{linkError}</p>}
      </Modal>
    </div>
  );
}
