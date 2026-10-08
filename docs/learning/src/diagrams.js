function teachingNode(id, title, sub, x, y, detail, tone='') {return {id,title,sub,x,y,detail,tone,w:220,h:78};}
function teachingFlow(title, labels, note='') {
  const positions = [[30,55],[340,55],[650,55],[650,245],[340,245],[30,245]];
  const nodes = labels.map((v,i)=>teachingNode('n'+i,v[0],v[1],...positions[i],v[2]||v[0],v[3]||''));
  const edges=nodes.slice(1).map((n,i)=>({from:nodes[i].id,to:n.id}));
  return {title,nodes,edges,height:labels.length>3?375:195,note};
}
const diagramSpecs = {
  business: teachingFlow('一件事故的作業流程',[
    ['人員提出問題','選事故 INC-1001','輸入事故與問題；數值是合成快照。','human'],
    ['查設備與保養','先整理觀測事實','壓力85、門檻50；保養紀錄提供線索。'],
    ['查相關 SOP','找到可核對的段落','查作業程序與維修知識，不補造來源。'],
    ['整理結果','事實／假設／建議','模型可能說錯；人員仍要核對內容。'],
    ['儲存與可選草稿','保留調查與來源','模型可選擇不建立草稿。'],
    ['人員審查與交接','核准本機模擬工單','核准不會控制設備或傳送外部工單。','human'],
  ],'先整理依據，再讓人員決定。箭頭描述工作推進，不是模型腦內思考。'),
  requirements: teachingFlow('一項核准需求的三個角度',[
    ['RA：要達成什麼','人員可核對建議來源','需求：值班人員需要有依據的核准。'],
    ['SA：行為與規則','明確確認、拒絕重放','分析：草稿、人審、核准與例外。'],
    ['SD：實作機制','operator API＋交易','設計：token、權限與資料庫原子更新。'],
  ],'每個需求都要能連到行為、程式與驗收。'),
  architecture: {
    title:'系統架構：點選元件，看它的責任',height:465,
    nodes:[
      teachingNode('ui','Angular / TypeScript','畫面、表單與操作狀態',30,65,'使用者操作入口。Router切頁、Signals store存狀態、ApiService送HTTP。','human'),
      teachingNode('host','Python Gateway / Host','輸入、模型與工具編排',340,65,'Gateway接請求；Host建立範圍、提供工具並驗證模型提議。'),
      teachingNode('ollama','Ollama','聊天模型／embedding',650,65,'模型執行環境；聊天模型選工具與寫結果，embedding模型轉換向量。'),
      teachingNode('api','.NET domain API','業務規則、搜尋與交易',30,285,'統一負責資料、來源驗證、草稿唯一性與核准交易。'),
      teachingNode('mcp','MCP Server','工具 → domain API',340,285,'以共同協定提供企業能力；stdio接Host，HTTP接.NET。'),
      teachingNode('db','PostgreSQL / pgvector','持久資料與SOP向量',650,285,'儲存事故、run、草稿、audit與chunks；不由模型直接執行SQL。'),
    ],
    edges:[
      {from:'ui',to:'host',label:'HTTP'}, {from:'host',to:'ollama',label:'chat'},
      {from:'host',to:'mcp',label:'MCP stdio'}, {from:'mcp',to:'api',label:'HTTP'},
      {from:'mcp',to:'ollama',d:'M 560 324 H 602 V 104 H 650',label:'embedding',lx:604,ly:206},
      {from:'api',to:'db',d:'M 140 363 V 419 H 760 V 363',label:'SQL／資料庫查詢',lx:450,ly:409},
    ],
    note:'人工核准由Gateway直接走operator API；交接摘要目前也是直接讀domain。圖形是分工，不代表六臺不同主機。',
  },
  data:{title:'核心資料關係',height:505,nodes:[
    teachingNode('machine','Machine','設備快照',30,50,'設備主檔與量測快照。'),
    teachingNode('incident','Incident','事故／異常',340,50,'一臺設備可以有多件事故。'),
    teachingNode('run','Agent run','一次調查與evidence快照',650,50,'儲存結果、模式與工具紀錄；不是執行中checkpoint。'),
    teachingNode('maintenance','Maintenance','保養紀錄',30,285,'設備可對應多筆保養。'),
    teachingNode('chunk','Knowledge chunk','SOP段落／向量',340,285,'原始來源獨立儲存；run保留當時原文快照。'),
    teachingNode('ticket','Ticket draft','同run最多一份草稿',650,285,'run_id UNIQUE；核准只更新本機狀態。'),
  ],edges:[{from:'machine',to:'incident',label:'1 → 多'},{from:'incident',to:'run',label:'1 → 多'},
    {from:'machine',to:'maintenance',label:'1 → 多'}, {from:'run',to:'ticket',label:'1 → 0 或 1'},
    {from:'chunk',to:'run',d:'M 560 324 H 609 V 187 H 700 V 128',label:'原文快照，非外來鍵',lx:601,ly:169,dashed:true}],
    note:'外來鍵與唯一性由DB約束。Chunks到run的虛線是複製來源內容，不是schema中的外來鍵。'},
  llm:teachingFlow('模型生成與驗證的流程',[
    ['蒐集材料','問題＋觀測＋SOP','模型可用的本次context。'],['要求回答格式','prompt＋JSON schema','要求區分事實、假設與建議。'],
    ['Ollama執行LLM','生成findings','流暢與格式合法不保證內容正確。'],['程式驗證','欄位、引用、重複步驟','來源ID有效不等於語意支持。'],
    ['最多一次修正','仍失敗則明確降級','不是無限重問直到看似成功。'],['人員核對內容','檢視原文與缺少資料','最終核對建議是否由事實與來源支持。','human'],
  ],'圖中沒有訓練模型；這是使用既有LLM生成結果。'),
  agent:teachingFlow('有界Agent：模型選擇，Host把關',[
    ['固定事故範圍','Host先get_incident','根據使用者選擇的事故取得可信設備ID。'],['模型選讀取工具','工具名、引數與搜尋詞','模型決定需要什麼資訊，不直接執行。'],
    ['Host檢查','allowlist／schema／scope','任何不合規呼叫在執行前被拒絕。'],['MCP執行與回傳','工具 → API → 資料','結果放回模型context；可進行下一輪。'],
    ['證據足夠就停','設備＋保養＋非空SOP','8輪／16次calls；不等待模型無限停止。'],['生成、驗證、儲存','可選草稿 → 等人審','核准是另一條路徑。','human'],
  ],'蒐證可能重複模型→工具→結果；實際順序可變。圖是概覽，互動演練另有各步結果。'),
  mcp:teachingFlow('MCP與domain API是兩段介面',[
    ['Host＋MCP Client','initialize／tools/list','Host取得工具描述與引數規格。'],['MCP Server','tools/call與結果','以stdio JSON-RPC交換工具訊息。'],
    ['.NET domain API','HTTP與業務規則','Server把工具轉成domain請求。'],['PostgreSQL','資料與搜尋結果','資料經domain、MCP回到Host。'],
  ],'回應沿原路回傳；MCP不決定Agent策略，也不直接代替domain授權。'),
  rag:{title:'RAG：匯入與提問是兩個時段',height:460,nodes:[
    teachingNode('sop','SOP檔案','預先準備',10,65,'合成 Markdown 作業程序文件。'),teachingNode('chunk','章節切段','可獨立引用',240,65,'內容hash形成穩定段落ID。'),
    teachingNode('emb','檔案embedding','nomic / 768維',470,65,'使用目前embedding模型轉換內容。'),teachingNode('store','PostgreSQL','段落＋向量',700,65,'整份檔案於同一交易替換。'),
    teachingNode('query','使用者問題','每次提問',10,290,'事故症狀與模型選擇的搜尋詞。'),teachingNode('qemb','問題embedding','使用相同模型',240,290,'不能混用不同向量空間。'),
    teachingNode('rank','混合檢索','向量＋關鍵字',470,290,'排名、門檻與少量候選；無結果就說不足。'),teachingNode('generate','LLM生成','觀測＋段落＋引用',700,290,'再驗證來源與人員核對內容。'),
  ].map(n=>({...n,w:195})),edges:[{from:'sop',to:'chunk'},{from:'chunk',to:'emb'},{from:'emb',to:'store'},
    {from:'query',to:'qemb'},{from:'qemb',to:'rank'},{from:'rank',to:'generate'},
    {from:'store',to:'rank',d:'M 797 143 V 225 H 568 V 290',label:'取回相關段落',lx:684,ly:213}],
    width:920,note:'上排只在匯入／改版時進行；下排在每次搜尋時進行。不是重新訓練LLM。'},
  workflow:{title:'兩個工作入口與各自路徑',height:440,nodes:[
    teachingNode('a','事故調查','指定incident',30,60,'Host先固定事故，再模型工具蒐證。'),teachingNode('b','Agent / MCP','自主蒐證與RAG',340,60,'包含scope與工具budget。'),teachingNode('c','結果／可選草稿','驗證後儲存',650,60,'人員核准另走operator API。'),
    teachingNode('d','交接摘要','要求接手資訊',30,275,'Gateway直接讀當前domain資料。'),teachingNode('e','Domain → Ollama','事故／工單／班別',340,275,'這條路徑目前沒有MCP工具loop。'),teachingNode('f','摘要＋事故IDs','驗證與baseline降級',650,275,'顯示當前facts，模型失敗時用baseline。'),
  ],edges:[{from:'a',to:'b'},{from:'b',to:'c'},{from:'d',to:'e'},{from:'e',to:'f'}],note:'這兩條流程已實作；可獨立載入的技能套件與通用流程引擎仍屬後續設計。'},
  validation:{title:'例外各有不同回應',height:465,nodes:[
    teachingNode('badllm','LLM結果無效','格式／引用',30,40,'允許一次生成修正。','human'),teachingNode('fix','最多一次修正','再次驗證',340,40,'仍失敗則走明確baseline。'),teachingNode('base','offline-fallback','固定讀取與規則',650,40,'不算完整自主AI通過。','dim'),
    teachingNode('bademb','Embedding不可用','模型服務錯誤',30,190,'搜尋可以改用關鍵字。','human'),teachingNode('lex','Lexical搜尋','PostgreSQL關鍵字',340,190,'保留能取得的來源。'),teachingNode('warn','顯示模式與警告','不是完整向量驗收',650,190,'生成模型仍可用，但release gate不當完整AI。','dim'),
    teachingNode('badtoken','核准token不合格','過期／重放',30,340,'不能自動繞過核准規則。','human'),teachingNode('reject','409拒絕核准','交易未更新',340,340,'維持工單狀態。'),teachingNode('keep','保留原紀錄','不增核准audit',650,340,'與AI降級是不同種類的處理。','dim'),
  ],edges:[{from:'badllm',to:'fix'},{from:'fix',to:'base'},{from:'bademb',to:'lex'},{from:'lex',to:'warn'},{from:'badtoken',to:'reject'},{from:'reject',to:'keep'}],note:'教材可演練結果，但不執行真正模型、API或資料庫。'},
  trace:teachingFlow('同一trace ID沿著操作傳遞',[
    ['Gateway／Host','調查根span','同一調查的開始與結束。'],['MCP tool span','工具與耗時','Host注入traceparent。'],['MCP Server','domain請求span','再用HTTP header傳遞關聯。'],
    ['.NET HTTP span','API請求與回應','目前未加入Npgsql DB instrumentation。'],['Jaeger檢視','父子關係與時間','核對是否真實收到所有服務資料。'],['人員排查','找到主要耗時與錯誤','根據證據檢查，不先猜測所有問題都在模型。','human'],
  ],'Jaeger是觀測工具，業務請求不需要經過Jaeger才能繼續。這是追蹤訊號的概覽。'),
  delivery:teachingFlow('受信main版本到本機staging',[
    ['Git commit','完整SHA識別','PR只在hosted runner驗證。'],['Hosted Linux','驗證與映像建置','程式、DB、MCP與offline baseline。'],['私人GHCR','兩個SHA映像','main才發布並觸發部署。'],
    ['Windows runner','拉同版映像','外部state與持久DB/model。'],['真實AI release gate','Ollama＋RAG＋三案例','fallback不等於完整AI通過。'],['記錄成功或回復','release.json / images','失敗保留資料與前一成功版本。'],
  ],'應用部署在這臺電腦；模型留在主機。雲端提供CI與registry，不是雲端應用hosting。'),
  decision:teachingFlow('說清楚一個架構決策',[
    ['問題與限制','為什麼需要選擇','例如單機作品、易重現、需真實模型。'],['方案與理由','選擇最符合需求的做法','本機Ollama、domain與AI分工。'],['代價與驗證','如何知道選擇可用','額外HTTP、依賴與tracing；各層測試。'],
  ],'ADR留下決策的上下文；日後條件變化，可以重新評估。'),
  interview:teachingFlow('面試回答的一條線',[
    ['目的與使用者','這件工作解決什麼','先用白話講價值，不急著列框架。'],['實作與一次流程','誰做、依據什麼','沿事故資料說明元件分工。'],['證據與範圍','實際測了什麼','區分mock、offline、liveDB與liveAI。'],
    ['限制與下一步','還缺什麼、怎麼驗','誠實說skills、品質營運與人工review。','', 'human'],
  ],'先寫自己的回答，再看參考要點。自評不是能力認證。'),
};
const sequenceSpecs = {
  mcp:{title:'調查工具呼叫的泳道時序',roles:['Host','Ollama','MCP Server','.NET / DB'],messages:[
    [0,2,'1 固定讀取指定事故'],[2,3,'2 GET incident'],[3,2,'3 事故與設備ID',true],[2,0,'4 回傳範圍資料',true],
    [0,1,'5 問下一個讀取工具'],[1,0,'6 工具名與引數',true],[0,2,'7 Host驗證後 tools/call'],[2,3,'8 domain API請求'],[3,2,'9 資料結果',true],[2,0,'10 納入context',true],
  ],note:'由上往下看時間，箭頭起點是呼叫者。search_sop的embedding路徑另見RAG；此圖是一般讀取工具。'},
  approval:{title:'人工核准的泳道時序',roles:['人員 / Angular','Gateway','.NET operator','PostgreSQL'],messages:[
    [0,1,'1 明確確認並提交'],[1,2,'2 申請核准token'],[2,3,'3 存hash與60秒期限'],[3,2,'4 寫入成功',true],[2,1,'5 回傳一次性token',true],
    [1,2,'6 提交同一token'],[2,3,'7 消耗token＋核准＋audit交易'],[3,2,'8 交易結果',true],[2,1,'9 核准狀態',true],[1,0,'10 畫面更新',true],
  ],note:'token不進入瀏覽器、LLM或MCP。圖中沒有AI角色；核准屬於人員與domain交易。'},
};
function safeText(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function edgeGeometry(e,nodes) {
  const a=nodes.find(n=>n.id===e.from), b=nodes.find(n=>n.id===e.to);
  if(e.d)return {d:e.d,lx:e.lx,ly:e.ly};
  let sx,sy,ex,ey;
  if(a.y===b.y){sx=b.x>a.x?a.x+a.w:a.x;sy=a.y+a.h/2;ex=b.x>a.x?b.x:b.x+b.w;ey=sy;}
  else if(a.x===b.x){sx=a.x+a.w/2;sy=b.y>a.y?a.y+a.h:a.y;ex=sx;ey=b.y>a.y?b.y:b.y+b.h;}
  else{sx=a.x+a.w/2;sy=a.y+a.h;ex=b.x+b.w/2;ey=b.y;}
  return {d:`M ${sx} ${sy} L ${ex} ${ey}`,lx:(sx+ex)/2,ly:(sy+ey)/2-12};
}
function flowSvg(key,prefix='main',selected='') {
  const s=diagramSpecs[key]; if(!s)return '';
  const arrow='arrow-'+key+'-'+prefix;
  const edges=s.edges.map(e=>{const g=edgeGeometry(e,s.nodes);return `<path class="edge ${e.dashed?'dashed':''}" d="${g.d}" marker-end="url(#${arrow})"/>${e.label?`<text class="edge-label" x="${g.lx}" y="${g.ly}" text-anchor="middle">${safeText(e.label)}</text>`:''}`;}).join('');
  const nodes=s.nodes.map(n=>`<g class="node ${n.tone} ${n.id===selected?'selected':''}" ${key==='architecture'&&prefix!=='zoom'?`role="button" tabindex="0" data-node="${n.id}" aria-label="${safeText(n.title+'：'+n.detail)}"`:''}><rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="5"/><text x="${n.x+n.w/2}" y="${n.y+32}" text-anchor="middle">${safeText(n.title)}</text><text class="sub" x="${n.x+n.w/2}" y="${n.y+58}" text-anchor="middle">${safeText(n.sub)}</text></g>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" class="diagram-svg" viewBox="0 0 ${s.width||900} ${s.height}" role="img" aria-label="${safeText(s.title)}"><title>${safeText(s.title)}</title><desc>${safeText(s.note)}</desc><defs><marker id="${arrow}" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto"><path d="M 0 0 L 10 4 L 0 8" fill="#477d85"/></marker></defs>${edges}${nodes}</svg>`;
}
function sequenceSvg(key,prefix='main',active=-1) {
  const s=sequenceSpecs[key], arrow='seq-'+key+'-'+prefix, xs=[120,340,560,780], height=145+s.messages.length*48;
  const roles=s.roles.map((r,i)=>`<rect x="${xs[i]-98}" y="20" width="196" height="62" rx="5" fill="#172d3b"/><text x="${xs[i]}" y="58" text-anchor="middle" fill="white" font-size="18">${safeText(r)}</text><path class="lifeline" d="M ${xs[i]} 88 V ${height-25}"/>`).join('');
  const messages=s.messages.map(([from,to,label,reply],i)=>{const y=122+i*48;return `<g class="message ${i===active?'active':''}" data-message="${i}"><path class="edge ${reply?'dashed':''}" d="M ${xs[from]} ${y} H ${xs[to]}" marker-end="url(#${arrow})"/><text x="${(xs[from]+xs[to])/2}" y="${y-12}" text-anchor="middle">${safeText(label)}</text></g>`;}).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" class="diagram-svg" viewBox="0 0 900 ${height}" role="img" aria-label="${safeText(s.title)}"><title>${safeText(s.title)}</title><desc>${safeText(s.note)}</desc><defs><marker id="${arrow}" markerWidth="9" markerHeight="7" refX="8" refY="3.5" orient="auto"><path d="M 0 0 L 9 3.5 L 0 7" fill="#477d85"/></marker></defs>${roles}${messages}</svg>`;
}
function diagramHtml(key,sequence=false,prefix='main',active=-1) {
  const s=sequence?sequenceSpecs[key]:diagramSpecs[key];
  const svg=sequence?sequenceSvg(key,prefix,active):flowSvg(key,prefix);
  const reading=sequence?s.messages.map(v=>`${s.roles[v[0]]} → ${s.roles[v[1]]}：${v[2]}`):s.edges.map(e=>`${s.nodes.find(n=>n.id===e.from).title} → ${s.nodes.find(n=>n.id===e.to).title}${e.label?'（'+e.label+'）':''}`);
  return `<div class="diagram-box"><div class="diagram-scroll" tabindex="0" aria-label="流程圖；窄螢幕可左右捲動">${svg}</div><p class="diagram-note">${safeText(s.note)} 窄螢幕可左右捲動，或放大閱讀。</p></div><div class="actions"><button class="btn subtle" data-zoom="${key}" data-sequence="${sequence}">放大圖解</button></div><details><summary>看文字流程</summary><ol>${reading.map(t=>`<li>${safeText(t)}</li>`).join('')}</ol></details>`;
}
