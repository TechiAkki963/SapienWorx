import {expect,test,type Page,type WebSocketRoute} from "@playwright/test";
import fs from "node:fs/promises";
import {insertMessageEmoji,messageBytes} from "../../lib/message-emoji";
import {login,MOCK_API,recordedRequests,resetE2E} from "./helpers";

const thread="73000000-0000-4000-8000-000000000001";
const root="visual-artifacts/messaging-emoji";
const views=[[1440,900],[1366,768],[768,1024],[428,926],[390,844],[360,800]];
const unicode="👩🏽‍💻 Wednesday 4 PM works ✅\nThank you 🙏🏽 https://example.test/jobs 🎉";

async function open(page:Page,role:"candidate"|"recruiter"){
  await page.goto(`${role==="recruiter"?"/recruiter/messages":"/candidate/inbox"}?thread=${thread}`);
  await expect(page.getByRole("textbox",{name:"Write a reply"})).toBeVisible();
  await expect(page.getByRole("region",{name:"Message history"})).toHaveAttribute("aria-busy","false");
}
async function picker(page:Page){await page.getByRole("button",{name:"Add emoji",exact:true}).click();const dialog=page.getByRole("dialog",{name:"Add emoji",exact:true});await expect(dialog).toBeVisible();return dialog;}
async function bounds(page:Page){
  await expect.poll(()=>page.evaluate(()=>{
    const popup=document.querySelector(".swx-emoji-picker")?.getBoundingClientRect();
    const composer=document.querySelector(".swx-messaging-composer")!.getBoundingClientRect();
    return !popup || popup.bottom<=composer.top-7 || popup.top>=composer.bottom+7;
  })).toBeTruthy();
  const result=await page.evaluate(()=>{
    const popup=document.querySelector<HTMLElement>(".swx-emoji-picker");const box=popup?.getBoundingClientRect();
    return{width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight,vw:innerWidth,vh:innerHeight,
      popup:box?{left:box.left,right:box.right,top:box.top,bottom:box.bottom,width:box.width}:null,
      composer:document.querySelector(".swx-messaging-composer")!.getBoundingClientRect().bottom,
      composerTop:document.querySelector(".swx-messaging-composer")!.getBoundingClientRect().top};
  });
  expect(result.width).toBeLessThanOrEqual(result.vw+1);expect(result.height).toBeLessThanOrEqual(result.vh+1);expect(result.composer).toBeLessThanOrEqual(result.vh);
  if(result.popup){expect(result.popup.left).toBeGreaterThanOrEqual(0);expect(result.popup.right).toBeLessThanOrEqual(result.vw);expect(result.popup.top).toBeGreaterThanOrEqual(0);expect(result.popup.bottom).toBeLessThanOrEqual(result.vh);expect(result.popup.width).toBeLessThanOrEqual(320);expect(result.popup.bottom<=result.composerTop-7||result.popup.top>=result.composer+7,JSON.stringify(result)).toBeTruthy();}
}

test.beforeEach(async({request,page})=>{
  await resetE2E(request);await page.routeWebSocket("**/api/v1/messaging/**",()=>{});
  await page.emulateMedia({colorScheme:"light",reducedMotion:"reduce"});
  await page.addInitScript(()=>{if(!localStorage.getItem("swx-theme"))localStorage.setItem("swx-theme","system");});
});

test("Unicode insertion respects grapheme boundaries, selections and the existing UTF-8 byte limit",()=>{
  expect(insertMessageEmoji("",0,0,"🙂")).toEqual({value:"🙂",cursor:2});
  expect(insertMessageEmoji("Hello team",6,10,"👋🏽")).toEqual({value:"Hello 👋🏽",cursor:10});
  expect(insertMessageEmoji("First\nSecond",6,6,"✅")).toEqual({value:"First\n✅Second",cursor:7});
  expect(insertMessageEmoji("Hi 👩🏽‍💻 there",5,5,"👍")).toEqual({value:"Hi 👍👩🏽‍💻 there",cursor:5});
  expect(insertMessageEmoji("Hi 👩🏽‍💻 there",5,7,"✅")?.value).toBe("Hi ✅ there");
  expect(messageBytes("🙂")).toBe(4);expect(messageBytes("👩🏽‍💻")).toBe(15);
  expect(insertMessageEmoji("a".repeat(4996),4996,4996,"🙂")?.value).toHaveLength(4998);
  expect(insertMessageEmoji("a".repeat(4997),4997,4997,"🙂")).toBeNull();
});

