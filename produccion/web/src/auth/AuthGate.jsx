import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient.js';

export function AuthGate() {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session || null);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess || null);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  if (loading) return <p>Cargando...</p>;

  if (!session) {
    return (
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const { error } = await supabase.auth.signInWithPassword({ email, password });
          if (error) alert(error.message);
        }}
        style={{ maxWidth: 360, display: 'grid', gap: 8 }}
      >
        <h2>Iniciar sesión</h2>
        <input
          placeholder="correo"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          placeholder="contraseña"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button type="submit">Entrar</button>
      </form>
    );
  }

  return (
    <div>
      <p>Sesión activa: {session.user.email}</p>
      <button
        onClick={async () => {
          await supabase.auth.signOut();
        }}
      >
        Cerrar sesión
      </button>
    </div>
  );
}
