import { User } from '@shared/schema';

export function getStoredUser(): User | null {
  try {
    const raw = localStorage.getItem('user');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed) return null;

    let user = parsed;
    // Unwrap if wrapped as { user: { ... } }
    if (parsed.user && typeof parsed.user === 'object' && parsed.user.id) {
      user = parsed.user;
      localStorage.setItem('user', JSON.stringify(user));
    }

    if (!user || !user.id || isNaN(Number(user.id))) return null;
    return user as User;
  } catch {
    return null;
  }
}

export function setStoredUser(user: any): void {
  const actualUser = user?.user && typeof user.user === 'object' && user.user.id ? user.user : user;
  localStorage.setItem('user', JSON.stringify(actualUser));
  window.dispatchEvent(new Event('storage'));
}

export function clearStoredUser(): void {
  localStorage.removeItem('user');
  window.dispatchEvent(new Event('storage'));
}
