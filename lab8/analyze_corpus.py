"""Cluster original vectors, project with UMAP, and export auditable D3 data."""
import csv
import json
from pathlib import Path
from collections import Counter
import numpy as np
from sklearn.cluster import KMeans
from sklearn.feature_extraction.text import TfidfVectorizer, ENGLISH_STOP_WORDS
import umap

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'data/lab8'
CACHE = ROOT / '.lab8-cache'
rows = list(csv.DictReader((OUT / 'bulletin_passages.csv').open(encoding='utf-8')))
for row in rows:
    for col in ['page', 'page_end', 'pdf_page', 'word_count']:
        row[col] = int(row[col])
vectors = np.load(CACHE / 'embeddings.npy')
assert len(rows) == len(vectors)
kmeans = KMeans(n_clusters=8, random_state=401, n_init=10).fit(vectors)
coords = umap.UMAP(n_components=2, n_neighbors=15, min_dist=.15, metric='cosine', random_state=401).fit_transform(vectors)
stop = sorted(set(ENGLISH_STOP_WORDS) | {'course','courses','students','student','university','duke','kunshan','credits','credit','prerequisite','instructor','consent'})
tfidf = TfidfVectorizer(stop_words=stop, min_df=3, max_df=.8, token_pattern=r'(?u)\b[a-zA-Z][a-zA-Z-]{2,}\b')
tf = tfidf.fit_transform([r['text_clean'] for r in rows])
terms = tfidf.get_feature_names_out()
labels_file = ROOT / 'lab8/topic_labels.json'
names = json.loads(labels_file.read_text(encoding='utf-8')) if labels_file.exists() else {}
topics = []
for c in range(8):
    ix = np.where(kmeans.labels_ == c)[0]
    scores = np.asarray(tf[ix].mean(axis=0)).ravel()
    top = terms[np.argsort(scores)[-10:][::-1]].tolist()
    near = ix[np.argsort(np.linalg.norm(vectors[ix] - kmeans.cluster_centers_[c], axis=1))[:5]]
    topics.append({'id': c, 'name': names.get(str(c), f'Topic {c+1}'), 'count': len(ix), 'terms': top,
                   'representatives': [{'passage_id':rows[i]['passage_id'], 'section':rows[i]['section'], 'page':rows[i]['page'], 'text':rows[i]['text']} for i in near]})
similarity = vectors @ vectors.T
np.fill_diagonal(similarity, -np.inf)
neighbors = {}
for i, row in enumerate(rows):
    c = int(kmeans.labels_[i])
    row.update(cluster=c, cluster_name=topics[c]['name'], x=float(coords[i,0]), y=float(coords[i,1]))
    indices = np.argsort(similarity[i])[-5:][::-1]
    neighbors[row['passage_id']] = [{'id':rows[j]['passage_id'], 'similarity':round(float(similarity[i,j]),6)} for j in indices]
sections = list(dict.fromkeys(r['section'] for r in rows))
matrix = []
section_stats = []
for section in sections:
    subset = [r for r in rows if r['section'] == section]
    counts = Counter(r['cluster'] for r in subset)
    proportions = np.array(list(counts.values())) / len(subset)
    section_stats.append({'section':section, 'count':len(subset), 'mean_words':round(np.mean([r['word_count'] for r in subset]),1), 'entropy':round(float(-(proportions*np.log2(proportions)).sum()),3)})
    for c in range(8):
        matrix.append({'section':section, 'cluster':c, 'cluster_name':topics[c]['name'], 'count':counts[c]})
pairs = []
for i in range(len(rows)):
    for j in np.argsort(similarity[i])[::-1]:
        if rows[i]['section'] != rows[j]['section']:
            if i < j:
                pairs.append({'a':rows[i]['passage_id'], 'b':rows[j]['passage_id'], 'similarity':round(float(similarity[i,j]),6)})
            break
pairs.sort(key=lambda p:p['similarity'], reverse=True)
audit = json.loads((OUT / 'corpus_audit.json').read_text(encoding='utf-8'))
method = json.loads((CACHE / 'embedding_method.json').read_text(encoding='utf-8'))
method.update(umap={'n_components':2,'n_neighbors':15,'min_dist':.15,'metric':'cosine','random_state':401}, clustering={'method':'KMeans on original normalized embeddings','k':8,'random_state':401,'n_init':10})
term_scores = np.asarray(tf.mean(axis=0)).ravel()
bundle = {'audit':audit, 'method':method, 'passages':rows,'topics':topics, 'sections':section_stats,'matrix':matrix,'neighbors':neighbors,'cross_section_pairs':pairs[:200], 'top_terms':[{'term':terms[i], 'score':round(float(term_scores[i]),5)} for i in np.argsort(term_scores)[-15:][::-1]]}
(OUT / 'explorer.json').write_text(json.dumps(bundle, ensure_ascii=False), encoding='utf-8')
(OUT / 'topic_review.json').write_text(json.dumps(topics, ensure_ascii=False, indent=2), encoding='utf-8')
for filename, values in [('lab8_embedding_map.csv',rows),('lab8_topic_section_matrix.csv',matrix)]:
    with (OUT / filename).open('w',encoding='utf-8',newline='') as f:
        writer=csv.DictWriter(f,fieldnames=list(values[0])); writer.writeheader(); writer.writerows(values)
print('Exported',len(rows),'passages;',len(sections),'sections')
for topic in topics:
    print(topic['id'],topic['count'],', '.join(topic['terms']))
