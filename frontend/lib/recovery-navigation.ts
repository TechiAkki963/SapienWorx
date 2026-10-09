export function recoveryNavigation(returnTo: string | undefined, role?: string) {
  const signIn = role === "recruiter" ? "/recruiter/login" : "/login";
  const routes: Record<string,{href:string;label:string}> = {
    "/login": {href:"/login",label:"sign in"},
    "/recruiter/login": {href:"/recruiter/login",label:"sign in"},
  };
  if(role==="candidate") { routes["/candidate/settings"]={href:"/candidate/settings",label:"Account Settings"};routes["/candidate/settings#security"]={href:"/candidate/settings#security",label:"Security"}; }
  if(role==="recruiter") { routes["/recruiter/settings"]={href:"/recruiter/settings",label:"Account Settings"};routes["/recruiter/settings#security"]={href:"/recruiter/settings#security",label:"Security"}; }
  return { ...(returnTo && routes[returnTo] || {href:signIn,label:"sign in"}), signIn };
}
