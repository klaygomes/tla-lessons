import builtins
import html
import io
import keyword
import re
import token
import tokenize

BUILTINS = {name for name in dir(builtins) if not name.startswith("_")}
STRINGS = {token.STRING} | {getattr(token, n) for n in ("FSTRING_START", "FSTRING_MIDDLE", "FSTRING_END") if hasattr(token, n)}
PSEUDO_KEYWORDS = {"for", "if", "else", "elif", "return", "while", "do", "in", "to", "and", "or", "not", "then", "end", "each", "repeat", "until", "is", "empty"}
PSEUDO = re.compile(r"(?P<arrow>←|→|≠|≤|≥)|(?P<num>\b\d+(?:\.\d+)?\b)|(?P<word>[A-Za-z_][\w]*)|(?P<other>.)", re.S)


def span(kind, text):
    return f'<span class="c-{kind}">{html.escape(text)}</span>'


def python(source):
    lines = source.splitlines(keepends=True)
    offsets = [0]
    for line in lines:
        offsets.append(offsets[-1] + len(line))
    out, pos, prev = [], 0, None
    try:
        tokens = list(tokenize.generate_tokens(io.StringIO(source).readline))
    except (tokenize.TokenError, IndentationError, SyntaxError):
        return html.escape(source)
    for i, tok in enumerate(tokens):
        if tok.type in (token.ENDMARKER, token.NEWLINE, token.NL, token.INDENT, token.DEDENT):
            continue
        start = offsets[tok.start[0] - 1] + tok.start[1]
        end = offsets[tok.end[0] - 1] + tok.end[1]
        out.append(html.escape(source[pos:start]))
        text = source[start:end]
        nxt = next((t for t in tokens[i + 1:] if t.type not in (token.NL, token.NEWLINE)), None)
        if tok.type == token.NAME and keyword.iskeyword(text):
            kind = "keyword"
        elif tok.type == token.NAME and prev is not None and prev.string in ("def", "class"):
            kind = "function"
        elif tok.type == token.NAME and nxt is not None and nxt.string == "(":
            kind = "builtin" if text in BUILTINS else "call"
        elif tok.type == token.NAME and text in BUILTINS:
            kind = "builtin"
        elif tok.type in STRINGS:
            kind = "string"
        elif tok.type == token.NUMBER:
            kind = "number"
        elif tok.type == token.COMMENT:
            kind = "comment"
        elif tok.type == token.OP and text == "...":
            kind = "comment"
        else:
            kind = None
        out.append(span(kind, text) if kind else html.escape(text))
        pos, prev = end, tok
    out.append(html.escape(source[pos:]))
    return "".join(out)


def pseudo(source):
    out, after_assign = [], False
    for m in PSEUDO.finditer(source):
        text = m.group(0)
        if m.group("arrow"):
            out.append(span("keyword", text))
        elif m.group("num"):
            out.append(span("number", text))
        elif m.group("word"):
            rest = source[m.end():m.end() + 1]
            if text in PSEUDO_KEYWORDS or text.isupper() and len(text) > 1:
                out.append(span("keyword", text))
            elif rest == "(" and text[:1].isupper():
                out.append(span("function", text))
            else:
                out.append(html.escape(text))
        else:
            out.append(html.escape(text))
    return "".join(out)

