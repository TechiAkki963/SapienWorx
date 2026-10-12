import {expect,test} from "@playwright/test";
import {login,resetE2E} from "./helpers";
const mock=`http://127.0.0.1:${process.env.E2E_MOCK_API_PORT||"18080"}`;
test.beforeEach(async({request})=>resetE2E(request));
test("Offer Studio preserves published templates when an editor saves a newer draft",async({page,request})=>{
 await login(page,"recruiter");await page.goto("/recruiter/offers/templates");await page.getByRole("link",{name:"Create template",exact:true}).click();
 await page.getByLabel("Template name",{exact:true}).fill("Engineering employment");await page.getByRole("button",{name:"Publish new version"}).click();
 await expect(page).toHaveURL(/\/offers\/templates$/);await expect(page.getByText("Version 1 · published",{exact:false})).toBeVisible();
 await page.getByRole("link",{name:"Edit new version"}).click();await page.getByLabel("Letter introduction").fill("New draft terms awaiting company review.");await page.getByRole("button",{name:"Save draft version"}).click();
 await expect(page.getByText("Version 2 · draft",{exact:false})).toBeVisible();await expect(page.getByText("Version 1 · published",{exact:false})).toBeVisible();
 await page.goto("/recruiter/offers/new");await page.getByLabel("Eligible application").selectOption("70000000-0000-4000-8000-000000000002");await page.getByRole("button",{name:"Continue",exact:true}).click();
 await expect(page.getByRole("combobox",{name:"Template",exact:true}).locator("option")).toContainText(["Basic employment offer","Engineering employment · Version 1"]);
 const ledger=await (await request.get(mock+"/__e2e/requests")).json();const saves=ledger.items.filter((r:{path:string;method:string})=>r.path.includes("offer-templates")&&r.method==="POST");expect(saves).toHaveLength(2);expect(saves[1].body.expected_version).toBe(1);expect(saves[0].body.command_key).toBeTruthy();
});
test("Offer composer saves exact decimal inputs and sending remains a separate governed action",async({page,request})=>{
 await login(page,"recruiter");await page.goto("/recruiter/offers/new?application_id=70000000-0000-4000-8000-000000000002");
 await page.getByRole("button",{name:"Continue",exact:true}).click();await page.getByRole("button",{name:"Continue",exact:true}).click();
 await page.getByLabel("Annual compensation",{exact:false}).fill("1234567.89");await page.getByLabel("Joining date",{exact:true}).fill("2027-01-15");await page.getByLabel("Offer valid until").fill("2026-12-31");
 await page.getByRole("button",{name:"Continue",exact:true}).click();await page.getByRole("button",{name:"Continue",exact:true}).click();await page.getByRole("button",{name:"Save private draft"}).click();
 await expect(page).toHaveURL(/\/recruiter\/offers\/[^/?]+$/);await expect(page.getByRole("button",{name:"Submit for review"})).toBeVisible();await expect(page.getByRole("button",{name:"Send offer",exact:true})).toHaveCount(0);await expect(page.getByRole("button",{name:"Accept offer",exact:true})).toHaveCount(0);
 await page.getByRole("button",{name:"Submit for review"}).click();await page.getByRole("dialog").getByRole("button",{name:"Confirm",exact:false}).click();
 await expect(page.getByRole("button",{name:"Send offer",exact:true})).toBeVisible();
 const ledger=await (await request.get(mock+"/__e2e/requests")).json();const save=ledger.items.find((r:{path:string;method:string})=>r.path==="/api/v1/recruiter/offers"&&r.method==="POST");expect(save.body.values.annual_compensation).toBe("1234567.89");expect(save.body.command_key).toBeTruthy();
});
test("Candidate response binds the displayed immutable version and explicit acknowledgement",async({page,request})=>{
 await login(page,"candidate");await page.goto("/candidate/offers");await page.getByRole("link",{name:"Review your offer",exact:true}).click();
 const accept=page.getByRole("button",{name:"Accept offer",exact:true});await expect(accept).toBeEnabled();await accept.click();
 const dialog=page.getByRole("dialog");const confirm=dialog.getByRole("button",{name:"Confirm",exact:false});await expect(confirm).toBeDisabled();await dialog.getByRole("checkbox").check();await confirm.click();await expect(page.getByText("Your acceptance has been recorded",{exact:false})).toBeVisible();
 const ledger=await (await request.get(mock+"/__e2e/requests")).json();const writes=ledger.items.filter((r:{path:string;method:string})=>r.path.endsWith("/commands")&&r.method==="POST");const views=writes.filter((r:{body:{action:string}})=>r.body.action==="view"),decisions=writes.filter((r:{body:{action:string}})=>r.body.action==="accept");expect(views.length).toBeGreaterThan(0);expect(new Set(views.map((r:{body:{command_key:string}})=>r.body.command_key)).size).toBe(1);expect(decisions).toHaveLength(1);expect(decisions[0].body.expected_revision).toBe(2);expect(decisions[0].body.terms_hash).toMatch(/^[a-f0-9]{64}$/);
});
test("Company Admin can save explicit parallel approval policy without altering existing offers",async({page,request})=>{
 await login(page,"recruiter");await page.goto("/company/offer-governance");await page.getByLabel("Approval mode").selectOption("parallel");await page.getByLabel("Reviewer role").selectOption("sub_admin");await page.getByLabel("Reason for policy / permission changes").fill("Require engineering lead review for future versions.");await page.getByRole("button",{name:"Save governed policy"}).click();await expect(page.getByRole("status")).toContainText("Approval policy and permissions saved");
 const ledger=await (await request.get(mock+"/__e2e/requests")).json();const write=ledger.items.find((r:{path:string;method:string})=>r.path.endsWith("offer-governance")&&r.method==="PUT");expect(write.body.expected_revision).toBe(0);expect(write.body.policy.mode).toBe("parallel");expect(write.body.policy.steps[0].role).toBe("sub_admin");expect(ledger.items.filter((r:{method:string;path:string})=>r.method==="POST"&&r.path.endsWith("/commands"))).toHaveLength(0);
});

