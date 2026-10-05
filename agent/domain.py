import httpx
from contextlib import asynccontextmanager
from opentelemetry.propagate import inject
from .config import settings

_domain_client: httpx.AsyncClient | None = None
_ollama_client: httpx.AsyncClient | None = None

@asynccontextmanager
async def network_clients():
    global _domain_client, _ollama_client
    async with httpx.AsyncClient(timeout=30) as api, httpx.AsyncClient(timeout=180) as model:
        _domain_client, _ollama_client = api, model
        try:
            yield
        finally:
            _domain_client, _ollama_client = None, None

async def domain(method: str, path: str, payload=None, operator=False):
    headers = {'X-Operator-Key' if operator else 'X-Service-Key': settings.operator_key if operator else settings.service_key}
    inject(headers)
    async def send(client):
        response = await client.request(method, settings.domain_api + path, json=payload, headers=headers)
        response.raise_for_status()
        return response.json() if response.content else None
    if _domain_client is not None:
        return await send(_domain_client)
    async with httpx.AsyncClient(timeout=30) as client:
        return await send(client)

async def ollama(path: str, payload: dict):
    async def send(client):
        response = await client.post(settings.ollama_url + path, json=payload)
        response.raise_for_status()
        return response.json()
    if _ollama_client is not None:
        return await send(_ollama_client)
    async with httpx.AsyncClient(timeout=180) as client:
        return await send(client)

async def embedding(text: str):
    result = await ollama('/api/embed', {'model': settings.ollama_embed_model, 'input': text, 'truncate': False})
    vector = result['embeddings'][0]
    import math
    if len(vector) != 768 or not all(math.isfinite(n) for n in vector):
        raise ValueError('Expected 768 finite embedding dimensions')
    return vector
