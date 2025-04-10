import { User as FirebaseUser } from 'firebase/auth';

export interface User extends FirebaseUser {
  firstName?: string;
  lastName?: string;
  username?: string;
  photoURL: string | null;
  email: string | null;
  displayName: string | null;
  createdAt?: string;
  isOnline?: boolean;
  lastSeen?: string;
} 