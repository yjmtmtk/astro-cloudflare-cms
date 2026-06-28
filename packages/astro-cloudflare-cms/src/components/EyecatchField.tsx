import { useRef } from 'react';
import { uploadImage } from './ImageUploader';
import { ImagePlus, X } from 'lucide-react';

export default function EyecatchField({
  articleId,
  value,
  onChange,
  className,
}: {
  articleId: string;
  value: string | null;
  onChange: (v: string | null) => void;
  className?: string;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    try {
      const { url } = await uploadImage(file, articleId);
      onChange(url);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'アイキャッチ画像のアップロードに失敗しました');
    }
  }

  return (
    <div className={`space-y-2 ${className ?? ''}`}>
      {value ? (
        <div className="relative inline-block">
          <img
            src={value}
            alt="アイキャッチ"
            className="max-h-48 rounded-md border object-cover"
          />
        </div>
      ) : (
        <div className="flex h-32 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
          未設定
        </div>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
        >
          <ImagePlus className="h-4 w-4" />
          画像を選択
        </button>
        {value && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm text-destructive hover:bg-destructive/10"
          >
            <X className="h-4 w-4" />
            解除
          </button>
        )}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFile}
      />
    </div>
  );
}
