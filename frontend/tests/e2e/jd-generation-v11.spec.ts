import { expect, test, Page } from "@playwright/test";
import fs from "node:fs/promises";
import { readFileSync } from "node:fs";
import path from "node:path";
import { login, resetE2E } from "./helpers";

type Blueprint = { title: string; about_role: string; core_responsibilities: string[]; core_skills: string[]; optional_skills: string[]; review_notes: string[] };
const blueprints: Blueprint[] = JSON.parse(readFileSync(path.resolve(__dirname, "../../../backend/internal/workforce/testdata/role-blueprints-v1.1.json"), "utf8"));
const artifactRoot = "visual-artifacts/jd-generation-v11";
const id = "97000000-0000-4000-8000-000000000001";

async function mockV11(page: Page) {
 const calls: { path: string; body: Record<string, any> }[] = [];
 await page.route("**/api/v1/intelligence/jobs/**", async route => {
  const headers = { "Access-Control-Allow-Origin": new URL(page.url()).origin, "Access-Control-Allow-Credentials":"true", "Access-Control-Allow-Headers":"content-type,x-csrf-token", "Access-Control-Allow-Methods":"POST,OPTIONS" };
  if (route.request().method() === "OPTIONS") return route.fulfill({status:204,headers});
  const body = route.request().postDataJSON(); calls.push({path:route.request().url(),body});
  if (route.request().url().endsWith("/review")) return route.fulfill({status:200,headers,json:{id,revision:1,result:{status:"owner_reviewed"}}});
  const f=body.fields; const b=blueprints.find(row => row.title===f.title);
  if (!b) return route.fulfill({status:503,headers,json:{error:{code:"ai_unavailable",message:"Continue manually."}}});
  const item=(key:string,value:string,source="sapienworx_suggested")=>({id:key,value,source,source_reference:`fixture:${key}`,requires_confirmation:source!=="recruiter_supplied"});
  const draft={version:"v1.1",blueprint_version:"rb-1.1",blueprint_hash:"synthetic-test-hash",headline:item("fact:title",f.title,"recruiter_supplied"),about_role:item("blueprint:about",b.about_role),responsibilities:b.core_responsibilities.map((v,i)=>item(`blueprint:duty:${i+1}`,v)),required_skills:[...f.skills.map((v:string,i:number)=>item(`fact:skill:${i+1}`,v,"recruiter_supplied")),...b.core_skills.filter(v=>!f.skills.includes(v)).map((v,i)=>item(`blueprint:core:${i+1}`,v))],preferred_skills:b.optional_skills.map((v,i)=>item(`blueprint:optional:${i+1}`,v)),qualifications:[],location:item("fact:location",f.location,"recruiter_supplied"),experience:{minimum:f.min_experience_years,maximum:f.max_experience_years,source:"recruiter_supplied",source_reference:"JobProfile.experience"},assumptions_requiring_review:[...b.review_notes.map((v,i)=>item(`blueprint:review:${i+1}`,v)),item("editorial:review","Confirm employer-specific requirements before publishing.","ai_suggested")]};
  if(b.title==="Java Backend Developer") draft.preferred_skills.push(item("ai:optional:1","Java code review","ai_suggested"));
  const text=`${f.title}\n\nAbout the Role\n${b.about_role}\n\nKey Responsibilities — role recommendations for review\n${b.core_responsibilities.map(v=>`- ${v}`).join("\n")}\n\nSkills / Competencies — core recommendations, not confirmed requirements\n${b.core_skills.map(v=>`- ${v}`).join("\n")}\n\nPreferred Skills — optional recommendations for review\n${draft.preferred_skills.map(v=>`- ${v.value}`).join("\n")}\n\nExperience\n${f.min_experience_years}–${f.max_experience_years} years\n\nLocation\n${f.location}`;
  return route.fulfill({status:200,headers,json:{id,revision:0,result:{status:"requires_review",domain_valid:true,task:"job.generate_description",prompt_version:"jd-p2",schema_version:"jd-generation-v1.1",value:{generated_description:text,draft,structured_fields:f,suggested_skills:b.core_skills,warnings:["Core and optional recommendations are not confirmed employer requirements."],regeneration:0}}}});
 });
 return calls;
}
async function start(page:Page,title=blueprints[0].title) {
 await login(page,"recruiter");const calls=await mockV11(page);await page.goto("/recruiter/jobs/new");
 await page.getByLabel("Job title",{exact:true}).fill(title);await page.getByLabel("Location",{exact:true}).fill("Bengaluru");
 await page.getByLabel("Minimum years",{exact:true}).fill("3");await page.getByLabel("Maximum years",{exact:true}).fill("5");
 await page.getByLabel("Allow these role details").check();return calls;
}
async function generate(page:Page){await page.getByRole("button",{name:"Generate with AI",exact:true}).click();await expect(page.getByText("Generated draft · not yet applied",{exact:true})).toBeVisible();}
test.beforeEach(async({request})=>resetE2E(request));

