const ALLOWED_TAGS = new Set([
  "a",
  "abbr",
  "b",
  "blockquote",
  "br",
  "cite",
  "code",
  "div",
  "em",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "hr",
  "i",
  "iframe",
  "img",
  "li",
  "ol",
  "p",
  "pre",
  "span",
  "strong",
  "sub",
  "sup",
  "u",
  "ul",
]);

const ALLOWED_ATTRS = new Set([
  "href",
  "title",
  "target",
  "rel",
  "src",
  "alt",
  "width",
  "height",
  "class",
  "style",
  "loading",
  "frameborder",
  "allow",
  "allowfullscreen",
]);

const URL_ATTRS = new Set(["href", "src"]);

function isSafeUrl(value: string, attr: string): boolean {
  const v = value.trim();
  if (!v) return false;
  const lower = v.toLowerCase();
  if (lower.startsWith("javascript:") || lower.startsWith("data:text/html")) return false;
  if (attr === "href") {
    return (
      lower.startsWith("http://") ||
      lower.startsWith("https://") ||
      lower.startsWith("mailto:") ||
      lower.startsWith("tel:") ||
      lower.startsWith("/") ||
      lower.startsWith("./") ||
      lower.startsWith("../") ||
      lower.startsWith("#")
    );
  }
  if (attr === "src") {
    return (
      lower.startsWith("https://") ||
      lower.startsWith("http://") ||
      lower.startsWith("/") ||
      lower.startsWith("./") ||
      lower.startsWith("../") ||
      lower.startsWith("data:image/")
    );
  }
  return false;
}

/** Lightweight HTML sanitizer for Workers (no DOM). */
export function sanitizeHtml(input: string): string {
  if (!input) return "";
  let html = String(input);
  // Strip scripts, styles, event handlers and dangerous tags wholesale.
  html = html.replace(/<\s*(script|style|object|embed|link|meta)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, "");
  html = html.replace(/<\s*(script|style|object|embed|link|meta)[^>]*\/?\s*>/gi, "");
  html = html.replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  html = html.replace(/javascript\s*:/gi, "");

  // Filter tags/attributes.
  html = html.replace(/<\/?([a-z0-9]+)([^>]*)>/gi, (match, tagName: string, attrs: string) => {
    const tag = tagName.toLowerCase();
    const isClose = match.startsWith("</");
    if (!ALLOWED_TAGS.has(tag)) return "";
    if (isClose) return `</${tag}>`;

    const safeAttrs: string[] = [];
    const attrRe = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/g;
    let m: RegExpExecArray | null;
    while ((m = attrRe.exec(attrs))) {
      const name = m[1].toLowerCase();
      const value = m[3] ?? m[4] ?? m[5] ?? "";
      if (!ALLOWED_ATTRS.has(name)) continue;
      if (name.startsWith("on")) continue;
      if (URL_ATTRS.has(name) && !isSafeUrl(value, name)) continue;
      if (name === "target" && value !== "_blank" && value !== "_self") continue;
      if (name === "rel") {
        safeAttrs.push(`rel="noopener noreferrer"`);
        continue;
      }
      const escaped = value.replace(/"/g, "&quot;");
      safeAttrs.push(`${name}="${escaped}"`);
    }
    if (tag === "a" && safeAttrs.some((a) => a.startsWith("target=")) && !safeAttrs.some((a) => a.startsWith("rel="))) {
      safeAttrs.push(`rel="noopener noreferrer"`);
    }
    return safeAttrs.length ? `<${tag} ${safeAttrs.join(" ")}>` : `<${tag}>`;
  });

  return html;
}

export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || `entrada-${Date.now()}`;
}
