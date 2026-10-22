import { NextResponse, type NextRequest } from "next/server";

const productionHosts = new Set(["sapienworx.com", "www.sapienworx.com"]);

// The server cannot see the refresh cookie scoped to /api/v1/auth. Preserve the
// actual local destination for a browser renewal; never trust an incoming header.
export function proxy(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  if (
    request.nextUrl.pathname.startsWith("/candidate/") ||
    request.nextUrl.pathname === "/candidate" ||
    request.nextUrl.pathname === "/welcome" ||
    request.nextUrl.pathname.startsWith("/onboarding/") ||
    request.nextUrl.pathname === "/onboarding"
  ) {
    requestHeaders.set(
      "x-swx-candidate-path",
      request.nextUrl.pathname + request.nextUrl.search,
    );
  }

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  const host = request.headers.get("host")?.split(":")[0]?.toLowerCase() ?? "";
  if (!productionHosts.has(host)) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  }
  return response;
}

export const config = {
  matcher: ["/((?!api/|_next/static/|_next/image/|favicon.ico).*)"],
};
