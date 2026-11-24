const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { mkdirSync } = require('node:fs');
const assert = require('node:assert/strict');

const url=process.argv[2];
if(!url) throw new Error('Pass the published table URL.');

(async()=>{
  const browser=await chromium.launch({
    channel:'chrome', args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']
  });
  try {
    const errors=[];
    const watch=page=>{
      page.on('pageerror',error=>errors.push(error.message));
      page.on('console',message=>{
        if(message.type()==='error') console.error(message.text());
      });
    };
    const page=await browser.newPage({viewport:{width:1200,height:700}});
    watch(page);
    await page.goto(url);
    await page.locator('[data-scene="ready"]').waitFor({timeout:20000});
    mkdirSync('table-captures',{recursive:true});
    await page.screenshot({timeout:60000,path:'table-captures/close.jpg'});
    const seat=page.getByRole('button',{name:'Место гостя'});
    await seat.click();
    assert.equal(await seat.getAttribute('aria-pressed'),'true');
    await page.waitForTimeout(850);
    await page.screenshot({timeout:60000,path:'table-captures/seat.jpg'});
    await page.mouse.move(610,375);
    await page.mouse.down();
    await page.mouse.move(696,358,{steps:5});
    await page.mouse.up();
    assert.equal(await seat.getAttribute('aria-pressed'),'false');
    await page.waitForTimeout(350);
    await page.screenshot({timeout:60000,path:'table-captures/orbit.jpg'});
    await page.close();
    const mobile=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
    watch(mobile);
    await mobile.goto(url);
    await mobile.locator('[data-scene="ready"]').waitFor({timeout:60000});
    assert.ok(await mobile.evaluate(()=>document.documentElement.scrollWidth===innerWidth));
    const mobileSeat=mobile.getByRole('button',{name:'Место гостя'});
    await mobileSeat.tap();
    assert.equal(await mobileSeat.getAttribute('aria-pressed'),'true');
    assert.deepEqual(errors,[]);
    console.log('Verified desktop camera presets and orbit, plus 390 px touch controls.');
  } finally {
    await browser.close();
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
