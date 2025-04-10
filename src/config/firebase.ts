import { initializeApp } from 'firebase/app';
import { getAuth, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Firebase yapılandırmasını ortam değişkenlerinden oku
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID
};

// --- GEÇİCİ DEBUG LOG --- 
console.log("Okunan API Anahtarı:", process.env.REACT_APP_FIREBASE_API_KEY);
console.log("Oluşturulan Firebase Config:", firebaseConfig);
// --- GEÇİCİ DEBUG LOG SONU ---

// Değişkenlerin yüklenip yüklenmediğini kontrol et (opsiyonel ama önerilir)
if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  console.error("Firebase yapılandırma değişkenleri bulunamadı. .env.local dosyasını kontrol edin.");
  // Uygulamanın çökmesini veya bir hata mesajı göstermesini sağlayabilirsiniz
}

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

// Hata ayıklama için konsola bilgi yazdır (API Anahtarını yazdırmamaya dikkat!)
console.log('Firebase yapılandırması yüklendi (ortam değişkenlerinden):', {
  authDomain: firebaseConfig.authDomain,
  projectId: firebaseConfig.projectId,
  storageBucket: firebaseConfig.storageBucket
}); 