test("Company template cloning, variable insertion and guarded archival preserve the original",async({page,request})=>{
 await login(page,"recruiter");await page.goto("/recruiter/offers/templates/new");await page.getByLabel("Template name",{exact:true}).fill("Engineering terms");await page.getByLabel("Letter introduction").fill("Welcome ");await page.getByRole("button",{name:"Insert candidate name",exact:true}).click();await expect(page.getByLabel("Letter introduction")).toHaveValue("Welcome {{candidate_name}}");await page.getByRole("button",{name:"Publish new version"}).click();
 await page.getByRole("link",{name:"Clone template",exact:true}).click();await expect(page.getByLabel("Template name",{exact:true})).toHaveValue("Engineering terms copy");await expect(page.getByLabel("Letter introduction")).toHaveValue("Welcome {{candidate_name}}");await page.getByRole("button",{name:"Save draft version"}).click();
 const original=page.getByRole("article").filter({has:page.getByRole("heading",{name:"Engineering terms",exact:true})});await original.getByRole("button",{name:"Archive template",exact:true}).click();const modal=page.getByRole("dialog",{name:"Archive company template"});await modal.getByLabel("Reason",{exact:true}).fill("Synthetic template is being retired.");await modal.getByRole("button",{name:"Confirm archive"}).click();await expect(page.getByRole("heading",{name:"Engineering terms",exact:true})).toHaveCount(0);await expect(page.getByRole("heading",{name:"Engineering terms copy",exact:true})).toBeVisible();
 const ledger=await(await request.get(mock+"/__e2e/requests")).json();const archives=ledger.items.filter((r:{path:string})=>r.path.endsWith("/archive"));expect(archives).toHaveLength(1);expect(archives[0].body.expected_version).toBe(1);expect(archives[0].body.command_key).toBeTruthy();
});


test("Save draft from the review step preserves incomplete terms and blocks release",async({page,request})=>{
 await login(page,"recruiter");await page.setViewportSize({width:360,height:800});await page.goto("/recruiter/offers/new?application_id=70000000-0000-4000-8000-000000000002");
 await page.getByRole("button",{name:"5. Review",exact:true}).click();await expect(page.getByRole("button",{name:"Save private draft",exact:true})).toBeDisabled();
 await page.getByRole("button",{name:"Save draft",exact:true}).click();await expect(page).toHaveURL(/\/recruiter\/offers\/[^/?]+$/);
 await expect(page.getByRole("status")).toContainText("This private draft is incomplete");await expect(page.getByRole("button",{name:"Submit for review",exact:true})).toBeDisabled();await expect(page.getByRole("button",{name:"Generate PDF preview",exact:true})).toBeDisabled();await expect(page.getByRole("button",{name:"Send offer",exact:true})).toHaveCount(0);
 const ledger=await(await request.get(mock+"/__e2e/requests")).json();const save=ledger.items.findLast((r:{path:string;method:string})=>r.path==="/api/v1/recruiter/offers"&&r.method==="POST");expect(save.body.save_incomplete).toBe(true);expect(save.body.values.annual_compensation).toBe("");expect(save.body.joining_date).toBe("");expect(save.body.expires_at).toBe("");expect(save.body.command_key).toBeTruthy();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
});


