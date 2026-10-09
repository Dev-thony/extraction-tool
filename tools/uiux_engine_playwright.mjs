import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const root = process.env.UIUX_ROOT || process.cwd();
const out = path.join(root, '.uiux-reports', 'visual');
fs.mkdirSync(out, { recursive: true });
const base = process.env.UIUX_BASE_URL || 'http://localhost:3000';
const viewports = [
  [320,800],[375,812],[390,844],[414,896],[768,1024],[820,1180],
  [1024,768],[1280,720],[1440,900],[1920,1080]
];
const paths = ['/', '/records', '/batches'];
const extractor = process.env.UIUX_EXTRACTOR_URL || base;
const admin = process.env.UIUX_ADMIN_URL || 'http://localhost:3001';
const adminPaths = process.env.UIUX_SKIP_ADMIN === '1' ? [] : ['/login','/','/records','/batches'];
const results=[];

async function loginIfPossible(page) {
  const email = process.env.UIUX_ADMIN_EMAIL || process.env.ADMIN_EMAIL;
  const password = process.env.UIUX_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD;
  if (!email || !password) return false;
  const emailInput = page.locator('input[type="email"], input[name="email"]').first();
  const passInput = page.locator('input[type="password"], input[name="password"]').first();
  if (await emailInput.count() && await passInput.count()) {
    await emailInput.fill(email); await passInput.fill(password);
    await page.locator('button[type="submit"]').first().click();
    await page.waitForLoadState('networkidle').catch(()=>{});
    return true;
  }
  return false;
}

async function testPage(browser, baseUrl, route, w, h, needsLogin=false) {
  const context=await browser.newContext({ viewport:{width:w,height:h}, deviceScaleFactor:1 });
  const page=await context.newPage();
  const consoleErrors=[]; const failed=[];
  page.on('console', m => { if (m.type()==='error') consoleErrors.push(m.text()); });
  page.on('requestfailed', r => failed.push(r.url()));
  const started=Date.now();
  let error=null;
  try {
    await page.goto(baseUrl+route,{waitUntil:'networkidle',timeout:30000});
    if (needsLogin && route !== '/login') {
      const logged = await loginIfPossible(page);
      if (logged) await page.goto(baseUrl+route,{waitUntil:'networkidle',timeout:30000});
    }
    await page.screenshot({path:path.join(out, `${safe(route)}-${w}x${h}.png`), fullPage:true});
    const metrics=await page.evaluate(() => {
      const els=[...document.querySelectorAll('body *')];
      const outside=[];
      for (const el of els) {
        const r=el.getBoundingClientRect();
        if (r.width>0 && (r.right > innerWidth+2 || r.left < -2)) outside.push({tag:el.tagName,cls:typeof el.className==='string'?el.className:'',left:r.left,right:r.right,width:r.width});
      }
      const small=[];
      for (const el of els) {
        if (!(el instanceof HTMLElement)) continue;
        if (!['A','BUTTON','INPUT','SELECT','TEXTAREA','SUMMARY'].includes(el.tagName)) continue;
        const r=el.getBoundingClientRect();
        if (r.width>0 && (r.width<24 || r.height<24)) small.push({tag:el.tagName,text:(el.innerText||el.getAttribute('aria-label')||'').trim().slice(0,80),width:r.width,height:r.height});
      }
      return {scrollWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth,overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1,outside:outside.slice(0,25),small:small.slice(0,25)};
    });
    results.push({route,width:w,height:h,durationMs:Date.now()-started,consoleErrors,failed,metrics});
  } catch(e) { error=String(e); results.push({route,width:w,height:h,error,consoleErrors,failed}); }
  await context.close();
}
function safe(s){return s.replace(/[^a-z0-9]+/gi,'-').replace(/^-|-$/g,'')||'home';}

const browser=await chromium.launch({headless:true});
for (const [w,h] of viewports) {
  for (const r of paths) await testPage(browser,extractor,r,w,h,false);
  for (const r of adminPaths) await testPage(browser,admin,r,w,h,r !== '/login');
}
await browser.close();
const summary={generatedAt:new Date().toISOString(),base,results};
fs.writeFileSync(path.join(out,'summary.json'),JSON.stringify(summary,null,2));
const bad=results.filter(x=>x.error || x.metrics?.overflow || x.consoleErrors?.length || x.failed?.length);
console.log(`Visual audit complete: ${results.length} checks, ${bad.length} flagged. Reports: .uiux-reports/visual`);
process.exit(bad.length ? 2 : 0);
