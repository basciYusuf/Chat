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
  onSnapshot,
  Timestamp,
  serverTimestamp 
} from 'firebase/firestore';
import { db, auth } from '../config/firebase';
import { 
  COLLECTIONS, 
  SUB_COLLECTIONS,
  createChatId, 
  ChatDoc, 
  MessageDoc 
} from '../config/dbSchema';
import { User } from 'firebase/auth';

/**
 * İki kullanıcı arasındaki sohbeti başlatır veya var olanı getirir
 * @param currentUser Mevcut kullanıcı
 * @param otherUserId Sohbet kurulacak diğer kullanıcının ID'si
 * @returns Sohbet ID'si
 */
export async function createOrGetChat(currentUser: User, otherUserId: string): Promise<string> {
  if (!currentUser) throw new Error('Kullanıcı oturum açmamış');
  
  const chatId = createChatId(currentUser.uid, otherUserId);
  const chatRef = doc(db, COLLECTIONS.CHATS, chatId);
  
  try {
    const chatDoc = await getDoc(chatRef);
    
    if (!chatDoc.exists()) {
      // Sohbet henüz yoksa oluştur
      const chatData: ChatDoc = {
        participants: [currentUser.uid, otherUserId],
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await setDoc(chatRef, chatData);
      console.log(`Yeni sohbet oluşturuldu: ${chatId}`);
    } else {
      console.log(`Var olan sohbet getirildi: ${chatId}`);
    }
    
    return chatId;
  } catch (error) {
    console.error('Sohbet oluşturma/getirme hatası:', error);
    // Offline durumda bile chatId dönebiliriz
    return chatId;
  }
}

/**
 * Sohbete yeni bir mesaj gönderir
 * @param chatId Sohbet ID'si
 * @param message Gönderilecek mesaj
 * @returns Oluşturulan mesaj ID'si
 */
export async function sendMessage(
  chatId: string, 
  messageData: Omit<MessageDoc, 'timestamp' | 'isRead' | 'readBy'>
): Promise<string> {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('Kullanıcı oturum açmamış');
  
  // Mesaj koleksiyonuna referans
  const messagesRef = collection(db, COLLECTIONS.CHATS, chatId, SUB_COLLECTIONS.MESSAGES);
  
  // Mesaj verisi
  const fullMessageData: MessageDoc = {
    ...messageData,
    timestamp: new Date(),
    isRead: false,
    readBy: [currentUser.uid], // Gönderen kişi mesajı okumuş sayılır
  };
  
  // Mesajı ekle
  const docRef = await addDoc(messagesRef, fullMessageData);
  
  // Sohbeti güncelle
  const chatRef = doc(db, COLLECTIONS.CHATS, chatId);
  await updateDoc(chatRef, {
    lastMessage: {
      text: messageData.text,
      senderId: messageData.senderId,
      timestamp: fullMessageData.timestamp,
      hasAttachments: messageData.attachments ? messageData.attachments.length > 0 : false
    },
    updatedAt: fullMessageData.timestamp
  });
  
  return docRef.id;
}

/**
 * Kullanıcının tüm sohbetlerini dinler
 * @param userId Kullanıcı ID'si
 * @param callback Sohbet listesi değiştiğinde çağrılacak fonksiyon
 * @returns Dinleme fonksiyonunu kaldıran fonksiyon
 */
export function listenToUserChats(userId: string, callback: (chats: any[]) => void) {
  try {
    // Kullanıcının katıldığı sohbetleri filtrele
    const chatsQuery = query(
      collection(db, COLLECTIONS.CHATS),
      where('participants', 'array-contains', userId),
      orderBy('updatedAt', 'desc')
    );
    
    // Değişiklikleri dinle
    return onSnapshot(chatsQuery, 
      async (snapshot) => {
        try {
          const chatsPromises = snapshot.docs.map(async (doc) => {
            const chatData = doc.data() as ChatDoc;
            
            // Diğer kullanıcıyı bul
            const otherUserId = chatData.participants.find(id => id !== userId);
            if (!otherUserId) return null;
            
            // Diğer kullanıcının verilerini getir
            try {
              const userDoc = await getDoc(docRef(db, COLLECTIONS.USERS, otherUserId));
              if (!userDoc.exists()) return null;
              
              const userData = { uid: userDoc.id, ...userDoc.data() };
              
              // Okunmamış mesaj sayısını hesapla
              let unreadCount = 0;
              try {
                const messagesRef = collection(db, COLLECTIONS.CHATS, doc.id, SUB_COLLECTIONS.MESSAGES);
                const messagesQuery = query(
                  messagesRef,
                  where('senderId', '==', otherUserId),
                  where('isRead', '==', false)
                );
                
                const messagesSnapshot = await getDocs(messagesQuery);
                unreadCount = messagesSnapshot.size;
              } catch (e) {
                console.error(`[Chats] Error counting messages for chat ${doc.id}:`, e);
              }
              
              // Son mesaj zamanını Date'e çevir
              const lastMessageTimestamp = chatData.lastMessage?.timestamp;
              
              return {
                id: doc.id,
                otherUser: userData,
                lastMessage: chatData.lastMessage ? {
                  text: chatData.lastMessage.text,
                  timestamp: lastMessageTimestamp instanceof Timestamp 
                    ? lastMessageTimestamp.toDate() 
                    : (lastMessageTimestamp || new Date()),
                  senderId: chatData.lastMessage.senderId
                } : null,
                unreadCount
              };
            } catch (error) {
              console.error(`[Chats] Error fetching user ${otherUserId}:`, error);
              // Hata durumunda en azından temel bilgileri içeren bir nesne döndürüyoruz
              return {
                id: doc.id,
                otherUser: { uid: otherUserId, displayName: 'Kullanıcı', photoURL: '' },
                lastMessage: chatData.lastMessage ? {
                  text: chatData.lastMessage.text,
                  timestamp: new Date(),
                  senderId: chatData.lastMessage.senderId
                } : null,
                unreadCount: 0
              };
            }
          });
          
          const chats = (await Promise.all(chatsPromises)).filter(Boolean);
          callback(chats);
        } catch (error) {
          console.error('[Chats] Error processing snapshot:', error);
          callback([]);
        }
      },
      (error) => {
        console.error('[Chats] Error in chat listener:', error);
        // Hata durumunda boş bir dizi dön
        callback([]);
      }
    );
  } catch (error) {
    console.error('[Chats] Error setting up chat listener:', error);
    // Hata durumunda boş bir dizi dön ve fonksiyon döndür
    callback([]);
    return () => {};
  }
}

/**
 * Belirli bir sohbetin mesajlarını dinler
 * @param chatId Sohbet ID'si
 * @param callback Mesajlar değiştiğinde çağrılacak fonksiyon
 * @returns Dinleme fonksiyonunu kaldıran fonksiyon
 */
export function listenToChatMessages(chatId: string, callback: (messages: any[]) => void) {
  // Mesajları zaman sırasına göre sorgula
  const messagesQuery = query(
    collection(db, COLLECTIONS.CHATS, chatId, SUB_COLLECTIONS.MESSAGES),
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
 * Mesajı okundu olarak işaretler
 * @param chatId Sohbet ID'si
 * @param messageId Mesaj ID'si
 */
export async function markMessageAsRead(chatId: string, messageId: string) {
  const currentUser = auth.currentUser;
  if (!currentUser) return;
  
  const messageRef = doc(db, COLLECTIONS.CHATS, chatId, SUB_COLLECTIONS.MESSAGES, messageId);
  
  // readBy dizisini güncelle
  await updateDoc(messageRef, {
    isRead: true,
    readBy: arrayUnion(currentUser.uid)
  });
}

/**
 * Sohbeti siler (sadece belirli güvenlik kontrolleri sonrası)
 * @param chatId Sohbet ID'si
 */
export async function deleteChat(chatId: string) {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('Kullanıcı oturum açmamış');
  
  // Sohbetin mevcut katılımcılarını kontrol et
  const chatRef = doc(db, COLLECTIONS.CHATS, chatId);
  const chatDoc = await getDoc(chatRef);
  
  if (!chatDoc.exists()) throw new Error('Sohbet bulunamadı');
  
  const chatData = chatDoc.data() as ChatDoc;
  
  // Kullanıcının bu sohbetin katılımcısı olup olmadığını kontrol et
  if (!chatData.participants.includes(currentUser.uid)) {
    throw new Error('Bu sohbeti silme yetkiniz yok');
  }
  
  // Sohbeti sil (gerçek silme yerine bir 'deleted' flag eklenebilir)
  await updateDoc(chatRef, {
    deletedBy: arrayUnion(currentUser.uid),
    deletedAt: new Date()
  });
}

function docRef(database: any, collection: string, id: string) {
  return doc(database, collection, id);
} 