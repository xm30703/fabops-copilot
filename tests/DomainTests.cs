using FabOps;
using Xunit;
namespace FabOps.Tests;
public class DomainTests
{
    [Fact] public void MissingCitationCannotCreateDraft() => Assert.Throws<ArgumentException>(() => DomainPolicy.ValidateDraft(new(Guid.NewGuid().ToString(), "INC-1001", "Alarm", "Investigate", [])));
    [Fact] public void ValidDraftRequiresEvidence() => DomainPolicy.ValidateDraft(new(Guid.NewGuid().ToString(), "INC-1001", "Alarm", "Investigate", ["SOP-VAC-01#1"]));
    [Fact] public void InvalidRunIdentifierIsRejected() => Assert.Throws<ArgumentException>(() => DomainPolicy.ValidateDraft(new("invalid", "INC-1001", "Alarm", "Review", ["SOP#1"])));
    [Fact] public void MissingIncidentIsRejected() => Assert.Throws<ArgumentException>(() => DomainPolicy.ValidateDraft(new(Guid.NewGuid().ToString(), "", "Alarm", "Review", ["SOP#1"])));
    [Fact] public void OversizedSummaryIsRejected() => Assert.Throws<ArgumentException>(() => DomainPolicy.ValidateDraft(new(Guid.NewGuid().ToString(), "INC-1001", "Alarm", new string('x',8001), ["SOP#1"])));
    [Fact] public void EmptyTitleIsRejected() => Assert.Throws<ArgumentException>(() => DomainPolicy.ValidateDraft(new(Guid.NewGuid().ToString(), "INC-1001", "", "Review", ["SOP#1"])));
    [Fact] public void InvalidEmbeddingDimensionIsRejected() => Assert.False(DomainPolicy.ValidEmbedding([1, 2]));
    [Fact] public void NonFiniteEmbeddingIsRejected() { var vector = new float[768]; vector[0] = float.NaN; Assert.False(DomainPolicy.ValidEmbedding(vector)); }
}
