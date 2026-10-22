import { expect, test, type Page, type WebSocketRoute } from "@playwright/test";
import fs from "node:fs/promises";
import { login, MOCK_API, recordedRequests, resetE2E } from "./helpers";

const threadID = "73000000-0000-4000-8000-000000000001";
const secondThread = "73000000-0000-4000-8000-000000000002";
const root = "visual-artifacts/messaging-layout";
const viewports = [[1920,1080],[1440,900],[1366,768],[1024,768],[768,1024],[428,926],[390,844],[360,800]];

function message(index: number, role: "candidate" | "recruiter" = index % 2 ? "candidate" : "recruiter") {
  return { id: `history-${index}`, thread_id: threadID, sender_id: `${role}-synthetic`, sender_type: role,
    content: `Message ${index + 1}: Let's discuss the Platform Engineer opportunity and the interview timeline.`,
    is_read: true, created_at: new Date(Date.now() - (100 - index) * 60000).toISOString() };
}

async function openConversation(page: Page, role: "candidate" | "recruiter") {
  await page.goto(role === "recruiter" ? "/recruiter/messages" : "/candidate/inbox");
  if ((page.viewportSize()?.width ?? 1440) < 1024) {
    await page.getByRole("button", { name: /Senior Go Platform Engineer opportunity/ }).click();
  }
  await expect(page.getByRole("region", { name: "Message history" })).toHaveAttribute("aria-busy", "false");
  await expect(page.locator("[data-message-id]").last()).toBeVisible();
}

async function bounded(page: Page) {
  const bounds = await page.evaluate(() => {
    const composer = document.querySelector(".swx-messaging-composer")!.getBoundingClientRect();
    const pane = document.querySelector(".swx-messaging-pane")!.getBoundingClientRect();
    const history = document.querySelector(".swx-message-history")!.getBoundingClientRect();
    return { pageHeight: document.documentElement.scrollHeight, height: innerHeight, width: innerWidth,
      pageWidth: document.documentElement.scrollWidth, y: scrollY, composerBottom: composer.bottom,
      paneBottom: pane.bottom, composerTop: composer.top, historyBottom: history.bottom,
      historyHeight: history.height, position: getComputedStyle(document.querySelector(".swx-messaging-composer")!).position,
      viewportHeight:visualViewport?.height,bodyMinHeight:getComputedStyle(document.body).minHeight,
      frameHeight:document.querySelector(".swx-recruiter-frame,.candidate-frame")?.getBoundingClientRect().height };
  });
  expect(bounds.pageHeight, JSON.stringify(bounds)).toBeLessThanOrEqual(bounds.height + 1);
  expect(bounds.pageWidth).toBeLessThanOrEqual(bounds.width + 1);
  expect(bounds.y).toBe(0);
  expect(bounds.composerBottom).toBeLessThanOrEqual(bounds.height);
  expect(Math.abs(bounds.paneBottom - bounds.composerBottom)).toBeLessThanOrEqual(1);
  expect(bounds.historyBottom).toBeLessThanOrEqual(bounds.composerTop + 1);
  expect(bounds.historyHeight).toBeGreaterThan(80);
  expect(bounds.position).toBe("sticky");
}

async function atLatest(page: Page) {
  await expect.poll(() => page.getByRole("region", {name:"Message history"}).evaluate(node => Math.abs(node.scrollHeight - node.scrollTop - node.clientHeight))).toBeLessThanOrEqual(2);
}

