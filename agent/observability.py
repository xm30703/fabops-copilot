from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.sdk.resources import Resource
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from .config import settings

def configure(service: str):
    provider = TracerProvider(resource=Resource.create({'service.name': service}))
    provider.add_span_processor(BatchSpanProcessor(OTLPSpanExporter(endpoint=settings.otel_exporter_otlp_endpoint.rstrip('/') + '/v1/traces', timeout=3)))
    trace.set_tracer_provider(provider)
    return trace.get_tracer(service)

tracer = trace.get_tracer('fabops-agent')
