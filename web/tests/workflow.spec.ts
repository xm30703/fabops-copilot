import { test, expect } from '@playwright/test';
test('operator sees evidence and must confirm before approval (mocked API contract)',async({page})=>{
  test.skip(process.env.FABOPS_LIVE === '1', 'Use real service workflow in live mode');
  const incident={id:'INC-1001',machineId:'ETCH-07',severity:'P1',title:'真空壓力異常',description:'Pressure 85 mTorr',status:'open'};
  const run={id:'run-test',mode:'offline-baseline',traceId:'000',durationMs:150,warnings:[],evidence:[{id:'SOP#1',title:'Vacuum',content:'Notify engineer',score:.8}],events:[{tool:'search_sop',arguments:{query:'vacuum'},durationMs:20,status:'ok'}],findings:{summary:'離線流程結果',hypothesis:'未確認',steps:[{text:'Notify engineer',citations:['SOP#1']}],uncertainties:['Synthetic']},ticket:{id:'ticket-test',status:'draft'}};
  await page.route('**/api/**',async route=>{
    const path=new URL(route.request().url()).pathname;
    const data:Record<string,unknown>={'/api/health':{provider:'offline',dependencies:{domain:true,ollama:false,chatModel:false,embeddingModel:false}},'/api/incidents':[incident],'/api/machines':[{id:'ETCH-07',telemetry:{pressure:85}}],'/api/tickets':[], '/api/audit':[], '/api/investigate':run,'/api/tickets/ticket-test/approve':{status:'approved'}};
    await route.fulfill({json:data[path]??{}});
  });
  await page.goto('/');await page.getByRole('button',{name:'開始調查'}).click();
  await expect(page.locator('app-root')).toHaveAttribute('ng-version', /^21\./);
  await expect(page.getByText('離線流程結果')).toBeVisible();
  const approve=page.getByRole('button',{name:'核准模擬工單'});await expect(approve).toBeDisabled();
  await page.getByRole('checkbox').check();await expect(approve).toBeEnabled();await approve.click();
  await expect(page.getByText('模擬工單已核准')).toBeVisible();
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.screenshot({path:'../artifacts/workflow-desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:'../artifacts/workflow-mobile.png',fullPage:true});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});

test('Angular routes render search, abstention and retain handover data',async({page})=>{
  test.skip(process.env.FABOPS_LIVE === '1', 'Mock contract test');
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/api/**',async route=>{
    const path=new URL(route.request().url()).pathname;
    const query=route.request().method()==='POST'?route.request().postDataJSON()?.query:undefined;
    const data:Record<string,unknown>={
      '/api/health':{provider:'offline',dependencies:{domain:true,ollama:false,chatModel:false,embeddingModel:false}},
      '/api/incidents':[], '/api/machines':[], '/api/tickets':[], '/api/audit':[],
      '/api/search':{mode:'lexical-postgres',evidence:query==='quasar'?[]:[{id:'SOP-VAC-01#test',title:'Vacuum procedure',content:'Compare pressure readings.',score:.8}]},
      '/api/handover':{mode:'offline-baseline',summary:'INC-1001 remains open; equipment engineer review pending.',incidentIds:['INC-1001'],facts:{incidents:[{id:'INC-1001',status:'open'}]}},
    };
    await route.fulfill({json:data[path]??{}});
  });
  await page.goto('/#/knowledge');
  await expect(page.getByRole('link',{name:'知識檢索'})).toHaveAttribute('aria-current','page');
  await page.getByRole('textbox',{name:'搜尋 SOP'}).fill('vacuum differential');
  const searchPromise=page.waitForResponse(response=>response.url().endsWith('/api/search'));
  await page.getByRole('button',{name:'搜尋',exact:true}).click();
  expect((await searchPromise).request().postDataJSON()).toEqual({query:'vacuum differential'});
  await expect(page.getByText('Compare pressure readings.')).toBeVisible();
  await page.getByRole('textbox',{name:'搜尋 SOP'}).fill('quasar');
  await page.getByRole('button',{name:'搜尋',exact:true}).click();
  await expect(page.getByText('找不到符合的文件；不產生沒有依據的回答。')).toBeVisible();
  await page.getByRole('link',{name:'值班交接'}).click();
  await expect(page).toHaveURL(/#\/handover$/);
  await page.getByRole('button',{name:'產生交接摘要'}).click();
  await expect(page.locator('.handover')).toContainText('equipment engineer review pending');
  await page.getByText('核對摘要使用的原始資料').click();
  await expect(page.locator('details pre')).toContainText('open');
  await page.getByRole('link',{name:'工單與稽核'}).click();
  await expect(page.getByText('尚無工單。完成一次調查後可檢視草稿。')).toBeVisible();
  await page.getByRole('link',{name:'值班交接'}).click();
  await expect(page.locator('.handover')).toContainText('INC-1001');
  await page.reload();
  await expect(page.getByRole('heading',{name:'讓下一班接得住'})).toBeVisible();
  expect(errors).toEqual([]);
});

test('Angular clears review on another incident and recovers from API errors',async({page})=>{
  test.skip(process.env.FABOPS_LIVE === '1', 'Mock contract test');
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  let investigations=0;let approvals=0;
  const incidents=['INC-1001','INC-1002'].map(id=>({id,machineId:'ETCH-07',severity:'P1',title:id,description:'Pressure observed',status:'open'}));
  await page.route('**/api/**',async route=>{
    const path=new URL(route.request().url()).pathname;
    if(path==='/api/investigate'){
      investigations++;
      if(investigations===1){await route.fulfill({status:503,json:{detail:'Synthetic dependency unavailable'}});return;}
      await route.fulfill({json:{id:'run-test',mode:'offline-baseline',traceId:'000',durationMs:1,warnings:[],events:[],evidence:[{id:'SOP#safe',title:'SOP',content:'<img src=x onerror=alert(1)>',score:1}],findings:{summary:'Observed alarm',hypothesis:'Unconfirmed',steps:[{text:'Review SOP',citations:['SOP#safe']}],uncertainties:[]},ticket:{id:'ticket-test',status:'draft'}}});return;
    }
    if(path.endsWith('/approve'))approvals++;
    const data:Record<string,unknown>={'/api/health':{provider:'offline',dependencies:{domain:true}},'/api/incidents':incidents,'/api/machines':[], '/api/tickets':[], '/api/audit':[]};
    await route.fulfill({json:data[path]??{}});
  });
  await page.goto('/');await page.getByRole('button',{name:'開始調查'}).click();
  await expect(page.getByRole('alert')).toContainText('Synthetic dependency unavailable');
  await expect(page.getByRole('button',{name:'開始調查'})).toBeEnabled();
  await page.getByRole('button',{name:'開始調查'}).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.locator('.source')).toContainText('<img src=x onerror=alert(1)>');
  await expect(page.locator('.source img')).toHaveCount(0);
  await page.getByRole('checkbox').check();
  await page.getByRole('link',{name:'知識檢索'}).click();
  await page.getByRole('link',{name:'事故應變'}).click();
  await expect(page.getByRole('checkbox')).toBeChecked();
  await page.locator('.incident-card').filter({hasText:'INC-1002'}).click();
  await page.getByRole('button',{name:'開始調查'}).click();
  await expect(page.getByRole('checkbox')).not.toBeChecked();
  await expect(page.getByRole('button',{name:'核准模擬工單'})).toBeDisabled();
  expect(approvals).toBe(0);expect(errors).toEqual([]);
});
