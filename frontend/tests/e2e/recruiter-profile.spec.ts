import {expect,test,type Page} from "@playwright/test";
import fs from "node:fs/promises";
import {login,MOCK_API,recordedRequests,resetE2E} from "./helpers";

const dialog=(page:Page)=>page.getByRole("dialog",{name:"Your recruiter profile",exact:true});
async function openProfile(page:Page) {
  if((page.viewportSize()?.width??1440)>=1024)await page.locator("#recruiter-desktop-nav").getByRole("button",{name:"My profile",exact:true}).click();
  else {await page.getByRole("button",{name:"More",exact:true}).click();await page.getByRole("dialog",{name:"More recruiter tools",exact:true}).getByRole("button",{name:"My profile",exact:true}).click();}
  await expect(dialog(page)).toBeVisible();
}
test.beforeEach(async({request,page})=>{await resetE2E(request);await page.emulateMedia({reducedMotion:"reduce",colorScheme:"light"});});

for(const width of [1366,390]) {
  test(`profile trigger waits for hydration and retains the open request ${width}`,async({page})=>{
    await page.setViewportSize({width,height:800});await login(page,"recruiter");
    let release!:()=>void;const ready=new Promise<void>(resolve=>{release=resolve});
    await page.route("**/_next/static/**",async route=>{if(route.request().resourceType()==="script")await ready;await route.continue()});
    const trigger=width>=1024?page.locator("#recruiter-desktop-nav").getByRole("button",{name:"My profile",exact:true}):page.getByRole("button",{name:"More",exact:true});
    try{await page.reload({waitUntil:"commit"});await expect(trigger).toBeVisible();await expect(trigger).toBeDisabled()}finally{release()}
    await expect(trigger).toBeEnabled();await trigger.click();
    if(width<1024)await page.getByRole("dialog",{name:"More recruiter tools",exact:true}).getByRole("button",{name:"My profile",exact:true}).click();
    await expect(dialog(page)).toBeVisible();await expect(dialog(page).getByRole("heading",{name:"Riya Recruiter",exact:true})).toBeVisible();
    await page.keyboard.press("Escape");await expect(dialog(page)).toBeHidden();await expect(trigger).toBeFocused();
  });
}

test("professional identity, account fields and keyboard dismissal",async({page,request})=>{
  await login(page,"recruiter");await openProfile(page);const panel=dialog(page);
  await expect(panel.getByRole("heading",{name:"Riya Recruiter",exact:true})).toBeVisible();
  await expect(panel.getByRole("region",{name:"Recruiter identity"})).toContainText("Recruitment Specialist");
  await expect(panel.getByRole("img",{name:"Verified work email"})).toBeVisible();
  await expect(panel).toContainText("recruiter@example.com");await expect(panel).toContainText("Bengaluru, India");
  await expect(panel.getByRole("button",{name:"Close Your recruiter profile",exact:true})).toBeFocused();
  await page.keyboard.press("Shift+Tab");await expect(panel.getByRole("button",{name:"Close",exact:true})).toBeFocused();
  await page.keyboard.press("Tab");await expect(panel.getByRole("button",{name:"Close Your recruiter profile",exact:true})).toBeFocused();
  await panel.getByRole("button",{name:"Edit details"}).click();await expect(panel.getByRole("textbox",{name:"Full name",exact:true})).toBeFocused();
  await expect(panel.getByRole("textbox",{name:"Work email",exact:true})).toHaveCount(0);await expect(panel.getByRole("textbox",{name:"Company",exact:true})).toHaveCount(0);
  await panel.getByRole("button",{name:"Cancel",exact:true}).click();await page.keyboard.press("Escape");
  await expect(panel).toBeHidden();await expect(page.locator("#recruiter-desktop-nav").getByRole("button",{name:"My profile",exact:true})).toBeFocused();
  expect((await recordedRequests(request)).filter(item=>item.method==="PATCH"&&item.path==="/api/v1/recruiter/profile")).toHaveLength(0);
});

test("account menu focus returns and missing optional fields remain editable",async({page,request})=>{
  await request.post(`${MOCK_API}/__e2e/workspace`,{data:{recruiter_profile:{designation:"",work_phone:"",location:"",expertise:[],bio:"",work_email_verified:false}}});
  await login(page,"recruiter");await page.getByLabel(/Account menu for/).click();const trigger=page.getByRole("button",{name:"My profile & photo",exact:true});await trigger.click();const panel=dialog(page);
  await expect(panel.getByRole("heading",{name:"Riya Recruiter",exact:true})).toBeVisible();await expect(panel.getByRole("img",{name:"Verified work email"})).toHaveCount(0);
  await expect(panel.getByText("Not added",{exact:true})).toHaveCount(5);
  await panel.getByRole("button",{name:"Edit details"}).click();await panel.getByRole("button",{name:"Cancel",exact:true}).click();await expect(panel.getByRole("button",{name:"Edit details"})).toBeFocused();
  await page.keyboard.press("Escape");await expect(trigger).toBeFocused();
});