test("V11 preserves minimum-input facts and keeps all recommendations out of matching",async({page})=>{
 const calls=await start(page);expect(calls).toHaveLength(0);await generate(page);
 expect(calls[0].body).toMatchObject({version:"v1.1",fields:{skills:[],responsibilities:"",work_mode:"",employment_type:""}});
 expect(JSON.stringify(calls[0].body)).not.toMatch(/salary|internal_notes|role_blueprint|model|tenant_id/);
 await page.getByRole("button",{name:"Use this draft",exact:true}).click();
 await expect(page.getByRole("complementary",{name:"Candidate preview locked"})).toBeVisible();
 await page.getByRole("textbox",{name:"Role summary",exact:true}).fill("Human edit. Kubernetes is mandatory in prose only.");
 await page.getByRole("button",{name:"I reviewed the description and requirements",exact:true}).click();
 expect(calls.at(-1)!.body.fields.skills).toEqual([]);expect(calls.at(-1)!.body.fields.responsibilities).toBe("");
 expect(calls.filter(c=>!c.path.endsWith("/review"))).toHaveLength(1);
});

test("V11 core skill accept edit remove are explicit and optional skills never become mandatory",async({page})=>{
 const calls=await start(page);await generate(page);let saved:Record<string,any>|undefined;
 await page.route("**/api/v1/recruiter/jobs/builder",async route=>{saved=route.request().postDataJSON();await route.fulfill({status:201,json:{id:"synthetic-saved-job"},headers:{"Access-Control-Allow-Origin":new URL(page.url()).origin,"Access-Control-Allow-Credentials":"true"}});});
 await page.getByRole("button",{name:"Accept Java",exact:true}).click();
 await expect(page.getByRole("button",{name:"Java accepted",exact:true})).toBeDisabled();
 await page.getByRole("button",{name:"Edit SQL",exact:true}).click();await page.getByRole("textbox",{name:"Edit SQL",exact:true}).fill("PostgreSQL");
 await page.getByRole("button",{name:"Save suggestion",exact:true}).click();
 await page.getByRole("button",{name:"Accept PostgreSQL",exact:true}).click();
 await page.getByRole("button",{name:"Remove Container Fundamentals",exact:true}).click();
 await expect(page.getByRole("button",{name:"Keep Container Fundamentals as optional",exact:true})).toHaveCount(0);
 await page.getByRole("button",{name:"Keep Spring Boot as optional",exact:true}).click();
 await page.getByRole("button",{name:"Keep Java code review as optional",exact:true}).click();
 await page.getByRole("button",{name:"Use this draft",exact:true}).click();
 await expect(page.getByRole("textbox",{name:"Role summary",exact:true})).not.toHaveValue(/Container Fundamentals/);
 await page.getByRole("button",{name:"Save as draft",exact:true}).click();
 await expect.poll(()=>saved?.skills).toEqual(["Java","PostgreSQL"]);
 expect(saved?.ai_generation_id).toBe(id);expect(saved?.description).toContain("Spring Boot");expect(saved?.publish).toBe(false);
 expect(calls.filter(c=>!c.path.endsWith("/review"))).toHaveLength(1);
});

test("V11 accepts individual responsibilities only and exposes separate AI review notes",async({page})=>{
 const calls=await start(page);await generate(page);await page.getByRole("group",{name:"Suggestion sections"}).getByRole("button",{name:"Review notes",exact:true}).click();
 await expect(page.getByText("AI suggested · confirm with hiring team",{exact:true})).toBeVisible();
 await page.getByRole("group",{name:"Suggestion sections"}).getByRole("button",{name:"Responsibilities",exact:true}).click();
 const text=blueprints[0].core_responsibilities[0];await page.getByRole("button",{name:`Accept ${text}`,exact:true}).click();
 await page.getByRole("button",{name:"Use this draft",exact:true}).click();
 await expect(page.getByRole("textbox",{name:"Responsibilities",exact:true})).toHaveValue(`- ${text}`);
 await page.getByRole("button",{name:"I reviewed the description and requirements",exact:true}).click();
 expect(calls.at(-1)!.body.fields.responsibilities).toBe(`- ${text}`);expect(calls.at(-1)!.body.fields.skills).toEqual([]);
});