test.beforeEach(async ({request,page}) => {
  await resetE2E(request);
  await request.post(`${MOCK_API}/__e2e/messaging`, {data:{messages:{[threadID]:Array.from({length:100},(_,i)=>message(i)),[secondThread]:[]}}});
  await page.addInitScript(() => { if (!localStorage.getItem("swx-theme")) localStorage.setItem("swx-theme", "system"); });
  await page.emulateMedia({reducedMotion:"reduce",colorScheme:"light"});
  await page.routeWebSocket("**/api/v1/messaging/**", () => {});
  await page.route("**/api/v1/recruiter/candidates/10000000-0000-4000-8000-000000000001",route=>route.fulfill({json:{user_id:"10000000-0000-4000-8000-000000000001",headline:"Platform Engineer",current_city:"Bengaluru",total_experience_months:48}}));
  await page.route("**/api/v1/recruiter/pipeline?candidate_id=10000000-0000-4000-8000-000000000001&**",route=>route.fulfill({json:{items:[{application_id:"synthetic-application",candidate_id:"10000000-0000-4000-8000-000000000001",job_title:"Senior Go Platform Engineer",stage:"interview"}],total:1,page:1,limit:10}}));
});

for (const role of ["recruiter","candidate"] as const) {
  for (const width of [1440,390]) {
    test(`${role} ${width}: long history scrolls independently; incoming and sent messages stay above composer`, async ({page,request}) => {
      let channel: WebSocketRoute | undefined;
      await page.routeWebSocket(`**/messaging/threads/${threadID}/ws`, socket => {channel=socket;});
      await page.setViewportSize({width,height:900});
      await login(page,role);await openConversation(page,role);await bounded(page);await atLatest(page);
      const header = page.locator(".swx-messaging-header");
      const composer = page.getByRole("form",{name:"Message composer"});
      const start = {header:await header.boundingBox(),composer:await composer.boundingBox()};
      const history = page.getByRole("region",{name:"Message history"});
      await history.evaluate(node => node.scrollTop=0);
      await expect(page.getByText(/^Message 1:/)).toBeVisible();
      expect(await header.boundingBox()).toEqual(start.header);expect(await composer.boundingBox()).toEqual(start.composer);
      await history.focus();await page.keyboard.press("PageDown");
      await expect.poll(()=>history.evaluate(node=>node.scrollTop)).toBeGreaterThan(0);
      await expect.poll(()=>Boolean(channel)).toBeTruthy();
      channel!.send(JSON.stringify({type:"message",thread_id:threadID,payload:{message:{...message(100,role==="recruiter"?"candidate":"recruiter"),content:"New incoming message"}}}));
      await expect(history.getByText("New incoming message",{exact:true})).toBeVisible();await atLatest(page);await bounded(page);
      const input=page.getByRole("textbox",{name:"Write a reply"});await input.fill("My reply");await input.press("Enter");
      await expect(input).toHaveValue("");await expect(history.getByText("My reply",{exact:true})).toBeVisible();await atLatest(page);await bounded(page);
      const sent=(await recordedRequests(request)).filter(r=>r.method==="POST"&&r.path.endsWith(`/threads/${threadID}/messages`));
      expect(sent).toHaveLength(1);expect(sent[0].body.content).toBe("My reply");
      expect(await composer.boundingBox()).toEqual(start.composer);
    });
  }

  test(`${role}: multiline composer is capped, preserves failed draft and resets after sending`, async ({page}) => {
    await page.setViewportSize({width:1440,height:900});await login(page,role);await openConversation(page,role);
    const input=page.getByRole("textbox",{name:"Write a reply"});const initial=await input.boundingBox();
    const composer=await page.locator(".swx-messaging-composer").boundingBox();expect(composer!.height).toBeGreaterThanOrEqual(72);expect(composer!.height).toBeLessThanOrEqual(88);
    await input.fill("First line");await input.press("Shift+Enter");await input.press("a");
    await expect(input).toHaveValue("First line\na");expect((await input.boundingBox())!.height).toBeGreaterThan(initial!.height);
    const longDraft=Array.from({length:40},(_,i)=>`Draft line ${i+1}`).join("\n");await input.fill(longDraft);
    expect((await input.boundingBox())!.height).toBeLessThanOrEqual(144);
    expect(await input.evaluate(n=>n.scrollHeight>n.clientHeight)).toBeTruthy();await bounded(page);
    await page.route(`**/messaging/threads/${threadID}/messages`,async route=>{
      if(route.request().method()==="POST")await route.fulfill({status:503,json:{error:{message:"Message service unavailable"}}});else await route.continue();
    });
    await page.getByRole("button",{name:"Send",exact:true}).click();await expect(page.getByRole("form",{name:"Message composer"}).getByRole("alert")).toContainText("Message service unavailable");await expect(input).toHaveValue(longDraft);await bounded(page);
    await page.unroute(`**/messaging/threads/${threadID}/messages`);
    await page.getByRole("button",{name:"Send",exact:true}).click();await expect(input).toHaveValue("");await expect(page.getByRole("form",{name:"Message composer"}).getByRole("alert")).toHaveCount(0);
    await expect.poll(async()=>(await input.boundingBox())!.height).toEqual(initial!.height);await atLatest(page);await bounded(page);
  });

  test(`${role}: conversation switching, empty history and mobile back remain usable`,async({page})=>{
    await page.setViewportSize({width:390,height:844});await login(page,role);await openConversation(page,role);
    await page.getByRole("button",{name:"Back to conversations",exact:true}).click();
    await page.getByRole("button",{name:/Operations leadership conversation/}).click();
    await expect(page.getByRole("region",{name:"Message history"})).toContainText("No messages yet");await bounded(page);
    await page.getByRole("textbox",{name:"Write a reply"}).fill("Starting a conversation");await page.getByRole("button",{name:"Send",exact:true}).click();
    await expect(page.getByRole("region",{name:"Message history"}).getByText("Starting a conversation")).toBeVisible();await bounded(page);
  });

  for (const [width,height] of viewports) {
    test(`${role}: visual and viewport bounds ${width}x${height}, Light Dark System`,async({page})=>{
      test.setTimeout(90000);const errors:string[]=[];page.on("pageerror",error=>errors.push(error.message));
      await page.setViewportSize({width,height});await login(page,role);await openConversation(page,role);
      await fs.mkdir(`${root}/${width}x${height}`,{recursive:true});
      for(const theme of ["light","dark","system"]){
        // Storage is the same persisted preference used by the Appearance controls.
        await page.evaluate(value=>localStorage.setItem("swx-theme",value),theme);
        await page.emulateMedia({colorScheme:theme==="system"?"dark":theme as "light"|"dark"});
        await page.reload();
        if(width<1024)await page.getByRole("button",{name:/Senior Go Platform Engineer opportunity/}).click();
        await expect(page.locator("[data-message-id]").last()).toBeVisible();await bounded(page);await atLatest(page);
        await expect(page.locator("html")).toHaveAttribute("data-theme",theme);
        if(theme==="light")await expect(page.locator("html")).not.toHaveClass(/swx-dark/);else await expect(page.locator("html")).toHaveClass(/swx-dark/);
        await page.screenshot({path:`${root}/${width}x${height}/${role}-${theme}.png`,animations:"disabled"});
      }
      expect(errors).toEqual([]);
    });
  }
}

