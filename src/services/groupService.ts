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
  addDoc, 
  updateDoc, 
  arrayUnion,
  arrayRemove,
  onSnapshot,
  Timestamp,
  serverTimestamp 
} from 'firebase/firestore';
import { db, auth } from '../config/firebase';
import { 
  COLLECTIONS, 
  SUB_COLLECTIONS,
  GroupDoc, 
  GroupMessageDoc 
} from '../config/dbSchema';
import { User } from 'firebase/auth';

/**
 * Yeni bir grup oluşturur
 * @param name Grup adı
 * @param description Grup açıklaması
 * @param selectedUsers Gruba eklenecek kullanıcı ID'leri
 * @returns Oluşturulan grup ID'si
 */
export async function createGroup(
  name: string, 
  description: string, 
  selectedUsers: string[]
): Promise<string> {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('Kullanıcı oturum açmamış');
  
  // Üyeleri oluştur - önce kullanıcı bilgilerini al
  const members = await Promise.all(
    [currentUser.uid, ...selectedUsers].map(async (uid) => {
      const userDoc = await getDoc(doc(db, COLLECTIONS.USERS, uid));
      if (!userDoc.exists()) throw new Error(`Kullanıcı bulunamadı: ${uid}`);
      
      const userData = userDoc.data();
      return {
        uid,
        displayName: userData.displayName || userData.email || "",
        photoURL: userData.photoURL || "",
        email: userData.email || "",
        role: uid === currentUser.uid ? 'admin' as const : 'member' as const,
        status: 'active' as const,
        joinedAt: new Date()
      };
    })
  );
  
  // Grup verisi
  const groupData: GroupDoc = {
    name,
    description,
    createdBy: currentUser.uid,
    createdAt: new Date(),
    updatedAt: new Date(),
    members
  };
  
  // Yeni grup oluştur
  const groupRef = await addDoc(collection(db, COLLECTIONS.GROUPS), groupData);
  console.log(`Yeni grup oluşturuldu: ${groupRef.id}`);
  
  return groupRef.id;
}

/**
 * Gruba yeni bir mesaj gönderir
 * @param groupId Grup ID'si
 * @param messageData Gönderilecek mesaj
 * @returns Oluşturulan mesaj ID'si
 */
export async function sendGroupMessage(
  groupId: string, 
  messageData: Omit<GroupMessageDoc, 'timestamp' | 'readBy'>
): Promise<string> {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('Kullanıcı oturum açmamış');
  
  // Grup üyeliğini kontrol et
  const groupRef = doc(db, COLLECTIONS.GROUPS, groupId);
  const groupDoc = await getDoc(groupRef);
  
  if (!groupDoc.exists()) throw new Error('Grup bulunamadı');
  
  const groupData = groupDoc.data() as GroupDoc;
  const currentMember = groupData.members.find(m => m.uid === currentUser.uid);
  
  if (!currentMember) throw new Error('Bu grubun üyesi değilsiniz');
  if (currentMember.status !== 'active') throw new Error('Bu grupta aktif üye değilsiniz');
  
  // Mesaj koleksiyonuna referans
  const messagesRef = collection(db, COLLECTIONS.GROUPS, groupId, SUB_COLLECTIONS.MESSAGES);
  
  // Mesaj verisi
  const fullMessageData: GroupMessageDoc = {
    ...messageData,
    timestamp: new Date(),
    readBy: [currentUser.uid], // Gönderen kişi mesajı okumuş sayılır
  };
  
  // Mesajı ekle
  const docRef = await addDoc(messagesRef, fullMessageData);
  
  // Grubu güncelle
  await updateDoc(groupRef, {
    lastMessage: {
      text: messageData.text,
      senderId: messageData.senderId,
      senderName: messageData.senderName,
      timestamp: fullMessageData.timestamp,
      hasAttachments: messageData.attachments ? messageData.attachments.length > 0 : false
    },
    updatedAt: fullMessageData.timestamp
  });
  
  return docRef.id;
}

