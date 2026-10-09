import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return response;
  }

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        response = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();

  const url = request.nextUrl.clone();
  const pathname = url.pathname;

  // Handle /login
  if (pathname === '/login') {
    if (user) {
      // User is already logged in, redirect to root which will route by role
      url.pathname = '/';
      return NextResponse.redirect(url);
    }
    return response;
  }

  // If user is not authenticated and trying to access protected paths
  if (!user) {
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // Fetch user profile to check role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, active')
    .eq('id', user.id)
    .single();

  if (!profile || !profile.active) {
    // If user account is inactive or profile missing, sign out and redirect to login
    url.pathname = '/login';
    url.searchParams.set('error', 'Account inactive or disabled.');
    return NextResponse.redirect(url);
  }

  // Route root / to appropriate dashboard
  if (pathname === '/') {
    if (profile.role === 'admin') {
      url.pathname = '/admin';
    } else {
      url.pathname = '/worker';
    }
    return NextResponse.redirect(url);
  }

  // Worker trying to access admin dashboard
  if (pathname.startsWith('/admin') && profile.role !== 'admin') {
    url.pathname = '/worker';
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     * - api/* (API routes - they handle auth themselves and must return JSON)
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico and other static assets
     */
    '/((?!api|_next/static|_next/image|favicon\\.ico|.*\\..*).*)',
  ],
};
