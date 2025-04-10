/**
 * Firebase Firestore Veritabanı Şema Yapısı
 * Bu dosya, uygulamada kullanılan Firestore koleksiyonlarının yapısını tanımlar.
 */

// Koleksiyon Adları (sabit olarak kullanılması için)
export const COLLECTIONS = {
  USERS: 'users',
  CHATS: 'chats',
  GROUPS: 'groups',
  USER_CHATS: 'userChats',
};

// Alt Koleksiyon Adları (sabit olarak kullanılması için)
export const SUB_COLLECTIONS = {
  MESSAGES: 'messages',
  MEMBERS: 'members',
};

// Örnek Veri Yapıları

/**
 * Kullanıcı Dokümanı Yapısı - users/{userId}
 */
export interface UserDoc {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  firstName?: string;
  lastName?: string;
  createdAt: Date;
  lastOnline: Date;
  status: 'online' | 'offline' | 'away';
  fcmTokens?: { [token: string]: boolean }; // Push bildirimleri için
}

/**
 * Sohbet Dokümanı Yapısı - chats/{chatId}
 * Not: chatId genellikle "userId1_userId2" formatında oluşturulur (küçük olandan büyük olana)
 */
export interface ChatDoc {
  participants: string[]; // Katılımcı kullanıcı ID'leri
  createdAt: Date;
  updatedAt: Date;
  lastMessage?: {
    text: string;
    senderId: string;
    timestamp: Date;
    hasAttachments?: boolean;
  };
}

/**
 * Mesaj Dokümanı Yapısı - chats/{chatId}/messages/{messageId}
 */
export interface MessageDoc {
  text: string;
  senderId: string;
  senderName: string;
  senderPhotoURL: string;
  timestamp: Date;
  isRead: boolean;
  readBy?: string[]; // Mesajı okuyan kullanıcı ID'leri
  isEdited?: boolean;
  isDeleted?: boolean;
  attachments?: {
    type: 'image' | 'file' | 'audio' | 'video';
    name: string;
    url: string;
    size?: number;
  }[];
  quotedMessage?: {
    id: string;
    text: string;
    senderId: string;
  };
}

/**
 * Grup Dokümanı Yapısı - groups/{groupId}
 */
export interface GroupDoc {
  name: string;
  description: string;
  photoURL?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  members: {
    uid: string;
    displayName: string;
    photoURL: string;
    role: 'admin' | 'member';
    status: 'active' | 'inactive' | 'left';
    joinedAt: Date;
  }[];
  lastMessage?: {
    text: string;
    senderId: string;
    senderName: string;
    timestamp: Date;
    hasAttachments?: boolean;
  };
}

/**
 * Grup Mesajı Dokümanı Yapısı - groups/{groupId}/messages/{messageId}
 */
export interface GroupMessageDoc {
  text: string;
  senderId: string;
  senderName: string;
  senderPhotoURL: string;
  timestamp: Date;
  isEdited?: boolean;
  isDeleted?: boolean;
  readBy?: string[]; // Mesajı okuyan kullanıcı ID'leri
  attachments?: {
    type: 'image' | 'file' | 'audio' | 'video';
    name: string;
    url: string;
    size?: number;
  }[];
  quotedMessage?: {
    id: string;
    text: string;
    senderId: string;
    senderName: string;
  };
}

/**
 * Kullanıcı sohbetleri - userChats/{userId}
 * Her kullanıcının hangi sohbetlere sahip olduğunu izleyen koleksiyon
 * Çok fazla sohbet olduğunda, kullanıcıya ait sohbetlerin hızlı sorgularını kolaylaştırır
 */
export interface UserChatsDoc {
  chatIds: {
    [chatId: string]: {
      otherUserId: string;
      unreadCount: number;
      lastMessageDate: Date;
      // Diğer gerekli bilgiler...
    }
  };
  groupIds: {
    [groupId: string]: {
      unreadCount: number;
      lastMessageDate: Date;
      // Diğer gerekli bilgiler...
    }
  };
}

// Yardımcı Fonksiyonlar

/**
 * İki kullanıcı ID'sinden tutarlı bir sohbet ID'si oluşturur
 * Her zaman kullanıcı ID'lerini alfasayısal olarak sıralar böylece aynı çift için aynı ID üretilir
 */
export function createChatId(userId1: string, userId2: string): string {
  return userId1 < userId2 ? `${userId1}_${userId2}` : `${userId2}_${userId1}`;
} 