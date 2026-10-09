export type CandidateReferralSummary = {
 id:string; candidate_name:string; job_id?:string; job_title?:string; company_name:string;
 status:string; created_at:string; expires_at:string;referral_status?:string;hiring_progress?:string;reward_progress?:string;reward_programme?:boolean;
};
export type CandidateReferralList={items:CandidateReferralSummary[];total:number;page:number;limit:number};
export const referralStatuses:Record<string,string>={invitation_queued:"Invitation queued",invitation_sent:"Invitation sent",viewed:"Viewed",joined:"Joined",applied:"Applied",in_process:"In process",successful:"Successful",not_proceeding:"Not proceeding",expired:"Expired"};
export function referralProgress(item:CandidateReferralSummary){
 const status=item.status;
 const referral=item.referral_status||(["joined","applied","in_process","successful"].includes(status)?"accepted":status==="expired"?"expired":status==="not_proceeding"?"closed":"invited");
 const hiring=item.hiring_progress||(["applied","in_process","successful"].includes(status)?status:"");
 const text=(value:string)=>value.replaceAll("_"," ").replace(/^./,letter=>letter.toUpperCase());
 return {referral:text(referral),hiring:hiring?text(hiring):"Not applied",reward:item.reward_progress?text(item.reward_progress):item.reward_programme?"Not yet eligible":"No reward programme"};
}
