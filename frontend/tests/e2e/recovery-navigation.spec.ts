import { expect,test } from "@playwright/test";
import { login,resetE2E,waitForRecordedRequest } from "./helpers";
test.beforeEach(async({request})=>resetE2E(request));
test("recovery has a safe exit on both steps and rejects external or unapproved return paths",async({page})=>{
 for(const value of ["https://example.invalid/","//example.invalid","/recruiter/settings","/login?next=https://example.invalid/"]){await page.goto(`/forgot-password?returnTo=${encodeURIComponent(value)}`);await expect(page.getByRole("link",{name:"Back to sign in"})).toHaveAttribute("href","/login");}
 await page.goto("/forgot-password?returnTo=%2Frecruiter%2Flogin");await expect(page.getByRole("link",{name:"Back to sign in"})).toHaveAttribute("href","/recruiter/login");await page.getByLabel("Account email").fill("recruiter@example.com");await page.getByRole("button",{name:"Send reset code"}).click();await expect(page.getByRole("link",{name:"Return to sign in"})).toHaveAttribute("href","/recruiter/login");await expect(page.getByRole("heading",{name:"Choose a new password"})).toBeVisible();
});
test("authenticated recovery uses verified identity and returns to the caller's settings",async({page,request})=>{
 await login(page,"recruiter");await page.goto("/recruiter/settings");await page.getByRole("link",{name:"Reset your password"}).click();await expect(page.getByRole("link",{name:"Back to Account Settings"})).toHaveAttribute("href","/recruiter/settings");await expect(page.getByText("recruiter@example.com",{exact:true})).toBeVisible();await expect(page.getByLabel("Account email")).toHaveCount(0);await page.getByRole("button",{name:"Send reset code"}).click();const call=await waitForRecordedRequest(request,item=>item.path==="/api/v1/auth/password/forgot"&&item.method==="POST");expect(call.body).toEqual({email:"recruiter@example.com"});await page.getByRole("link",{name:"Return to Account Settings"}).click();await expect(page).toHaveURL(/\/recruiter\/settings$/);
});
