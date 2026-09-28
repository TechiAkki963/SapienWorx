import {expect,test,type Page} from "@playwright/test";

const mock="http://127.0.0.1:18090",company="40000000-0000-4000-8000-000000000001",job="60000000-0000-4000-8000-000000000001";
async function login(page:Page) {
  await page.goto("/swx-command-centre");
  await page.getByLabel("Email",{exact:true}).fill("master_admin@example.invalid");
  await page.getByLabel("Password",{exact:true}).fill("E2e-password-123!");
  await page.getByRole("button",{name:"Enter command centre",exact:true}).click();
  await expect(page).toHaveURL(/\/swx-command-centre\/(overview|access)$/);
}
test.beforeEach(async({request})=>{await request.post(mock+"/__e2e/reset");});
test.afterEach(async({request})=>{await request.post(mock+"/__e2e/reset");});

test("dashboard scope links to exact stage and interview cohorts",async({page,request})=>{
  await login(page);
  await page.getByLabel("Organization ID",{exact:true}).fill(company);
  await page.getByLabel("Organization country",{exact:true}).fill("IN");
  await page.getByRole("button",{name:"Apply window"}).click();
  const offer=page.getByRole("link",{name:"Offer-stage applications: 1. View records"});
  const url=new URL(await offer.getAttribute("href")||"",mock);
  expect(Object.fromEntries(url.searchParams)).toEqual({stage:"offer",company_id:company,country:"IN"});
  await offer.click();
  await expect(page.getByLabel("Application stage")).toHaveValue("offer");
  await expect(page.getByText("1 records",{exact:true})).toBeVisible();
  await page.getByRole("link",{name:"View recorded history →"}).first().click();
  await expect(page.getByRole("heading",{name:"Application timeline",exact:true})).toBeVisible();
  await expect(page.getByText("Actor not independently recorded",{exact:true})).toBeVisible();
  await expect(page.getByText("Recorded recruiter actor:",{exact:false})).toBeVisible();
  await expect(page.locator("main")).not.toContainText("private@example");
  await page.goto(`/swx-command-centre/overview?company_id=${company}&country=IN`);
  await page.getByRole("link",{name:"Upcoming interviews: 2. View records"}).click();
  await expect(page.getByLabel("Upcoming scheduled only")).toBeChecked();
  await expect(page.getByText("2 records",{exact:true})).toBeVisible();
  const logged=await(await request.get(mock+"/__e2e/requests")).json();
  expect(logged.items.filter((i:{path:string,method:string})=>i.path.startsWith("/api/v1/admin/")&&i.method!=="GET")).toEqual([]);
});

test("application pagination retains scope and invalid scope does not invent zero counts",async({page})=>{
  await login(page);
  await page.goto(`/swx-command-centre/applications?company_id=${company}&country=IN&job_id=${job}&stage=screening`);
  await expect(page.getByText("28 records",{exact:true})).toBeVisible();
  await page.getByRole("link",{name:"Next",exact:true}).click();
  await expect(page).toHaveURL(/page=2/);
  expect(new URL(page.url()).searchParams.get("job_id")).toBe(job);
  expect(new URL(page.url()).searchParams.get("company_id")).toBe(company);
  await expect(page.getByText("Page 2 of 2",{exact:true})).toBeVisible();
  await page.goto("/swx-command-centre/applications?company_id=invalid");
  await expect(page.getByRole("alert").filter({hasText:"Invalid recruitment filters"})).toBeVisible();
  await expect(page.getByText("0 records",{exact:true})).toHaveCount(0);
  await page.goto("/swx-command-centre/applications/00000000-0000-4000-8000-000000000000");
  await expect(page.getByRole("heading",{name:"Application record unavailable"})).toBeVisible();
});

