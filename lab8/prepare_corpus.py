"""Extract paragraph units using PDF typography and its table of contents.

Run extract_source.py first. Printed pages are PDF page minus one.
Tables are not flattened into synthetic prose; their short fragments are audited.
"""
import csv
import json
import re
import unicodedata
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / '.lab8-cache'
OUT = ROOT / 'data' / 'lab8'


def clean(s):
    s = unicodedata.normalize('NFKC', s)
    return re.sub(r'\s+', ' ', s.replace('\u00ad', '').replace('\u0000', '')).strip()


def key(s):
    return re.sub(r'[^a-z0-9]', '', clean(s).lower())


def lines(page, small=False):
    result = []
    for w in sorted(page['words'], key=lambda w: (w['top'], w['x0'])):
        if w['top'] >= 720 or (not small and w['size'] < 9):
            continue
        if not result or abs(w['top'] - result[-1]['top']) > 2.5:
            result.append({'top': w['top'], 'words': []})
        result[-1]['words'].append(w)
    for line in result:
        ws = sorted(line.pop('words'), key=lambda w: w['x0'])
        line.update(text=clean(' '.join(w['text'] for w in ws)), x=min(w['x0'] for w in ws),
                    bottom=max(w['bottom'] for w in ws), size=max(w['size'] for w in ws),
                    bold=sum(len(w['text']) for w in ws if 'Bold' in w['fontname']) / max(1, sum(len(w['text']) for w in ws)))
    return result


def extract_toc(pages):
    toc, pending, left = [], '', 72
    for p in pages[2:10]:
        for line in lines(p):
            text = line['text']
            if text == 'Table of Contents':
                continue
            if not pending:
                left = line['x']
            pending = clean(pending + ' ' + text)
            match = re.match(r'(.+?)\s*\.{2,}\s*(\d+)\s*$', pending)
            if match:
                title, page = match.groups()
                level = 0 if title.startswith('Part ') else (1 if left < 89 else (2 if left < 100 else 3))
                toc.append({'title': title.strip(), 'page': int(page), 'level': level, 'key': key(title)})
                pending = ''
    return toc


