export const recruitmentStages = ["new_application","screening","shortlisted","technical_interview","hr_round","final_interview","offer","hired","rejected","withdrawn"];
export const interviewStatuses = ["scheduled","completed","cancelled","no_show"];
export const recruitmentDate = (value: string) => new Date(value).toLocaleString("en-IN",{timeZone:"UTC"})+" UTC";
export function recruitmentQuery(params: Record<string,string|string[]|undefined>) {
  const query = new URLSearchParams({limit:"25"});
  for (const key of ["q","company_id","country","job_id","stage","status","from","before","upcoming","page"]) {
    const raw = params[key]; const value = Array.isArray(raw) ? raw[0] : raw;
    if (value) query.set(key,value);
  }
  if (!query.has("page")) query.set("page","1");
  return query;
}
export function recruitmentHref(path: string, query: URLSearchParams, page: number) {
  const next = new URLSearchParams(query); next.delete("limit"); next.set("page",String(page));
  return path+"?"+next;
}
