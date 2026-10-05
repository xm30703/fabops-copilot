from fastapi.testclient import TestClient
from agent.app import app

client=TestClient(app)

def test_cross_origin_approval_denied():
    result=client.post('/api/tickets/00000000-0000-0000-0000-000000000000/approve',json={'confirmed':True},headers={'Origin':'https://evil.example'})
    assert result.status_code==403

def test_human_confirmation_required():
    result=client.post('/api/tickets/00000000-0000-0000-0000-000000000000/approve',json={'confirmed':False})
    assert result.status_code==400

def test_invalid_incident_rejected():
    result=client.post('/api/investigate',json={'incidentId':'../../secret'})
    assert result.status_code==422
