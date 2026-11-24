const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { createServer } = require('node:http');
const { mkdirSync, readFileSync } = require('node:fs');
const { extname, resolve, sep } = require('node:path');
const assert = require('node:assert/strict');

const root = resolve('dist');
const mime = { '.html':'text/html', '.mjs':'text/javascript', '.glb':'model/gltf-binary' };
const server = createServer((req,res)=>{
  const pathname = new URL(req.url,'http://localhost').pathname;
  const path = resolve(root,'.'+pathname+(pathname.endsWith('/')?'index.html':''));
  if(!path.startsWith(root+sep)) { res.writeHead(404).end(); return; }
  try {
    const data = readFileSync(path);
    res.writeHead(200,{'Content-Type':mime[extname(path)] || 'application/octet-stream'}).end(data);
  } catch { res.writeHead(404).end(); }
});
(async()=>{
  await new Promise(done=>server.listen(0,'127.0.0.1',done));
  const browser=await chromium.launch({
    channel:'chrome', args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']
  });
  try {
    const url='http://127.0.0.1:'+server.address().port+'/table/';
    const errors=[];
    const watch=page=>page.on('pageerror',error=>errors.push(error.message));
    const page=await browser.newPage({viewport:{width:1320,height:760}});
    watch(page);
    await page.goto(url);
    await page.locator('[data-scene="ready"]').waitFor({timeout:20000});
    mkdirSync('table-captures',{recursive:true});
    await page.screenshot({path:'table-captures/close.jpg'});
    const seat=page.getByRole('button',{name:'Место гостя'});
    await seat.click();
    assert.equal(await seat.getAttribute('aria-pressed'),'true');
    await page.waitForTimeout(850);
    await page.screenshot({path:'table-captures/seat.jpg'});
    await page.mouse.move(610,375);
    await page.mouse.down();
    await page.mouse.move(696,358,{steps:5});
    await page.mouse.up();
    assert.equal(await seat.getAttribute('aria-pressed'),'false');
    await page.waitForTimeout(350);
    await page.screenshot({path:'table-captures/orbit.jpg'});
    const mobile=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
    watch(mobile);
    await mobile.goto(url);
    await mobile.locator('[data-scene="ready"]').waitFor({timeout:20000});
    assert.ok(await mobile.evaluate(()=>document.documentElement.scrollWidth===innerWidth));
    const mobileSeat=mobile.getByRole('button',{name:'Место гостя'});
    await mobileSeat.tap();
    assert.equal(await mobileSeat.getAttribute('aria-pressed'),'true');
    assert.deepEqual(errors,[]);
    console.log('Verified desktop camera presets and orbit, plus 390 px touch controls.');
  } finally {
    await browser.close();
  }
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>server.close());