test("auditor cannot fetch recruitment lists or direct record history",async({page,request})=>{
  await request.post(mock+"/__e2e/admin-security",{data:{enabled:true,admin_role:"auditor",mfa_enrolled:true,mfa_verified:true}});
  await login(page);
  for(const path of ["applications","interviews","applications/70000000-0000-4000-8000-000000000001"]) {
    await page.goto("/swx-command-centre/"+path);
    await expect(page).toHaveURL(/swx-command-centre\/access$/);
  }
  const logged=await(await request.get(mock+"/__e2e/requests")).json();
  expect(logged.items.filter((i:{path:string})=>/^\/api\/v1\/admin\/(applications|interviews)/.test(i.path))).toEqual([]);
});

test("recruitment views fit desktop tablet and mobile with keyboard-accessible filters",async({page})=>{
  await login(page);
  for(const width of [1440,768,375]) {
    await page.setViewportSize({width,height:960});
    for(const path of ["applications?stage=offer","interviews","jobs"]) {
      await page.goto("/swx-command-centre/"+path);
      await expect(page.locator("main h1")).toBeVisible();
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
      await page.screenshot({path:`../output/admin-${path.split("?")[0]}-${width}.png`,fullPage:true});
    }
    await page.goto("/swx-command-centre/applications?stage=offer");
    await page.getByLabel("Search recruitment").focus();
    await expect(page.getByLabel("Search recruitment")).toBeFocused();
  }
});

test("account summaries link candidate and recruiter metadata without editing accounts",async({page,request})=>{
  await request.post(mock+"/__e2e/admin-security",{data:{governanceFull:true}});
  await login(page);
  await page.goto("/swx-command-centre/users?q=10000000-0000-4000-8000-000000000001");
  await page.getByRole("link",{name:"View account summary →"}).first().click();
  await expect(page.getByRole("heading",{name:"Candidate onboarding"})).toBeVisible();
  await expect(page.getByText("review required",{exact:true})).toBeVisible();
  await expect(page.getByText("85%",{exact:true})).toBeVisible();
  await expect(page.getByRole("heading",{name:"Consent register summary"})).toBeVisible();
  for(const width of [1440,768,375]) {
    await page.setViewportSize({width,height:960});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:`../output/admin-account-summary-${width}.png`,fullPage:true});
  }
  await page.goto("/swx-command-centre/users/20000000-0000-4000-8000-000000000001");
  await expect(page.getByRole("heading",{name:"Recruiter activity"})).toBeVisible();
  await expect(page.getByRole("heading",{name:"Candidate onboarding"})).toHaveCount(0);
  await page.goto("/swx-command-centre/users/00000000-0000-4000-8000-000000000000");
  await expect(page.getByRole("heading",{name:"Account summary unavailable"})).toBeVisible();
  const logged=await(await request.get(mock+"/__e2e/requests")).json();
  expect(logged.items.filter((i:{method:string,path:string})=>i.path.startsWith("/api/v1/admin/users")&&i.method!=="GET")).toEqual([]);
});

test("support can read account summary while auditor cannot fetch it",async({page,request})=>{
  await request.post(mock+"/__e2e/admin-security",{data:{enabled:true,admin_role:"support_admin",mfa_enrolled:true,mfa_verified:true}});
  await login(page);
  await page.goto("/swx-command-centre/users/10000000-0000-4000-8000-000000000001");
  await expect(page.getByRole("heading",{name:"Account summary",exact:true})).toBeVisible();
  await expect(page.getByRole("button",{name:"Suspend",exact:true})).toHaveCount(0);
  await request.post(mock+"/__e2e/reset");
  await request.post(mock+"/__e2e/admin-security",{data:{enabled:true,admin_role:"auditor",mfa_enrolled:true,mfa_verified:true}});
  await page.goto("/swx-command-centre/users/10000000-0000-4000-8000-000000000001");
  await expect(page).toHaveURL(/\/access$/);
  const logged=await(await request.get(mock+"/__e2e/requests")).json();
  expect(logged.items.filter((i:{path:string})=>i.path.endsWith("/summary"))).toEqual([]);
});
