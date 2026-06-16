import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { escapeHtml } from './config.js';

const ALLOWED_TAGS = [
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'p', 'br', 'hr',
    'strong', 'b', 'em', 'i', 'u', 's', 'del', 'ins', 'mark',
    'ul', 'ol', 'li',
    'a',
    'blockquote', 'q', 'cite',
    'code', 'pre', 'kbd', 'samp', 'var',
    'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
    'img',
    'div', 'span'
];

const TAG_ATTR_WHITELIST = {
    'a':          ['href', 'title', 'target', 'rel'],
    'img':        ['src', 'alt', 'title', 'width', 'height', 'loading', 'referrerpolicy'],
    'th':         ['align', 'colspan', 'rowspan'],
    'td':         ['align', 'colspan', 'rowspan'],
    'code':       ['class'],
    'pre':        ['class'],
    'div':        ['class'],
    'span':       ['class'],
    'ol':         ['start', 'type'],
    'li':         ['value'],
    'blockquote': ['cite'],
    'q':          ['cite'],
    'table':      [],
    'thead':      [],
    'tbody':      [],
    'tfoot':      [],
    'tr':         [],
    'h1':         ['id'],
    'h2':         ['id'],
    'h3':         ['id'],
    'h4':         ['id'],
    'h5':         ['id'],
    'h6':         ['id'],
    'p':          [],
    'br':         [],
    'hr':         [],
    'strong':     [],
    'b':          [],
    'em':         [],
    'i':          [],
    'u':          [],
    's':          [],
    'del':        [],
    'ins':        [],
    'mark':       [],
    'ul':         [],
    'kbd':        [],
    'samp':       [],
    'var':        [],
    'cite':       [],
};

const ALL_ALLOWED_ATTRS = [...new Set(
    Object.values(TAG_ATTR_WHITELIST).flat()
)];

const FORBIDDEN_PROTOCOLS = ['javascript:', 'vbscript:', 'data:'];

marked.setOptions({
    breaks: true,
    gfm: true,
    headerIds: true,
    mangle: false,
    highlight: function (code, lang) {
        return code;
    }
});

function sanitizeHref(href) {
    if (!href) return href;
    const lower = href.toLowerCase().trim();
    for (const proto of FORBIDDEN_PROTOCOLS) {
        if (lower.startsWith(proto)) {
            return '#';
        }
    }
    if (lower.startsWith('//')) {
        return 'https:' + href;
    }
    return href;
}

const purifyConfig = {
    ALLOWED_TAGS: ALLOWED_TAGS,
    ALLOWED_ATTR: ALL_ALLOWED_ATTRS,
    ALLOW_DATA_ATTR: false,
    FORBID_TAGS: ['script', 'style', 'iframe', 'frame', 'object', 'embed', 'form', 'input', 'button', 'textarea', 'select', 'option', 'noscript', 'meta', 'link', 'base'],
    FORBID_ATTR: ['style'],
    SAFE_FOR_TEMPLATES: false,
    WHOLE_DOCUMENT: false,
    SANITIZE_DOM: true,
    KEEP_CONTENT: true,
    IN_PLACE: false,
    ALLOW_UNKNOWN_PROTOCOLS: false,
    ADD_TAGS: [],
    ADD_ATTR: [],
    RETURN_DOM_FRAGMENT: true,
};

function enforceStrictAttributes(fragment) {
    const elements = fragment.querySelectorAll('*');
    elements.forEach(el => {
        const tagName = el.tagName.toLowerCase();
        const allowed = TAG_ATTR_WHITELIST[tagName];
        if (!allowed) {
            return;
        }
        const attrNames = [...el.attributes].map(a => a.name);
        for (const attrName of attrNames) {
            if (!allowed.includes(attrName)) {
                el.removeAttribute(attrName);
            }
        }
    });
}

function fragmentToHtml(fragment) {
    const serializer = new XMLSerializer();
    let html = '';
    for (const child of fragment.childNodes) {
        html += serializer.serializeToString(child);
    }
    return html;
}

