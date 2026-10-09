import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";
import { login, resetE2E, MOCK_API, recordedRequests } from "./helpers";
const companyID = "40000000-0000-4000-8000-000000000001";
test.beforeEach(async ({ request,page }) => {await resetE2E(request);await page.setViewportSize({width:1440,height:900})});
test("company drafts, scoped invitation and explicit deactivation", async ({ page, request }) => {
    await login(page, "recruiter");
    await request.post(`${MOCK_API}/__e2e/company`, { data: {} });
    await page.goto("/company");
    await expect(page.getByRole("heading", { name: "Welcome to your company workspace" })).toBeVisible();
    await page.getByLabel("Industry", { exact: true }).fill("Engineering services");
    await page.getByRole("button", { name: "Save draft", exact: true }).click();
    await expect(page.getByText("Draft saved.", { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByLabel("Industry", { exact: true })).toHaveValue("Engineering services");
    await page.getByRole("link", { name: "Team & invitations", exact: true }).click();
    await page.getByRole("button", { name: "Invite teammate" }).click();
    await page.getByLabel("Full name", { exact: true }).fill("Synthetic Scoped Recruiter");
    await page.getByLabel("Official company email", { exact: true }).fill("scoped@example.test");
    await page.getByLabel("Access scope").selectOption("departments");
    await page.getByLabel("Scope names (comma separated)").fill("Engineering, Product");
    await page.getByRole("button", { name: "Send invitation", exact: true }).click();
    await expect(page.getByText("Synthetic Scoped Recruiter · scoped@example.test")).toBeVisible();
    const writes = await recordedRequests(request);
    const invite = writes.find(r => r.method === "POST" && r.path === "/api/v1/company/team");
    expect(invite?.body).toMatchObject({ role: "recruiter", scope: { all: false, departments: ["Engineering", "Product"] }, talent_seat: false });
    await page.getByRole("button", { name: "Manage", exact: true }).click();
    await page.getByRole("combobox", { name: "Action", exact: true }).selectOption("deactivate");
    await page.getByLabel("Reason (required)").fill("Synthetic reviewer selected this inactive account explicitly.");
    await page.getByRole("button", { name: "Save team change" }).click();
    await expect(page.getByText("inactive", { exact: true })).toBeVisible();
});
test("candidate review uses explicit public fields and edit permissions", async ({ page, request }) => {
    await login(page, "candidate");
    await request.post(`${MOCK_API}/__e2e/company`, { data: {} });
    await page.goto(`/candidate/company-reviews?company_id=${companyID}`);
    await page.getByLabel("Job function / role").fill("Engineering");
    await page.getByLabel("Location", { exact: true }).fill("Pune");
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page.getByRole("combobox", { name: "Work culture", exact: true }).selectOption("4");
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page.getByLabel("Review title").fill("Clear guidance and helpful peers");
    await page.getByLabel("Pros", { exact: true }).fill("The team provides clear guidance and helpful engineering peer reviews.");
    await page.getByLabel("Cons", { exact: true }).fill("Planning could improve through clearer communication of changing priorities.");
    await page.getByRole("button", { name: "Submit for moderation" }).click();
    await expect(page.getByText(/employee · pending/)).toBeVisible();
    await page.getByRole("button", { name: "Edit review", exact: true }).click();
    await page.getByRole("button", { name: "3. Your review", exact: true }).click();
    await page.getByLabel("Review title").fill("Updated clear guidance and helpful peers");
    await page.getByRole("button", { name: "Submit for moderation" }).click();
    await expect(page.getByText("Updated clear guidance and helpful peers", { exact: true })).toBeVisible();
    const patch = (await recordedRequests(request)).find(r => r.method === "PATCH" && r.path.startsWith("/api/v1/candidate/company-reviews/"));
    expect(patch?.body).not.toHaveProperty("id");
    expect(patch?.body).not.toHaveProperty("moderation_status");
    expect(patch?.body).not.toHaveProperty("author_id");
});
test("company UI visual review across desktop, tablet and mobile themes", async ({ page, request }) => {
    test.setTimeout(360000);
    await fs.mkdir("visual-artifacts/company-administration", { recursive: true });
    await login(page, "recruiter");
    await request.post(`${MOCK_API}/__e2e/company`, { data: {} });
    const errors: string[] = [];
    page.on("pageerror", e => errors.push(e.message));
    for (const width of [1920, 1440, 1366, 1024, 768, 428, 360])
        for (const mode of ["light", "dark"]) {
            await page.setViewportSize({ width, height: width === 360 ? 800 : 900 });
            await page.evaluate(mode => localStorage.setItem("swx-theme", mode), mode);
            for (const [name, path] of [["setup", "/company"], ["team", "/company/team"], ["plan", "/company/plan"], ["reviews", "/company/reviews"], ["public-reviews", `/companies/${companyID}?tab=reviews`], ["directory", "/companies"]]) {
                await page.goto(path);
                await expect(page.locator("h1")).toBeVisible();
                expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBeTruthy();
                await page.screenshot({ path: `visual-artifacts/company-administration/${name}-${width}-${mode}.png`, fullPage: true,animations:"disabled" });
            }
            await page.goto("/company/team");
            await page.getByRole("button", { name: "Invite teammate" }).click();
            await expect(page.getByRole("dialog")).toBeVisible();
            await page.screenshot({ path: `visual-artifacts/company-administration/invite-${width}-${mode}.png`, fullPage: true,animations:"disabled" });
            await page.keyboard.press("Escape");
            await expect(page.getByRole("dialog")).toBeHidden();
        }
    expect(errors).toEqual([]);
});
test("scoped hiring and expired sourcing have controlled screens", async ({ page, request }) => {
    await login(page, "recruiter");
    await request.post(`${MOCK_API}/__e2e/company`, { data: { member: { company_id: companyID, user_id: "20000000-0000-4000-8000-000000000001", name: "Synthetic Hiring Collaborator", role: "collaborator", status: "active", scope: { all: false, departments: ["Engineering"] }, talent_seat: false } } });
    await page.goto("/company");
    await page.getByRole("button", { name: "Senior Go Platform Engineer", exact: true }).click();
    await expect(page.getByText("Synthetic Scoped Applicant", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Schedule interview", exact: true })).toHaveCount(0);
    await expect(page.getByLabel("Application stage for Synthetic Scoped Applicant")).toHaveCount(0);
    await page.screenshot({ path: "visual-artifacts/company-administration/scoped-collaborator-1440-light.png", fullPage: true,animations:"disabled" });
    await request.post(`${MOCK_API}/__e2e/company`, { data: { policy: { company_id: companyID, managed: true, plan_name: "Synthetic expired plan", state: "expired", features: { "talent.discovery": false, "talent.smart_pools": false }, capacity: {}, usage: {}, free_capacity: {}, limits_approved: false } } });
    await page.goto("/recruiter/discover");
    await expect(page.getByRole("heading", { name: "Talent access is paused" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Open conversations" })).toBeVisible();
    await page.screenshot({ path: "visual-artifacts/company-administration/expired-talent-1440-light.png", fullPage: true,animations:"disabled" });
});
test("command centre provisioning and review moderation remain audited", async ({ page, request }) => {
    await page.context().clearCookies();
    await request.post(`${MOCK_API}/__e2e/admin-security`, { data: { enabled: true, assigned: true, admin_role: "super_admin", mfa_enrolled: true, mfa_verified: true } });
    await login(page, "master_admin");
    await request.post(`${MOCK_API}/__e2e/company`, { data: {} });
    await page.goto(`/swx-command-centre/organizations/${companyID}`);
    await expect(page.getByRole("heading", { name: "Company administration", exact: true })).toBeVisible();
    await expect(page.getByLabel("Approved organization invitation request ID")).toBeVisible();
    await page.screenshot({ path: "visual-artifacts/company-administration/platform-company-1440-light.png", fullPage: true,animations:"disabled" });
    await page.goto("/swx-command-centre/company-reviews");
    await expect(page.getByRole("heading", { name: "Company review moderation" })).toBeVisible();
    await page.getByLabel("Decision reason").fill("Synthetic employment evidence and public text reviewed in local QA.");
    await page.getByRole("button", { name: "Apply audited moderation decision" }).click();
    const changes = (await recordedRequests(request)).filter(r => r.method === "PATCH" && r.path.startsWith("/api/v1/admin/company-reviews/"));
    expect(changes.at(-1)?.body).toMatchObject({ action: "publish", revision: 1, verified: true });
    await page.evaluate(() => { (document.activeElement as HTMLElement)?.blur(); window.scrollTo(0, 0); });
    await page.screenshot({ path: "visual-artifacts/company-administration/platform-moderation-1440-light.png", fullPage: true,animations:"disabled" });
});
test("scoped Sub-admin team controls cannot grant wider access", async ({ page, request }) => {
    await login(page, "recruiter");
    const member = { company_id: companyID, user_id: "20000000-0000-4000-8000-000000000001", name: "Synthetic Engineering Sub-admin", role: "sub_admin", status: "active", scope: { all: false, departments: ["Engineering"], locations: [], job_ids: [] }, talent_seat: false };
    const teammate = { ...member, user_id: "20000000-0000-4000-8000-000000000003", role: "recruiter", name: "Synthetic Engineering Recruiter", email: "engineer@example.test" };
    await request.post(`${MOCK_API}/__e2e/company`, { data: { member, members: [teammate, { ...teammate, user_id: "20000000-0000-4000-8000-000000000004", name: "Synthetic Sales Recruiter", scope: { ...member.scope, departments: ["Sales"] } }] } });
    await page.goto("/company/team");
    await expect(page.getByText("Synthetic Engineering Recruiter", { exact: true })).toBeVisible();
    await expect(page.getByText("Synthetic Sales Recruiter", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Plan & usage", exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Invite teammate", exact: true }).click();
    await expect(page.getByLabel("Access scope")).toHaveValue("departments");
    await expect(page.getByLabel("Scope names (comma separated)")).toHaveValue("Engineering");
    await expect(page.getByLabel("Assign a Talent seat")).toHaveCount(0);
    expect(await page.getByLabel("Company role").locator("option").allTextContents()).toEqual(["Recruiter", "Hiring collaborator — view & feedback"]);
    await expect(page.getByLabel("Access scope").locator('option[value="all"]')).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "Invite teammate", exact: true })).toBeFocused();
    await page.getByRole("button", { name: "Manage", exact: true }).click();
    await expect(page.getByLabel("Action").locator('option[value="transfer_owner"]')).toHaveCount(0);
    await page.screenshot({ path: "visual-artifacts/company-administration/subadmin-team-1440-light.png", fullPage: true,animations:"disabled" });
});
test("mobile setup focus and System appearance remain accessible", async ({ page, request }) => {
    await login(page, "recruiter");
    await request.post(`${MOCK_API}/__e2e/company`, { data: {} });
    await page.setViewportSize({ width: 360, height: 800 });
    await page.emulateMedia({ colorScheme: "light" });
    await page.evaluate(() => localStorage.setItem("swx-theme", "system"));
    await page.goto("/company");
    await expect(page.locator("html")).not.toHaveClass(/dark/);
    await page.getByRole("textbox", { name: "Work culture", exact: true }).focus();
    await expect.poll(() => page.getByRole("textbox", { name: "Work culture", exact: true }).evaluate(el => el.getBoundingClientRect().bottom < innerHeight - 100)).toBeTruthy();
    await page.screenshot({ animations:"disabled",path: "visual-artifacts/company-administration/setup-mobile-keyboard-system-light.png" });
    await page.emulateMedia({ colorScheme: "dark" });
    await expect(page.locator("html")).toHaveClass(/dark/);
    await page.screenshot({ animations:"disabled",path: "visual-artifacts/company-administration/setup-mobile-keyboard-system-dark.png" });
    await page.emulateMedia({ colorScheme: "light" });
    await expect(page.locator("html")).not.toHaveClass(/dark/);
});
test("owner selects an explicit resource handoff before deactivation", async ({ page, request }) => {
    await login(page, "recruiter");
    await request.post(`${MOCK_API}/__e2e/company`, { data: {} });
    await page.goto("/company/team");
    await page.getByRole("button", { name: "Manage", exact: true }).click();
    await page.getByRole("combobox", { name: "Action", exact: true }).selectOption("deactivate");
    await expect(page.getByText("3 jobs · 2 saved searches · 1 pool · 1 sequence · 1 campaign")).toBeVisible();
    await page.getByRole("combobox", { name: "Transfer owned resources to", exact: true }).selectOption("20000000-0000-4000-8000-000000000001");
    await page.getByLabel("Reason (required)").fill("Synthetic owner approved handoff of departing teammate resources.");
    await page.screenshot({ path: "visual-artifacts/company-administration/team-resource-handoff-1440-light.png", fullPage: true,animations:"disabled" });
    await page.getByRole("button", { name: "Save team change" }).click();
    expect((await recordedRequests(request)).find(r => r.method === "PATCH" && r.path.includes("/company/team/"))?.body).toMatchObject({ action: "deactivate", transfer_to: "20000000-0000-4000-8000-000000000001" });
});
test("candidate review and Command Centre responsive visual review", async ({ page, request }) => {
    test.setTimeout(240000);
    const errors: string[] = [];
    page.on("pageerror", e => errors.push(e.message));
    await login(page, "candidate");
    await request.post(`${MOCK_API}/__e2e/company`, { data: {} });
    for (const width of [1920, 1440, 1366, 1024, 768, 428, 360])
        for (const mode of ["light", "dark"]) {
            await page.setViewportSize({ width, height: width === 360 ? 800 : 900 });
            await page.evaluate(mode => localStorage.setItem("swx-theme", mode), mode);
            await page.goto(`/candidate/company-reviews?company_id=${companyID}`);
            for (const [step, label] of [[1, "1. Your relationship"], [2, "2. Ratings"], [3, "3. Your review"]] as const) {
                await page.getByRole("button", { name: label, exact: true }).click();
                expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBeTruthy();
                await page.screenshot({ path: `visual-artifacts/company-administration/candidate-review-step${step}-${width}-${mode}.png`, fullPage: true,animations:"disabled" });
            }
        }
    await page.context().clearCookies();
    await request.post(`${MOCK_API}/__e2e/admin-security`, { data: { enabled: true, assigned: true, admin_role: "super_admin", mfa_enrolled: true, mfa_verified: true } });
    await login(page, "master_admin");
    await request.post(`${MOCK_API}/__e2e/company`, { data: {} });
    for (const width of [1920, 1440, 1366, 1024, 768, 428, 360])
        for (const mode of ["light", "dark"]) {
            await page.setViewportSize({ width, height: width === 360 ? 800 : 900 });
            await page.evaluate(mode => localStorage.setItem("swx-theme", mode), mode);
            for (const [name, path] of [["platform-company", `/swx-command-centre/organizations/${companyID}`], ["platform-moderation", "/swx-command-centre/company-reviews"]]) {
                await page.goto(path);
                await expect(page.locator("h1")).toBeVisible();
                expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBeTruthy();
                await page.evaluate(() => { (document.activeElement as HTMLElement)?.blur(); window.scrollTo(0, 0); });
                await page.screenshot({ path: `visual-artifacts/company-administration/${name}-${width}-${mode}.png`, fullPage: true,animations:"disabled" });
            }
        }
    expect(errors).toEqual([]);
});


test("owner can explicitly retire a legacy recruiter while preserving other access",async({page,request})=>{
 await login(page,"recruiter");const owner={company_id:companyID,user_id:"20000000-0000-4000-8000-000000000001",name:"Synthetic Company Owner",role:"primary_admin",status:"active",scope:{all:true,departments:[],locations:[],job_ids:[]},talent_seat:true};const legacy={...owner,user_id:"20000000-0000-4000-8000-000000000007",role:"legacy_recruiter",name:"Synthetic Existing Recruiter",email:"existing@example.test"};await request.post(`${MOCK_API}/__e2e/company`,{data:{members:[owner,legacy]}});await page.goto("/company/team");await page.getByRole("row").filter({hasText:"Synthetic Existing Recruiter"}).getByRole("button",{name:"Manage",exact:true}).click();await expect(page.getByRole("combobox",{name:"Company role",exact:true})).toHaveValue("recruiter");await page.getByRole("combobox",{name:"Action",exact:true}).selectOption("deactivate");await page.getByLabel("Reason (required)").fill("Synthetic owner explicitly retired an existing recruiter account.");await page.getByRole("button",{name:"Save team change"}).click();await expect(page.getByRole("row").filter({hasText:"Synthetic Existing Recruiter"})).toContainText("inactive");await expect(page.getByRole("row").filter({hasText:"Synthetic Company Owner"})).toContainText("Owner protected");await page.screenshot({path:"visual-artifacts/company-administration/legacy-recruiter-deactivation-1440-light.png",fullPage:true,animations:"disabled"});
 await page.evaluate(()=>localStorage.setItem("swx-theme","dark"));await page.goto("/company/plan");const contrast=await page.locator(".swx-company-success").first().evaluate(el=>{const components=(v:string)=>v.match(/[\d.]+/g)!.slice(0,3).map(Number);const lum=(v:number[])=>v.map(c=>{c/=255;return c<=.04045?c/12.92:Math.pow((c+.055)/1.055,2.4)}).reduce((a,c,i)=>a+c*[.2126,.7152,.0722][i],0);const fg=lum(components(getComputedStyle(el).color));const bg=lum(components(getComputedStyle(el.closest("li")!).backgroundColor));return(Math.max(fg,bg)+.05)/(Math.min(fg,bg)+.05)});expect(contrast).toBeGreaterThanOrEqual(4.5);
});


test("mobile candidate review actions clear the bottom navigation",async({page,request})=>{
 await login(page,"candidate");await request.post(`${MOCK_API}/__e2e/company`,{data:{}});await page.setViewportSize({width:360,height:800});await page.evaluate(()=>localStorage.setItem("swx-theme","dark"));await page.goto(`/candidate/company-reviews?company_id=${companyID}`);await page.getByRole("textbox",{name:"Job function / role",exact:true}).fill("Engineering");await page.getByRole("textbox",{name:"Location",exact:true}).fill("Pune");await page.getByRole("button",{name:"Continue",exact:true}).click();await page.getByRole("button",{name:"Continue",exact:true}).click();await page.getByRole("textbox",{name:"Review title",exact:true}).fill("Thoughtful collaboration and clear expectations");await page.getByRole("textbox",{name:"Pros",exact:true}).fill("Helpful colleagues support learning and provide clear feedback in engineering reviews.");await page.getByRole("textbox",{name:"Cons",exact:true}).fill("Cross-team planning could become more predictable as the company and workload grow.");const submit=page.getByRole("button",{name:"Submit for moderation",exact:true});await expect(submit).toBeInViewport();const actionBounds=await submit.boundingBox();const navBounds=await page.locator(".candidate-mobile-nav").boundingBox();expect(actionBounds!.y+actionBounds!.height).toBeLessThan(navBounds!.y);await page.screenshot({path:"visual-artifacts/company-administration/candidate-review-mobile-actions-360-dark.png",animations:"disabled"});await submit.click();await expect(page.getByText(/Your review was submitted for moderation/)).toBeVisible();
});
