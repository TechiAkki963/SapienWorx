import { cookies } from "next/headers";
import { API_URL } from "@/lib/api";

export class RecruiterBackendError extends Error { constructor(message:string, public status:number){super(message);} }
async function parse(response:Response){try{const body=await response.json() as {error?:{message?:string}};return body.error?.message ?? "Request failed.";}catch{return "Request failed.";}}
export async function recruiterAPI<T>(path:string):Promise<T>{const store=await cookies();const response=await fetch(`${API_URL}${path}`,{headers:{cookie:store.toString()},cache:"no-store"});if(!response.ok)throw new RecruiterBackendError(await parse(response),response.status);return await response.json() as T;}