/**
 * Kullanıcının tüm gruplarını dinler
 * @param userId Kullanıcı ID'si
 * @param callback Grup listesi değiştiğinde çağrılacak fonksiyon
 * @returns Dinleme fonksiyonunu kaldıran fonksiyon
 */
export function listenToUserGroups(userId: string, callback: (groups: any[]) => void) {
  // Kullanıcının üyesi olduğu grupları bul
  const groupsQuery = query(
    collection(db, COLLECTIONS.GROUPS),
    // array-contains ile members.uid içinde arama yapılamadığı için
    // tüm grupları çekip JS'de filtreliyoruz
    orderBy('updatedAt', 'desc')
  );
  
  // Değişiklikleri dinle
  return onSnapshot(groupsQuery, (snapshot) => {
    // Grupları JS'de filtrele
    const groups = snapshot.docs
      .map(doc => ({
        id: doc.id,
        ...doc.data() as GroupDoc,
        lastMessage: doc.data().lastMessage ? {
          ...doc.data().lastMessage,
          timestamp: doc.data().lastMessage.timestamp instanceof Timestamp 
            ? doc.data().lastMessage.timestamp.toDate() 
            : (doc.data().lastMessage.timestamp || new Date())
        } : undefined
      }))
      .filter(group => {
        // Kullanıcı grup üyesi mi ve aktif mi kontrol et
        return group.members.some(m => m.uid === userId && m.status === 'active');
      });
    
    callback(groups);
  });
}

/**
 * Belirli bir grubun mesajlarını dinler
 * @param groupId Grup ID'si
 * @param callback Mesajlar değiştiğinde çağrılacak fonksiyon
 * @returns Dinleme fonksiyonunu kaldıran fonksiyon
 */
export function listenToGroupMessages(groupId: string, callback: (messages: any[]) => void) {
  // Mesajları zaman sırasına göre sorgula
  const messagesQuery = query(
    collection(db, COLLECTIONS.GROUPS, groupId, SUB_COLLECTIONS.MESSAGES),
    orderBy('timestamp', 'asc')
  );
  
  // Değişiklikleri dinle
  return onSnapshot(messagesQuery, (snapshot) => {
    const messages = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      timestamp: doc.data().timestamp instanceof Timestamp 
        ? doc.data().timestamp.toDate() 
        : (doc.data().timestamp || new Date())
    }));
    
    callback(messages);
  });
}

/**
 * Grup mesajını okundu olarak işaretler
 * @param groupId Grup ID'si
 * @param messageId Mesaj ID'si
 */
export async function markGroupMessageAsRead(groupId: string, messageId: string) {
  const currentUser = auth.currentUser;
  if (!currentUser) return;
  
  const messageRef = doc(db, COLLECTIONS.GROUPS, groupId, SUB_COLLECTIONS.MESSAGES, messageId);
  
  // readBy dizisini güncelle
  await updateDoc(messageRef, {
    readBy: arrayUnion(currentUser.uid)
  });
}

/**
 * Gruba yeni üye ekler
 * @param groupId Grup ID'si
 * @param userIds Eklenecek kullanıcı ID'leri
 */
export async function addGroupMembers(groupId: string, userIds: string[]) {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('Kullanıcı oturum açmamış');
  
  // Grup bilgilerini al
  const groupRef = doc(db, COLLECTIONS.GROUPS, groupId);
  const groupDoc = await getDoc(groupRef);
  
  if (!groupDoc.exists()) throw new Error('Grup bulunamadı');
  
  const groupData = groupDoc.data() as GroupDoc;
  
  // Kullanıcı admin mi kontrol et
  const currentMember = groupData.members.find(m => m.uid === currentUser.uid);
  
  if (!currentMember) throw new Error('Bu grubun üyesi değilsiniz');
  if (currentMember.role !== 'admin') throw new Error('Üye ekleme yetkiniz yok');
  
  // Kullanıcıların bilgilerini al ve üye olarak ekle
  const newMembers = await Promise.all(
    userIds
      .filter(uid => !groupData.members.some(m => m.uid === uid)) // Zaten üye olanları filtrele
      .map(async (uid) => {
        const userDoc = await getDoc(doc(db, COLLECTIONS.USERS, uid));
        if (!userDoc.exists()) throw new Error(`Kullanıcı bulunamadı: ${uid}`);
        
        const userData = userDoc.data();
        return {
          uid,
          displayName: userData.displayName || userData.email || "",
          photoURL: userData.photoURL || "",
          email: userData.email || "",
          role: 'member' as const,
          status: 'active' as const,
          joinedAt: new Date()
        };
      })
  );
  
  // Yeni üyeleri ekle
  await updateDoc(groupRef, {
    members: [...groupData.members, ...newMembers],
    updatedAt: new Date()
  });
}

