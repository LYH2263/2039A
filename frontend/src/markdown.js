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

const ALLOWED_ATTRS = {
    'a': ['href', 'title', 'target', 'rel'],
    'img': ['src', 'alt', 'title', 'width', 'height'],
    'th': ['align', 'colspan', 'rowspan'],
    'td': ['align', 'colspan', 'rowspan'],
    'div': ['class'],
    'span': ['class'],
    'code': ['class'],
    'pre': ['class'],
    '*': ['id']
};

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

function buildAttributeWhitelist() {
    const result = {};
    for (const tag of ALLOWED_TAGS) {
        result[tag] = ['class', 'id', 'style'];
    }
    for (const [tag, attrs] of Object.entries(ALLOWED_ATTRS)) {
        if (tag === '*') continue;
        if (!result[tag]) result[tag] = [];
        for (const attr of attrs) {
            if (!result[tag].includes(attr)) {
                result[tag].push(attr);
            }
        }
    }
    return result;
}

const purifyConfig = {
    ALLOWED_TAGS: ALLOWED_TAGS,
    ALLOWED_ATTR: buildAttributeWhitelist(),
    ALLOW_DATA_ATTR: false,
    FORBID_TAGS: ['script', 'style', 'iframe', 'frame', 'object', 'embed', 'form', 'input', 'button', 'textarea', 'select', 'option', 'noscript', 'meta', 'link', 'base'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onmouseout', 'onkeydown', 'onkeypress', 'onkeyup', 'onsubmit', 'onreset', 'onchange', 'onblur', 'onfocus', 'ondblclick', 'oncontextmenu', 'ondrag', 'ondragend', 'ondragenter', 'ondragleave', 'ondragover', 'ondragstart', 'ondrop', 'oncopy', 'oncut', 'onpaste', 'onbeforecopy', 'onbeforecut', 'onbeforepaste', 'onresize', 'onscroll', 'onunload', 'onabort', 'onbeforeunload', 'onerror', 'onhashchange', 'onmessage', 'onoffline', 'ononline', 'onpagehide', 'onpageshow', 'onpopstate', 'onstorage', 'ontoggle', 'onwheel', 'onpointerdown', 'onpointerup', 'onpointermove', 'onpointerover', 'onpointerout', 'onpointerenter', 'onpointerleave', 'onpointercancel', 'ongotpointercapture', 'onlostpointercapture', 'onauxclick', 'onpointerlockchange', 'onpointerlockerror', 'onselect', 'onselectionchange', 'onselectstart', 'ontouchcancel', 'ontouchend', 'ontouchmove', 'ontouchstart', 'onanimationend', 'onanimationiteration', 'onanimationstart', 'ontransitionend', 'ontransitionrun', 'ontransitionstart', 'ontransitioncancel', 'oncanplay', 'oncanplaythrough', 'ondurationchange', 'onemptied', 'onended', 'onloadeddata', 'onloadedmetadata', 'onloadstart', 'onpause', 'onplay', 'onplaying', 'onprogress', 'onratechange', 'onseeked', 'onseeking', 'onstalled', 'onsuspend', 'ontimeupdate', 'onvolumechange', 'onwaiting', 'onfullscreenchange', 'onfullscreenerror', 'oncopy', 'oncut', 'onpaste'],
    SAFE_FOR_TEMPLATES: false,
    WHOLE_DOCUMENT: false,
    SANITIZE_DOM: true,
    KEEP_CONTENT: true,
    IN_PLACE: false,
    ALLOW_UNKNOWN_PROTOCOLS: false,
    ADD_TAGS: [],
    ADD_ATTR: [],
};

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

        const cleanHtml = DOMPurify.sanitize(rawHtml, purifyConfig);

        if (typeof cleanHtml !== 'string') {
            throw new Error('Purify returned non-string result');
        }

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
