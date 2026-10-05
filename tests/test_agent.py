import json
from contextlib import asynccontextmanager
from types import SimpleNamespace
import pytest
from agent import core
from agent.models import validate_findings, findings_schema
from agent.ingest import chunk_markdown

EVIDENCE = {'id': 'SOP-VAC-01#abc', 'content': 'Notify equipment engineer. Do not restart automatically.', 'title': 'Vacuum pressure'}
FINDINGS = {'summary': 'Pressure alarm observed', 'hypothesis': 'Leak is unconfirmed', 'steps': [{'text': 'Notify engineer', 'citations': [EVIDENCE['id']]}], 'uncertainties': ['Reference reading missing']}
INCIDENT = {'id': 'INC-1001', 'machineId': 'ETCH-07', 'title': 'Vacuum pressure'}

class FakeSession:
    def __init__(self): self.calls = []
    async def list_tools(self):
        definitions = {
            'get_incident': {'incident_id': {'type': 'string'}},
            'get_machine': {'machine_id': {'type': 'string'}},
            'get_maintenance': {'machine_id': {'type': 'string'}},
            'search_sop': {'query': {'type': 'string'}},
            'create_ticket_draft': {k: {'type': 'array', 'items': {'type': 'string'}} if k == 'citations' else {'type': 'string'} for k in ['run_id','incident_id','title','summary','citations']},
            'approve_ticket': {},
        }
        return SimpleNamespace(tools=[SimpleNamespace(name=n, description=n, inputSchema={'type':'object','properties':p,'required':list(p),'additionalProperties':False}) for n,p in definitions.items()])
    async def call_tool(self, name, args):
        self.calls.append((name,args))
        values = {'get_incident':INCIDENT,'get_machine':{'id':'ETCH-07','telemetry':{'pressure':85}},'get_maintenance':[], 'search_sop':{'evidence':[EVIDENCE],'mode':'hybrid-pgvector','warning':None},'create_ticket_draft':{'id':'ticket-test','status':'draft'}}
        return SimpleNamespace(isError=False,structuredContent=values[name],content=[])

def call(name, **args): return {'function': {'name': name, 'arguments': args}}

def test_unknown_citations_rejected():
    with pytest.raises(ValueError): validate_findings({**FINDINGS,'steps':[{'text':'Act','citations':['invented']}]},[EVIDENCE])

def test_generation_schema_restricts_citations_to_retrieved_ids():
    from jsonschema import validate, ValidationError
    validate(FINDINGS, findings_schema([EVIDENCE]))
    with pytest.raises(ValidationError):
        validate({**FINDINGS, 'steps': [{'text': 'Act', 'citations': ['invented']}]}, findings_schema([EVIDENCE]))

def test_citationless_steps_rejected():
    with pytest.raises(ValueError): validate_findings({**FINDINGS,'steps':[{'text':'Act','citations':[]}]},[EVIDENCE])

def test_repeated_steps_are_rejected():
    step={'text':'Notify engineer','citations':[EVIDENCE['id']]}
    with pytest.raises(ValueError,match='Duplicate'):
        validate_findings({**FINDINGS,'steps':[step,step]},[EVIDENCE])

def test_chunk_ids_are_stable_and_content_sensitive():
    text = '# Test\n\n## Section\nGrounded evidence'
    assert chunk_markdown('DOC',text) == chunk_markdown('DOC',text)
    assert chunk_markdown('DOC',text)[0]['id'] != chunk_markdown('DOC',text+' changed')[0]['id']

@pytest.mark.asyncio
async def test_model_chooses_nonfixed_tool_order_and_draft(monkeypatch):
    session = FakeSession(); saved = []
    @asynccontextmanager
    async def factory(): yield session
    messages = iter([
        {'role':'assistant','tool_calls':[call('search_sop',query='vacuum pressure')]},
        {'role':'assistant','tool_calls':[call('get_maintenance',machine_id='ETCH-07'),call('get_machine',machine_id='ETCH-07')]},
        {'role':'assistant','content':json.dumps(FINDINGS)},
        {'role':'assistant','tool_calls':[call('create_ticket_draft')]},
    ])
    async def model(*args,**kwargs): return next(messages)
    async def save(run): saved.append(json.loads(json.dumps(run)))
    monkeypatch.setattr(core,'model_message',model); monkeypatch.setattr(core,'save_run',save); monkeypatch.setattr(core.settings,'ai_provider','ollama')
    run = await core.investigate('INC-1001','Investigate',factory)
    assert run['mode']=='ollama-agent'
    assert [n for n,a in session.calls]==['get_incident','search_sop','get_maintenance','get_machine','create_ticket_draft']
    assert run['ticket']['status']=='draft'
    assert all(n!='approve_ticket' for n,a in session.calls)
    assert saved[0]['evidence']==[EVIDENCE]

