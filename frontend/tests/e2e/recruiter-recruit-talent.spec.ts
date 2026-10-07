import { expect, test } from "@playwright/test";
import fs from "node:fs/promises";
import { login, recordedRequests, resetE2E, waitForRecordedRequest } from "./helpers";

const job = "60000000-0000-4000-8000-000000000001";
const candidate = "71000000-0000-4000-8000-000000000001";
test.beforeEach(async ({request}) => resetE2E(request));

test("Recruit keeps applicants separate from native Talent and preserves job context", async ({page,request}) => {
  await login(page,"recruiter");
  await expect(page.getByRole("navigation",{name:"SapienWorx Recruit"}).getByRole("link",{name:"Applications",exact:true})).toHaveAttribute("href","/recruiter/pipeline");
  await page.goto("/recruiter/talent");
  await expect(page.getByRole("navigation",{name:"Talent workspace"})).toBeVisible();
  await page.getByLabel("Professional keywords").fill("Java AWS"); await page.getByRole("button",{name:"Search Talent"}).click();
  await expect(page).toHaveURL(/\/recruiter\/discover\?q=Java\+AWS/);
  await expect(page.getByLabel("Keywords",{exact:true})).toHaveValue("Java AWS");
  await page.goto(`/recruiter/jobs/${job}`);
  await expect(page.getByRole("heading",{name:"Hiring progress"})).toBeVisible();
  await page.getByRole("navigation",{name:"Job workspace"}).getByRole("link",{name:"Interviews"}).click();
  await expect(page).toHaveURL(new RegExp(`job_id=${job}`));
  await page.getByRole("link",{name:"Calendar view"}).click(); await expect(page).toHaveURL(new RegExp(`job_id=${job}`));
  await page.getByRole("navigation",{name:"Job workspace"}).getByRole("link",{name:"Offers"}).click();
  await waitForRecordedRequest(request,item=>item.path==="/api/v1/recruiter/offers"&&item.query.job_id===job);
  await expect(page.getByRole("button",{name:"Create offer"})).toBeVisible();
  await page.goto("/recruiter/talent/insights"); await expect(page.getByRole("heading",{name:"Talent insights"})).toBeVisible();
  await page.goto("/recruiter/settings"); await expect(page.getByRole("heading",{name:"Settings",exact:true})).toBeVisible();
  await page.setViewportSize({width:360,height:800});
  await expect(page.getByRole("navigation",{name:"Recruiter mobile navigation"}).getByRole("link",{name:"Applications",exact:true})).toHaveAttribute("href","/recruiter/pipeline");
});

test("five job steps retain every existing field and publish payload", async ({page,request}) => {
  test.setTimeout(90000); await page.emulateMedia({reducedMotion:"reduce"});
  await login(page,"recruiter"); await page.goto(`/recruiter/jobs/${job}/edit`);
  await page.getByLabel("Job title",{exact:true}).fill("Reviewed five-step role");
  await page.getByLabel("Minimum years",{exact:true}).fill("3");
  await page.getByRole("button",{name:/Description Story/}).click(); await page.getByRole("textbox",{name:/^Role summary/}).fill("Meaningful role summary");
  await page.getByRole("textbox",{name:/^Responsibilities/}).fill("Deliver reviewed work");
  await page.getByRole("textbox",{name:/^Education requirements/}).fill("Relevant qualification");
  await page.getByRole("button",{name:/Application Questions/}).click();
  await page.getByRole("textbox",{name:/^Screening questions/}).fill("Can you perform this role?");
  await page.getByRole("button",{name:/Hiring workflow Ownership/}).click();
  await expect(page.getByLabel("Assigned recruiter")).toHaveValue("20000000-0000-4000-8000-000000000001");
  await page.getByRole("textbox",{name:/^Internal recruiter notes/}).fill("Internal context remains private");
  await page.getByRole("button",{name:/Publish Review/}).click();
  await page.getByLabel("Job visibility").selectOption("private");
  await page.getByRole("button",{name:"Save and keep published"}).click();
  const recorded=await waitForRecordedRequest(request,item=>item.path===`/api/v1/recruiter/jobs/${job}`&&item.method==="PATCH");
  expect(recorded.body).toMatchObject({title:"Reviewed five-step role",min_experience_years:3,description:"Meaningful role summary",responsibilities:"Deliver reviewed work",education_requirements:["Relevant qualification"],screening_questions:["Can you perform this role?"],visibility:"private",internal_notes:"Internal context remains private",publish:true});
  for(const key of ["department","employment_type","work_mode","role_category","location","openings","max_experience_years","min_salary_lakhs","max_salary_lakhs","skills","company_overview","why_join","hiring_process","application_deadline","referral_enabled","assigned_recruiter_id"])expect(recorded.body).toHaveProperty(key);
});

