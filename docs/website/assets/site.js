/* Lyap documentation site — shared navigation config + syntax highlighter.
   Loaded before lyap.min.js. Sets window.LYAP_NAV / window.LYAP_CURRENT. */
(function (global) {
  'use strict';

  var NAV = [
    {
      group: 'Introduction',
      items: [
        { id: 'index', href: 'index.html', label: 'Welcome' },
        { id: 'get-started', href: 'get-started.html', label: 'Getting Started' }
      ]
    },
    {
      group: 'Guide',
      items: [
        { id: 'state', href: 'state.html', label: 'State & Derived' },
        { id: 'lifecycle', href: 'lifecycle.html', label: 'Lifecycle & Scopes' },
        { id: 'text', href: 'text.html', label: 'Text & Show' },
        { id: 'events', href: 'events.html', label: 'Events & Actions' },
        { id: 'conditionals', href: 'conditionals.html', label: 'Conditionals & Loops' },
        { id: 'forms', href: 'forms.html', label: 'Forms & Binding' },
        { id: 'classes', href: 'classes.html', label: 'Classes & Attributes' },
        { id: 'magic', href: 'magic.html', label: 'Magic Variables' }
      ]
    },
    {
      group: 'Reference',
      items: [
        { id: 'reference', href: 'reference.html', label: 'Directive Reference' }
      ]
    }
  ];

  var FLAT = [];
  NAV.forEach(function (group) {
    group.items.forEach(function (item) { FLAT.push(item); });
  });

  global.LYAP_NAV = NAV;
  global.LYAP_FLAT = FLAT;
  global.LYAP_VERSION = '3.0.0-proto';

  var currentOverride = null;
  function currentPage() {
    if (currentOverride) return currentOverride;
    if (document.body && document.body.getAttribute('data-page')) {
      return document.body.getAttribute('data-page');
    }
    if (typeof location !== 'undefined' && location.pathname) {
      var p = location.pathname.split('/').pop() || 'index.html';
      var clean = p.split('?')[0].replace(/\.html$/, '');
      if (clean) return clean;
    }
    return 'index';
  }

  try {
    Object.defineProperty(global, 'LYAP_CURRENT', {
      get: currentPage,
      set: function (v) { currentOverride = v; },
      configurable: true,
      enumerable: true
    });
  } catch (e) {
    global.LYAP_CURRENT = 'index';
  }

  /* ------------------------------------------------------------------ *
   *  Syntax highlighting (tiny, dependency-free, single-pass tokenizer) *
   * ------------------------------------------------------------------ */
  var C = {
    com: 'tok-com',
    str: 'tok-str',
    num: 'tok-num',
    kw: 'tok-kw',
    fn: 'tok-fn',
    tag: 'tok-tag',
    attr: 'tok-attr',
    op: 'tok-op'
  };

  function esc(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  var JS_KEYWORDS = new Set(
    ('const let var function return if else for while do switch case break continue new class extends super this ' +
      'typeof instanceof in of try catch finally throw delete void yield async await import export from default ' +
      'state derived init mount cleanup destroy true false null undefined').split(' ')
  );

  function hlJS(src) {
    var out = '';
    var re = /\/\/[^\n]*|\/\*[\s\S]*?\*\/|'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"|`(?:\\.|[^`\\])*`|\b\d[\d_]*(?:\.\d+)?\b|[A-Za-z_$][\w$]*|\s+/g;
    var last = 0;
    var m;
    while ((m = re.exec(src)) !== null) {
      if (m.index > last) out += esc(src.slice(last, m.index));
      var tok = m[0];
      var c0 = tok[0];
      if (c0 === '/') {
        out += '<span class="' + C.com + '">' + esc(tok) + '</span>';
      } else if (c0 === "'" || c0 === '"' || c0 === '`') {
        out += '<span class="' + C.str + '">' + esc(tok) + '</span>';
      } else if (/\d/.test(c0)) {
        out += '<span class="' + C.num + '">' + esc(tok) + '</span>';
      } else if (/[A-Za-z_$]/.test(c0)) {
        if (JS_KEYWORDS.has(tok)) {
          out += '<span class="' + C.kw + '">' + esc(tok) + '</span>';
        } else if (/^\s*\(/.test(src.slice(m.index + tok.length))) {
          out += '<span class="' + C.fn + '">' + esc(tok) + '</span>';
        } else {
          out += esc(tok);
        }
      } else {
        out += esc(tok);
      }
      last = re.lastIndex;
    }
    out += esc(src.slice(last));
    return out;
  }

  function findTagEnd(src, start) {
    var i = start + 1;
    var n = src.length;
    var quote = '';
    while (i < n) {
      var ch = src[i];
      if (quote) {
        if (ch === '\\') { i += 2; continue; }
        if (ch === quote) quote = '';
      } else if (ch === '"' || ch === "'") {
        quote = ch;
      } else if (ch === '>') {
        return i;
      }
      i++;
    }
    return n - 1;
  }

  function hlTag(tag) {
    var m = /^(\s*)(<\/?)([a-zA-Z][\w-]*)([\s\S]*?)(\/?>)$/.exec(tag);
    if (!m) return esc(tag);
    var inner = m[4];
    var html = '';
    var last = 0;
    var re = /([a-zA-Z_:][\w:.-]*)(\s*=\s*)("[^"]*"|'[^']*')|([a-zA-Z_:][\w:.-]*)/g;
    var mm;
    while ((mm = re.exec(inner)) !== null) {
      if (mm.index > last) html += esc(inner.slice(last, mm.index));
      if (mm[1] !== undefined) {
        html += '<span class="' + C.attr + '">' + esc(mm[1]) + '</span>' + esc(mm[2]) +
          '<span class="' + C.str + '">' + esc(mm[3]) + '</span>';
      } else {
        html += '<span class="' + C.attr + '">' + esc(mm[4]) + '</span>';
      }
      last = re.lastIndex;
    }
    html += esc(inner.slice(last));
    return m[1] +
      '<span class="' + C.op + '">' + esc(m[2]) + '</span>' +
      '<span class="' + C.tag + '">' + esc(m[3]) + '</span>' +
      html +
      '<span class="' + C.op + '">' + esc(m[5]) + '</span>';
  }

  function hlHTML(src) {
    var out = '';
    var i = 0;
    var n = src.length;
    var closeTag;
    while (i < n) {
      var rest = src.slice(i);
      if (rest.indexOf('<!--') === 0) {
        var end = src.indexOf('-->', i);
        end = end === -1 ? n : end + 3;
        out += '<span class="' + C.com + '">' + esc(src.slice(i, end)) + '</span>';
        i = end;
      } else if (rest.toLowerCase().indexOf('<script') === 0) {
        var sEnd = findTagEnd(src, i);
        out += hlTag(src.slice(i, sEnd + 1));
        i = sEnd + 1;
        closeTag = src.toLowerCase().indexOf('</script>', i);
        if (closeTag === -1) { out += hlJS(src.slice(i)); i = n; }
        else {
          out += hlJS(src.slice(i, closeTag));
          var cEnd = closeTag + '</script>'.length;
          out += hlTag(src.slice(closeTag, cEnd));
          i = cEnd;
        }
      } else if (rest.toLowerCase().indexOf('<style') === 0) {
        var tEnd = findTagEnd(src, i);
        out += hlTag(src.slice(i, tEnd + 1));
        i = tEnd + 1;
        closeTag = src.toLowerCase().indexOf('</style>', i);
        if (closeTag === -1) { out += esc(src.slice(i)); i = n; }
        else {
          out += esc(src.slice(i, closeTag));
          var stEnd = closeTag + '</style>'.length;
          out += hlTag(src.slice(closeTag, stEnd));
          i = stEnd;
        }
      } else if (rest.charAt(0) === '<') {
        var gEnd = findTagEnd(src, i);
        out += hlTag(src.slice(i, gEnd + 1));
        i = gEnd + 1;
      } else {
        var lt = src.indexOf('<', i);
        if (lt === -1) { out += esc(src.slice(i)); i = n; }
        else { out += esc(src.slice(i, lt)); i = lt; }
      }
    }
    return out;
  }

  function highlightBlocks() {
    var blocks = document.querySelectorAll('pre.doc-code code');
    Array.prototype.forEach.call(blocks, function (code) {
      if (code.getAttribute('data-hl')) return;
      var cls = code.className || '';
      var lm = /language-(\w+)/.exec(cls);
      var lang = lm ? lm[1] : '';
      var text = code.textContent || '';
      var html;
      if (lang === 'js' || lang === 'javascript' || lang === 'ts') html = hlJS(text);
      else if (lang === 'html' || lang === 'xml') html = hlHTML(text);
      else html = esc(text);
      code.setAttribute('data-hl', '1');
      code.innerHTML = html;
    });
  }

  function init() {
    global.LYAP_CURRENT = currentPage();
    highlightBlocks();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);