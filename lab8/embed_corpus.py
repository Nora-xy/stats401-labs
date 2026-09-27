"""MiniLM sentence embeddings; token windows avoid silently truncating passages."""
import csv
import json
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
os.environ.setdefault('HF_HOME', str(ROOT / '.lab8-cache' / 'huggingface'))
os.environ.setdefault('HF_HUB_DISABLE_XET', '1')
os.environ.setdefault('HF_HUB_DOWNLOAD_TIMEOUT', '120')

import numpy as np
import torch
from transformers import AutoModel, AutoTokenizer

MODEL = 'sentence-transformers/all-MiniLM-L6-v2'
REVISION = '1110a243fdf4706b3f48f1d95db1a4f5529b4d41'
torch.set_num_threads(4)
rows = list(csv.DictReader((ROOT / 'data/lab8/bulletin_passages.csv').open(encoding='utf-8')))
tokenizer = AutoTokenizer.from_pretrained(MODEL, revision=REVISION)
model = AutoModel.from_pretrained(MODEL, revision=REVISION, use_safetensors=True).eval()
windows, owners, lengths = [], [], []
for i, row in enumerate(rows):
    ids = tokenizer.encode(row['text_clean'], add_special_tokens=False)
    for start in range(0, len(ids), 254):
        chunk = ids[start:start+254]
        windows.append(tokenizer.prepare_for_model(chunk, add_special_tokens=True, return_attention_mask=True))
        owners.append(i)
        lengths.append(len(chunk))
vectors = np.zeros((len(rows), model.config.hidden_size), dtype=np.float32)
weights = np.zeros(len(rows), dtype=np.float32)
with torch.inference_mode():
    for start in range(0, len(windows), 32):
        batch = tokenizer.pad(windows[start:start+32], padding=True, return_tensors='pt')
        hidden = model(**batch).last_hidden_state
        mask = batch['attention_mask'].unsqueeze(-1)
        pooled = (hidden * mask).sum(1) / mask.sum(1).clamp(min=1)
        pooled = pooled.numpy()
        for j, vec in enumerate(pooled):
            k = start + j
            vectors[owners[k]] += vec * lengths[k]
            weights[owners[k]] += lengths[k]
        if start % 320 == 0:
            print(f'Encoded {min(start+32,len(windows))}/{len(windows)} windows', flush=True)
vectors /= weights[:, None]
vectors /= np.linalg.norm(vectors, axis=1, keepdims=True)
np.save(ROOT / '.lab8-cache/embeddings.npy', vectors)
(ROOT / '.lab8-cache/embedding_method.json').write_text(json.dumps({
    'model': MODEL, 'revision': getattr(model.config, '_commit_hash', None), 'dimensions': vectors.shape[1],
    'pooling': 'attention-mask mean pooling; 254-content-token non-overlapping windows, token-count-weighted passage mean; L2 normalization',
    'windows': len(windows), 'passages': len(rows)
}, indent=2), encoding='utf-8')
print('Saved embeddings', vectors.shape)
