import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import { useEffect, useRef } from 'react';
import { uploadImage } from './ImageUploader';
import { Bold, Italic, Heading2, List, ImagePlus } from 'lucide-react';

export default function RichTextEditor({
  value,
  onChange,
  articleId,
}: {
  value: string;
  onChange: (html: string) => void;
  articleId: string;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [StarterKit, Image],
    content: value,
    immediatelyRender: false, // required for SSR/islands
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  // Keep editor in sync if the incoming value changes externally (e.g. initial load).
  useEffect(() => {
    if (editor && value !== editor.getHTML()) editor.commands.setContent(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  async function handleImageFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !editor) return;
    // Reset so the same file can be re-selected
    e.target.value = '';
    try {
      const { url } = await uploadImage(file, articleId);
      editor.chain().focus().setImage({ src: url }).run();
    } catch (err) {
      alert(err instanceof Error ? err.message : '画像のアップロードに失敗しました');
    }
  }

  return (
    <div className="rounded-md border">
      <div className="flex gap-1 border-b p-1 text-sm">
        <button
          type="button"
          aria-label="太字"
          title="太字"
          onClick={() => editor?.chain().focus().toggleBold().run()}
          className="rounded p-1 hover:bg-muted"
        >
          <Bold className="h-4 w-4" />
        </button>
        <button
          type="button"
          aria-label="イタリック"
          title="イタリック"
          onClick={() => editor?.chain().focus().toggleItalic().run()}
          className="rounded p-1 hover:bg-muted"
        >
          <Italic className="h-4 w-4" />
        </button>
        <button
          type="button"
          aria-label="見出し2"
          title="見出し2"
          onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
          className="rounded p-1 hover:bg-muted"
        >
          <Heading2 className="h-4 w-4" />
        </button>
        <button
          type="button"
          aria-label="箇条書き"
          title="箇条書き"
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
          className="rounded p-1 hover:bg-muted"
        >
          <List className="h-4 w-4" />
        </button>
        <button
          type="button"
          aria-label="画像を挿入"
          title="画像を挿入"
          onClick={() => fileInputRef.current?.click()}
          className="rounded p-1 hover:bg-muted"
        >
          <ImagePlus className="h-4 w-4" />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleImageFile}
        />
      </div>
      <EditorContent editor={editor} className="prose max-w-none p-2" />
    </div>
  );
}
