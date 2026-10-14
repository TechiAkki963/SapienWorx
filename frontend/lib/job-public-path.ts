export function canonicalJobPath(reference?: string) {
    return reference && /^SWX-JOB-\d{4}-\d{5,10}$/.test(reference) ? "/jobs/" + reference : null;
}
export function safeCanonicalJobURL(value: string) {
    try {
        const url = new URL(value);
        const local = ["localhost", "127.0.0.1"].includes(url.hostname);
        if (!local && !["beta.sapienworx.com", "www.sapienworx.com", "sapienworx.com"].includes(url.hostname))
            return null;
        if (url.protocol !== "https:" && !(local && url.protocol === "http:"))
            return null;
        if (url.username || url.password || url.search || url.hash || !/^\/jobs\/SWX-JOB-\d{4}-\d{5,10}$/.test(url.pathname))
            return null;
        return url.href;
    }
    catch {
        return null;
    }
}
