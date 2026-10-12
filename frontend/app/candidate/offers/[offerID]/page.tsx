import {notFound} from "next/navigation";
import {candidateAPI,BackendResponseError} from "@/lib/candidate-server";
import {requireRole} from "@/lib/auth-server";
import {OfferDetail} from "@/components/recruiter/offer-detail";
import type {GovernedOffer} from "@/lib/offers";
export const dynamic="force-dynamic";
export default async function CandidateOffer({params}:{params:Promise<{offerID:string}>}){
 const user=await requireRole("candidate");const {offerID}=await params;let item:GovernedOffer;
 try{item=await candidateAPI<GovernedOffer>(`/api/v1/candidate/offers/${encodeURIComponent(offerID)}`)}catch(cause){if(cause instanceof BackendResponseError&&[403,404].includes(cause.status))notFound();throw cause}
 return <div className="pb-24"><OfferDetail initial={item} userID={user.id} candidate/></div>
}
