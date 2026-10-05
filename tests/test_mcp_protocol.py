import pytest
from agent.core import enterprise

@pytest.mark.asyncio
async def test_real_stdio_handshake_and_tool_discovery():
    # Real official SDK client + server subprocess. Does not depend on DB or LLM.
    async with enterprise() as session:
        advertised = await session.list_tools()
        names = {t.name for t in advertised.tools}
        assert names == {'get_machine','get_incident','get_maintenance','search_sop','create_ticket_draft'}
        assert 'approve_ticket' not in names
        resource = await session.read_resource('fabops://scope')
        assert 'synthetic' in resource.contents[0].text
