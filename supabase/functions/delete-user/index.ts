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

    // Verify caller is an admin
    const token = req.headers.get('Authorization')?.replace('Bearer ', '') ?? '';
    const { data: { user: caller }, error: callerErr } = await supabaseAdmin.auth.getUser(token);
    if (callerErr || !caller) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }
    const { data: callerProfile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', caller.id)
      .single();
    if (callerProfile?.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: corsHeaders });
    }

    const { user_id } = await req.json();
    if (!user_id) {
      return new Response(JSON.stringify({ error: 'user_id diperlukan' }), { status: 400, headers: corsHeaders });
    }

    // Prevent self-deletion
    if (user_id === caller.id) {
      return new Response(JSON.stringify({ error: 'Tidak bisa menghapus akun sendiri' }), { status: 400, headers: corsHeaders });
    }

    // Delete from auth.users — cascades to profiles and all related rows
    const { error: deleteErr } = await supabaseAdmin.auth.admin.deleteUser(user_id);
    if (deleteErr) {
      return new Response(JSON.stringify({ error: deleteErr.message }), { status: 400, headers: corsHeaders });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders });
  }
});
