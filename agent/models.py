from pydantic import BaseModel, Field

class Step(BaseModel):
    text: str = Field(min_length=1, max_length=1500)
    citations: list[str] = Field(min_length=1, max_length=8)

class Findings(BaseModel):
    summary: str = Field(min_length=1, max_length=4000)
    hypothesis: str = Field(min_length=1, max_length=1500)
    steps: list[Step] = Field(min_length=1, max_length=6)
    uncertainties: list[str] = Field(min_length=1, max_length=6)

def validate_findings(payload: dict, evidence: list[dict]) -> dict:
    findings = Findings.model_validate(payload)
    allowed = {item['id'] for item in evidence}
    if any(c not in allowed for step in findings.steps for c in step.citations):
        raise ValueError('Unsupported citation rejected')
    actions = [step.text.strip().casefold() for step in findings.steps]
    if len(actions) != len(set(actions)):
        raise ValueError('Duplicate suggested steps rejected')
    return findings.model_dump()

def findings_schema(evidence: list[dict]) -> dict:
    schema = Findings.model_json_schema()
    schema['$defs']['Step']['properties']['citations']['items']['enum'] = [item['id'] for item in evidence]
    return schema

def baseline(incident: dict, evidence: list[dict]) -> dict:
    return {
        'summary': incident['id'] + '：' + incident['title'] + '。此為離線規則／檢索結果，沒有 LLM 推理。',
        'hypothesis': '症狀與保養紀錄不能單獨證明根因，需工程師確認。',
        'steps': [{'text': item['content'], 'citations': [item['id']]} for item in evidence[:3]],
        'uncertainties': ['資料與 SOP 全部為虛構。', '未經語意蘊涵檢查；來源 ID 有效不等於建議正確。', '本系統只建立模擬工單，沒有設備控制能力。'],
    }