for(const role of ["recruiter","candidate"] as const){
  test(`${role}: keyboard opens picker, browses emoji and restores focus`,async({page,request})=>{
    await login(page,role);await open(page,role);const input=page.getByRole("textbox",{name:"Write a reply"});const trigger=page.getByRole("button",{name:"Add emoji",exact:true});
    await input.focus();await page.keyboard.press("Tab");await expect(trigger).toBeFocused();await page.keyboard.press("Enter");
    const dialog=page.getByRole("dialog",{name:"Add emoji",exact:true});await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button",{name:"Slightly smiling face",exact:true})).toBeFocused();
    await fs.mkdir(`${root}/keyboard`,{recursive:true});await page.screenshot({path:`${root}/keyboard/${role}-focus.png`,animations:"disabled"});
    await page.keyboard.press("ArrowRight");await expect(dialog.getByRole("button",{name:"Smiling face",exact:true})).toBeFocused();
    await page.keyboard.press("End");await expect(dialog.getByRole("button",{name:"Raising hands",exact:true})).toBeFocused();await page.keyboard.press("Home");
    await page.keyboard.press("Escape");await expect(dialog).toHaveCount(0);await expect(trigger).toBeFocused();await page.keyboard.press("Space");await expect(dialog).toBeVisible();
    await dialog.getByRole("button",{name:"Smiling face",exact:true}).click();await expect(input).toHaveValue("😊");await expect(input).toBeFocused();
    expect((await recordedRequests(request)).filter(r=>r.method==="POST"&&r.path.endsWith("/messages"))).toHaveLength(0);
  });

  test(`${role}: inserts at cursor, replaces selection, remembers recent and does not auto-submit`,async({page,request})=>{
    await login(page,role);await open(page,role);const input=page.getByRole("textbox",{name:"Write a reply"});await input.fill("Wednesday 4 PM works");
    await input.evaluate(n=>(n as HTMLTextAreaElement).setSelectionRange(10,10));let dialog=await picker(page);await dialog.getByRole("button",{name:"Smiling face",exact:true}).click();await expect(input).toHaveValue("Wednesday 😊4 PM works");
    await input.evaluate(n=>(n as HTMLTextAreaElement).setSelectionRange(10,12));dialog=await picker(page);await dialog.getByRole("button",{name:"People",exact:true}).click();await dialog.getByRole("button",{name:"Thumbs up: medium skin tone",exact:true}).click();
    await expect(input).toHaveValue("Wednesday 👍🏽4 PM works");await expect(input).toBeFocused();
    dialog=await picker(page);await expect(dialog.getByRole("button",{name:"Recent",exact:true})).toHaveAttribute("aria-pressed","true");await dialog.getByRole("button",{name:"Thumbs up: medium skin tone",exact:true}).click();
    await expect(input).toHaveValue("Wednesday 👍🏽👍🏽4 PM works");await expect(input).toBeFocused();
    expect((await recordedRequests(request)).filter(r=>r.method==="POST"&&r.path.endsWith("/messages"))).toHaveLength(0);
    await page.reload();dialog=await picker(page);await expect(dialog.getByRole("button",{name:"Recent",exact:true})).toHaveAttribute("aria-pressed","true");
  });

  test(`${role}: Unicode sends, deduplicates realtime echo, persists and updates previews`,async({page,request})=>{
    let socket:WebSocketRoute|undefined;await page.routeWebSocket(`**/messaging/threads/${thread}/ws`,ws=>{socket=ws;});
    await login(page,role);await open(page,role);const input=page.getByRole("textbox",{name:"Write a reply"});await input.fill(unicode);await page.getByRole("button",{name:"Send",exact:true}).click();await expect(input).toHaveValue("");
    const state=await(await request.get(`${MOCK_API}/__e2e/state`)).json();const sent=state.messagingMessages[thread].at(-1);
    expect(sent.content).toBe(unicode);await expect.poll(()=>Boolean(socket)).toBeTruthy();socket!.send(JSON.stringify({type:"message",thread_id:thread,payload:{message:sent}}));
    await expect(page.getByRole("region",{name:"Message history"}).getByText(unicode,{exact:true})).toHaveCount(1);
    expect((await recordedRequests(request)).filter(r=>r.method==="POST"&&r.path.endsWith("/messages")).at(-1)!.body.content).toBe(unicode);
    await page.reload();await expect(page.getByRole("region",{name:"Message history"}).getByText(unicode,{exact:true})).toHaveCount(1);await expect(page.locator(".swx-thread-row").first()).toContainText("Thank you 🙏🏽");
    const incoming={...sent,id:"unicode-opposite-role",sender_type:role==="candidate"?"recruiter":"candidate",content:"Congratulations 🎉 👍🏻👍🏽👍🏿",created_at:new Date(Date.now()+1).toISOString()};
    socket!.send(JSON.stringify({type:"message",thread_id:thread,payload:{message:incoming}}));await expect(page.getByRole("region",{name:"Message history"}).getByText(incoming.content,{exact:true})).toBeVisible();await bounds(page);
  });

  for(const[width,height]of views){
    test(`${role}: emoji visual QA ${width}x${height} Light Dark System`,async({page})=>{
      test.setTimeout(120000);const errors:string[]=[];page.on("pageerror",error=>errors.push(error.message));
      await page.setViewportSize({width,height});await login(page,role);await fs.mkdir(`${root}/${width}x${height}`,{recursive:true});
      for(const theme of ["light","dark","system"]){
        await page.evaluate(mode=>localStorage.setItem("swx-theme",mode),theme);await page.emulateMedia({colorScheme:theme==="light"?"light":"dark"});await open(page,role);
        const input=page.getByRole("textbox",{name:"Write a reply"});const composer=page.locator(".swx-messaging-composer");const original=await composer.boundingBox();
        await page.screenshot({path:`${root}/${width}x${height}/${role}-${theme}-closed.png`,animations:"disabled"});
        let dialog=await picker(page);await bounds(page);expect(await composer.boundingBox()).toEqual(original);
        await expect(dialog).toHaveAttribute("aria-modal","false");await expect(dialog.getByRole("group",{name:"Emoji categories"})).toBeVisible();
        await page.screenshot({path:`${root}/${width}x${height}/${role}-${theme}-open.png`,animations:"disabled"});
        await dialog.getByRole("button",{name:"Smileys",exact:true}).click();await dialog.getByRole("button",{name:"Smiling face",exact:true}).click();await expect(input).toHaveValue("😊");await expect(input).toBeFocused();
        await page.screenshot({path:`${root}/${width}x${height}/${role}-${theme}-inserted.png`,animations:"disabled"});
        await input.fill(Array.from({length:15},()=>unicode).join("\n"));dialog=await picker(page);await dialog.getByRole("button",{name:"People",exact:true}).click();await bounds(page);
        expect((await input.boundingBox())!.height).toBeLessThanOrEqual(144);await page.screenshot({path:`${root}/${width}x${height}/${role}-${theme}-long.png`,animations:"disabled"});
        await page.keyboard.press("Escape");await expect(dialog).toHaveCount(0);await input.fill("");
      }
      expect(errors).toEqual([]);
    });
  }
}

