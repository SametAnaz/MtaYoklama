import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/favicon.ico"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.includes(pathname) || pathname.startsWith("/_next");
  const token = request.cookies.get("mta_session")?.value;

  if (!token && !isPublic) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|.*\\.png$).*)"],
};
