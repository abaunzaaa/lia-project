import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { User as FirebaseUser, onAuthStateChanged } from 'firebase/auth';
import * as SecureStore from 'expo-secure-store';
import {
  initFirebase,
  getFirebaseAuth,
  loginUser,
  registerUser,
  logoutUser,
  resetPassword,
  getUserProfile,
  updateUserProfile,
} from '../services/firebaseService';
import {
  clearAuthToken,
  fetchMe,
  getAuthToken,
  loginWithApi,
  registerWithApi,
  saveAuthToken,
  updateEmergencyContactWithApi,
} from '../services/authApi';
import { cancelLiaMedicationNotifications } from '../services/notificationService';
import { stopSpeaking } from '../services/speechService';
import { FIREBASE_ENABLED } from '../config/firebase';
import { User } from '../types';

interface AuthContextType {
  user: User | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  isDemo: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginDemo: () => void;
  register: (data: {
    fullName: string;
    email: string;
    password: string;
    age: number;
    emergencyContact: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateEmergencyContact: (emergencyContact: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const KEEP_SESSION_KEY = 'lia_keep_session';

const DEMO_USER: User = {
  uid: 'demo-user',
  fullName: 'María García',
  email: 'demo@lia.app',
  age: 68,
  emergencyContact: '+57 300 123 4567',
  allergies: ['Penicilina'],
  createdAt: new Date().toISOString(),
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDemo, setIsDemo] = useState(false);

  /** Restaura sesión JWT desde SecureStore → GET /auth/me */
  const restoreJwtSession = useCallback(async () => {
    const token = await getAuthToken();
    if (!token) {
      setUser(null);
      return;
    }

    try {
      const profile = await fetchMe(token);
      setUser(profile);
      setIsDemo(false);
    } catch {
      await clearAuthToken();
      setUser(null);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;
    let timeout: ReturnType<typeof setTimeout> | undefined;

    async function bootstrap() {
      if (!FIREBASE_ENABLED) {
        try {
          await restoreJwtSession();
        } finally {
          if (!cancelled) setLoading(false);
        }
        return;
      }

      try {
        initFirebase();
        const auth = getFirebaseAuth();
        timeout = setTimeout(() => {
          if (!cancelled) setLoading(false);
        }, 5000);

        unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
          if (timeout) clearTimeout(timeout);
          if (cancelled) return;
          setFirebaseUser(fbUser);
          if (fbUser) {
            try {
              const profile = await getUserProfile(fbUser.uid);
              setUser(profile);
            } catch {
              /* perfil no disponible */
            }
          } else if (!isDemo) {
            setUser(null);
          }
          setLoading(false);
        });
      } catch {
        if (!cancelled) setLoading(false);
      }
    }

    void bootstrap();

    return () => {
      cancelled = true;
      if (timeout) clearTimeout(timeout);
      unsubscribe?.();
    };
  }, [isDemo, restoreJwtSession]);

  const login = useCallback(async (email: string, password: string) => {
    if (FIREBASE_ENABLED) {
      const profile = await loginUser(email, password);
      setUser(profile);
      setIsDemo(false);
      await SecureStore.setItemAsync(KEEP_SESSION_KEY, 'true');
      return;
    }

    const { user: profile, token } = await loginWithApi(email, password);
    await saveAuthToken(token);
    setIsDemo(false);
    setUser(profile);
  }, []);

  const register = useCallback(
    async (data: {
      fullName: string;
      email: string;
      password: string;
      age: number;
      emergencyContact: string;
    }) => {
      if (FIREBASE_ENABLED) {
        const profile = await registerUser(data);
        setUser(profile);
        setIsDemo(false);
        return;
      }

      const { user: profile, token } = await registerWithApi(data);
      await saveAuthToken(token);
      setIsDemo(false);
      setUser(profile);
    },
    []
  );

  const loginDemo = useCallback(() => {
    void cancelLiaMedicationNotifications();
    void clearAuthToken();
    setUser(DEMO_USER);
    setIsDemo(true);
    setLoading(false);
  }, []);

  const logout = useCallback(async () => {
    await cancelLiaMedicationNotifications();
    await stopSpeaking();

    if (isDemo) {
      setUser(null);
      setIsDemo(false);
      return;
    }

    if (FIREBASE_ENABLED) {
      await logoutUser();
      await SecureStore.deleteItemAsync(KEEP_SESSION_KEY);
    } else {
      await clearAuthToken();
    }

    setUser(null);
    setFirebaseUser(null);
  }, [isDemo]);

  const forgotPassword = useCallback(async (email: string) => {
    await resetPassword(email);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (FIREBASE_ENABLED && firebaseUser) {
      const profile = await getUserProfile(firebaseUser.uid);
      setUser(profile);
      return;
    }

    const token = await getAuthToken();
    if (!token) return;

    try {
      const profile = await fetchMe(token);
      setUser(profile);
    } catch {
      await clearAuthToken();
      setUser(null);
    }
  }, [firebaseUser]);

  const updateEmergencyContact = useCallback(
    async (emergencyContact: string) => {
      if (isDemo) {
        setUser((current) => (current ? { ...current, emergencyContact } : current));
        return;
      }

      if (FIREBASE_ENABLED && firebaseUser) {
        await updateUserProfile(firebaseUser.uid, { emergencyContact });
        setUser((current) => (current ? { ...current, emergencyContact } : current));
        return;
      }

      const profile = await updateEmergencyContactWithApi(emergencyContact);
      setUser(profile);
    },
    [isDemo, firebaseUser]
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        firebaseUser,
        loading,
        isDemo,
        login,
        loginDemo,
        register,
        logout,
        forgotPassword,
        refreshProfile,
        updateEmergencyContact,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return context;
}
