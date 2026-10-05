"""Live evidence: no model/DB mocks. Reports lexical vs hybrid and agent mode."""
import argparse
import json
import sys
import time
from pathlib import Path
from datetime import datetime, timezone
import httpx

CASES = [('vacuum pressure seal maintenance', 'SOP-VAC-01'), ('temperature drift sensor calibration', 'SOP-TEMP-02'), ('MES queue backlog upstream timeout', 'SOP-MES-03')]

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--require-ai',action='store_true');parser.add_argument('--agent',action='store_true');parser.add_argument('--base-url',default='http://127.0.0.1:4317');args=parser.parse_args()
    rows=[]
    with httpx.Client(base_url=args.base_url,timeout=650) as client:
        health=client.get('/api/health');health.raise_for_status()
        for query, expected in CASES:
            response=client.post('/api/search',json={'query':query});response.raise_for_status();data=response.json()
            ids=[e['documentId'] for e in data['evidence']]
            passed=expected in ids[:3] and (not args.require_ai or data['mode']=='hybrid-pgvector')
            rows.append({'query':query,'expected':expected,'top3':ids[:3],'mode':data['mode'],'passed':passed})
        unknown=client.post('/api/search',json={'query':'quasar astrophysics interstellar spectroscopy'});unknown.raise_for_status()
        rows.append({'case':'out-of-domain abstention','passed':not unknown.json()['evidence']})
        if args.agent:
            for incident in ['INC-1001','INC-1002','INC-1003']:
                started=time.monotonic();response=client.post('/api/investigate',json={'incidentId':incident});response.raise_for_status();run=response.json()
                ids={e['id'] for e in run['evidence']};steps=run['findings']['steps']
                valid=bool(steps) and all(s['citations'] and set(s['citations'])<=ids for s in steps)
                tools=[e['tool'] for e in run['events']]
                passed=valid and 'approve_ticket' not in tools and (not args.require_ai or run['mode']=='ollama-agent')
                rows.append({'incident':incident,'runId':run['id'],'mode':run['mode'],'tools':tools,'validCitations':valid,'durationSeconds':round(time.monotonic()-started,1),'passed':passed})
    report={'scope':'live local dependencies','evaluatedAtUtc':datetime.now(timezone.utc).isoformat(),'configuration':health.json(),'results':rows,'passed':all(r['passed'] for r in rows)}
    output=Path(__file__).resolve().parents[1]/'artifacts/live-evaluation.json';output.parent.mkdir(exist_ok=True);output.write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(report,ensure_ascii=False,indent=2));return 0 if report['passed'] else 1

if __name__=='__main__':sys.exit(main())
