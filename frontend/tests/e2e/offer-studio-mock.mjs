// Stateful UI contract fixture. Database/security evidence comes from the real
// isolated Go/PostgreSQL suite; this fixture does not replace authorization tests.
import crypto from "node:crypto";
const owner="20000000-0000-4000-8000-000000000001",candidate="10000000-0000-4000-8000-000000000001",application="70000000-0000-4000-8000-000000000001",job="60000000-0000-4000-8000-000000000001";
const permissions=Object.fromEntries(["view","create","edit","send","withdraw","approve","view_compensation","manage_templates","manage_formulas","manage_approval_policy","download_documents","view_audit"].map(k=>["offer."+k,true]));
const definition={currency:"INR",fields:[{key:"annual_compensation",label:"Annual compensation",kind:"money",currency:"INR",required:true,locked:false}],clauses:[{key:"confidentiality",label:"Confidentiality",text:"Protect company and candidate information.",locked:true}],letter_text:"We are pleased to offer you this role. Please review the terms before responding."};
const timestamp=()=>new Date().toISOString(),hash=value=>crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
function fixture(pipelineRows){const snapshot={...structuredClone(definition),provenance:"governed_v1",title:"Employment offer",annual_compensation:"1800000.00",joining_date:"2027-01-15",expires_at:"2026-12-31",candidate_name:"Aarav Candidate",company_name:"Synthetic QA Company",job_title:"Senior Go Platform Engineer",job_id:job,values:{annual_compensation:"1800000.00"},annexures:[]};
 const version={version:1,revision:1,status:"sent",snapshot,terms_hash:hash(snapshot),created_at:timestamp(),sent_at:timestamp(),approvals:[],documents:[{id:crypto.randomUUID(),version:1,kind:"letter",filename:"offer-letter.pdf",sha256:hash("pdf"),bytes:4000}]};
 return {settings:{branding:{},revision:0,policy:{mode:"none",steps:[],rules:[]},permissions:{...permissions},usage:{offer_templates:0,offer_monthly_sends:1,offer_document_bytes:4000},members:[{user_id:owner,name:"Synthetic Company Owner",role:"primary_admin",permissions:{...permissions}}],entitlements:{managed:false,state:"unmanaged",plan_name:"Synthetic preserved access",features:Object.fromEntries(["studio","templates","formulas","custom_fields","approvals","conditional_approvals","sequential_approvals","parallel_approvals","branding","analytics","annexures"].map(k=>["offers."+k,true])),capacity:{},usage:{},limits_approved:false}},templates:[],offers:[{id:"93000000-0000-4000-8000-000000000001",application_id:application,candidate_id:candidate,candidate_name:snapshot.candidate_name,job_id:job,job_title:snapshot.job_title,job_reference:"SWX-JOB-2026-00001",title:snapshot.title,status:"sent",active_version:1,revision:1,terms_hash:version.terms_hash,snapshot,versions:[version],permissions:{...permissions},candidate:{...pipelineRows()[0],candidate_id:candidate,candidate_name:snapshot.candidate_name,stage:"offer"},updated_at:timestamp(),expires_at:snapshot.expires_at}],commands:{},audit:[]};}
