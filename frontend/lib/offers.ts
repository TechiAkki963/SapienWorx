import type { PipelineRow } from "./recruiter";
import type { CompanyEntitlements } from "./company";
export type OfferField={key:string;label:string;kind:"money"|"number"|"percent"|"text"|"date"|"boolean"|"select"|"section";options?:string[];currency?:string;required:boolean;locked:boolean;default?:string;formula?:string};
export type OfferClause={key:string;label:string;text:string;locked:boolean;optional?:boolean};
export type OfferAttachment={id:string;filename:string;sha256:string;bytes:number};
export type OfferDefinition={currency:string;fields:OfferField[];clauses:OfferClause[];letter_text:string};
export type OfferBranding={accent?:string;address?:string;signatory?:string;logo_data_url?:string};
export const offerLetterVariables=["candidate_name","company_name","job_title","joining_date","expires_at","currency","title"];
export type OfferSnapshot=OfferDefinition & {employment_type?:string;work_mode?:string;work_location?:string;department?:string;incomplete?:boolean;letter_source?:string;clause_sources?:Record<string,string>;branding?:OfferBranding;template_version_id?:string;provenance:string;title:string;annual_compensation:string;joining_date:string;expires_at:string;candidate_name:string;company_name:string;job_title:string;job_id:string;values:Record<string,string>;annexures:OfferAttachment[]};
export type OfferApproval={step:number;user_id:string;name:string;decision:string;reason:string;acted_at?:string};
export type OfferDocument={id:string;version:number;kind:string;filename:string;sha256:string;bytes:number};
export type OfferVersion={version:number;revision:number;status:string;terms_hash:string;snapshot?:OfferSnapshot;created_at:string;sent_at?:string;viewed_at?:string;responded_at?:string;approvals:OfferApproval[];documents:OfferDocument[]};
export type GovernedOffer={id:string;application_id:string;candidate_id:string;candidate_name:string;job_id:string;job_title:string;job_reference:string;title:string;status:string;active_version:number;revision:number;terms_hash:string;updated_at:string;expires_at?:string;snapshot?:OfferSnapshot;permissions:Record<string,boolean>;versions?:OfferVersion[];candidate?:PipelineRow};
export type OfferList={items:GovernedOffer[];total:number;page:number;limit:number;counts:Record<string,number>;insights?:{released_versions:number;viewed_versions:number;accepted_versions:number;declined_versions:number;average_response_hours:number|null}};
export type OfferTemplate={owner_name?:string;updated_at?:string;id:string;name:string;version_id:string;version:number;status:string;definition:OfferDefinition;hash:string};
export type OfferStep={user_ids:string[];role?:string;department?:string};
export type OfferRule={field:string;operator:string;value:string;steps:OfferStep[]};
export type OfferPolicy={mode:"none"|"single"|"sequential"|"parallel"|"conditional";steps:OfferStep[];rules:OfferRule[]};
export type OfferSettings={branding?:OfferBranding;revision:number;policy:OfferPolicy;permissions:Record<string,boolean>;entitlements:CompanyEntitlements;usage:Record<string,number>;members:{user_id:string;name:string;role:string;permissions:Record<string,boolean>}[]};
export const offerStatuses=["draft","awaiting_approval","approved","sent","viewed","accepted","declined","withdrawn","expired","cancelled"];
export const offerStatus=(status:string)=>status==="awaiting_approval"?"Awaiting approval":status==="pending_revision"?"Revision being prepared":status.replaceAll("_"," ").replace(/^./,s=>s.toUpperCase());
export function offerDate(value?:string){return value?new Date(value).toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric",timeZone:"UTC"}):"Not set"}
export function offerMoney(currency:string,value?:string){if(!value)return "Not set";const [integer,fraction]=value.split(".");return `${currency} ${integer.replace(/\B(?=(\d{3})+(?!\d))/g,",")}${fraction!=null?"."+fraction:""}`}
export const basicOfferDefinition:OfferDefinition={currency:"INR",fields:[{key:"annual_compensation",label:"Annual compensation",kind:"money",currency:"INR",required:true,locked:false}],clauses:[],letter_text:"We are pleased to offer you the position described below. Please review your compensation, joining date and the terms of this offer before responding."};