test("candidate context stays reachable with keyboard, without moving the composer",async({page})=>{
  await page.setViewportSize({width:1024,height:768});await login(page,"recruiter");await openConversation(page,"recruiter");
  const trigger=page.getByRole("button",{name:"Candidate context",exact:true});const initial=await page.locator(".swx-messaging-composer").boundingBox();
  await trigger.focus();await page.keyboard.press("Enter");const dialog=page.getByRole("dialog",{name:"Candidate context",exact:true});await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("link",{name:"View profile",exact:true})).toBeVisible();
  await page.keyboard.press("Shift+Tab");expect(await dialog.evaluate(n=>n.contains(document.activeElement))).toBeTruthy();
  await page.keyboard.press("Escape");await expect(dialog).not.toBeVisible();await expect(trigger).toBeFocused();
  expect(await page.locator(".swx-messaging-composer").boundingBox()).toEqual(initial);await bounded(page);
});

for(const role of ["candidate","recruiter"] as const) test(`${role}: mobile keyboard-sized viewport keeps reply and Send visible`,async({page})=>{
  await page.setViewportSize({width:390,height:844});await login(page,role);await openConversation(page,role);
  await page.getByRole("textbox",{name:"Write a reply"}).focus();await page.setViewportSize({width:390,height:480});
  // CDP can report innerHeight before Chromium updates viewport units/layout.
  // Wait for that browser recalculation, then retain every strict bounds check.
  const frame=page.locator(".swx-recruiter-frame,.candidate-frame");
  await expect.poll(()=>frame.evaluate(n=>n.getBoundingClientRect().height)).toBeLessThanOrEqual(480);
  await bounded(page);await page.getByRole("textbox",{name:"Write a reply"}).fill("Keyboard remains usable");
  await page.getByRole("button",{name:"Send",exact:true}).click();await expect(page.getByRole("textbox",{name:"Write a reply"})).toHaveValue("");await bounded(page);
  await page.setViewportSize({width:390,height:844});
  await expect.poll(()=>frame.evaluate(n=>n.getBoundingClientRect().height)).toBe(844);
  await bounded(page);
});

