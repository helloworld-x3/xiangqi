'use strict';
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const http=require('node:http');
const fs=require('node:fs/promises');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml'};
const server=http.createServer(async(req,res)=>{
  try{
    const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname==='/'
      ?'/index.html':new URL(req.url,'http://localhost').pathname));
    if(!file.startsWith(root+path.sep))throw Error('forbidden');
    const content=await fs.readFile(file);
    res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});
    res.end(content);
  }catch(e){res.writeHead(404);res.end();}
});
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const browser=await chromium.launch();
  const errors=[];
  try{
    const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
    page.on('pageerror',e=>errors.push(e.message));
    const url='http://127.0.0.1:'+server.address().port;
    const at=label=>page.locator('#board button').and(page.getByRole('button',{name:new RegExp('^'+label+'，')}));
    await page.goto(url);
    assert.equal(await page.locator('#board button').count(),90);
    await page.getByRole('heading',{name:'红方先行'}).waitFor();
    await at('A4').click();
    assert(await page.locator('.square.legal').count()>0);
    await at('A5').click();
    await page.getByRole('heading',{name:'黑方走棋'}).waitFor();
    await page.reload();
    await page.getByRole('heading',{name:'黑方走棋'}).waitFor();
    assert.equal(await page.locator('#moves li').count(),1);
    await page.getByRole('button',{name:'悔棋',exact:false}).click();
    await page.getByRole('heading',{name:'红方先行'}).waitFor();
    await page.getByRole('button',{name:'翻转',exact:false}).click();
    assert((await page.locator('#top-player').innerText()).includes('红方'));
    await page.getByRole('button',{name:'设置',exact:false}).click();
    await page.getByRole('switch',{name:'面对面模式',exact:false}).check();
    await page.getByRole('switch',{name:'落子音效',exact:false}).uncheck();
    await page.getByRole('switch',{name:'走子提示',exact:false}).uncheck();
    await page.getByRole('button',{name:'关闭设置'}).click();
    assert(await page.locator('.facing-away').count()>0);
    await at('A4').click();
    assert.equal(await page.locator('.square.legal').count(),0);
    await at('A5').click();
    await page.getByRole('heading',{name:'黑方走棋'}).waitFor();
    await page.getByRole('button',{name:'新对局',exact:false}).click();
    await page.getByRole('button',{name:'继续本局'}).click();
    await page.getByRole('heading',{name:'黑方走棋'}).waitFor();
    await page.getByRole('button',{name:'新对局',exact:false}).click();
    await page.getByRole('button',{name:'开始新局'}).click();
    await page.getByRole('heading',{name:'红方先行'}).waitFor();
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await fs.mkdir(path.join(root,'test-results'),{recursive:true});
    await page.screenshot({path:path.join(root,'test-results/android-mobile.png'),fullPage:true});
    await page.setViewportSize({width:1366,height:900});
    await page.screenshot({path:path.join(root,'test-results/desktop.png'),fullPage:true});
    await page.evaluate(()=>localStorage.setItem('xiangqi:game:v2','invalid JSON'));
    await page.reload();
    await page.getByRole('heading',{name:'红方先行'}).waitFor();
    assert((await page.locator('#notice').innerText()).includes('存档不可用'));
    assert.deepEqual(errors,[]);
    console.log('Browser smoke passed: touch moves, reload/restore, undo, flip, face-to-face, hints, settings, restart, corrupt save, responsive overflow.');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>server.close());
