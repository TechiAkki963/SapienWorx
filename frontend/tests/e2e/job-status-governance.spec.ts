import {expect,test} from "@playwright/test";
import {login,resetE2E,recordedRequests} from "./helpers";
test.beforeEach(async({request})=>resetE2E(request));
test("Job pause is optimistic and Undo preserves the current status precondition",async({page,request})=>{
 await login(page,"recruiter");await page.goto("/recruiter/jobs");const control=page.getByRole("button",{name:"Job status",exact:true}).first();await control.click();await page.getByRole("button",{name:"Paused",exact:true}).click();await expect(control).toContainText("Paused");await page.getByRole("button",{name:"Undo",exact:true}).first().click();await expect(control).toContainText("Active");
 const writes=(await recordedRequests(request)).filter(r=>r.path.endsWith("/status"));expect(writes).toHaveLength(2);expect(writes[0].body).toMatchObject({status:"paused",expected_status:"active"});expect(writes[1].body).toMatchObject({status:"active",expected_status:"paused",reason:"Undo recent job status change"});
});
test("Closing a job requires a centered confirmation with an audited reason",async({page,request})=>{
 await login(page,"recruiter");await page.goto("/recruiter/jobs");await page.getByRole("button",{name:"Job status",exact:true}).first().click();await page.getByRole("button",{name:"Closed",exact:true}).click();const dialog=page.getByRole("dialog",{name:"Confirm job status change"});await expect(dialog).toBeVisible();const confirm=dialog.getByRole("button",{name:"Confirm job change"});await expect(confirm).toBeDisabled();expect((await recordedRequests(request)).filter(r=>r.path.endsWith("/status"))).toHaveLength(0);
 await dialog.getByLabel("Reason for job status change").fill("Hiring for this position has been completed.");await confirm.click();await expect(dialog).not.toBeVisible();await expect(page.getByRole("button",{name:"Job status",exact:true}).first()).toContainText("Closed");expect((await recordedRequests(request)).find(r=>r.path.endsWith("/status"))?.body).toMatchObject({status:"closed",expected_status:"active",reason:"Hiring for this position has been completed."});
});
