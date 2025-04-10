import { initializeApp } from 'firebase/app';
import { getAuth, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Firebase yapılandırması
const firebaseConfig = {
  apiKey: "AIzaSyATfCx5yilCbaCCHyTeNI4xnwikFFQ_-u0",
  authDomain: "meryuschat2.firebaseapp.com",
  projectId: "meryuschat2",
  storageBucket: "meryuschat2.firebasestorage.app",
  messagingSenderId: "697977617753",
  appId: "1:697977617753:web:68f4d96c5936f1d941e048"
};

// Firebase uygulamasını başlat
const app = initializeApp(firebaseConfig);

// Firebase servislerini başlat
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Auth persistence'ı ayarla
setPersistence(auth, browserLocalPersistence)
  .then(() => {
    console.log('Auth persistence ayarlandı');
  })
  .catch((error) => {
    console.error('Auth persistence hatası:', error);
  });

// Hata ayıklama için konsola bilgi yazdır
console.log('Firebase yapılandırması yüklendi:', {
  authDomain: firebaseConfig.authDomain,
  projectId: firebaseConfig.projectId,
  storageBucket: firebaseConfig.storageBucket
}); 