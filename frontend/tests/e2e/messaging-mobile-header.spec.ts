import {expect,test} from "@playwright/test";
import fs from "node:fs/promises";
import {login,MOCK_API,resetE2E} from "./helpers";

test.beforeEach(async({request,page})=>{
  await resetE2E(request);await page.routeWebSocket("**/api/v1/messaging/**",()=>{});
  await page.emulateMedia({colorScheme:"light",reducedMotion:"reduce"});
});

for(const role of ["recruiter","candidate"] as const){
  test(`${role}: Back preserves conversation list scroll, search and selected thread`,async({page,request})=>{
    const fixture=await(await request.get(`${MOCK_API}/__e2e/state`)).json();
    const threads=Array.from({length:40},(_,i)=>({...fixture.messagingThreads[0],id:`mobile-thread-${i}`,candidate_name:`Synthetic candidate ${i+1}`,recruiter_name:`Synthetic recruiter ${i+1}`,unread_recruiter:1,unread_candidate:1,updated_at:new Date(Date.now()-i*60000).toISOString()}));
    await request.post(`${MOCK_API}/__e2e/messaging`,{data:{threads}});
    await page.setViewportSize({width:390,height:844});await login(page,role);await page.goto(role==="recruiter"?"/recruiter/messages":"/candidate/inbox");
    await page.getByRole("textbox",{name:"Search conversations"}).fill("Platform");
    if(role==="recruiter")await page.getByRole("button",{name:"Unread only",exact:true}).click();
    const list=page.getByRole("complementary",{name:"Conversation list"});const scroll=list.locator(".overflow-y-auto");
    const last=list.getByRole("button").filter({has:page.getByText(`Synthetic ${role==="recruiter"?"candidate":"recruiter"} 40`,{exact:true})});
    await last.scrollIntoViewIfNeeded();const before=await scroll.evaluate(n=>n.scrollTop);expect(before).toBeGreaterThan(0);
    await last.click();const back=page.getByRole("button",{name:"Back to conversations",exact:true});await expect(back).toBeVisible();
    expect(await back.evaluate(n=>({width:n.getBoundingClientRect().width,height:n.getBoundingClientRect().height,text:n.textContent}))).toEqual({width:44,height:44,text:""});
    await back.click();await expect(page.getByRole("textbox",{name:"Search conversations"})).toHaveValue("Platform");
    if(role==="recruiter")await expect(page.getByRole("button",{name:"Unread only",exact:true})).toHaveAttribute("aria-pressed","true");
    await expect(last).toHaveAttribute("aria-current","true");
    await expect.poll(()=>scroll.evaluate(n=>n.scrollTop)).toBeCloseTo(before,0);
    await page.setViewportSize({width:1440,height:900});await expect(back).not.toBeVisible();await expect(list).toBeVisible();
  });

  test(`${role}: mobile icon-only header visual inspection`,async({page})=>{
    test.setTimeout(90000);await login(page,role);const root="visual-artifacts/messaging-mobile-header";await fs.mkdir(root,{recursive:true});
    for(const [width,height]of [[428,926],[390,844],[360,800]])for(const theme of ["light","dark","system"]){
      await page.setViewportSize({width,height});await page.evaluate(value=>localStorage.setItem("swx-theme",value),theme);await page.emulateMedia({colorScheme:theme==="light"?"light":"dark"});
      await page.goto(`${role==="recruiter"?"/recruiter/messages":"/candidate/inbox"}?thread=73000000-0000-4000-8000-000000000001`);
      const back=page.getByRole("button",{name:"Back to conversations",exact:true});await expect(back).toBeVisible();
      expect(await back.evaluate(n=>n.textContent)).toBe("");expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight+1)).toBeTruthy();
      await expect(page.getByRole("textbox",{name:"Write a reply"})).toBeVisible();
      await page.screenshot({path:`${root}/${role}-${width}-${theme}.png`,animations:"disabled"});
    }
  });
}