test("desktop context can collapse and re-open without covering the composer",async({page})=>{
  await page.setViewportSize({width:1920,height:1080});await login(page,"recruiter");await openConversation(page,"recruiter");
  const context=page.getByRole("region",{name:"Candidate conversation context"});await expect(context).toContainText("Platform Engineer");
  const before=(await page.locator(".swx-messaging-pane").boundingBox())!.width;
  await page.getByRole("button",{name:"Hide context",exact:true}).click();await expect(context).toHaveCount(0);
  expect((await page.locator(".swx-messaging-pane").boundingBox())!.width).toBeGreaterThan(before);await bounded(page);
  await page.getByRole("button",{name:"Show context",exact:true}).click();await expect(context).toContainText("Platform Engineer");await bounded(page);
});

test("a long conversation list scrolls independently; search and unread filtering still work",async({page,request})=>{
  const fixture=await(await request.get(`${MOCK_API}/__e2e/state`)).json();
  await request.post(`${MOCK_API}/__e2e/messaging`,{data:{threads:Array.from({length:40},(_,i)=>({...fixture.messagingThreads[0],id:i===0?threadID:`synthetic-thread-${i}`,candidate_name:`Synthetic candidate ${i+1}`,unread_recruiter:i%2,updated_at:new Date(Date.now()-i*60000).toISOString()}))}});
  await page.setViewportSize({width:1440,height:900});await login(page,"recruiter");await openConversation(page,"recruiter");
  const list=page.getByRole("complementary",{name:"Conversation list"});const scroll=list.locator(".overflow-y-auto");
  expect(await scroll.evaluate(n=>n.scrollHeight>n.clientHeight)).toBeTruthy();await scroll.evaluate(n=>n.scrollTop=n.scrollHeight);await bounded(page);
  await page.getByRole("textbox",{name:"Search conversations"}).fill("Synthetic candidate 40");await expect(list.getByRole("button",{name:/Synthetic candidate/})).toHaveCount(1);
  await page.getByRole("button",{name:"Unread only",exact:true}).click();await expect(list.getByRole("button",{name:/Synthetic candidate 40/})).toBeVisible();await bounded(page);
  await page.getByRole("textbox",{name:"Search conversations"}).fill("No such conversation");await expect(list).toContainText("No unread conversations match your search.");await bounded(page);
});

test("System appearance follows OS changes live; leaving Messages restores the normal page shell",async({page})=>{
  await page.setViewportSize({width:1440,height:900});await login(page,"recruiter");await openConversation(page,"recruiter");
  await page.emulateMedia({colorScheme:"dark"});await expect(page.locator("html")).toHaveClass(/swx-dark/);await bounded(page);
  await page.emulateMedia({colorScheme:"light"});await expect(page.locator("html")).not.toHaveClass(/swx-dark/);await bounded(page);
  await page.getByRole("link",{name:"Jobs",exact:true}).first().click();await expect(page).toHaveURL(/\/recruiter\/jobs$/);
  await expect(page.locator(".swx-messaging-workspace")).toHaveCount(0);await expect(page.locator(".swx-recruiter-frame")).toHaveCSS("overflow","visible");
});