test("edits persist and the PATCH contains only professional identity fields",async({page,request})=>{
  await login(page,"recruiter");await openProfile(page);const panel=dialog(page);await panel.getByRole("button",{name:"Edit details"}).click();
  await panel.getByRole("textbox",{name:"Full name",exact:true}).fill("José Recruiter");
  await panel.getByRole("textbox",{name:"Designation",exact:true}).fill("Senior Recruitment Specialist");
  await panel.getByRole("textbox",{name:"Work phone",exact:true}).fill("+919222220002");
  await panel.getByRole("textbox",{name:"Location",exact:true}).fill("Mumbai, India");
  await panel.getByRole("textbox",{name:"Areas of expertise",exact:true}).fill("Engineering, Hiring");
  await panel.getByRole("textbox",{name:"Bio",exact:true}).fill("People first ✅\nEngineering hiring");
  await panel.getByRole("button",{name:"Save changes",exact:true}).click();await expect(panel.getByRole("status")).toHaveText("Profile details updated.");
  await expect(panel.getByRole("button",{name:"Edit details"})).toBeFocused();
  const patch=(await recordedRequests(request)).find(item=>item.method==="PATCH"&&item.path==="/api/v1/recruiter/profile")!;
  expect(Object.keys(patch.body).sort()).toEqual(["bio","designation","expected_updated_at","expertise","full_name","location","work_phone"]);
  expect(patch.body.work_phone).toBe("+919222220002");
  await panel.getByRole("button",{name:"Close",exact:true}).click();await page.reload();await openProfile(page);
  await expect(panel.getByRole("heading",{name:"José Recruiter",exact:true})).toBeVisible();await expect(panel).toContainText("Mumbai, India");await expect(panel).toContainText("People first ✅");
});

test("Cancel, Keep editing and Discard preserve saved identity",async({page,request})=>{
  await login(page,"recruiter");await openProfile(page);const panel=dialog(page);await panel.getByRole("button",{name:"Edit details"}).click();
  await panel.getByRole("textbox",{name:"Location",exact:true}).fill("Unsaved location");await page.keyboard.press("Escape");
  await expect(panel.getByRole("alert")).toContainText("Discard your unsaved changes?");await panel.getByRole("button",{name:"Keep editing"}).click();
  await expect(panel.getByRole("textbox",{name:"Location",exact:true})).toHaveValue("Unsaved location");
  await panel.getByRole("button",{name:"Cancel",exact:true}).click();await expect(panel).not.toContainText("Unsaved location");
  await panel.getByRole("button",{name:"Edit details"}).click();await panel.getByRole("textbox",{name:"Location",exact:true}).fill("Another unsaved location");
  await panel.getByRole("button",{name:"Close Your recruiter profile",exact:true}).click();await panel.getByRole("button",{name:"Discard changes"}).click();
  await openProfile(page);await expect(panel).toContainText("Bengaluru, India");
  expect((await recordedRequests(request)).filter(item=>item.method==="PATCH"&&item.path==="/api/v1/recruiter/profile")).toHaveLength(0);
});

test("load retry, failed save and concurrent edit conflict are recoverable",async({page,request})=>{
  await request.post(`${MOCK_API}/__e2e/workspace`,{data:{fail:{recruiter_profile_get:true}}});await login(page,"recruiter");await openProfile(page);const panel=dialog(page);
  await expect(panel.getByRole("alert")).toContainText("Profile service unavailable");
  await request.post(`${MOCK_API}/__e2e/workspace`,{data:{fail:{recruiter_profile_get:false}}});await panel.getByRole("button",{name:"Try again"}).click();
  await panel.getByRole("button",{name:"Edit details"}).click();await panel.getByRole("textbox",{name:"Designation",exact:true}).fill("Retained draft");
  await request.post(`${MOCK_API}/__e2e/workspace`,{data:{fail:{recruiter_profile_patch:true}}});await panel.getByRole("button",{name:"Save changes"}).click();
  await expect(panel.getByRole("alert")).toBeFocused();await expect(panel.getByRole("textbox",{name:"Designation",exact:true})).toHaveValue("Retained draft");
  await request.post(`${MOCK_API}/__e2e/workspace`,{data:{fail:{recruiter_profile_patch:false},recruiter_profile:{updated_at:"2026-10-15T10:00:00Z",designation:"Changed elsewhere"}}});
  await panel.getByRole("button",{name:"Save changes"}).click();await expect(panel.getByRole("alert")).toContainText("another session");await expect(panel.getByRole("button",{name:"Save changes"})).toBeDisabled();
  await panel.getByRole("button",{name:"Cancel",exact:true}).click();await panel.getByRole("button",{name:"Close",exact:true}).click();await openProfile(page);await expect(panel.getByRole("region",{name:"Recruiter identity"})).toContainText("Changed elsewhere");
});

