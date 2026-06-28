import { config } from 'virtual:acc-config';
import { resizeToWebp } from '../lib/image';

/**
 * Resize a file to webp and upload to /admin/api/upload.
 * Returns the `/cms-media/<key>` url on success.
 * Throws on non-2xx responses.
 */
export async function uploadImage(file: File, articleId: string): Promise<{ url: string }> {
  const webpBlob = await resizeToWebp(file);
  const form = new FormData();
  form.append('file', new File([webpBlob], 'image.webp', { type: 'image/webp' }));
  form.append('articleId', articleId);

  const res = await fetch(`${config.adminBasePath}/api/upload`, {
    method: 'POST',
    body: form,
    credentials: 'same-origin',
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Upload failed (${res.status}): ${text}`);
  }

  const json = (await res.json()) as { key: string; url: string };
  return { url: json.url };
}
