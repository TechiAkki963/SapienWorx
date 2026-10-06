import { NextResponse, type NextRequest } from "next/server";

// The server cannot see the refresh cookie scoped to /api/v1/auth. Preserve the
// actual local destination for a browser renewal; never trust an incoming header.
export function proxy(request: NextRequest) {
  const headers = new Headers(request.headers);
  headers.set(
    "x-swx-candidate-path",
    request.nextUrl.pathname + request.nextUrl.search,
  );
  return NextResponse.next({ request: { headers } });
}
export const config = {
  matcher: ["/candidate/:path*", "/welcome", "/onboarding/:path*"],
};
