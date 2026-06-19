import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === '/' || pathname.startsWith('/auth') || pathname.startsWith('/pricing') || pathname.startsWith('/features') || pathname.startsWith('/blog') || pathname.startsWith('/contact') || pathname.startsWith('/shared')) {
    return NextResponse.next();
  }

  if (pathname.startsWith('/dashboard') || pathname.startsWith('/api/protected')) {
    const token = request.cookies.get('auth_token');
    if (!token) {
      return NextResponse.redirect(new URL('/auth/login', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/api/protected/:path*'],
};
