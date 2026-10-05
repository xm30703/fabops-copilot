CREATE EXTENSION IF NOT EXISTS vector;
CREATE TABLE IF NOT EXISTS machines(id text PRIMARY KEY, payload jsonb NOT NULL);
CREATE TABLE IF NOT EXISTS incidents(id text PRIMARY KEY, machine_id text NOT NULL REFERENCES machines(id), payload jsonb NOT NULL);
CREATE TABLE IF NOT EXISTS maintenance(id text PRIMARY KEY, machine_id text NOT NULL REFERENCES machines(id), payload jsonb NOT NULL);
CREATE TABLE IF NOT EXISTS shifts(id text PRIMARY KEY, payload jsonb NOT NULL);
CREATE TABLE IF NOT EXISTS knowledge_chunks(
  id text PRIMARY KEY, document_id text NOT NULL, title text NOT NULL, content text NOT NULL,
  tags text[] NOT NULL, embedding vector(768),
  search_vector tsvector GENERATED ALWAYS AS (to_tsvector('simple', title || ' ' || content)) STORED
);
CREATE INDEX IF NOT EXISTS knowledge_lexical ON knowledge_chunks USING gin(search_vector);
CREATE INDEX IF NOT EXISTS knowledge_vector ON knowledge_chunks USING hnsw(embedding vector_cosine_ops);
CREATE TABLE IF NOT EXISTS agent_runs(id text PRIMARY KEY, incident_id text NOT NULL REFERENCES incidents(id), mode text NOT NULL, status text NOT NULL, payload jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS ticket_drafts(
  id uuid PRIMARY KEY, run_id text NOT NULL UNIQUE REFERENCES agent_runs(id), incident_id text NOT NULL REFERENCES incidents(id),
  title text NOT NULL, summary text NOT NULL, citations text[] NOT NULL, status text NOT NULL DEFAULT 'draft',
  approval_hash text, approval_expires timestamptz, approved_by text, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS audit_events(id bigserial PRIMARY KEY, event text NOT NULL, payload jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
