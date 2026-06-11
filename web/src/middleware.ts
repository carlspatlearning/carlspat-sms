import { NextRequest, NextResponse } from "next/server";

/**
 * Gate /dashboard behind the session cookie. The cookie is only a signal that
 * a login happened in this browser — every API call is still verified with the
 * real JWT server-side. Logged-out visitors are bounced to /login.
 */
export function middleware(req: NextRequest) {
  const hasSession = req.cookies.has("cps_session");
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/dashboard") && !hasSession) {
    const login = new URL("/login", req.url);
    login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }
  if (pathname === "/login" && hasSession) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/login"],
};
