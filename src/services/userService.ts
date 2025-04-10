import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  limit, 
  updateDoc, 
  onSnapshot,
  Timestamp 
} from 'firebase/firestore';
import { db, auth } from '../config/firebase';
import { COLLECTIONS, UserDoc } from '../config/dbSchema';
import { User } from 'firebase/auth';

/**
 * Kullanıcının Firebase Authentication kaydından sonra Firestore'da profil oluşturur
 * @param user Firebase Authentication kullanıcısı
 * @returns Oluşturulan kullanıcı verisi
 */
export async function createUserProfile(user: User): Promise<UserDoc> {
  if (!user) throw new Error('Kullanıcı bilgisi geçersiz');
  
  const userRef = doc(db, COLLECTIONS.USERS, user.uid);
  const userData: UserDoc = {
    uid: user.uid,
    email: user.email || '',
    displayName: user.displayName || user.email?.split('@')[0] || '',
    photoURL: user.photoURL || '',
    firstName: '',
    lastName: '',
    createdAt: new Date(),
    lastOnline: new Date(),
    status: 'online'
  };
  
  await setDoc(userRef, userData);
  console.log(`Kullanıcı profili oluşturuldu: ${user.uid}`);
  
  return userData;
}

/**
 * Kullanıcı profilini günceller
 * @param userId Kullanıcı ID'si
 * @param updates Güncellenecek profil değerleri
 */
export async function updateUserProfile(
  userId: string, 
  updates: Partial<Pick<UserDoc, 'displayName' | 'photoURL' | 'firstName' | 'lastName' | 'status'>>
) {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('Kullanıcı oturum açmamış');
  
  // Sadece kendi profilini güncelleyebilir
  if (currentUser.uid !== userId) throw new Error('Başka bir kullanıcının profilini güncelleyemezsiniz');
  
  const userRef = doc(db, COLLECTIONS.USERS, userId);
  await updateDoc(userRef, {
    ...updates,
    updatedAt: new Date()
  });
}

/**
 * Kullanıcıyı çevrimiçi veya çevrimdışı olarak işaretler
 * @param userId Kullanıcı ID'si
 * @param isOnline true ise çevrimiçi, false ise çevrimdışı
 */
export async function updateOnlineStatus(userId: string, isOnline: boolean) {
  const userRef = doc(db, COLLECTIONS.USERS, userId);
  await updateDoc(userRef, {
    status: isOnline ? 'online' : 'offline',
    lastOnline: new Date()
  });
}

/**
 * Tüm kullanıcıları getirir (sadece temel bilgilerle)
 * @returns Kullanıcılar listesi
 */
export async function getAllUsers() {
  const usersRef = collection(db, COLLECTIONS.USERS);
  const q = query(usersRef, orderBy('displayName'));
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    uid: doc.id,
    ...doc.data()
  } as UserDoc));
}

/**
 * Kullanıcı adına göre arama yapar
 * @param searchTerm Aranacak terim (büyük küçük harf duyarsız başlar)
 * @param maxResults Maksimum sonuç sayısı
 * @returns Eşleşen kullanıcılar listesi
 */
export async function searchUsers(searchTerm: string, maxResults: number = 10) {
  // Firestore'da tam büyük küçük harf duyarsız arama yapılamaz, kelime başına göre arama yapar
  // Daha gelişmiş aramalar için Algolia gibi bir servis kullanılabilir
  const usersRef = collection(db, COLLECTIONS.USERS);
  const termLowerCase = searchTerm.toLowerCase();
  
  // Firebase büyük-küçük harf duyarsız arama, kelime başları
  const q = query(
    usersRef,
    orderBy('displayName'),
    limit(maxResults * 2) // Filtreleme yaptığımız için daha fazla sonuç çekelim
  );
  
  const snapshot = await getDocs(q);
  
  // Manuel filtreleme
  return snapshot.docs
    .map(doc => ({ uid: doc.id, ...doc.data() } as UserDoc))
    .filter(user => 
      user.displayName.toLowerCase().includes(termLowerCase) ||
      (user.firstName && user.firstName.toLowerCase().includes(termLowerCase)) ||
      (user.lastName && user.lastName.toLowerCase().includes(termLowerCase)) ||
      user.email.toLowerCase().includes(termLowerCase)
    )
    .slice(0, maxResults);
}

/**
 * Belirli bir kullanıcının verilerini alır
 * @param userId Kullanıcı ID'si
 * @returns Kullanıcı verisi veya null (kullanıcı bulunamazsa)
 */
export async function getUserById(userId: string) {
  const userRef = doc(db, COLLECTIONS.USERS, userId);
  const userDoc = await getDoc(userRef);
  
  if (!userDoc.exists()) return null;
  
  return {
    uid: userDoc.id,
    ...userDoc.data()
  } as UserDoc;
}

/**
 * Kullanıcının çevrimiçi durumunu dinler
 * @param userId Kullanıcı ID'si
 * @param callback Kullanıcı durumu değiştiğinde çağrılacak fonksiyon
 * @returns Dinleme fonksiyonunu kaldıran fonksiyon
 */
export function listenToUserStatus(userId: string, callback: (status: string, lastOnline: Date) => void) {
  const userRef = doc(db, COLLECTIONS.USERS, userId);
  
  return onSnapshot(userRef, (doc) => {
    if (doc.exists()) {
      const data = doc.data();
      const lastOnline = data.lastOnline instanceof Timestamp 
        ? data.lastOnline.toDate() 
        : (data.lastOnline || new Date());
      callback(data.status || 'offline', lastOnline);
    } else {
      callback('offline', new Date());
    }
  });
} 