test("Company template review is separate from publication and cannot enter an offer",async({page,request})=>{
 await login(page,"recruiter");await page.goto("/recruiter/offers/templates/new");await page.getByLabel("Template name",{exact:true}).fill("Review-only terms");await page.getByRole("button",{name:"Submit template for review",exact:true}).click();
 await expect(page.getByText(/Version 1 · In review/)).toBeVisible();
 await page.goto("/recruiter/offers/new?application_id=70000000-0000-4000-8000-000000000002");await page.getByRole("button",{name:"Continue",exact:true}).click();await expect(page.getByRole("combobox",{name:"Template",exact:true})).not.toContainText("Review-only terms");
 await page.goto("/recruiter/offers/templates");await page.getByRole("link",{name:"Edit new version",exact:true}).click();await expect(page.getByLabel("Template name",{exact:true})).toHaveValue("Review-only terms");await page.getByRole("button",{name:"Publish new version",exact:true}).click();
 await expect(page.getByText(/Version 2 · published/)).toBeVisible();await expect(page.getByText(/Version 1 · In review/)).toBeVisible();
 const ledger=await(await request.get(mock+"/__e2e/requests")).json();const writes=ledger.items.filter((r:{method:string;path:string})=>r.method==="POST"&&r.path.includes("offer-templates"));expect(writes).toHaveLength(2);expect(writes[0].body).toMatchObject({review:true,publish:false});expect(writes[1].body).toMatchObject({review:false,publish:true,expected_version:1});
});



test("PDF preview opens immediately and cancel prevents a late response reopening it",async({page})=>{
 let finish:()=>void=()=>{},handled:()=>void=()=>{};const pending=new Promise<void>(r=>{finish=r}),complete=new Promise<void>(r=>{handled=r});
 await page.route("**/api/v1/recruiter/offers/*/documents/1?mode=view",async route=>{await pending;try{await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({download:{url:"https://example.test/private-synthetic-offer.pdf"}})})}finally{handled()}});
 await login(page,"recruiter");await page.goto("/recruiter/offers/93000000-0000-4000-8000-000000000001");const trigger=page.getByRole("button",{name:"View letter",exact:true});await trigger.click();const modal=page.getByRole("dialog",{name:"Offer PDF · version 1",exact:true});await expect(modal).toContainText("Opening PDF…");await expect(modal.locator("iframe")).toHaveCount(0);
 const cancelled=page.waitForEvent("requestfailed",request=>request.url().includes("/documents/1?mode=view"));await page.keyboard.press("Escape");await cancelled;await expect(modal).not.toBeVisible();await expect(trigger).toBeEnabled();await expect(trigger).toBeFocused();finish();await complete;await expect(modal).not.toBeVisible();await expect(page.locator("iframe")).toHaveCount(0);
});


test("Company Admin can configure a typed employment approval without numeric coercion",async({page,request})=>{
 await login(page,"recruiter");await page.goto("/company/offer-governance");await page.getByLabel("Approval mode").selectOption("conditional");await page.getByLabel("Field key",{exact:true}).fill("employment_type");await expect(page.getByLabel("Comparison")).toHaveValue("eq");await page.getByLabel("Condition value",{exact:true}).fill("full_time");await page.getByLabel("Reviewer role").selectOption("sub_admin");await page.getByLabel("Reason for policy / permission changes").fill("Require a distinct reviewer for full-time employment.");await page.getByRole("button",{name:"Save governed policy",exact:true}).click();await expect(page.getByRole("status")).toContainText("Approval policy and permissions saved");
 const ledger=await(await request.get(mock+"/__e2e/requests")).json();const write=ledger.items.findLast((r:{path:string;method:string})=>r.method==="PUT"&&r.path.endsWith("offer-governance"));expect(write.body.policy.rules[0]).toMatchObject({field:"employment_type",operator:"eq",value:"full_time",steps:[{user_ids:[],role:"sub_admin",department:""}]});
});
