import { useCallback, useEffect, useState } from 'react';
import {
  createUsuario as createUsuarioRemote,
  fetchUsuarios,
  updateUsuarioPapel as updateUsuarioPapelRemote,
} from '../services/usuariosRepo';
import type { Papel, Usuario } from '../types';

export function useUsuarios(enabled: boolean) {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    fetchUsuarios()
      .then((data) => {
        setUsuarios(data);
        setLoaded(true);
      })
      .catch((err) => console.error('Falha ao carregar usuários do Supabase', err));
  }, [enabled]);

  const createUsuario = useCallback(async (email: string, password: string, papel: Papel) => {
    const created = await createUsuarioRemote(email, password, papel);
    setUsuarios((current) => [...current, created]);
    return created;
  }, []);

  const updateUsuarioPapel = useCallback(async (userId: string, papel: Papel) => {
    await updateUsuarioPapelRemote(userId, papel);
    setUsuarios((current) => current.map((u) => (u.userId === userId ? { ...u, papel } : u)));
  }, []);

  return { usuarios, loaded, createUsuario, updateUsuarioPapel };
}