test("invalid phone and expertise cannot save; HTML-looking bio remains text",async({page,request})=>{
  await login(page,"recruiter");await openProfile(page);const panel=dialog(page);await panel.getByRole("button",{name:"Edit details"}).click();
  await panel.getByRole("textbox",{name:"Work phone",exact:true}).fill("123");await panel.getByRole("button",{name:"Save changes"}).click();
  expect(await panel.getByRole("textbox",{name:"Work phone",exact:true}).evaluate((node:HTMLInputElement)=>node.validity.valid)).toBe(false);
  await panel.getByRole("textbox",{name:"Work phone",exact:true}).fill("");await panel.getByRole("textbox",{name:"Areas of expertise",exact:true}).fill(Array.from({length:13},(_,i)=>`Area ${i}`).join(", "));
  await panel.getByRole("button",{name:"Save changes"}).click();await expect(panel.getByRole("alert")).toContainText("up to 12");
  expect((await recordedRequests(request)).filter(item=>item.method==="PATCH"&&item.path==="/api/v1/recruiter/profile")).toHaveLength(0);
  await panel.getByRole("textbox",{name:"Areas of expertise",exact:true}).fill("");await panel.getByRole("textbox",{name:"Bio",exact:true}).fill('<script>window.profileXss = true</script>');
  await panel.getByRole("button",{name:"Save changes"}).click();await expect(panel.getByRole("status")).toHaveText("Profile details updated.");
  await expect(panel).toContainText('<script>window.profileXss = true</script>');expect(await page.evaluate(()=>"profileXss" in window)).toBe(false);
});

test("photo control validates files, reports upload failure and saves a valid photo",async({page})=>{
  await login(page,"recruiter");await openProfile(page);const panel=dialog(page);const file=panel.getByLabel("Profile photo file",{exact:true});
  await file.setInputFiles({name:"photo.txt",mimeType:"text/plain",buffer:Buffer.from("not an image")});await expect(panel.getByRole("status")).toContainText("JPEG, PNG or WebP");
  const png=Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6i28AAAAASUVORK5CYII=","base64");
  await page.route("**/api/v1/users/profile-image",route=>route.fulfill({status:502,json:{error:{message:"Could not save your profile image."}}}));
  await file.setInputFiles({name:"photo.png",mimeType:"image/png",buffer:png});await expect(panel.getByRole("status")).toContainText("Could not save");
  await page.unroute("**/api/v1/users/profile-image");
  await page.route("**/api/v1/users/profile-image**",route=>route.request().method()==="POST"?route.fulfill({json:{profile_image_url:"/api/v1/users/profile-image?version=synthetic-test",size_bytes:160,content_type:"image/webp"}}):route.fulfill({contentType:"image/png",body:png}));
  await file.setInputFiles({name:"photo.png",mimeType:"image/png",buffer:png});await expect(panel.getByRole("status")).toContainText("Profile photo updated.");
  await expect(panel.getByRole("img",{name:"Riya Recruiter profile photo",exact:true})).toBeVisible();
  await panel.getByRole("button",{name:"Close",exact:true}).click();await expect(panel).toBeHidden();
});

for(const [width,height] of [[1920,1080],[1440,900],[1366,768],[1024,768],[768,1024],[428,926],[390,844],[360,800]]){
  test(`profile view/edit responsive appearance ${width}x${height}`,async({page,request})=>{
    test.setTimeout(90000);const root="visual-artifacts/recruiter-profile";await fs.mkdir(root,{recursive:true});
    await request.post(`${MOCK_API}/__e2e/workspace`,{data:{recruiter_profile:{full_name:"recruiter_1 — Synthetic QA Aster"}}});
    await page.setViewportSize({width,height});await login(page,"recruiter");const exceptions:string[]=[];page.on("pageerror",error=>exceptions.push(error.message));
    for(const theme of ["light","dark","system"]){
      await page.evaluate(value=>localStorage.setItem("swx-theme",value),theme);await page.emulateMedia({colorScheme:theme==="light"?"light":"dark"});await page.reload();
      await openProfile(page);const panel=dialog(page);await expect(panel.getByRole("heading",{name:"recruiter_1 — Synthetic QA Aster",exact:true})).toBeVisible();
      expect(await panel.evaluate(node=>node.scrollWidth<=node.clientWidth+1)).toBe(true);
      expect(await panel.getByRole("heading",{name:"recruiter_1 — Synthetic QA Aster",exact:true}).evaluate(node=>getComputedStyle(node).textOverflow)).not.toBe("ellipsis");
      const close=panel.getByRole("button",{name:"Close",exact:true});await expect(close).toBeInViewport();
      await page.screenshot({path:`${root}/${width}x${height}-${theme}-view.png`,animations:"disabled"});
      await panel.getByRole("button",{name:"Edit details"}).click();await expect(panel.getByRole("textbox",{name:"Full name",exact:true})).toBeFocused();
      await expect(panel.getByRole("button",{name:"Save changes"})).toBeInViewport();
      expect(await panel.evaluate(node=>node.scrollWidth<=node.clientWidth+1)).toBe(true);
      await page.screenshot({path:`${root}/${width}x${height}-${theme}-edit.png`,animations:"disabled"});
      await panel.getByRole("button",{name:"Cancel",exact:true}).click();await close.click();
    }
    expect(exceptions).toEqual([]);
  });
}