test("outside dismissal and Tab leave the picker without an incorrect focus trap",async({page})=>{
  await login(page,"recruiter");await open(page,"recruiter");let dialog=await picker(page);await page.getByRole("heading",{name:"Messages",exact:true}).click();await expect(dialog).toHaveCount(0);
  dialog=await picker(page);await dialog.getByRole("button",{name:"Slightly smiling face",exact:true}).focus();await page.keyboard.press("Tab");await expect(dialog).toHaveCount(0);await bounds(page);
});

test("byte boundary rejects a whole emoji, preserves the draft and blocks oversize sends",async({page})=>{
  await login(page,"recruiter");await open(page,"recruiter");const input=page.getByRole("textbox",{name:"Write a reply"});await input.fill("a".repeat(4997));const dialog=await picker(page);await dialog.getByRole("button",{name:"Smiling face",exact:true}).click();await expect(dialog.getByRole("status")).toContainText("Message is full");await expect(input).toHaveValue("a".repeat(4997));
  await page.keyboard.press("Escape");await input.fill("🙂".repeat(1251));await expect(page.getByRole("button",{name:"Send",exact:true})).toBeDisabled();await expect(page.getByRole("form",{name:"Message composer"}).getByRole("alert")).toContainText("5,000-byte");
  await input.fill("a".repeat(4996));await input.evaluate(n=>{const input=n as HTMLTextAreaElement;input.setSelectionRange(input.value.length,input.value.length);});await picker(page);await page.getByRole("dialog",{name:"Add emoji",exact:true}).getByRole("button",{name:"Smileys",exact:true}).click();await page.getByRole("button",{name:"Smiling face",exact:true}).click();expect(messageBytes(await input.inputValue())).toBe(5000);
  await page.getByRole("button",{name:"Send",exact:true}).click();await expect(input).toHaveValue("");
});