@pytest.mark.asyncio
async def test_host_feedback_allows_model_to_collect_missing_evidence(monkeypatch):
    session = FakeSession(); events=[]; evidence={}; observations={'incident':INCIDENT}
    responses=iter([
        {'role':'assistant','tool_calls':[call('get_machine',machine_id='ETCH-07'),call('search_sop',query='vacuum')]},
        {'role':'assistant','content':'Done'},
        {'role':'assistant','tool_calls':[call('get_maintenance',machine_id='ETCH-07')]},
        {'role':'assistant','content':'Done'},
    ])
    async def model(*a,**kw): return next(responses)
    monkeypatch.setattr(core,'model_message',model)
    schemas={t.name:t.inputSchema for t in (await session.list_tools()).tools}; messages=[]
    await core.bounded_tool_loop(session,messages,[],schemas,events,evidence,observations,'INC-1001')
    assert [name for name,args in session.calls]==['get_machine','search_sop','get_maintenance']
    assert any('hostValidation' in m.get('content','') for m in messages)

@pytest.mark.asyncio
async def test_discovery_stops_when_evidence_complete_even_if_model_keeps_calling(monkeypatch):
    session=FakeSession(); observations={'incident':INCIDENT}; evidence={}; model_calls=0
    async def model(*a,**kw):
        nonlocal model_calls
        model_calls += 1
        return {'role':'assistant','tool_calls':[
            call('get_machine',machine_id='ETCH-07'),
            call('search_sop',query='vacuum'),
            call('get_maintenance',machine_id='ETCH-07'),
        ]}
    monkeypatch.setattr(core,'model_message',model)
    schemas={t.name:t.inputSchema for t in (await session.list_tools()).tools}
    await core.bounded_tool_loop(session,[],[],schemas,[],evidence,observations,'INC-1001')
    assert model_calls == 1
    assert len(session.calls) == 3
    assert evidence[EVIDENCE['id']] == EVIDENCE

@pytest.mark.asyncio
async def test_hallucinated_write_tool_denied():
    with pytest.raises(ValueError,match='not allowed'):
        await core.invoke(FakeSession(),'approve_ticket',{}, {}, [])

@pytest.mark.asyncio
async def test_argument_schema_blocks_invalid_call():
    with pytest.raises(Exception):
        await core.invoke(FakeSession(),'get_machine',{'machine_id':123},{'get_machine':{'type':'object','properties':{'machine_id':{'type':'string'}}}},[])

@pytest.mark.asyncio
async def test_unavailable_model_falls_back_and_labels_it(monkeypatch):
    session = FakeSession()
    @asynccontextmanager
    async def factory(): yield session
    async def model(*a,**kw): raise RuntimeError('Model down')
    async def save(*a): pass
    monkeypatch.setattr(core,'model_message',model);monkeypatch.setattr(core,'save_run',save);monkeypatch.setattr(core.settings,'ai_provider','ollama')
    run = await core.investigate('INC-1001','Investigate',factory)
    assert run['mode']=='offline-fallback'
    assert '沒有 LLM' in run['findings']['summary']
    assert run['warnings']

@pytest.mark.asyncio
async def test_model_call_budget(monkeypatch):
    async def model(*a,**kw): return {'role':'assistant','tool_calls':[call('search_sop',query='vacuum')]*17}
    monkeypatch.setattr(core,'model_message',model)
    schema={'search_sop':{'type':'object','properties':{'query':{'type':'string'}}}}
    with pytest.raises(ValueError,match='budget'):
        await core.bounded_tool_loop(FakeSession(),[],[],schema,[],{}, {'incident':INCIDENT},'INC-1001')

@pytest.mark.asyncio
async def test_out_of_scope_machine_rejected(monkeypatch):
    async def model(*a,**kw): return {'role':'assistant','tool_calls':[call('get_machine',machine_id='OTHER')]}
    monkeypatch.setattr(core,'model_message',model)
    with pytest.raises(ValueError,match='scope'):
        await core.bounded_tool_loop(FakeSession(),[],[],{},[],{}, {'incident':INCIDENT},'INC-1001')
