import { describe, expect, it, vi } from 'vitest';

const mockCookieStore = {
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
  getAll: vi.fn().mockReturnValue([]),
};

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockImplementation(async () => mockCookieStore),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
      signInWithPassword: vi.fn().mockResolvedValue({ error: null }),
    },
    from: vi.fn(),
  }),
}));

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

import { getCurrentUser, DEMO_USERS } from '../auth';
import { loginDemoAction, logoutAction } from '../auth-actions';

describe('Rol FRIGORIFICO mockeado con cookie muunar_demo_rol', () => {
  it('getCurrentUser resuelve el perfil de Frigorífico cuando existe la cookie', async () => {
    mockCookieStore.get.mockImplementation((name: string) => {
      if (name === 'muunar_demo_rol') return { value: 'FRIGORIFICO' };
      return undefined;
    });

    const user = await getCurrentUser();
    expect(user).not.toBeNull();
    expect(user?.rol).toBe('FRIGORIFICO');
    expect(user?.nombre_completo).toBe(DEMO_USERS.FRIGORIFICO.nombre_completo);
    expect(user?.cuit).toBe(DEMO_USERS.FRIGORIFICO.cuit);
    expect(user?.wallet).toBe(DEMO_USERS.FRIGORIFICO.wallet);
    expect(user?.tipo_comprador).toBe('FRIGORIFICO_EXPORTADOR');
  });

  it('loginDemoAction("FRIGORIFICO") setea la cookie muunar_demo_rol', async () => {
    mockCookieStore.set.mockClear();
    await loginDemoAction('FRIGORIFICO');

    expect(mockCookieStore.set).toHaveBeenCalledWith(
      'muunar_demo_rol',
      'FRIGORIFICO',
      expect.objectContaining({ path: '/', httpOnly: true }),
    );
  });

  it('logoutAction borra la cookie muunar_demo_rol', async () => {
    mockCookieStore.delete.mockClear();
    await logoutAction();

    expect(mockCookieStore.delete).toHaveBeenCalledWith('muunar_demo_rol');
  });
});
