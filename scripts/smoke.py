"""Release gate: static Angular assets, domain data, model readiness and boundaries."""
import argparse
import httpx


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--base-url', default='http://127.0.0.1:4317')
    parser.add_argument('--require-ai', action='store_true')
    args = parser.parse_args()
    with httpx.Client(base_url=args.base_url, timeout=15) as client:
        page = client.get('/')
        page.raise_for_status()
        assert '<app-root' in page.text, 'Angular production assets missing'
        health = client.get('/api/health')
        health.raise_for_status()
        data = health.json()
        assert data['dependencies']['domain'], 'Domain/DB not ready'
        if args.require_ai:
            assert data['provider'] == 'ollama'
            assert all(data['dependencies'].get(key) for key in ['ollama', 'chatModel', 'embeddingModel']), 'Required Ollama models unavailable'
        machines = client.get('/api/machines'); machines.raise_for_status()
        incidents = client.get('/api/incidents'); incidents.raise_for_status()
        assert machines.json() and incidents.json(), 'Synthetic seed data missing'
        denied = client.post('/api/search', json={'query': 'vacuum'}, headers={'Origin': 'https://untrusted.example'})
        assert denied.status_code == 403, 'Cross-origin mutation boundary failed'
    print('Release smoke passed: Angular, domain/DB, seed data, origin boundary' + (', Ollama models' if args.require_ai else ''))


if __name__ == '__main__':
    main()
