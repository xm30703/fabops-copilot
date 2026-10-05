import asyncio
from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Request
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
import httpx
from .config import settings, ROOT
from .domain import domain, embedding, network_clients
from .core import investigate, handover
from .observability import configure
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor

configure('fabops-agent-gateway')
semaphore = asyncio.Semaphore(1)
@asynccontextmanager
async def lifespan(app):
    async with network_clients():
        yield

app = FastAPI(title='FabOps Agent Gateway', version='0.1.0', lifespan=lifespan)
FastAPIInstrumentor.instrument_app(app)

@app.middleware('http')
async def local_boundary(request: Request, call_next):
    # Local demo identity, with cross-origin mutation protection. No public auth claims.
    allowed = {'127.0.0.1', 'localhost', 'testserver'}
    if request.url.hostname not in allowed:
        from fastapi.responses import JSONResponse
        return JSONResponse({'detail': 'Local demo host only'}, status_code=403)
    origin = request.headers.get('origin')
    if request.method not in {'GET', 'HEAD', 'OPTIONS'} and origin and origin not in {f'http://127.0.0.1:{settings.agent_port}', f'http://localhost:{settings.agent_port}', 'http://testserver'}:
        from fastapi.responses import JSONResponse
        return JSONResponse({'detail': 'Cross-origin mutation denied'}, status_code=403)
    try:
        return await call_next(request)
    except httpx.HTTPStatusError as error:
        from fastapi.responses import JSONResponse
        status = error.response.status_code if error.response.status_code in {400,401,404,409} else 503
        return JSONResponse({'detail': 'Domain request rejected or dependency unavailable; check request and service readiness.'}, status_code=status)
    except httpx.HTTPError:
        from fastapi.responses import JSONResponse
        return JSONResponse({'detail': 'Dependency unavailable. Check .NET API, database and model readiness.'}, status_code=503)

class Investigation(BaseModel):
    incidentId: str = Field(pattern=r'^INC-\d{4}$')
    question: str = Field(default='請查明告警的觀測事實、可能原因與 SOP 建議，必要時建立 Ticket 草稿。', min_length=1, max_length=1000)

@app.get('/api/health')
async def health():
    dependencies = {'domain': False, 'ollama': False}
    async with httpx.AsyncClient(timeout=3) as client:
        for name, url in [('domain', settings.domain_api + '/health/ready'), ('ollama', settings.ollama_url + '/api/tags')]:
            try:
                response = await client.get(url); dependencies[name] = response.is_success
                if name == 'ollama' and response.is_success:
                    names = {m['name'] for m in response.json().get('models', [])}
                    dependencies['chatModel'] = settings.ollama_chat_model in names
                    dependencies['embeddingModel'] = settings.ollama_embed_model in names or settings.ollama_embed_model + ':latest' in names
            except httpx.HTTPError: pass
    return {'provider': settings.ai_provider, 'models': {'chat': settings.ollama_chat_model, 'embedding': settings.ollama_embed_model}, 'dependencies': dependencies, 'synthetic': True}

@app.get('/api/incidents')
async def incidents(): return await domain('GET', '/incidents')

@app.get('/api/machines')
async def machines(): return await domain('GET', '/machines')

@app.get('/api/tickets')
async def tickets(): return await domain('GET', '/tickets')

@app.get('/api/audit')
async def audit(): return await domain('GET', '/audit')

@app.get('/api/runs/{run_id}')
async def run(run_id: str):
    import uuid
    try: uuid.UUID(run_id)
    except ValueError: raise HTTPException(400, 'Invalid run ID')
    return await domain('GET', '/runs/' + run_id)

@app.post('/api/investigate')
async def investigation(body: Investigation):
    if semaphore.locked(): raise HTTPException(429, 'One investigation is already running')
    async with semaphore:
        try: return await investigate(body.incidentId, body.question)
        except TimeoutError: raise HTTPException(504, 'Investigation exceeded the 10 minute budget')
        except ValueError as error: raise HTTPException(422, str(error))

class HumanApproval(BaseModel):
    confirmed: bool

@app.post('/api/tickets/{ticket_id}/approve')
async def approve(ticket_id: str, body: HumanApproval):
    import uuid
    try: uuid.UUID(ticket_id)
    except ValueError: raise HTTPException(400, 'Invalid ticket ID')
    if not body.confirmed: raise HTTPException(400, 'Explicit human review confirmation required')
    # Token never enters the LLM context or MCP process.
    token = await domain('POST', '/operator/tickets/' + ticket_id + '/token', operator=True)
    return await domain('POST', '/operator/tickets/' + ticket_id + '/approve', {'approvalToken': token['token']}, operator=True)

@app.post('/api/handover')
async def shift_handover():
    if semaphore.locked(): raise HTTPException(429, 'AI request already running')
    async with semaphore: return await handover()

class Search(BaseModel):
    query: str = Field(min_length=1, max_length=1000)

@app.post('/api/search')
async def search(body: Search):
    vector, warning = None, None
    if settings.ai_provider == 'ollama':
        try: vector = await embedding(body.query)
        except Exception: warning = 'Embedding unavailable; lexical fallback'
    result = await domain('POST', '/knowledge/search', {'query': body.query, 'embedding': vector, 'limit': 4})
    return {**result, 'warning': warning}

if (ROOT / 'web/dist').exists():
    app.mount('/', StaticFiles(directory=ROOT / 'web/dist', html=True), name='web')