test("Unicode HTML-like messages remain text; recent preferences reject unknown values",async({page})=>{
  await page.addInitScript(()=>localStorage.setItem("swx:emoji:recent:v1:recruiter:20000000-0000-4000-8000-000000000001",JSON.stringify(["<img src=x onerror=alert(1)>","not-emoji"])));
  await login(page,"recruiter");await open(page,"recruiter");const dialog=await picker(page);await expect(dialog.getByRole("button",{name:"Recent",exact:true})).toHaveCount(0);await page.keyboard.press("Escape");
  const input=page.getByRole("textbox",{name:"Write a reply"});const content="<img src=x onerror=alert(1)> 🙂";await input.fill(content);await input.press("Enter");await expect(page.getByRole("region",{name:"Message history"}).getByText(content,{exact:true})).toBeVisible();await expect(page.getByRole("region",{name:"Message history"}).locator("img")).toHaveCount(0);
});

test("Unicode history is recovered after reconnect",async({page,request})=>{
  let socket:WebSocketRoute|undefined;let connections=0;await page.routeWebSocket(`**/messaging/threads/${thread}/ws`,ws=>{socket=ws;connections++;});
  await login(page,"candidate");await open(page,"candidate");await expect.poll(()=>connections).toBe(1);
  const state=await(await request.get(`${MOCK_API}/__e2e/state`)).json();await request.post(`${MOCK_API}/__e2e/messaging`,{data:{messages:{[thread]:[...state.messagingMessages[thread],{...state.messagingMessages[thread][0],id:"recovered-emoji",content:unicode,created_at:new Date().toISOString()}]}}});
  socket!.close();await expect.poll(()=>connections,{timeout:10000}).toBeGreaterThan(1);await expect(page.getByRole("region",{name:"Message history"}).getByText(unicode,{exact:true})).toBeVisible();await bounds(page);
});

test("picker remains compact in a keyboard-sized viewport and does not steal native typing",async({page})=>{
  await page.setViewportSize({width:390,height:844});await login(page,"candidate");await open(page,"candidate");await page.setViewportSize({width:390,height:480});const dialog=await picker(page);await bounds(page);await dialog.getByRole("button",{name:"Smiling face",exact:true}).click();const input=page.getByRole("textbox",{name:"Write a reply"});await expect(input).toBeFocused();await input.press("End");await input.pressSequentially(" Thank you");await expect(input).toHaveValue("😊 Thank you");await bounds(page);
});

test("picker works when browser storage is unavailable",async({page})=>{
  await page.addInitScript(()=>{
    const get=Storage.prototype.getItem,set=Storage.prototype.setItem;
    Storage.prototype.getItem=function(key){if(key.startsWith("swx:emoji:"))throw new DOMException("Storage disabled");return get.call(this,key);};
    Storage.prototype.setItem=function(key,value){if(key.startsWith("swx:emoji:"))throw new DOMException("Storage disabled");return set.call(this,key,value);};
  });
  await login(page,"candidate");await open(page,"candidate");const dialog=await picker(page);await dialog.getByRole("button",{name:"Smiling face",exact:true}).click();await expect(page.getByRole("textbox",{name:"Write a reply"})).toHaveValue("😊");
});