def main():
    source = json.loads((CACHE / 'source.json').read_text(encoding='utf-8'))
    toc = extract_toc(source['pages'])
    (CACHE / 'toc.json').write_text(json.dumps(toc, indent=2, ensure_ascii=False), encoding='utf-8')
    raw, excluded = [], Counter()
    chapter, path, section, subsection = '', {}, '', ''
    buf, start, end, previous = [], 0, 0, None

    def flush():
        nonlocal buf
        if buf:
            raw.append({'chapter': chapter, 'section': section or chapter, 'subsection': subsection,
                        'heading_path': ' > '.join([chapter] + list(path.values())), 'page': start,
                        'page_end': end, 'pdf_page': start + 1, 'text': clean(' '.join(buf))})
        buf = []

    for p in source['pages'][10:]:
        page = p['pdf_page'] - 1
        ls = lines(p)
        candidates = [t for t in toc if t['page'] == page]
        i = 0
        while i < len(ls):
            line = ls[i]
            text = line['text']
            found, consumed = None, 1
            # Match wrapped structural headings to the source TOC, never generated topic names.
            for n in range(1, min(4, len(ls) - i + 1)):
                candidate = key(' '.join(x['text'] for x in ls[i:i+n]))
                for t in candidates:
                    if candidate == t['key'] or (candidate.startswith(t['key']) and candidate[len(t['key']):].isdigit()):
                        found, consumed = t, n
                        break
                if found:
                    break
            if found:
                flush()
                level, title = found['level'], found['title']
                if level == 0:
                    chapter, path, section, subsection = title, {}, title, ''
                else:
                    path = {k: v for k, v in path.items() if k < level}
                    path[level] = title
                    # Part 10's named majors and course subjects provide usable formal sections.
                    if chapter.startswith('Part 10:') and level >= 2:
                        section = path.get(2, title)
                    else:
                        section = path.get(1, title)
                    subsection = title if title != section else ''
                i += consumed
                previous = None
                continue
            course = bool(re.match(r'^[A-Z]{2,12}\s+\d{3}[A-Z]?\b', text) and ('credit' in text.lower() or line['bold'] > .8))
            heading = line['bold'] > .94 and len(text.split()) <= 25 and not text.endswith(('.', ';')) and not text.startswith(('Prerequisite', 'Corequisite'))
            if course or heading:
                flush()
                subsection = text
                # A course title is contextual text belonging to its course description.
                if course:
                    buf, start, end = [text], page, page
                previous = None
                i += 1
                continue
            if re.match(r'^(Course Code|Course Name|Course Credit|Course$|Credit$)', text):
                flush()
                excluded['table_header_lines'] += 1
                previous = None
                i += 1
                continue
            if re.match(r'^[A-Z]{2,12}\s+\d{3}', text) and re.search(r'\s\d\s*$', text) and len(text.split()) < 24:
                flush()
                excluded['table_course_rows'] += 1
                previous = None
                i += 1
                continue
            gap = line['top'] - previous['bottom'] if previous else 0
            if previous and gap > 7 and buf and not text.startswith(('Prerequisite', 'Corequisite')):
                flush()
            # At a page boundary join unfinished sentences; otherwise start a new paragraph.
            if buf and end != page and re.search(r'[.!?:;][\"\u201d\u2019]?$', buf[-1]):
                flush()
            if not buf:
                start = page
            if buf and buf[-1].endswith('-') and text[:1].islower():
                buf[-1] = buf[-1][:-1] + text
            else:
                buf.append(text)
            end, previous = page, line
            i += 1
        previous = None
    flush()
    rows, seen = [], set()
    for row in raw:
        text = row['text']
        if text.startswith(('Courses listed in the table below', '(Not every course listed')):
            excluded['repeated_table_instructions'] += 1
            continue
        if text[-1:].isalnum() and 'Prerequisite' not in text and 'Corequisite' not in text:
            excluded['incomplete_or_tabular_blocks'] += 1
            continue
        if len(text.split()) < 20:
            excluded['short_blocks_under_20_words'] += 1
            continue
        if text in seen:
            excluded['duplicate_blocks'] += 1
            continue
        if re.search(r'\(cid:\d+\)', text):
            excluded['malformed_blocks'] += 1
            continue
        seen.add(text)
        # Keep complete sentences; bound exceptionally long blocks for interpretation.
        chunks, current = [], ''
        for sentence in re.split(r'(?<=[.!?])\s+(?=[A-Z0-9])', text):
            if current and len((current + ' ' + sentence).split()) > 220:
                chunks.append(current)
                current = ''
            current = clean(current + ' ' + sentence)
        if current:
            chunks.append(current)
        for chunk in chunks:
            rows.append({**row, 'passage_id': f'p{len(rows)+1:05d}', 'text': chunk, 'text_clean': chunk,
                         'word_count': len(chunk.split())})
    OUT.mkdir(parents=True, exist_ok=True)
    with (OUT / 'bulletin_passages.csv').open('w', encoding='utf-8', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)
    audit = {'title': 'Bulletin of Duke Kunshan University Undergraduate Instruction', 'academic_year': '2023-2024',
             'publication': 'July 2023', 'source': 'User-provided local PDF: ug_bulletin 2023-24.pdf',
             'accessed': '2026-09-27', 'sha256': source['sha256'], 'pdf_pages': len(source['pages']),
             'raw_passages': len(raw), 'clean_passages': len(rows), 'formal_sections': len(set(r['section'] for r in rows)),
             'mean_words': sum(r['word_count'] for r in rows)/len(rows), 'exclusions': dict(excluded),
             'scope': 'Substantive prose from the bulletin body (printed pages 10-508). Front matter, contents, small-print footnotes, table rows and instructions, incomplete blocks, duplicates and blocks under 20 words are excluded. Long blocks are divided at sentence boundaries. Not every source page yields a retained prose passage.',
             'hierarchy': 'Chapter is the bulletin Part; section is its first-level TOC heading, except Part 10 uses named majors and course subjects. Subsection preserves the most recent deeper heading or course title. The full TOC path is retained separately.'}
    (OUT / 'corpus_audit.json').write_text(json.dumps(audit, indent=2), encoding='utf-8')
    print(json.dumps(audit, indent=2))
    print('TOC entries', len(toc))


if __name__ == '__main__':
    main()
