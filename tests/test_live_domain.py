import os
import uuid
import httpx
import pytest

pytestmark=pytest.mark.skipif(os.getenv('FABOPS_INTEGRATION')!='1',reason='Requires live .NET API + PostgreSQL; set FABOPS_INTEGRATION=1')

def test_live_search_and_approval_boundary():
    service=os.getenv('SERVICE_KEY','local-service-change-me');operator=os.getenv('OPERATOR_KEY','local-operator-change-me')
    with httpx.Client(base_url='http://127.0.0.1:5080',headers={'X-Service-Key':service}) as client:
        response=client.post('/knowledge/search',json={'query':'vacuum pressure','embedding':None,'limit':3});response.raise_for_status();evidence=response.json()['evidence'];assert evidence
        run_id=str(uuid.uuid4());payload={'incidentId':'INC-1001','evidence':evidence}
        response=client.post('/runs',json={'id':run_id,'incidentId':'INC-1001','mode':'test','status':'test','payload':__import__('json').dumps(payload)});response.raise_for_status()
        draft={'runId':run_id,'incidentId':'INC-1001','title':'Integration test synthetic ticket','summary':'Human review required','citations':[evidence[0]['id']]}
        created=client.post('/tickets/drafts',json=draft);created.raise_for_status();ticket=created.json()
        duplicate=client.post('/tickets/drafts',json=draft);assert duplicate.json()['id']==ticket['id']
        assert client.post('/operator/tickets/'+ticket['id']+'/token').status_code==401
        token=client.post('/operator/tickets/'+ticket['id']+'/token',headers={'X-Operator-Key':operator});token.raise_for_status()
        approve={'approvalToken':token.json()['token']};path='/operator/tickets/'+ticket['id']+'/approve'
        assert client.post(path,json=approve,headers={'X-Operator-Key':operator}).status_code==200
        assert client.post(path,json=approve,headers={'X-Operator-Key':operator}).status_code==409
        bad={**draft,'runId':str(uuid.uuid4()),'citations':['made-up']}
        assert client.post('/tickets/drafts',json=bad).status_code==400