test("pool groups, saved counts and native campaign drafting preserve boundaries",async ({page,request})=>{
  await login(page,"recruiter");await page.goto("/recruiter/talent-pool");
  const row=page.getByRole("table",{name:"Saved candidates"}).getByRole("row").filter({hasText:"Aarav Mehta"});
  await row.getByRole("button",{name:"Edit tags for Aarav Mehta",exact:true}).click();
  const drawer=page.getByRole("dialog",{name:"Edit pool tags"});
  await drawer.getByLabel("Pool tags",{exact:true}).fill("Engineering, Future roles");await drawer.getByRole("button",{name:"Save pool tags"}).click();
  await waitForRecordedRequest(request,item=>item.method==="PUT"&&item.path.endsWith(candidate)&&Array.isArray(item.body.tags)&&item.body.tags.includes("Engineering"));
  await expect(row).toContainText("Future roles");
  await row.getByRole("checkbox").check();await page.getByRole("button",{name:"Remove bookmarks",exact:true}).click();
  const remove=page.getByRole("dialog",{name:"Remove selected bookmarks"});await expect(remove).toContainText("Candidate profiles, applications and conversations are retained");
  await remove.getByRole("button",{name:"Cancel",exact:true}).click();await expect(row).toBeVisible();
  await page.goto("/recruiter/saved-searches");await page.getByRole("button",{name:"Check match counts",exact:true}).click();
  await expect(page.getByRole("table",{name:"Saved talent searches"})).toContainText("3 current matches · 1 profiles updated since");
  await page.goto("/recruiter/outreach");await page.getByRole("button",{name:"Create campaign",exact:true}).click();
  const campaign=page.getByRole("dialog",{name:"Create campaign"});
  await campaign.getByLabel("Campaign name",{exact:true}).fill("Reviewed synthetic audience");await campaign.getByText("Meera Nair",{exact:true}).click();
  await campaign.getByRole("button",{name:"Continue",exact:true}).click();await campaign.getByRole("combobox",{name:"Sequence",exact:true}).selectOption("76000000-0000-4000-8000-000000000001");
  await campaign.getByRole("button",{name:"Continue",exact:true}).click();await expect(campaign).toContainText("Calendar-based campaign scheduling is unavailable");
  await campaign.getByRole("button",{name:"Continue",exact:true}).click();
  await expect(campaign.getByRole("heading",{name:"Review draft campaign",exact:true})).toBeVisible();
  expect((await recordedRequests(request)).filter(item=>item.method==="POST"&&item.path==="/api/v1/recruiter/outreach/campaigns")).toHaveLength(0);
  await campaign.getByRole("button",{name:"Create draft campaign",exact:true}).click();
  const created=await waitForRecordedRequest(request,item=>item.method==="POST"&&item.path==="/api/v1/recruiter/outreach/campaigns");expect(created.body).toHaveProperty("name","Reviewed synthetic audience");
  await expect(page.getByRole("table",{name:"Outreach campaigns"})).toContainText("Reviewed synthetic audience");
});

test("candidate conversation context uses authorized APIs and keyboard drawer",async ({page})=>{
  await login(page,"recruiter");
  await page.route("**/api/v1/recruiter/candidates/*",route=>route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({user_id:route.request().url().split("/").at(-1),full_name:"Synthetic context candidate",headline:"Shared professional headline",total_experience_months:48,current_city:"Mumbai",has_company_application:true,can_view_cv:true,can_collaborate:true,details:{}})}));
  await page.route("**/api/v1/recruiter/pipeline?candidate_id=*",route=>route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({items:[],page:1,limit:10,total:0})}));
  await page.setViewportSize({width:1920,height:1080});await page.goto("/recruiter/messages");
  await expect(page.getByRole("region",{name:"Candidate conversation context"})).toContainText("Shared professional headline");
  await page.setViewportSize({width:360,height:800});await page.getByRole("button",{name:/Senior Go Platform Engineer opportunity/}).click();
  await page.getByRole("button",{name:"Candidate context",exact:true}).click();const drawer=page.getByRole("dialog",{name:"Candidate context"});await expect(drawer).toContainText("Shared professional headline");
  await page.keyboard.press("Shift+Tab");expect(await drawer.evaluate(node=>node.contains(document.activeElement))).toBeTruthy();await page.keyboard.press("Escape");await expect(page.getByRole("button",{name:"Candidate context",exact:true})).toBeFocused();
});

test("all recruiter areas seven viewports, System Light Dark and hydration",async ({page}) => {
  test.setTimeout(480000); await login(page,"recruiter");
  const root="visual-artifacts/recruiter-recruit-talent"; await fs.mkdir(root,{recursive:true});
  const errors:string[]=[];page.on("pageerror",error=>errors.push(error.message));page.on("console",message=>{if(message.type()==="error"&&/hydration|cannot be a descendant/i.test(message.text()))errors.push(message.text());});
  const routes=[ ["home","/recruiter"],["jobs","/recruiter/jobs"],["job-overview",`/recruiter/jobs/${job}`],["candidates","/recruiter/pipeline"],["candidate",`/recruiter/candidates/${candidate}`],["interviews","/recruiter/interviews"],["offers","/recruiter/offers"],["messages","/recruiter/messages"],["talent","/recruiter/talent"],["pools","/recruiter/talent-pool"],["saved","/recruiter/saved-searches"],["outreach","/recruiter/outreach"],["analytics","/recruiter/analytics"],["insights","/recruiter/talent/insights"],["settings","/recruiter/settings"] ];
  for(const [width,height] of [[1920,1080],[1440,900],[1366,768],[1024,768],[768,1024],[428,926],[360,800]]){
    await page.setViewportSize({width,height});
    for(const colorScheme of ["light","dark","no-preference"] as const){
      await page.emulateMedia({colorScheme});
      for(const [name,path] of routes){
        await page.goto(path);await expect(page.locator("main h1")).toBeVisible();
        expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${name} ${width} ${colorScheme} overflow`).toBeTruthy();
        if(name==="messages") await expect(page.locator("[data-message-id]").first()).toHaveCSS("opacity","1");
        await page.screenshot({path:`${root}/${name}-${width}-${colorScheme}.png`,fullPage:true,caret:"initial"});
      }
    }
  }
  expect(errors).toEqual([]);
});
