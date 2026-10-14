import {test,expect} from "@playwright/test";
// A missing JS bundle must never put credentials into history or query logs.
for(const[route,emailLabel,button]of[["/login","Email","Sign in"],["/recruiter/login","Work email","Sign in"],["/swx-command-centre","Email","Enter command centre"]]){
 test(`native sign-in uses a request body without JavaScript: ${route}`,async({browser,baseURL})=>{
  const context=await browser.newContext({javaScriptEnabled:false}),page=await context.newPage();const target=new URL(route,baseURL).toString();
  await page.route(target,async request=>{if(request.request().method()==="POST")await request.fulfill({status:405,contentType:"text/html",body:"<p>JavaScript is required for sign-in.</p>"});else await request.continue()});
  await page.goto(target);await page.getByLabel(emailLabel,{exact:true}).fill("native-form@example.test");await page.getByLabel("Password",{exact:true}).fill("Synthetic-native-form-123!");const pending=page.waitForRequest(request=>request.url()===target&&request.method()==="POST");await page.getByRole("button",{name:button,exact:true}).click();const posted=await pending;expect(posted.url()).toBe(target);expect(posted.postData()).toContain("password=");expect(new URL(page.url()).search).toBe("");await context.close();
 });
}
