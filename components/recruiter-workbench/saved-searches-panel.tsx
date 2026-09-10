"use client";
import { apiClient } from "../../lib/api-client";
import { Button } from "../ui";
import type { SavedSearch } from "./types";
export default function SavedSearchesPanel({items,onChanged}:{items:SavedSearch[];onChanged:()=>void}){
 const remove=async(id:string)=>{await apiClient<void>(`/api/recruiter/workflow/saved-searches/${id}`,{method:"DELETE"});onChanged()};
 return <section className="panel workflow-list"><header className="section-title"><div><span className="eyebrow">Reusable sourcing</span><h2>Saved searches</h2></div><Button href="/recruiter/sourcing" variant="secondary">New search</Button></header>{items.length?items.map(item=><article key={item.id}><div><strong>{item.name}</strong><p>{item.alertFrequency==="OFF"?"Alerts off":`${item.alertFrequency.toLowerCase()} alerts`} · Updated {new Date(item.updatedAt).toLocaleDateString()}</p></div><div><Button href="/recruiter/sourcing" variant="quiet">Open</Button><Button variant="quiet" onClick={()=>void remove(item.id)}>Remove</Button></div></article>):<div className="empty-state"><strong>No saved searches yet.</strong><p>Save professional search criteria so you can reuse them without rebuilding filters.</p><Button href="/recruiter/sourcing">Create a search</Button></div>}</section>;
}
