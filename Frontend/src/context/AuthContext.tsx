import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

export interface UserProfile {
  _id: string;
  id?: string;
  name: string;
  email: string;
  role: 'mentee' | 'mentor' | 'admin';
  specialty?: string;
  subspecialty?: string;
  careerStage?: string;
  hospital?: string;
  institution?: string;
  mentorVerificationStatus?: 'not_required' | 'pending' | 'verified' | 'rejected';
}

interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  role: 'mentee' | 'mentor' | 'admin' | null;
  isAuthenticated: boolean;
  login: (user: UserProfile, token: string) => void;
  logout: () => void;
  updateUser: (fields: Partial<UserProfile>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('medconnect_token'));
  const [user, setUser] = useState<UserProfile | null>(() => {
    const saved = localStorage.getItem('medconnect_user');
    if (!saved) return null;
    try {
      return JSON.parse(saved);
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (token) {
      localStorage.setItem('medconnect_token', token);
    } else {
      localStorage.removeItem('medconnect_token');
    }
  }, [token]);

  useEffect(() => {
    if (user) {
      localStorage.setItem('medconnect_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('medconnect_user');
    }
  }, [user]);

  const login = (newUser: UserProfile, newToken: string) => {
    setUser(newUser);
    setToken(newToken);
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('medconnect_token');
    localStorage.removeItem('medconnect_user');
  };

  const updateUser = (fields: Partial<UserProfile>) => {
    setUser(prev => (prev ? { ...prev, ...fields } : null));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        role: user?.role || null,
        isAuthenticated: !!token && !!user,
        login,
        logout,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
