import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '') ?? '';
    const { data: { user: caller } } = await supabaseAdmin.auth.getUser(token);
    if (!caller) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });

    const { data: callerProfile } = await supabaseAdmin
      .from('profiles').select('role').eq('id', caller.id).single();
    if (callerProfile?.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: corsHeaders });
    }

    const { user_id, new_password } = await req.json();
    if (!user_id || !new_password) {
      return new Response(JSON.stringify({ error: 'user_id dan new_password wajib' }), { status: 400, headers: corsHeaders });
    }

    const { error } = await supabaseAdmin.auth.admin.updateUserById(user_id, { password: new_password });
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: corsHeaders });

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders });
  }
});