export function renderMarkdownSafe(markdownText) {
    if (markdownText === null || markdownText === undefined) {
        return '';
    }

    const text = String(markdownText);

    if (text.trim() === '') {
        return '';
    }

    try {
        let rawHtml = marked.parse(text);

        rawHtml = rawHtml.replace(/<a\s+([^>]*?)\s*>/gi, (match, attrs) => {
            let cleanedAttrs = attrs;
            cleanedAttrs = cleanedAttrs.replace(/(href\s*=\s*)(["']?)([^"'\s>]*)(\2)/gi, (m, prefix, quote, value, endQuote) => {
                const sanitized = sanitizeHref(value);
                return `${prefix}${quote}${sanitized}${endQuote}`;
            });
            if (!/target\s*=/i.test(cleanedAttrs)) {
                cleanedAttrs += ' target="_blank"';
            }
            if (!/rel\s*=/i.test(cleanedAttrs)) {
                cleanedAttrs += ' rel="noopener noreferrer"';
            } else {
                cleanedAttrs = cleanedAttrs.replace(/(rel\s*=\s*)(["']?)([^"']*)(\2)/i, (m, prefix, quote, value, endQuote) => {
                    let rels = value.split(/\s+/).filter(Boolean);
                    if (!rels.includes('noopener')) rels.push('noopener');
                    if (!rels.includes('noreferrer')) rels.push('noreferrer');
                    return `${prefix}${quote}${rels.join(' ')}${endQuote}`;
                });
            }
            return `<a ${cleanedAttrs}>`;
        });

        rawHtml = rawHtml.replace(/<img\s+([^>]*?)\s*\/?>/gi, (match, attrs) => {
            let cleanedAttrs = attrs;
            cleanedAttrs = cleanedAttrs.replace(/(src\s*=\s*)(["']?)([^"'\s>]*)(\2)/gi, (m, prefix, quote, value, endQuote) => {
                const sanitized = sanitizeHref(value);
                return `${prefix}${quote}${sanitized}${endQuote}`;
            });
            return `<img ${cleanedAttrs} loading="lazy" referrerpolicy="no-referrer">`;
        });

        const fragment = DOMPurify.sanitize(rawHtml, purifyConfig);

        enforceStrictAttributes(fragment);

        let cleanHtml = fragmentToHtml(fragment);

        cleanHtml = cleanHtml.replace(/<br\s*\/?>/gi, '<br>');
        cleanHtml = cleanHtml.replace(/<hr\s*\/?>/gi, '<hr>');
        cleanHtml = cleanHtml.replace(/<img([^>]*?)\s*\/>/gi, '<img$1>');
        cleanHtml = cleanHtml.replace(/\s+xmlns="[^"]*"/gi, '');

        return cleanHtml;
    } catch (error) {
        console.warn('Markdown rendering failed, falling back to plain text:', error);
        return renderPlainText(text);
    }
}

export function renderPlainText(text) {
    if (text === null || text === undefined) return '';
    const escaped = escapeHtml(String(text));
    return `<pre style="white-space: pre-wrap; word-wrap: break-word; font-family: inherit; margin: 0;">${escaped}</pre>`;
}

export function getPlainTextLength(text) {
    if (text === null || text === undefined) return 0;
    return String(text).length;
}

export function extractFirstParagraph(markdownText, maxLength = 200) {
    if (markdownText === null || markdownText === undefined) return '';
    const text = String(markdownText).trim();
    
    const firstLineBreak = text.search(/\n\s*\n/);
    let firstPart = firstLineBreak > 0 ? text.substring(0, firstLineBreak) : text;
    firstPart = firstPart.replace(/^#+\s*/gm, '')
                         .replace(/\*\*(.+?)\*\*/g, '$1')
                         .replace(/\*(.+?)\*/g, '$1')
                         .replace(/\[(.+?)\]\(.+?\)/g, '$1')
                         .replace(/`(.+?)`/g, '$1')
                         .replace(/^[-*+]\s+/gm, '')
                         .replace(/^\d+\.\s+/gm, '')
                         .replace(/^>\s*/gm, '');
    
    firstPart = firstPart.replace(/\s+/g, ' ').trim();
    
    if (firstPart.length > maxLength) {
        firstPart = firstPart.substring(0, maxLength - 3) + '...';
    }
    
    return firstPart;
}
