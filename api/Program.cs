using System.Diagnostics;
using FabOps;
using Npgsql;
using OpenTelemetry.Resources;
using OpenTelemetry.Trace;

var builder = WebApplication.CreateBuilder(args);
builder.WebHost.UseUrls(Environment.GetEnvironmentVariable("ASPNETCORE_URLS") ?? "http://127.0.0.1:5080");
var serviceKey = Environment.GetEnvironmentVariable("SERVICE_KEY") ?? "local-service-change-me";
var operatorKey = Environment.GetEnvironmentVariable("OPERATOR_KEY") ?? "local-operator-change-me";
if (serviceKey == operatorKey) throw new InvalidOperationException("Service and operator keys must differ");
builder.Services.AddSingleton(NpgsqlDataSource.Create(Environment.GetEnvironmentVariable("DB_CONNECTION") ?? "Host=127.0.0.1;Port=5439;Database=fabops;Username=fabops;Password=fabops-local-only"));
builder.Services.AddSingleton<Repository>();
builder.Services.AddOpenTelemetry().ConfigureResource(r => r.AddService("fabops-domain-api")).WithTracing(t => t.AddAspNetCoreInstrumentation().AddHttpClientInstrumentation().AddSource("FabOps.Domain").AddOtlpExporter(o => { o.Endpoint = new Uri((Environment.GetEnvironmentVariable("OTEL_EXPORTER_OTLP_ENDPOINT") ?? "http://127.0.0.1:4318").TrimEnd('/') + "/v1/traces"); o.Protocol = OpenTelemetry.Exporter.OtlpExportProtocol.HttpProtobuf; }));
var app = builder.Build();
app.Use(async (context, next) => {
    if (context.Request.Path.StartsWithSegments("/health")) { await next(context); return; }
    var requiresOperator = context.Request.Path.StartsWithSegments("/operator");
    var expected = requiresOperator ? operatorKey : serviceKey;
    var supplied = context.Request.Headers[requiresOperator ? "X-Operator-Key" : "X-Service-Key"].ToString();
    if (!System.Security.Cryptography.CryptographicOperations.FixedTimeEquals(System.Text.Encoding.UTF8.GetBytes(supplied), System.Text.Encoding.UTF8.GetBytes(expected))) { context.Response.StatusCode = 401; return; }
    try { await next(context); } catch (ArgumentException error) { context.Response.StatusCode = 400; await context.Response.WriteAsJsonAsync(new { error = error.Message }); }
});
app.MapGet("/health/live", () => Results.Ok(new { status = "live" }));
app.MapGet("/health/ready", async (Repository db) => await db.Ready() ? Results.Ok(new { status = "ready" }) : Results.Json(new { status = "database_unavailable" }, statusCode: 503));
app.MapGet("/machines", (Repository db) => db.List("machines"));
app.MapGet("/machines/{id}", async (string id, Repository db) => await db.Get("machines", id) is { } result ? Results.Ok(result) : Results.NotFound());
app.MapGet("/incidents", (Repository db) => db.List("incidents"));
app.MapGet("/incidents/{id}", async (string id, Repository db) => await db.Get("incidents", id) is { } result ? Results.Ok(result) : Results.NotFound());
app.MapGet("/maintenance/{machineId}", (string machineId, Repository db) => db.List("maintenance", machineId));
app.MapGet("/shifts", (Repository db) => db.List("shifts"));
app.MapPost("/knowledge/search", (SearchRequest request, Repository db) => db.Search(request));
app.MapPost("/knowledge/chunks", async (ChunkRequest request, Repository db) => { await db.Ingest(request); return Results.NoContent(); });
app.MapPost("/knowledge/documents", async (DocumentRequest request, Repository db) => { await db.ReplaceDocument(request); return Results.NoContent(); });
app.MapPost("/runs", async (RunRequest request, Repository db) => { await db.SaveRun(request); return Results.NoContent(); });
app.MapGet("/runs/{id}", async (string id, Repository db) => await db.Run(id) is { } run ? Results.Ok(run) : Results.NotFound());
app.MapPost("/tickets/drafts", (DraftRequest request, Repository db) => db.Draft(request));
app.MapGet("/tickets", (Repository db) => db.Tickets());
app.MapGet("/audit", (Repository db) => db.Audit());
app.MapPost("/operator/tickets/{id:guid}/token", async (Guid id, Repository db) => Results.Ok(new { token = await db.ApprovalToken(id) }));
app.MapPost("/operator/tickets/{id:guid}/approve", async (Guid id, ApprovalRequest request, Repository db) => await db.Approve(id, request.ApprovalToken) ? Results.Ok(new { status = "approved" }) : Results.Json(new { error = "Approval token invalid, expired or consumed" }, statusCode: 409));
try { await app.Services.GetRequiredService<Repository>().Initialize(); }
catch (Exception error) { app.Logger.LogWarning("Database initialization unavailable: {Type}. Readiness stays unhealthy; initialize again after DB starts.", error.GetType().Name); }
// Explicit local retry endpoint avoids claiming readiness when migrations have not run.
app.MapPost("/initialize", async (Repository db) => { await db.Initialize(); return Results.Ok(new { initialized = true }); });
app.Run();
public partial class Program { }
