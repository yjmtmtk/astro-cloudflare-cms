import { transformSync, walkSync, ELEMENT_NODE, COMMENT_NODE, type Node } from 'ultrahtml';
import sanitize from 'ultrahtml/transformers/sanitize';

const ALLOWED_TAGS = [
  'p', 'br', 'hr', 'strong', 'em', 'b', 'i', 'u', 's',
  'h1', 'h2', 'h3', 'ul', 'ol', 'li',
  'blockquote', 'code', 'pre', 'a', 'img',
];

// Per-tag attribute allowlist. Everything not listed is dropped (default-deny).
const ALLOWED_ATTRS: Record<string, string[]> = {
  a: ['href', 'title'],
  img: ['src', 'alt'],
};

// http(s), mailto, or root-relative (covers /cms-media/...). Anything else (javascript:, vbscript:, data:, etc.) is rejected.
const SAFE_URL = /^(https?:|mailto:|\/)/i;

// Characters that break out of an attribute-value context in HTML serialization.
const UNSAFE_ATTR_CHARS = /["'<>`]/g;
// on* event-handler patterns that may remain after quote stripping.
const ON_EVENT_PATTERN = /\bon\w+\s*=/gi;

function cleanAttrValue(v: string): string {
  return v.replace(UNSAFE_ATTR_CHARS, '').replace(ON_EVENT_PATTERN, '');
}

function attributeAllowlist() {
  return (doc: Node): Node => {
    const commentNodes: Array<{ parent: Node & { children: Node[] }; node: Node }> = [];
    walkSync(doc, (node, parent) => {
      // Remove HTML comments — ultrahtml's sanitize allowComments option is parsed but not enforced.
      if (node.type === COMMENT_NODE) {
        const p = parent as Node & { children?: Node[] };
        if (p?.children) {
          commentNodes.push({ parent: p as Node & { children: Node[] }, node });
        }
        return;
      }
      if (node.type !== ELEMENT_NODE) return;
      const el = node as { name?: string; attributes?: Record<string, string> };
      if (!el.attributes) return;
      const allowed = ALLOWED_ATTRS[el.name ?? ''] ?? [];
      for (const attr of Object.keys(el.attributes)) {
        if (!allowed.includes(attr)) {
          delete el.attributes[attr];
          continue;
        }
        const cleaned = cleanAttrValue(String(el.attributes[attr]));
        if (attr === 'href' || attr === 'src') {
          if (!SAFE_URL.test(cleaned)) { delete el.attributes[attr]; continue; }
        }
        el.attributes[attr] = cleaned;
      }
    });
    // Remove collected comment nodes after the walk completes.
    for (const { parent, node } of commentNodes) {
      parent.children = parent.children.filter((c) => c !== node);
    }
    return doc;
  };
}

export function sanitizeBody(html: string): string {
  return transformSync(html, [
    sanitize({
      allowElements: ALLOWED_TAGS,
      // dropElements is belt-and-suspenders: allowElements is already default-deny.
      dropElements: ['script', 'style', 'iframe', 'noscript', 'object', 'embed'],
      allowComments: false,
    }),
    attributeAllowlist(),
  ]);
}
