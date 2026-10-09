import { expect, test } from "@playwright/test";
import fs from "node:fs/promises";
import { login, MOCK_API, resetE2E, waitForRecordedRequest } from "./helpers";
test.beforeEach(async({request})=>resetE2E(request));
const id="80000000-0000-4000-8000-000000000001";
test("interview status counts, filters, calendar and contextual empty states",async({page,request})=>{
 await login(page,"recruiter");await page.goto("/recruiter/interviews");
 const tabs=page.getByRole("navigation",{name:"Interview status views"});await expect(tabs.getByRole("link",{name:"Upcoming 1"})).toHaveAttribute("aria-current","page");
 await tabs.getByRole("link",{name:"Cancelled 0"}).click();await expect(page.getByRole("heading",{name:"No cancelled interviews"})).toBeVisible();await page.getByRole("link",{name:"View upcoming"}).click();
 await page.getByLabel("Interviewer",{exact:true}).selectOption("20000000-0000-4000-8000-000000000001");await expect(page).toHaveURL(/interviewer=/);
 await page.getByRole("link",{name:"Calendar view"}).click();await expect(page).toHaveURL(/interviewer=/);await page.getByRole("link",{name:"Next week"}).click();await expect(page).toHaveURL(/interviewer=/);
 await page.setViewportSize({width:360,height:800});await page.goto("/recruiter/interviews?view=calendar");await expect(page.getByRole("link",{name:"Day",exact:true})).toHaveAttribute("aria-current","page");
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBeTruthy();
});
test("scheduling sends verified panel, timezone, format and user supplied meeting details",async({page,request})=>{
 await login(page,"recruiter");await page.goto("/recruiter/interviews");await page.getByRole("button",{name:"Schedule interview",exact:true}).click();const drawer=page.getByRole("dialog",{name:"Schedule interview",exact:true});
 await drawer.getByRole("checkbox",{name:"Riya Recruiter",exact:true}).check();await drawer.getByLabel("Date and time",{exact:true}).fill("2026-11-12T10:30");await drawer.getByLabel("Timezone",{exact:true}).selectOption("America/New_York");await drawer.getByLabel("Format",{exact:true}).selectOption("in_person");await drawer.getByLabel("Location",{exact:true}).fill("Bengaluru office, room 4");
 await drawer.getByRole("button",{name:"Schedule interview",exact:true}).click();const call=await waitForRecordedRequest(request,item=>item.method==="POST"&&item.path==="/api/v1/recruiter/interviews");expect(call.body).toMatchObject({format:"in_person",timezone:"America/New_York",location:"Bengaluru office, room 4",scheduled_at:"2026-11-12T15:30:00.000Z",interviewer_ids:["20000000-0000-4000-8000-000000000001"]});
});
test("feedback is separate from interview status, keeps input on failure, and confines keyboard focus",async({page,request})=>{
 const fixture={id,application_id:"70000000-0000-4000-8000-000000000001",candidate_id:"71000000-0000-4000-8000-000000000001",job_id:"60000000-0000-4000-8000-000000000001",job_reference:"SWX-JOB-2026-00001",candidate_name:"Candidate 001",candidate_headline:"Engineer",job_title:"Senior Go Platform Engineer",scheduled_at:new Date(Date.now()-48*3600000).toISOString(),duration_minutes:45,meeting_url:"https://example.test/meeting",status:"completed",round_label:"Technical",format:"video",timezone:"Asia/Kolkata",interviewers:[{user_id:"20000000-0000-4000-8000-000000000001",name:"Riya Recruiter",response:"accepted",feedback_submitted:false}],feedback_expected:1,feedback_submitted:0};
 await request.post(`${MOCK_API}/__e2e/interviews`,{data:{items:[fixture]}});await login(page,"recruiter");await page.goto("/recruiter/interviews?status=feedback_due");await page.getByRole("button",{name:/0\/1 pending/}).first().click();const drawer=page.getByRole("dialog",{name:"Interview details · Candidate 001"});await expect(drawer.getByLabel("Overall rating")).toBeVisible();await drawer.getByLabel("Evidence and feedback").fill("Demonstrated reliable reasoning and implementation.");
 await page.route(`**/api/v1/recruiter/interviews/${id}/feedback`,route=>route.request().method()==="PUT"?route.fulfill({status:503,contentType:"application/json",body:JSON.stringify({error:{message:"Temporary feedback failure"}})}):route.continue());await drawer.getByRole("button",{name:"Submit feedback"}).click();await expect(drawer.getByRole("alert")).toContainText("Temporary feedback failure");await expect(drawer.getByLabel("Evidence and feedback")).toHaveValue("Demonstrated reliable reasoning and implementation.");
 await page.unroute(`**/api/v1/recruiter/interviews/${id}/feedback`);await drawer.getByRole("button",{name:"Submit feedback"}).click();await expect(drawer.getByRole("button",{name:"Update my feedback"})).toBeVisible();await waitForRecordedRequest(request,item=>item.method==="PUT"&&item.path.endsWith("/feedback"));
 await drawer.getByRole("button",{name:/Close Interview details/}).focus();await page.keyboard.press("Shift+Tab");expect(await drawer.evaluate(node=>node.contains(document.activeElement))).toBeTruthy();await page.keyboard.press("Escape");await expect(drawer).not.toBeVisible();
});
test("interview list calendar and drawer visual inspection targets",async({page})=>{
 test.setTimeout(90000);await login(page,"recruiter");await fs.mkdir("visual-artifacts/interview-operations",{recursive:true});const errors:string[]=[];page.on("pageerror",error=>errors.push(error.message));
 for(const width of [1440,1366,768,360])for(const mode of ["light","dark"]){await page.setViewportSize({width,height:width<768?800:900});await page.evaluate(mode=>localStorage.setItem("swx-theme",mode),mode);for(const view of ["list","calendar"]){await page.goto(`/recruiter/interviews?view=${view}`);await expect(page.getByRole("heading",{name:"Interviews",exact:true})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBeTruthy();await page.screenshot({path:`visual-artifacts/interview-operations/${view}-${width}-${mode}.png`,fullPage:true});} }
 expect(errors).toEqual([]);
});