test("V11 suggestion keyboard flow and contrast preserve control without extra calls",async({page})=>{
 const calls=await start(page);const trigger=page.getByRole("button",{name:"Generate with AI",exact:true});await trigger.focus();await page.keyboard.press("Enter");
 const edit=page.getByRole("button",{name:"Edit Java",exact:true});await expect(edit).toBeVisible();await edit.focus();await page.keyboard.press("Enter");
 await page.getByRole("textbox",{name:"Edit Java",exact:true}).fill("Java service development");await page.getByRole("button",{name:"Save suggestion",exact:true}).click();
 await expect(page.getByRole("button",{name:"Accept Java service development",exact:true})).toBeVisible();
 for(const mode of ["light","dark"]){await page.evaluate(mode=>{localStorage.setItem("swx-theme",mode);document.documentElement.classList.toggle("swx-dark",mode==="dark");},mode);
  const region=page.getByRole("region",{name:"AI description assistant"});const heights=await region.getByRole("button").evaluateAll(nodes=>nodes.map(n=>n.getBoundingClientRect().height));expect(heights.every(h=>h>=44)).toBe(true);
  const readContrast=()=>region.locator("h3,h4,p.text-xs").evaluateAll(nodes=>{const canvas=document.createElement("canvas");canvas.width=canvas.height=1;const ctx=canvas.getContext("2d")!;const rgb=(s:string)=>{ctx.clearRect(0,0,1,1);ctx.fillStyle=s;ctx.fillRect(0,0,1,1);const v=Array.from(ctx.getImageData(0,0,1,1).data);return [v[0],v[1],v[2],v[3]/255];};const lum=(v:number[])=>v.slice(0,3).map(x=>{x/=255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4}).reduce((a,x,i)=>a+x*[.2126,.7152,.0722][i],0);return nodes.filter(n=>n.textContent?.trim()).map(n=>{let el:Element|null=n;let bg:number[]=[];while(el){bg=rgb(getComputedStyle(el).backgroundColor);if(bg.length===3||bg[3]>.99)break;el=el.parentElement;}const a=lum(rgb(getComputedStyle(n).color)),b=lum(bg);return(Math.max(a,b)+.05)/(Math.min(a,b)+.05);});});await expect.poll(async()=>Math.min(...await readContrast()),{timeout:5000}).toBeGreaterThanOrEqual(4.5);
 }
 await page.getByRole("button",{name:"Discard draft",exact:true}).click();await expect(page.getByText("Generated draft · not yet applied",{exact:true})).toHaveCount(0);expect(calls).toHaveLength(1);
});

for(const b of blueprints)test(`V11 role context: ${b.title}`,async({page})=>{await start(page,b.title);await generate(page);const preview=page.locator("pre");await expect(preview).toContainText(b.about_role);await expect(preview).toContainText(b.core_responsibilities[0]);await expect(preview).toContainText(b.core_skills[0]);if(b.title!=="Java Backend Developer")await expect(preview).not.toContainText("REST API endpoints");});

const viewports=[[1920,1080],[1440,900],[1366,768],[1024,768],[768,1024],[428,926],[360,800]];
for(const [width,height] of viewports)for(const mode of ["light","dark","system"] as const)test(`V11 visual ${width}x${height} ${mode}`,async({page})=>{
 test.setTimeout(90000);const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));await page.setViewportSize({width,height});
 await page.addInitScript(mode=>localStorage.setItem("swx-theme",mode),mode);await page.emulateMedia({colorScheme:mode==="system"?"dark":"light"});
 await start(page);await generate(page);await fs.mkdir(artifactRoot,{recursive:true});
 const shot=async(state:string)=>{expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);await page.evaluate(()=>{document.documentElement.style.scrollBehavior="auto";if(document.activeElement instanceof HTMLElement)document.activeElement.blur();window.scrollTo(0,0);});await expect.poll(()=>page.evaluate(()=>window.scrollY)).toBe(0);await page.screenshot({path:`${artifactRoot}/${state}-${width}x${height}-${mode}.png`,fullPage:true,animations:"disabled"});};
 await shot("skills");
 if((width===1440&&mode==="light")||(width===360&&mode==="dark")){await page.getByRole("button",{name:"Edit Java",exact:true}).click();await shot("edit-skill");await page.getByRole("button",{name:"Cancel edit",exact:true}).click();}
 if(width===1440){await page.getByRole("group",{name:"Suggestion sections"}).getByRole("button",{name:"Review notes",exact:true}).click();await shot("review-notes");}
 await page.getByRole("group",{name:"Suggestion sections"}).getByRole("button",{name:"Responsibilities",exact:true}).click();await shot("duties");
 await page.getByRole("button",{name:"Use this draft",exact:true}).click();await expect(page.getByRole("complementary",{name:"Candidate preview locked"})).toBeVisible();await shot("editor");
 if(mode==="system"){await page.emulateMedia({colorScheme:"light"});await expect(page.locator("html")).not.toHaveClass(/swx-dark/);await page.emulateMedia({colorScheme:"dark"});await expect(page.locator("html")).toHaveClass(/swx-dark/);}
 expect(errors).toEqual([]);
});
