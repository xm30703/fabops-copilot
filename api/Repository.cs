using System.Globalization;
using System.Text.Json;
using Npgsql;

namespace FabOps;
public sealed class Repository(NpgsqlDataSource source)
{
    public async Task Initialize()
    {
        await using var connection = await source.OpenConnectionAsync();
        await using var migration = new NpgsqlCommand(await File.ReadAllTextAsync(Path.Combine(AppContext.BaseDirectory, "schema.sql")), connection);
        await migration.ExecuteNonQueryAsync();
        using var seed = JsonDocument.Parse(await File.ReadAllTextAsync(Path.Combine(AppContext.BaseDirectory, "seed.json")));
        foreach (var table in new[] { "machines", "incidents", "maintenance", "shifts" })
        {
            foreach (var item in seed.RootElement.GetProperty(table).EnumerateArray())
            {
                var hasMachine = table is "incidents" or "maintenance";
                await using var cmd = new NpgsqlCommand($"INSERT INTO {table}(id,{(hasMachine ? "machine_id," : "")}payload) VALUES(@id,{(hasMachine ? "@machine," : "")}@payload::jsonb) ON CONFLICT(id) DO NOTHING", connection);
                cmd.Parameters.AddWithValue("id", item.GetProperty("id").GetString()!);
                if (hasMachine) cmd.Parameters.AddWithValue("machine", item.GetProperty("machineId").GetString()!);
                cmd.Parameters.AddWithValue("payload", item.GetRawText()); await cmd.ExecuteNonQueryAsync();
            }
        }
    }
    public async Task<List<JsonElement>> List(string table, string? machineId = null)
    {
        if (!new[] { "machines", "incidents", "maintenance", "shifts" }.Contains(table)) throw new ArgumentException("Unknown table");
        await using var cmd = source.CreateCommand($"SELECT payload FROM {table}" + (machineId is null ? " ORDER BY id" : " WHERE machine_id=@machine ORDER BY id"));
        if (machineId is not null) cmd.Parameters.AddWithValue("machine", machineId);
        await using var reader = await cmd.ExecuteReaderAsync(); var result = new List<JsonElement>();
        while (await reader.ReadAsync()) result.Add(JsonSerializer.Deserialize<JsonElement>(reader.GetString(0))); return result;
    }
    public async Task<JsonElement?> Get(string table, string id) => (await List(table)).Cast<JsonElement?>().FirstOrDefault(item => item!.Value.GetProperty("id").GetString() == id);
    public static string Vector(float[] vector) => "[" + string.Join(",", vector.Select(n => n.ToString("R", CultureInfo.InvariantCulture))) + "]";
    public async Task Ingest(ChunkRequest chunk)
    {
        if (chunk.Embedding is not null && !DomainPolicy.ValidEmbedding(chunk.Embedding)) throw new ArgumentException("Embedding must have 768 finite dimensions");
        await using var cmd = source.CreateCommand("INSERT INTO knowledge_chunks(id,document_id,title,content,tags,embedding) VALUES(@id,@doc,@title,@content,@tags,@vector::vector) ON CONFLICT(id) DO UPDATE SET title=EXCLUDED.title,content=EXCLUDED.content,tags=EXCLUDED.tags,embedding=EXCLUDED.embedding");
        cmd.Parameters.AddWithValue("id", chunk.Id); cmd.Parameters.AddWithValue("doc", chunk.DocumentId); cmd.Parameters.AddWithValue("title", chunk.Title);
        cmd.Parameters.AddWithValue("content", chunk.Content); cmd.Parameters.AddWithValue("tags", chunk.Tags);
        cmd.Parameters.Add("vector", NpgsqlTypes.NpgsqlDbType.Text).Value = chunk.Embedding is null ? DBNull.Value : Vector(chunk.Embedding);
        await cmd.ExecuteNonQueryAsync();
    }
    public async Task ReplaceDocument(DocumentRequest document)
    {
        if (document.Chunks.Length is < 1 or > 100 || document.Chunks.Any(c => c.DocumentId != document.DocumentId || (c.Embedding is not null && !DomainPolicy.ValidEmbedding(c.Embedding)))) throw new ArgumentException("Invalid document chunks");
        await using var connection = await source.OpenConnectionAsync();
        await using var transaction = await connection.BeginTransactionAsync();
        await using var delete = new NpgsqlCommand("DELETE FROM knowledge_chunks WHERE document_id=@id", connection, transaction);
        delete.Parameters.AddWithValue("id", document.DocumentId); await delete.ExecuteNonQueryAsync();
        foreach (var chunk in document.Chunks)
        {
            await using var insert = new NpgsqlCommand("INSERT INTO knowledge_chunks(id,document_id,title,content,tags,embedding) VALUES(@id,@doc,@title,@content,@tags,@vector::vector)", connection, transaction);
            insert.Parameters.AddWithValue("id", chunk.Id); insert.Parameters.AddWithValue("doc", chunk.DocumentId); insert.Parameters.AddWithValue("title", chunk.Title); insert.Parameters.AddWithValue("content", chunk.Content); insert.Parameters.AddWithValue("tags", chunk.Tags);
            insert.Parameters.Add("vector", NpgsqlTypes.NpgsqlDbType.Text).Value = chunk.Embedding is null ? DBNull.Value : Vector(chunk.Embedding);
            await insert.ExecuteNonQueryAsync();
        }
        await transaction.CommitAsync();
    }
    public async Task<object> Search(SearchRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Query) || request.Query.Length > 1000 || request.Limit is < 1 or > 6) throw new ArgumentException("Invalid search");
        if (request.Embedding is not null && !DomainPolicy.ValidEmbedding(request.Embedding)) throw new ArgumentException("Invalid vector");
        const string sql = """
        WITH scored AS (
          SELECT id,document_id,title,content,tags,
            ts_rank_cd(search_vector,websearch_to_tsquery('simple',@query)) AS lexical,
            CASE WHEN embedding IS NOT NULL AND @vector::vector IS NOT NULL THEN 1-(embedding <=> @vector::vector) ELSE 0 END AS semantic
          FROM knowledge_chunks
        ) SELECT id,document_id,title,content,tags,lexical,semantic,
          (CASE WHEN @vector::vector IS NULL THEN lexical ELSE 0.65*semantic+0.35*LEAST(lexical,1) END) AS score
          FROM scored WHERE lexical>0 OR semantic>=0.55 ORDER BY score DESC,id LIMIT @limit
        """;
        // OR terms keep multi-symptom queries useful; SQL parameters prevent query injection.
        var terms = System.Text.RegularExpressions.Regex.Matches(request.Query.ToLowerInvariant(), "[a-z0-9]+|[\\p{IsCJKUnifiedIdeographs}]{2,}").Select(m => m.Value).Distinct().Take(40);
        await using var cmd = source.CreateCommand(sql);
        cmd.Parameters.AddWithValue("query", string.Join(" OR ", terms)); cmd.Parameters.AddWithValue("limit", request.Limit);
        cmd.Parameters.Add("vector", NpgsqlTypes.NpgsqlDbType.Text).Value = request.Embedding is null ? DBNull.Value : Vector(request.Embedding);
        await using var reader = await cmd.ExecuteReaderAsync(); var results = new List<object>(); bool hasVector = false;
        while (await reader.ReadAsync()) { hasVector |= reader.GetDouble(6) != 0; results.Add(new { id = reader.GetString(0), documentId = reader.GetString(1), title = reader.GetString(2), content = reader.GetString(3), tags = reader.GetFieldValue<string[]>(4), lexical = reader.GetFloat(5), semantic = reader.GetDouble(6), score = reader.GetDouble(7) }); }
        return new { mode = hasVector ? "hybrid-pgvector" : "lexical-postgres", evidence = results };
    }
    public async Task SaveRun(RunRequest run)
    {
        await using var cmd = source.CreateCommand("INSERT INTO agent_runs(id,incident_id,mode,status,payload) VALUES(@id,@incident,@mode,@status,@payload::jsonb) ON CONFLICT(id) DO UPDATE SET mode=EXCLUDED.mode,status=EXCLUDED.status,payload=EXCLUDED.payload");
        cmd.Parameters.AddWithValue("id", run.Id); cmd.Parameters.AddWithValue("incident", run.IncidentId); cmd.Parameters.AddWithValue("mode", run.Mode); cmd.Parameters.AddWithValue("status", run.Status); cmd.Parameters.AddWithValue("payload", run.Payload); await cmd.ExecuteNonQueryAsync();
    }
    public async Task<JsonElement?> Run(string id)
    {
        await using var cmd = source.CreateCommand("SELECT payload FROM agent_runs WHERE id=@id"); cmd.Parameters.AddWithValue("id", id);
        var raw = await cmd.ExecuteScalarAsync(); return raw is string text ? JsonSerializer.Deserialize<JsonElement>(text) : null;
    }
    public async Task<object> Draft(DraftRequest draft)
    {
        DomainPolicy.ValidateDraft(draft);
        var run = await Run(draft.RunId) ?? throw new ArgumentException("Run not found");
        if (run.GetProperty("incidentId").GetString() != draft.IncidentId) throw new ArgumentException("Run incident mismatch");
        var allowed = run.GetProperty("evidence").EnumerateArray().Select(e => e.GetProperty("id").GetString()).ToHashSet();
        if (draft.Citations.Any(c => !allowed.Contains(c))) throw new ArgumentException("Citation is outside the run evidence");
        await using var cmd = source.CreateCommand("INSERT INTO ticket_drafts(id,run_id,incident_id,title,summary,citations) VALUES(@id,@run,@incident,@title,@summary,@citations) ON CONFLICT(run_id) DO UPDATE SET run_id=EXCLUDED.run_id RETURNING id,status");
        cmd.Parameters.AddWithValue("id", Guid.NewGuid()); cmd.Parameters.AddWithValue("run", draft.RunId); cmd.Parameters.AddWithValue("incident", draft.IncidentId); cmd.Parameters.AddWithValue("title", draft.Title); cmd.Parameters.AddWithValue("summary", draft.Summary); cmd.Parameters.AddWithValue("citations", draft.Citations);
        await using var reader = await cmd.ExecuteReaderAsync(); await reader.ReadAsync(); return new { id = reader.GetGuid(0), status = reader.GetString(1), draft.RunId };
    }
    public async Task<List<object>> Tickets()
    {
        await using var cmd = source.CreateCommand("SELECT id,run_id,incident_id,title,summary,citations,status,approved_by,created_at FROM ticket_drafts ORDER BY created_at DESC");
        await using var reader = await cmd.ExecuteReaderAsync(); var result = new List<object>();
        while (await reader.ReadAsync()) result.Add(new { id = reader.GetGuid(0), runId = reader.GetString(1), incidentId = reader.GetString(2), title = reader.GetString(3), summary = reader.GetString(4), citations = reader.GetFieldValue<string[]>(5), status = reader.GetString(6), approvedBy = reader.IsDBNull(7) ? null : reader.GetString(7), createdAt = reader.GetDateTime(8) }); return result;
    }
    private static string Hash(string token) => Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(token)));
    public async Task<string> ApprovalToken(Guid id)
    {
        var token = Convert.ToHexString(System.Security.Cryptography.RandomNumberGenerator.GetBytes(32));
        await using var cmd = source.CreateCommand("UPDATE ticket_drafts SET approval_hash=@hash,approval_expires=now()+interval '60 seconds' WHERE id=@id AND status='draft'");
        cmd.Parameters.AddWithValue("hash", Hash(token)); cmd.Parameters.AddWithValue("id", id);
        if (await cmd.ExecuteNonQueryAsync() != 1) throw new ArgumentException("Draft not found or already approved"); return token;
    }
    public async Task<bool> Approve(Guid id, string token)
    {
        await using var connection = await source.OpenConnectionAsync(); await using var transaction = await connection.BeginTransactionAsync();
        await using var cmd = new NpgsqlCommand("UPDATE ticket_drafts SET status='approved',approved_by='local-demo-operator',approval_hash=NULL,approval_expires=NULL WHERE id=@id AND status='draft' AND approval_hash=@hash AND approval_expires>now() AND cardinality(citations)>0", connection, transaction);
        cmd.Parameters.AddWithValue("id", id); cmd.Parameters.AddWithValue("hash", Hash(token));
        if (await cmd.ExecuteNonQueryAsync() != 1) { await transaction.RollbackAsync(); return false; }
        await using var audit = new NpgsqlCommand("INSERT INTO audit_events(event,payload) VALUES('ticket_approved',@payload::jsonb)", connection, transaction);
        audit.Parameters.AddWithValue("payload", JsonSerializer.Serialize(new { ticketId = id, actor = "local-demo-operator" })); await audit.ExecuteNonQueryAsync();
        await transaction.CommitAsync(); return true;
    }
    public async Task<List<object>> Audit()
    {
        await using var cmd = source.CreateCommand("SELECT event,payload,created_at FROM audit_events ORDER BY id DESC LIMIT 100");
        await using var reader = await cmd.ExecuteReaderAsync(); var result = new List<object>();
        while (await reader.ReadAsync()) result.Add(new { eventName = reader.GetString(0), payload = JsonSerializer.Deserialize<JsonElement>(reader.GetString(1)), at = reader.GetDateTime(2) }); return result;
    }
    public async Task<bool> Ready() { try { await using var cmd = source.CreateCommand("SELECT 1 FROM knowledge_chunks LIMIT 1"); await cmd.ExecuteScalarAsync(); return true; } catch { return false; } }
}
