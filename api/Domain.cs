namespace FabOps;

public record DraftRequest(string RunId, string IncidentId, string Title, string Summary, string[] Citations);
public record ApprovalRequest(string ApprovalToken);
public record SearchRequest(string Query, float[]? Embedding, int Limit = 4);
public record ChunkRequest(string Id, string DocumentId, string Title, string Content, string[] Tags, float[]? Embedding);
public record DocumentRequest(string DocumentId, ChunkRequest[] Chunks);
public record RunRequest(string Id, string IncidentId, string Mode, string Status, string Payload);

public static class DomainPolicy
{
    public static void ValidateDraft(DraftRequest draft)
    {
        if (!Guid.TryParse(draft.RunId, out _) || string.IsNullOrWhiteSpace(draft.IncidentId)
            || string.IsNullOrWhiteSpace(draft.Title) || draft.Title.Length > 200
            || string.IsNullOrWhiteSpace(draft.Summary) || draft.Summary.Length > 8000
            || draft.Citations.Length is < 1 or > 12)
            throw new ArgumentException("Invalid draft or missing citations");
    }
    public static bool ValidEmbedding(float[]? vector) => vector is { Length: 768 } && vector.All(float.IsFinite);
}
