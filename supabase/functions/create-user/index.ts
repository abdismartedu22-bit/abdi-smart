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

    // Verify the caller is an admin
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '') ?? '';
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

    const { email, password, username, display_name, role, group_ids } = await req.json();

    if (!email || !password || !username || !display_name || !role) {
      return new Response(JSON.stringify({ error: 'Field tidak lengkap' }), { status: 400, headers: corsHeaders });
    }

    // Create the auth user
    const { data: newUserData, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (createErr) {
      return new Response(JSON.stringify({ error: createErr.message }), { status: 400, headers: corsHeaders });
    }
    const newUserId = newUserData.user!.id;

    // Update the profile row (trigger already created the row)
    const { error: profileErr } = await supabaseAdmin
      .from('profiles')
      .update({ username, display_name, role })
      .eq('id', newUserId);
    if (profileErr) {
      return new Response(JSON.stringify({ error: profileErr.message }), { status: 500, headers: corsHeaders });
    }

    // Assign to groups if student
    if (role === 'student' && Array.isArray(group_ids) && group_ids.length > 0) {
      await supabaseAdmin.from('student_groups').insert(
        group_ids.map((gid: string) => ({ student_id: newUserId, group_id: gid }))
      );
    }

    return new Response(JSON.stringify({ id: newUserId }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders });
  }
});
