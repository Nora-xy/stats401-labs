import csv,json,math
from pathlib import Path
import numpy as np
ROOT=Path(__file__).resolve().parents[1]
d=json.loads((ROOT/'data/lab8/explorer.json').read_text(encoding='utf-8'))
r=d['passages']; v=np.load(ROOT/'.lab8-cache/embeddings.npy'); ids={p['passage_id']:i for i,p in enumerate(r)}
assert len(ids)==len(r)==v.shape[0] and v.shape[1]==384
assert np.isfinite(v).all() and np.allclose(np.linalg.norm(v,axis=1),1,atol=1e-5)
assert all(p['chapter'] and p['section'] and p['text'] and 10<=p['page']<=p['page_end']<=508 for p in r)
assert all(math.isfinite(p[k]) for p in r for k in ['x','y'])
assert len(set(p['text'] for p in r))==len(r)
assert sum(c['count'] for c in d['matrix'])==len(r)
assert sum(t['count'] for t in d['topics'])==len(r)
for c in d['matrix']:
    assert c['count']==sum(p['section']==c['section'] and p['cluster']==c['cluster'] for p in r)
for p in r:
    i=ids[p['passage_id']]; scores=v@v[i]; scores[i]=-np.inf
    expected=np.argsort(scores)[-5:][::-1].tolist(); actual=d['neighbors'][p['passage_id']]
    actual_ids=[ids[n['id']] for n in actual]
    assert len(set(actual_ids))==5 and i not in actual_ids
    # Float32 batch and vector products can rank numerical ties differently.
    assert min(scores[actual_ids]) >= scores[expected[-1]]-2e-6
    assert all(scores[a]>=scores[b]-2e-6 for a,b in zip(actual_ids,actual_ids[1:]))
    assert all(abs(n['similarity']-float(scores[ids[n['id']]]))<2e-6 for n in actual)
for name in ['lab8_embedding_map.csv','lab8_topic_section_matrix.csv']:
    values=list(csv.DictReader((ROOT/'data/lab8'/name).open(encoding='utf-8')))
    assert all(x['cluster_name']==d['topics'][int(x['cluster'])]['name'] for x in values)
print(f'PASS: {len(r)} passages, hierarchy, finite normalized embeddings/UMAP, matrix counts, topic labels, all cosine neighbors.')
