import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

function copyCookies(from: NextResponse, to: NextResponse) {
  from.cookies.getAll().forEach((cookie) => {
    to.cookies.set(cookie.name, cookie.value);
  });
}

function redirectPreservingSession(
  request: NextRequest,
  pathname: string,
  sessionResponse: NextResponse,
  search?: Record<string, string>,
) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";
  if (search) {
    for (const [k, v] of Object.entries(search)) {
      url.searchParams.set(k, v);
    }
  }
  const redirectResponse = NextResponse.redirect(url);
  copyCookies(sessionResponse, redirectResponse);
  return redirectResponse;
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isAdmin = path.startsWith("/admin");
  const isLogin = path === "/admin/login" || path.startsWith("/admin/login/");
  const isNoTenant =
    path === "/admin/sin-negocio" || path.startsWith("/admin/sin-negocio/");
  // PWA assets under /admin must be publicly fetchable (JSON, not login HTML)
  const isAdminPublicAsset =
    path === "/admin/manifest.webmanifest" ||
    path.endsWith(".webmanifest");
  const isSaLogin =
    path === "/super-admin/login" || path.startsWith("/super-admin/login/");
  const isSuperAdminArea = path.startsWith("/super-admin");

  // Tenant admin area
  if (isAdmin && !isLogin && !isNoTenant && !isAdminPublicAsset && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/login";
    url.searchParams.set("next", path);
    const redirectResponse = NextResponse.redirect(url);
    copyCookies(supabaseResponse, redirectResponse);
    return redirectResponse;
  }

  // Super-admin: unauthenticated → dedicated login
  if (isSuperAdminArea && !isSaLogin && !user) {
    return redirectPreservingSession(
      request,
      "/super-admin/login",
      supabaseResponse,
      { next: path },
    );
  }

  // Super-admin login: already SA → console
  if (isSaLogin && user) {
    const { data: sa } = await supabase
      .from("restaurant_members")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "super_admin")
      .limit(1)
      .maybeSingle();
    if (sa) {
      const next = request.nextUrl.searchParams.get("next");
      const dest =
        next &&
        next.startsWith("/super-admin") &&
        !next.startsWith("/super-admin/login")
          ? next
          : "/super-admin";
      return redirectPreservingSession(request, dest, supabaseResponse);
    }
    // Non-SA session: stay on login page (UI shows sign-out)
    return supabaseResponse;
  }

  if (isLogin && user) {
    const next = request.nextUrl.searchParams.get("next");
    let dest =
      next && next.startsWith("/") && !next.startsWith("//") ? next : null;

    if (
      !dest ||
      dest.startsWith("/admin/login") ||
      dest.startsWith("/admin/sin-negocio")
    ) {
      const { data: sa } = await supabase
        .from("restaurant_members")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "super_admin")
        .limit(1)
        .maybeSingle();
      dest = sa ? "/super-admin" : "/admin";
    }

    return redirectPreservingSession(request, dest, supabaseResponse);
  }

  // Super-admin console: must be SA (else login with reason)
  if (isSuperAdminArea && !isSaLogin && user) {
    const { data } = await supabase
      .from("restaurant_members")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "super_admin")
      .limit(1)
      .maybeSingle();
    if (!data) {
      return redirectPreservingSession(
        request,
        "/super-admin/login",
        supabaseResponse,
        { next: path, reason: "not-sa" },
      );
    }
  }

  return supabaseResponse;
}