TLA_KEYWORDS = {"MODULE", "EXTENDS", "VARIABLE", "VARIABLES", "CONSTANT", "CONSTANTS", "ASSUME", "THEOREM", "LOCAL", "INSTANCE", "WITH", "LET", "IN", "IF", "THEN", "ELSE", "CASE", "OTHER", "CHOOSE", "EXCEPT", "UNCHANGED", "ENABLED", "DOMAIN", "SUBSET", "UNION", "LAMBDA", "TRUE", "FALSE", "BOOLEAN", "SPECIFICATION", "INVARIANT", "INVARIANTS", "PROPERTY", "PROPERTIES", "INIT", "NEXT", "SYMMETRY", "CONSTRAINT", "WF_", "SF_"}
TLA_SYMBOLS = {
    "<=>": "⇔", "|->": "↦", "/\\": "∧", "\\/": "∨", "==": "≜", "=>": "⇒", "->": "→", "<=": "≤", "=<": "≤", ">=": "≥",
    "/=": "≠", "#": "≠", "<<": "⟨", ">>": "⟩", "[]": "□", "<>": "◇", "~>": "↝", "~": "¬", "'": "′",
}
TLA_WORDS = {
    "\\E": "∃", "\\A": "∀", "\\in": "∈", "\\notin": "∉", "\\cup": "∪", "\\union": "∪", "\\cap": "∩", "\\intersect": "∩",
    "\\subseteq": "⊆", "\\subset": "⊂", "\\X": "×", "\\times": "×", "\\lnot": "¬", "\\neg": "¬", "\\land": "∧", "\\lor": "∨",
    "\\o": "∘", "\\circ": "∘", "\\div": "÷", "\\leq": "≤", "\\geq": "≥", "\\equiv": "≡", "\\AA": "∀∀", "\\EE": "∃∃",
}
TLA = re.compile(
    r"(?P<rule>^[ \t]*(?:-{4,}[^\n]*|={4,}[ \t]*)$)|(?P<comment>\\\*[^\n]*|\(\*.*?\*\))|(?P<string>\"(?:[^\"\\]|\\.)*\")"
    r"|(?P<word>\\[A-Za-z]+)|(?P<sym>" + "|".join(re.escape(k) for k in sorted(TLA_SYMBOLS, key=len, reverse=True)) + r")"
    r"|(?P<sub>(?<=\])_[A-Za-z]\w*)|(?P<ident>[A-Za-z_]\w*)|(?P<num>\b\d+\b)|(?P<other>.)",
    re.M | re.S)
TLA_DEF = re.compile(r"^([A-Za-z_]\w*)(?:\([^)]*\))?\s*==", re.M)
TLA_ALIGN = {"⟨": "end", "⟩": "start"}


def tla_symbol(ascii_text, glyph, kind="op"):
    align = TLA_ALIGN.get(glyph, "center")
    return (f'<span class="tla-sym tla-{kind}" data-align="{align}" style="--w:{len(ascii_text)}">'
            f'<span class="tla-g">{glyph}</span><span class="tla-a">{html.escape(ascii_text)}</span></span>')


def tla(source):
    defined = {m.start(1) for m in TLA_DEF.finditer(source)}
    out = []
    for m in TLA.finditer(source):
        text = m.group(0)
        if m.group("rule"):
            name = re.search(r"MODULE\s+(\w+)", text)
            if name:
                glyph = f'<span class="tla-module"><span class="c-keyword">MODULE</span> {html.escape(name.group(1))}</span>'
            else:
                glyph = '<span class="tla-end"></span>'
            out.append(f'<span class="tla-rule"><span class="tla-g">{glyph}</span><span class="tla-a">{html.escape(text)}</span></span>')
        elif m.group("comment"):
            out.append(span("comment", text))
        elif m.group("string"):
            out.append(span("string", text))
        elif m.group("word"):
            glyph = TLA_WORDS.get(text)
            out.append(tla_symbol(text, glyph) if glyph else html.escape(text))
        elif m.group("sym"):
            out.append(tla_symbol(text, TLA_SYMBOLS[text], "prime" if text == "'" else "op"))
        elif m.group("sub"):
            out.append(f'<span class="tla-sub"><span class="tla-g"><sub>{html.escape(text[1:])}</sub></span>'
                       f'<span class="tla-a">{html.escape(text)}</span></span>')
        elif m.group("ident"):
            if text in TLA_KEYWORDS:
                out.append(span("keyword", text))
            elif m.start() in defined:
                out.append(span("function", text))
            else:
                out.append(html.escape(text))
        elif m.group("num"):
            out.append(span("number", text))
        else:
            out.append(html.escape(text))
    return "".join(out)


def tla_block(coloured):
    return ('<div class="tla-block"><label class="tla-switch"><input type="checkbox"> Show ASCII</label>'
            f'<pre class="code" data-lang="tla"><code>{coloured}</code></pre></div>')


BLOCK = re.compile(r'<pre class="code"( data-lang="([\w-]*)")?><code>(.*?)</code></pre>', re.S)


def highlight(body):
    def one(m):
        lang, source = (m.group(2) or "").lower(), html.unescape(m.group(3))
        if lang == "tla":
            return tla_block(tla(source))
        coloured = python(source) if lang in ("python", "py") else pseudo(source)
        attr = f' data-lang="{lang}"' if lang else ""
        return f'<pre class="code"{attr}><code>{coloured}</code></pre>'
    return BLOCK.sub(one, body)