export function handleOfferStudioMock(req,res,url,payload,{state,json,logRequest,pipelineRows,role}){
 const path=url.pathname;if(!path.includes("/offers")&&!path.includes("/offer-templates")&&!path.includes("/offer-governance")&&!path.includes("/offer-applications")&&!path.includes("/offer-attachments"))return false;
 const v=state.offerStudio??=fixture(pipelineRows);logRequest(req,url,payload);
 const fail=(status,message)=>json(res,status,{error:{code:"offer_contract",message}});
 if(path==="/__e2e/offers"&&req.method==="POST"){Object.assign(v,payload);return json(res,200,{ok:true})}
 if(path==="/api/v1/company/offer-governance"){
  if(req.method==="PUT"){if(payload.expected_revision!==v.settings.revision)return fail(409,"Policy changed. Reload before saving.");v.settings={...v.settings,revision:v.settings.revision+1,policy:payload.policy,branding:payload.branding??v.settings.branding};for(const grant of payload.grants??[]){const m=v.settings.members.find(m=>m.user_id===grant.user_id);if(m)m.permissions[grant.permission]=grant.allowed;}return json(res,200,v.settings)}
  return json(res,200,v.settings);
 }
 if(path==="/api/v1/recruiter/offer-applications"){const rows=pipelineRows().slice(0,3).map((p,i)=>({...p,stage:"offer",candidate_id:i? p.candidate_id:candidate,candidate_name:i?p.candidate_name:"Aarav Candidate"}));return json(res,200,{items:rows.filter(p=>!url.searchParams.get("application_id")||p.application_id===url.searchParams.get("application_id"))})}
 if(path==="/api/v1/recruiter/offer-attachments")return fail(503,"Annexure upload is unavailable until the private document scanner is ready.");
 if(req.method==="POST"&&/^\/api\/v1\/recruiter\/offer-templates\/[^/]+\/archive$/.test(path)){const id=path.split("/")[5],max=Math.max(0,...v.templates.filter(t=>t.id===id).map(t=>t.version));if(!max)return fail(404,"Template not found");if(max!==payload.expected_version)return fail(409,"Template changed");v.templates=v.templates.filter(t=>t.id!==id);return json(res,200,{})}
 if(path==="/api/v1/recruiter/offer-templates"&&req.method==="GET")return json(res,200,{items:v.templates});
 if(req.method==="POST"&&(path==="/api/v1/recruiter/offer-templates"||/^\/api\/v1\/recruiter\/offer-templates\/[^/]+\/versions$/.test(path))){
  const id=path.split("/")[5]??"new";const request=JSON.stringify(payload);if(v.commands[payload.command_key]){const saved=v.commands[payload.command_key];return saved.request===request?json(res,201,saved.result):fail(409,"Template command changed")}
  const max=Math.max(0,...v.templates.filter(t=>t.id===id).map(t=>t.version));if(payload.expected_version!==max)return fail(409,"Template changed. Reload the latest version.");
  const result={id:id==="new"?crypto.randomUUID():id,name:payload.name,version_id:crypto.randomUUID(),version:max+1,status:payload.publish?"published":payload.review?"in_review":"draft",definition:payload.definition,hash:hash(payload.definition)};
  v.templates=v.templates.filter(t=>!(t.id===result.id&&t.status===result.status));v.templates.unshift(result);v.commands[payload.command_key]={request,result};return json(res,201,result);
 }
 const candidateRoute=path.includes("/candidate/");
 if(candidateRoute&&role!=="candidate")return fail(403,"Candidate access required");
 if(path==="/api/v1/recruiter/offers"||path==="/api/v1/candidate/offers"){
  if(req.method==="POST"){
   const p=pipelineRows().find(p=>p.application_id===payload.application_id);if(!p)return fail(404,"Application not found");
   const snapshot={...structuredClone(definition),incomplete:Boolean(payload.save_incomplete&&(!payload.values.annual_compensation||!payload.joining_date||!payload.expires_at)),letter_source:payload.letter_text,title:payload.title,currency:payload.currency,annual_compensation:payload.values.annual_compensation,joining_date:payload.joining_date,expires_at:payload.expires_at,values:payload.values,letter_text:payload.letter_text,provenance:"governed_v1",candidate_name:p.candidate_name,company_name:"Synthetic QA Company",job_id:p.job_id,job_title:p.job_title,annexures:[]};
   const version={version:1,revision:1,status:"draft",terms_hash:hash(snapshot),snapshot,created_at:timestamp(),approvals:[],documents:[]};
   const offer={id:crypto.randomUUID(),application_id:p.application_id,candidate_id:p.candidate_id,candidate_name:p.candidate_name,job_id:p.job_id,job_title:p.job_title,job_reference:p.job_reference,title:payload.title,status:"draft",active_version:1,revision:1,terms_hash:version.terms_hash,snapshot,versions:[version],permissions:{...permissions},candidate:p,updated_at:timestamp(),expires_at:payload.expires_at};v.offers.unshift(offer);return json(res,201,offer);
  }
  let items=v.offers.filter(o=>(!candidateRoute||o.candidate_id===candidate&&o.versions.some(x=>x.sent_at))&&(!url.searchParams.get("job_id")||o.job_id===url.searchParams.get("job_id")));
  const counts={};for(const o of items)counts[o.status]=(counts[o.status]??0)+1;const released=items.flatMap(o=>o.versions).filter(x=>x.sent_at);
  const status=url.searchParams.get("status"),q=url.searchParams.get("q")?.toLowerCase();items=items.filter(o=>(!status||o.status===status)&&(!q||(o.candidate_name+o.job_title).toLowerCase().includes(q)));
  const page=Number(url.searchParams.get("page")??1),limit=25;return json(res,200,{items:items.slice((page-1)*limit,page*limit),total:items.length,page,limit,counts,insights:{released_versions:released.length,viewed_versions:released.filter(x=>x.viewed_at).length,accepted_versions:released.filter(x=>x.status==="accepted").length,declined_versions:released.filter(x=>x.status==="declined").length,average_response_hours:null}});
 }
 const id=path.split("/")[5],offer=v.offers.find(o=>o.id===id);if(!offer||candidateRoute&&(offer.candidate_id!==candidate||!offer.versions.some(x=>x.sent_at)))return fail(404,"Offer not found");
 if(path.endsWith("/audit"))return json(res,200,{items:v.audit.filter(e=>e.offer_id===id)});
 if(path.includes("/documents/"))return json(res,200,{download:{url:"https://example.test/private-synthetic-offer.pdf"}});
 if(path.endsWith("/commands")){
  if(offer.snapshot?.incomplete&&["submit","send","preview"].includes(payload.action))return fail(400,"Complete required terms before releasing this private draft.");
  const fingerprint=JSON.stringify({path,payload});const cached=v.commands[payload.command_key];
  if(cached)return cached.request===fingerprint?json(res,200,cached.result):fail(409,"Command payload changed");
  if(payload.expected_version!==offer.active_version||payload.expected_revision!==offer.revision||payload.terms_hash!==offer.terms_hash)return fail(409,"This offer changed. Reload the latest version before continuing.");
  const version=offer.versions.find(v=>v.version===offer.active_version),a=payload.action;
  if(a==="accept"&&!candidateRoute)return fail(403,"Only the candidate may accept");
  if(a==="submit"&&offer.status==="draft")offer.status="approved";
  else if(a==="send"&&offer.status==="approved"){offer.status="sent";version.sent_at=timestamp()}
  else if(a==="view"&&candidateRoute&&offer.status==="sent"){offer.status="viewed";version.viewed_at=timestamp()}
  else if(["accept","decline"].includes(a)&&candidateRoute&&["sent","viewed"].includes(offer.status)){offer.status=a==="accept"?"accepted":"declined";version.responded_at=timestamp()}
  else if(a==="withdraw"&&!candidateRoute){offer.status="withdrawn"}
  else if(a==="preview"){version.documents=[{id:crypto.randomUUID(),version:version.version,kind:"letter",filename:"offer-letter.pdf",sha256:hash("pdf"),bytes:4000}]}
  else if(a!=="clarification")return fail(409,"This action is unavailable for the current version");
  offer.revision++;version.revision=offer.revision;version.status=offer.status;v.audit.push({offer_id:id,version:version.version,kind:a,actor_name:candidateRoute?"Aarav Candidate":"Synthetic Company Owner",detail:{reason:payload.reason??""},occurred_at:timestamp()});v.commands[payload.command_key]={request:fingerprint,result:structuredClone(offer)};return json(res,200,offer);
 }
 return json(res,200,offer);
}
