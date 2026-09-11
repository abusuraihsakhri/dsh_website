#!/usr/bin/env python3
# Build the single-file 3D DSH site from extracted register data.
import json, re, html

members = json.load(open('src/data/members.json', encoding='utf-8'))

RANKS = [
    ('lt. col. (dr)', 'Lt. Col. (Dr)'), ('lt col (dr)', 'Lt. Col. (Dr)'),
    ('col (dr)', 'Col (Dr)'), ('col. (dr)', 'Col (Dr)'),
    ('dr (mrs.)', 'Dr. (Mrs.)'), ('dr (mrs)', 'Dr. (Mrs.)'),
    ('dr', 'Dr.'), ('dr.', 'Dr.'),
]
def split_rank(name):
    """Return (rank_prefix, rest) where rank_prefix may be ''."""
    n = name.strip()
    low = n.lower()
    for pat, disp in RANKS:
        if low == pat or low.startswith(pat + ' ') or low.startswith(pat + '.'):
            rest = n[len(pat):].strip().lstrip('.').strip()
            return disp, rest
    return '', n

def fix_surname_initials(s):
    # "Mohd.Zarif" -> "Mohd. Zarif"
    s = re.sub(r'(?<=[a-z])\.(?=[A-Z])', '. ', s)
    # "AmitaMahajan" -> "Amita Mahajan"
    s = re.sub(r'(?<=[a-z])(?=[A-Z])', ' ', s)
    # single-letter tokens -> "X."
    s = re.sub(r'\b([A-Za-z])\b', r'\1.', s)
    s = re.sub(r'\.\s*\.', '.', s)
    return s

def titlecase(s):
    s = fix_surname_initials(s.lower())
    # keep tokens that are initials (single letter) uppercase + dot
    out = []
    for tok in s.split():
        t = tok.title()
        out.append(t)
    s = ' '.join(out)
    return s

out = []
for m in members:
    rank, rest = split_rank(m['name'])
    # p2 glued names like "DrAmitaMahajan"
    if not rank and re.match(r'^Dr[A-Z][a-z]', rest):
        rank, rest = 'Dr.', re.sub(r'^Dr', '', rest).strip()
    rest = re.sub(r'^[\.\s]+', '', rest).strip()
    display = (rank + ' ' + titlecase(rest)).strip() if rest else rank
    sortname = titlecase(rest).lower()
    if m['n'] == 224:
        display = 'Dr. Vikas (record expired)'
        sortname = 'vikas'
    rec = {
        'n': m['n'],
        'name': display,
        'sortName': re.sub(r'^(lt\. col\.|col\.|dr\.?|mrs\.?)\s*', '', sortname).strip(),
        'addr': m['addr'], 'ph': m['ph'], 'mob': m['mob'], 'em': m['em'], 'inst': m['inst'],
    }
    if m['note']:
        rec['note'] = m['note']
    out.append(rec)

def valid_email(e):
    return bool(re.match(r'^[^\s@]+@[^\s@]+\.[^\s@]{2,}$', e))

emails = sum(1 for m in out if valid_email(m['em']))
mobiles = sum(1 for m in out if m['mob'])
insts = len(set(m['inst'].upper() for m in out if m['inst']))
print('members:', len(out), '| with email:', emails, '| with mobile:', mobiles, '| institutes:', insts)

# ---- assemble ----
css = open('src/style.css', encoding='utf-8').read()
js = open('src/app.js', encoding='utf-8').read()
tpl = open('src/template.html', encoding='utf-8').read()

page = (tpl
        .replace('__CSS__', css)
        .replace('__MEMBERS__', json.dumps(out, ensure_ascii=False, separators=(',', ':')))
        .replace('__JS__', js)
        .replace('__EMAILS__', str(emails))
        .replace('__MEMBERS_COUNT__', str(len(out))))

open('index.html', 'w', encoding='utf-8').write(page)
leftover = re.findall(r'__[A-Z_]+__', page)
print('leftover placeholders:', leftover)
print('index.html bytes:', len(page.encode('utf-8')))