/**
 * Kullanıcıyı gruptan çıkarır
 * @param groupId Grup ID'si
 * @param userId Çıkarılacak kullanıcı ID'si
 */
export async function removeGroupMember(groupId: string, userId: string) {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('Kullanıcı oturum açmamış');
  
  // Grup bilgilerini al
  const groupRef = doc(db, COLLECTIONS.GROUPS, groupId);
  const groupDoc = await getDoc(groupRef);
  
  if (!groupDoc.exists()) throw new Error('Grup bulunamadı');
  
  const groupData = groupDoc.data() as GroupDoc;
  
  // Kullanıcının admin olup olmadığını veya kendisini çıkarıp çıkarmadığını kontrol et
  const currentMember = groupData.members.find(m => m.uid === currentUser.uid);
  
  if (!currentMember) throw new Error('Bu grubun üyesi değilsiniz');
  
  // Admin mi veya kendini mi çıkarıyor?
  const isAdmin = currentMember.role === 'admin';
  const isSelf = userId === currentUser.uid;
  
  if (!isAdmin && !isSelf) throw new Error('Üye çıkarma yetkiniz yok');
  
  // Çıkarılacak üyeyi bul
  const memberToRemove = groupData.members.find(m => m.uid === userId);
  if (!memberToRemove) throw new Error('Kullanıcı bu grubun üyesi değil');
  
  // Çıkarılacak üye admin mi kontrol et
  if (memberToRemove.role === 'admin' && !isSelf) {
    // Admin sayısını kontrol et, son admini çıkarmaya çalışıyor olabilir
    const adminCount = groupData.members.filter(m => m.role === 'admin').length;
    if (adminCount <= 1) throw new Error('Grubun en az bir admin üyesi olmalı');
  }
  
  // Üyeyi çıkar veya durumunu 'left' olarak güncelle
  if (isSelf) {
    // Kendini grubu terk ediyor olarak işaretle
    await updateDoc(groupRef, {
      members: groupData.members.map(m => 
        m.uid === userId 
          ? { ...m, status: 'left', leftAt: new Date() } 
          : m
      ),
      updatedAt: new Date()
    });
  } else {
    // Admin başka birini çıkarıyor
    await updateDoc(groupRef, {
      members: groupData.members.filter(m => m.uid !== userId),
      updatedAt: new Date()
    });
  }
}

/**
 * Grubun detaylarını günceller
 * @param groupId Grup ID'si
 * @param updates Güncellenecek alanlar
 */
export async function updateGroupDetails(groupId: string, updates: Partial<Pick<GroupDoc, 'name' | 'description' | 'photoURL'>>) {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('Kullanıcı oturum açmamış');
  
  // Grup bilgilerini al
  const groupRef = doc(db, COLLECTIONS.GROUPS, groupId);
  const groupDoc = await getDoc(groupRef);
  
  if (!groupDoc.exists()) throw new Error('Grup bulunamadı');
  
  const groupData = groupDoc.data() as GroupDoc;
  
  // Kullanıcı admin mi kontrol et
  const currentMember = groupData.members.find(m => m.uid === currentUser.uid);
  
  if (!currentMember) throw new Error('Bu grubun üyesi değilsiniz');
  if (currentMember.role !== 'admin') throw new Error('Grup detaylarını düzenleme yetkiniz yok');
  
  // Grubu güncelle
  await updateDoc(groupRef, {
    ...updates,
    updatedAt: new Date()
  });
} 