import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=no_code`);
  }

  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: sessionData, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=auth_failed`);
  }

  // Verifica se o email está na tabela de analistas (whitelist)
  const email = sessionData.user?.email;
  const { createServiceClient } = await import("@/lib/supabase/server");
  const serviceClient = createServiceClient();
  const { data: analista } = await serviceClient
    .from("analistas")
    .select("id")
    .eq("email", email)
    .single();

  if (!analista) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/login?error=acesso_negado`);
  }

  return NextResponse.redirect(`${origin}/`);
}
