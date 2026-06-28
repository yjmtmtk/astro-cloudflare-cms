import { describe, it, expect } from 'vitest';
import { sanitizeBody } from '@/lib/sanitize-html-body';

describe('sanitizeBody', () => {
  it('keeps allowed tags and safe attributes', () => {
    const html = '<p><strong>Hi</strong> <a href="https://x.com" title="t">link</a></p><h2>H</h2><ul><li>x</li></ul>';
    const out = sanitizeBody(html);
    expect(out).toContain('<strong>Hi</strong>');
    expect(out).toContain('href="https://x.com"');
    expect(out).toContain('<h2>H</h2>');
    expect(out).toContain('<li>x</li>');
  });
  it('keeps img with /cms-media src + alt', () => {
    const out = sanitizeBody('<p><img src="/cms-media/articles/a.webp" alt="pic"></p>');
    expect(out).toContain('src="/cms-media/articles/a.webp"');
    expect(out).toContain('alt="pic"');
  });
  it('strips <script>', () => {
    expect(sanitizeBody('<p>ok</p><script>alert(1)</script>')).not.toContain('<script');
    expect(sanitizeBody('<p>ok</p><script>alert(1)</script>')).toContain('<p>ok</p>');
  });
  it('strips event-handler attributes', () => {
    expect(sanitizeBody('<img src="/cms-media/a.webp" onerror="alert(1)">')).not.toMatch(/onerror/i);
  });
  it('strips javascript: hrefs', () => {
    const out = sanitizeBody('<a href="javascript:alert(1)">x</a>');
    expect(out).not.toMatch(/javascript:/i);
  });
  it('strips iframe', () => {
    expect(sanitizeBody('<iframe src="https://evil"></iframe>')).not.toContain('<iframe');
  });
  it('strips exotic/novel event handlers not on any denylist', () => {
    expect(sanitizeBody('<p onbeforetoggle="x()">hi</p>')).not.toMatch(/onbeforetoggle/i);
    expect(sanitizeBody('<img src="/cms-media/a.webp" onbeforematch="x()">')).not.toMatch(/onbeforematch/i);
  });
  it('strips style and class and other non-allowlisted attributes', () => {
    const out = sanitizeBody('<p style="color:red" class="x" data-y="z">hi</p>');
    expect(out).not.toMatch(/style=/i);
    expect(out).not.toMatch(/class=/i);
    expect(out).not.toMatch(/data-y/i);
    expect(out).toContain('hi');
  });
  it('keeps safe url schemes (mailto, root-relative) and drops unsafe ones', () => {
    expect(sanitizeBody('<a href="mailto:a@b.com">m</a>')).toContain('mailto:a@b.com');
    expect(sanitizeBody('<a href="/news/x">n</a>')).toContain('href="/news/x"');
    expect(sanitizeBody('<a href="vbscript:msgbox(1)">v</a>')).not.toMatch(/vbscript:/i);
    expect(sanitizeBody('<a href="data:text/html,<script>1</script>">d</a>')).not.toMatch(/data:text\/html/i);
  });
  it('does not corrupt body text that contains on-like words', () => {
    expect(sanitizeBody('<p>go online=now and turn on</p>')).toContain('go online=now and turn on');
  });
  it('neutralizes attribute-value quote breakout (title)', () => {
    const out = sanitizeBody(`<a href="https://example.com" title='hi" onmouseover="alert(1)'>c</a>`);
    expect(out).not.toMatch(/onmouseover/i);
  });
  it('neutralizes attribute-value quote breakout (img alt)', () => {
    const out = sanitizeBody(`<img src="/cms-media/a.webp" alt='" onerror="alert(1)' x='>`);
    expect(out).not.toMatch(/onerror/i);
  });
  it('neutralizes quote breakout via href value', () => {
    const out = sanitizeBody(`<a href='https://x" onmouseover="alert(1)'>c</a>`);
    expect(out).not.toMatch(/onmouseover/i);
  });
  it('drops HTML comments (and markup inside them)', () => {
    const out = sanitizeBody('<p>ok</p><!--<script>alert(1)</script>-->');
    expect(out).not.toContain('<script');
    expect(out).toContain('<p>ok</p>');
  });
  it('preserves ordinary body text', () => {
    expect(sanitizeBody('<p>tom & jerry are friends</p>')).toContain('tom');
  });
});
