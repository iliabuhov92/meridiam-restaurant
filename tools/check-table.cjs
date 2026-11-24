const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { mkdirSync, readFileSync, writeFileSync } = require('node:fs');
const { join, resolve } = require('node:path');
const assert = require('node:assert/strict');

const url=new URL(process.argv[2]);
const path='table-captures';
const viewport={width:1920,height:1080};
const ready='[data-scene="ready"]';
async function capture(page,name) {
  await page.screenshot({timeout:75000,path:join(path,name+'.png')});
}
function intersects(a,b) {
  return Math.min(a.right,b.right)>Math.max(a.left,b.left) &&
    Math.min(a.bottom,b.bottom)>Math.max(a.top,b.top);
}

(async()=>{
  mkdirSync(path,{recursive:true});
  const browser=await chromium.launch({
    channel:'chrome', args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']
  });
  const errors=[];
  const watch=page=>{
    page.on('pageerror',error=>errors.push(error.message));
    page.on('console',message=>{
      if(message.type()==='error' && /THREE|WebGL|3D scene|shader/i.test(message.text())) errors.push(message.text());
    });
  };
  const report={commit:url.searchParams.get('build'),browser:browser.version(),viewport,frames:{}};
  try {
    const page=await browser.newPage({viewport,deviceScaleFactor:1});
    watch(page);
    await page.goto(url.href);
    await page.locator(ready).waitFor({timeout:60000});
    const seat=page.getByRole('button',{name:'Место гостя',exact:true});
    await seat.click();
    assert.equal(await seat.getAttribute('aria-pressed'),'true');
    await page.waitForTimeout(800);
    report.overlapDesktop=await page.evaluate(()=>{
      const a=document.querySelector('canvas').getBoundingClientRect();
      const b=document.querySelector('footer').getBoundingClientRect();
      return a.bottom>b.top && a.top<b.bottom;
    });
    const pose=await page.locator('#stage').getAttribute('data-camera');
    await page.mouse.move(914,460);
    await page.mouse.wheel(0,-180);
    await page.waitForFunction(before=>document.querySelector('#stage').dataset.camera!==before,pose);
    const zoomed=await page.locator('#stage').getAttribute('data-camera');
    await page.mouse.down();
    await page.mouse.move(1012,437,{steps:5});
    await page.mouse.up();
    assert.equal(await seat.getAttribute('aria-pressed'),'false');
    await page.waitForFunction(before=>document.querySelector('#stage').dataset.camera!==before,zoomed);
    const qaUrl=new URL(url);
    qaUrl.searchParams.set('qa','1');
    await page.goto(qaUrl.href);
    await page.locator(ready).waitFor({timeout:60000});
    for(const [view,orbit,name] of [['close',0,'close'],['seat',0,'seat'],['seat',20,'orbit'],['legacy',0,'after-matched']]) {
      await page.evaluate(([v,a])=>window.meridiamTableCapture(v,a),[view,orbit]);
      await page.locator('[data-measurement]').waitFor({timeout:60000});
      report.frames[name]=JSON.parse(await page.locator('#stage').getAttribute('data-measurement'));
      await capture(page,name);
    }
    for(const name of ['seat','orbit']) {
      const frame=report.frames[name];
      for(const item of ['plate','stemware']) {
        const [x0,y0,x1,y1]=frame.items[item];
        assert.ok(x0>=0 && y0>=0 && x1<=frame.width && y1<=frame.height,
          name+' '+item+' is clipped');
      }
    }
    const seatFrame=report.frames.seat;
    const orbitFrame=report.frames.orbit;
    const bearing=frame=>Math.atan2(frame.camera[0]-frame.target[0],frame.camera[2]-frame.target[2]);
    report.orbitDegrees=(bearing(orbitFrame)-bearing(seatFrame))*180/Math.PI;
    assert.ok(Math.abs(report.orbitDegrees-20)<=1);
    if(process.env.BASELINE_DIR) {
      const baseline=new URL('https://table-baseline.invalid/table/');
      const mime={'.html':'text/html','.mjs':'text/javascript','.glb':'model/gltf-binary','.webp':'image/webp'};
      await page.route('https://table-baseline.invalid/**',async route=>{
        const pathname=new URL(route.request().url()).pathname;
        const file=resolve(process.env.BASELINE_DIR,'.'+pathname+(pathname.endsWith('/')?'index.html':''));
        const kind=file.slice(file.lastIndexOf('.'));
        try { await route.fulfill({body:readFileSync(file),contentType:mime[kind]}); }
        catch { await route.fulfill({status:404}); }
      });
      await page.goto(baseline.href);
      await page.locator(ready).waitFor({timeout:60000});
      await page.getByRole('button',{name:'Место гостя',exact:true}).click();
      await page.addStyleTag({content:'header, footer {visibility:hidden !important}'});
      await page.waitForTimeout(1000);
      await capture(page,'before-matched');
      report.baseline='17fc7971f6322ef2cc7ad11c45df66492e30b7a7';
    }
    await page.close();
    const mobile=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
    watch(mobile);
    await mobile.goto(url.href);
    await mobile.locator(ready).waitFor({timeout:60000});
    const mobileSeat=mobile.getByRole('button',{name:'Место гостя',exact:true});
    await mobileSeat.tap();
    assert.equal(await mobileSeat.getAttribute('aria-pressed'),'true');
    await mobile.waitForTimeout(800);
    const mobileLayout=await mobile.evaluate(()=>({
      canvas:document.querySelector('canvas').getBoundingClientRect().toJSON(),
      footer:document.querySelector('footer').getBoundingClientRect().toJSON(),
      width:innerWidth,scroll:document.documentElement.scrollWidth
    }));
    report.overlapMobile=intersects(mobileLayout.canvas,mobileLayout.footer);
    assert.equal(mobileLayout.width,mobileLayout.scroll);
    const mobilePose=await mobile.locator('#stage').getAttribute('data-camera');
    const session=await mobile.context().newCDPSession(mobile);
    const y=Math.round((mobileLayout.canvas.top+mobileLayout.canvas.bottom)/2);
    await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:190,y}]});
    await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:240,y:y-15}]});
    await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await mobile.waitForFunction(before=>document.querySelector('#stage').dataset.camera!==before,mobilePose);
    const orbitPose=await mobile.locator('#stage').getAttribute('data-camera');
    await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:156,y,id:0},{x:230,y,id:1}]});
    await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:125,y,id:0},{x:261,y,id:1}]});
    await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await mobile.waitForFunction(before=>document.querySelector('#stage').dataset.camera!==before,orbitPose);
    await capture(mobile,'mobile');
    assert.equal(report.overlapDesktop,false);
    assert.equal(report.overlapMobile,false);
    assert.deepEqual(errors,[]);
    console.log('Verified desktop zoom/orbit, mobile tap/swipe and controls outside the canvas.');
  } finally {
    writeFileSync(join(path,'measurements.json'),JSON.stringify({...report,errors},null,2));
    await browser.close();
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
