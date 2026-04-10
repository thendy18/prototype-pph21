import { NextResponse, type NextRequest } from 'next/server';
import { getAppUserById } from './lib/appUsers';
import {
  applySupabaseCookies,
  createSupabaseProxyClient,
} from './lib/supabaseServer';

function redirectWithCookies(
  source: NextResponse,
  request: NextRequest,
  pathname: string,
  query?: Record<string, string>
): NextResponse {
  const url = new URL(pathname, request.url);

  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
  }

  return applySupabaseCookies(source, NextResponse.redirect(url));
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isLoginRoute = pathname === '/login';
  const isUsersRoute = pathname.startsWith('/users');

  const { supabase, getResponse } = createSupabaseProxyClient(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    if (isLoginRoute) {
      return getResponse();
    }

    return redirectWithCookies(getResponse(), request, '/login', {
      reason: 'signin',
    });
  }

  const profile = await getAppUserById(user.id);

  if (!profile || !profile.isActive) {
    await supabase.auth.signOut();
    return redirectWithCookies(getResponse(), request, '/login', {
      reason: 'inactive',
    });
  }

  if (isLoginRoute) {
    return redirectWithCookies(getResponse(), request, '/bulk');
  }

  if (isUsersRoute && profile.role !== 'master') {
    return redirectWithCookies(getResponse(), request, '/unauthorized');
  }

  return getResponse();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
