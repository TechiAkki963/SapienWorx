export type CandidateReferralSummary = {
 id:string; candidate_name:string; job_id?:string; job_title?:string; company_name:string;
 status:string; created_at:string; expires_at:string;
};
export type CandidateReferralList={items:CandidateReferralSummary[];total:number;page:number;limit:number};
export const referralStatuses:Record<string,string>={invitation_queued:"Invitation queued",invitation_sent:"Invitation sent",viewed:"Viewed",joined:"Joined",applied:"Applied",in_process:"In process",successful:"Successful",not_proceeding:"Not proceeding",expired:"Expired"};
