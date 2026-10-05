import argparse
import asyncio
import hashlib
import json
from pathlib import Path
from .config import ROOT
from .domain import domain, embedding

def chunk_markdown(document_id: str, text: str):
    # Sections define independently citable semantic chunks; stable content hash IDs.
    sections = text.split('\n## ')
    title = sections[0].splitlines()[0].lstrip('# ').strip()
    result = []
    for section in sections[1:]:
        heading, _, content = section.partition('\n')
        content = content.strip()
        if not content: continue
        chunk_id = document_id + '#' + hashlib.sha256(content.encode()).hexdigest()[:8]
        result.append({'id': chunk_id, 'documentId': document_id, 'title': title + ' / ' + heading, 'content': content, 'tags': title.lower().split(), 'embedding': None})
    return result

async def ingest(lexical_only=False):
    count = 0
    for path in sorted((ROOT / 'knowledge').glob('*.md')):
        document_chunks = chunk_markdown(path.stem, path.read_text(encoding='utf-8'))
        for chunk in document_chunks:
            if not lexical_only:
                chunk['embedding'] = await embedding(chunk['title'] + '\n' + chunk['content'])
            count += 1
        await domain('POST', '/knowledge/documents', {'documentId': path.stem, 'chunks': document_chunks})
    print(json.dumps({'ingested': count, 'mode': 'lexical' if lexical_only else 'pgvector-768'}, ensure_ascii=False))

if __name__ == '__main__':
    parser = argparse.ArgumentParser(); parser.add_argument('--lexical-only', action='store_true')
    args = parser.parse_args(); asyncio.run(ingest(args.lexical_only))
