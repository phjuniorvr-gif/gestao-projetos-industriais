import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Não autenticado.' }, 401);

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: callerData, error: callerError } = await callerClient.auth.getUser();
  if (callerError || !callerData.user) return json({ error: 'Não autenticado.' }, 401);

  const { data: callerPerfil } = await adminClient
    .from('perfis')
    .select('papel')
    .eq('user_id', callerData.user.id)
    .maybeSingle();

  if (callerPerfil?.papel !== 'administrador') {
    return json({ error: 'Só administrador pode criar usuários.' }, 403);
  }

  let body: { email?: string; password?: string; papel?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Corpo inválido.' }, 400);
  }

  const { email, password, papel } = body;
  if (!email || !password || (papel !== 'usuario' && papel !== 'administrador' && papel !== 'visualizador')) {
    return json({ error: 'Preencha e-mail, senha e papel (usuario, administrador ou visualizador).' }, 400);
  }
  if (password.length < 6) {
    return json({ error: 'A senha precisa ter pelo menos 6 caracteres.' }, 400);
  }

  const { data: created, error: createError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createError || !created.user) {
    return json({ error: createError?.message ?? 'Não foi possível criar o usuário.' }, 400);
  }

  const { error: insertError } = await adminClient
    .from('perfis')
    .insert({ user_id: created.user.id, email, papel });
  if (insertError) {
    await adminClient.auth.admin.deleteUser(created.user.id);
    return json({ error: `Falha ao gravar perfil: ${insertError.message}` }, 400);
  }

  return json({ userId: created.user.id, email, papel });
});
