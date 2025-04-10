import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  User as FirebaseUser,
  UserCredential,
  updateProfile
} from 'firebase/auth';
import { auth, db } from '../config/firebase';
import { doc, setDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { User } from '../types/User';
import { createUserProfile } from '../services/userService';

interface AuthContextType {
  currentUser: FirebaseUser | null;
  loading: boolean;
  error: string | null;
  register: (email: string, password: string, displayName: string) => Promise<FirebaseUser>;
  login: (email: string, password: string) => Promise<FirebaseUser>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Kullanıcının çevrimiçi durumunu güncelle
  const updateOnlineStatus = async (user: FirebaseUser | null, isOnline: boolean) => {
    if (!user) return;

    const userRef = doc(db, 'users', user.uid);
    await setDoc(userRef, {
      isOnline,
      lastSeen: serverTimestamp(),
      displayName: user.displayName,
      email: user.email,
      photoURL: user.photoURL,
    }, { merge: true });
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        await updateOnlineStatus(user, true);
      }
      setCurrentUser(user);
      setLoading(false);
    });

    // Çevrimdışı olma durumunu yakala
    window.addEventListener('beforeunload', () => {
      if (currentUser) {
        updateOnlineStatus(currentUser, false);
      }
    });

    return () => {
      unsubscribe();
      if (currentUser) {
        updateOnlineStatus(currentUser, false);
      }
    };
  }, [currentUser]);

  async function register(email: string, password: string, displayName: string): Promise<FirebaseUser> {
    try {
      setLoading(true);
      setError(null);
      
      // Firebase Auth'da kullanıcı oluştur
      const { user } = await createUserWithEmailAndPassword(auth, email, password);
      
      // Kullanıcı adını güncelle
      await updateProfile(user, {
        displayName: displayName
      });
      
      // Firestore'da kullanıcı profili oluştur
      try {
        await createUserProfile(user);
      } catch (profileError) {
        console.error('Kullanıcı profili oluşturma hatası:', profileError);
        // Profil oluşturma hatası kritik değil, devam ediyoruz
      }
      
      return user;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }

  async function login(email: string, password: string): Promise<FirebaseUser> {
    try {
      setLoading(true);
      setError(null);
      
      const { user } = await signInWithEmailAndPassword(auth, email, password);
      return user;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }

  async function logout(): Promise<void> {
    if (currentUser) {
      await updateOnlineStatus(currentUser, false);
    }
    try {
      setError(null);
      await signOut(auth);
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  }

  const value = {
    currentUser,
    loading,
    error,
    register,
    login,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}; 