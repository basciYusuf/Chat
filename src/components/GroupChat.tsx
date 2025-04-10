import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useThemeMode } from '../contexts/ThemeContext';
import { db } from '../config/firebase';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  serverTimestamp,
  doc,
  getDoc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  FieldValue,
  writeBatch
} from 'firebase/firestore';
import {
  ref,
  uploadBytes,
  getDownloadURL,
} from 'firebase/storage';
import { storage } from '../config/firebase';
import {
  Box,
  Typography,
  TextField,
  IconButton,
  Avatar,
  Paper,
  Divider,
  CircularProgress,
  useTheme,
  AvatarGroup,
  Tooltip,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText as MuiListItemText,
  ListItemSecondaryAction,
  Chip,
  Badge,
  Checkbox,
  DialogContentText,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Send as SendIcon,
  AttachFile as AttachFileIcon,
  MoreVert as MoreVertIcon,
  Settings as SettingsIcon,
  PersonAdd as PersonAddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  ExitToApp as ExitToAppIcon,
  EmojiEmotions as EmojiIcon,
  Image as ImageIcon,
  InsertDriveFile as FileIcon,
  Reply as ReplyIcon,
  PushPin as PushPinIcon,
  AddReaction as AddReactionIcon,
  Star as StarIcon,
  Close as CloseIcon,
  RemoveCircleOutline as RemoveCircleOutlineIcon,
} from '@mui/icons-material';
import { Timestamp } from 'firebase/firestore';
import { User } from '../types/User'; // User importunu kontrol et

interface GroupMember {
  uid: string;
  role: 'admin' | 'member';
  joinedAt: FieldValue;
  displayName: string | null;
  photoURL: string | null;
  email: string | null;
  status: 'active' | 'left' | 'removed';
}

interface Group {
  id: string;
  name: string;
  description: string;
  createdBy: string;
  createdAt: Date;
  members: GroupMember[];
}

interface GroupMessage {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  senderPhotoURL?: string;
  timestamp: any; // Firestore Timestamp veya Date olabilir
  isEdited?: boolean;
  isDeleted?: boolean;
  isStarred?: boolean;
  isPinned?: boolean;
  reactions?: { [key: string]: string[] };
  quotedMessage?: {
    id: string;
    text: string;
    senderName: string;
  } | null;
  readBy?: string[];
  attachments?: string[];
  type?: 'user' | 'system'; // type alanı eklendi
}

interface MessageData {
  text: string;
  senderId: string;
  senderName: string;
  senderPhotoURL?: string;
  timestamp: FieldValue; // Keep as FieldValue for server timestamp
  isEdited?: boolean;
  isDeleted?: boolean;
  isStarred?: boolean;
  isPinned?: boolean;
  quotedMessage?: {
    id: string;
    text: string;
    senderName: string;
  } | null;
  readBy?: string[]; // readBy alanı eklendi (string dizisi)
  attachments?: string[]; // attachments alanı eklendi
}

const GroupChat: React.FC = () => {
  const { groupId } = useParams<{ groupId: string }>();
  const { currentUser } = useAuth();
  const { isDarkMode } = useThemeMode();
  const navigate = useNavigate();
  const theme = useTheme();
  const [group, setGroup] = useState<Group | null>(null);
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAddMembers, setShowAddMembers] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<any[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [editingGroup, setEditingGroup] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  const [admins, setAdmins] = useState<string[]>([]);
  const [isCurrentUserAdmin, setIsCurrentUserAdmin] = useState(false);
  const [openAddMemberDialog, setOpenAddMemberDialog] = useState(false);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [backgroundImage, setBackgroundImage] = useState<string | null>(null);
  const [wallpaperOpacity, setWallpaperOpacity] = useState<number>(0.5);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [replyingTo, setReplyingTo] = useState<GroupMessage | null>(null);
  const [selectedMessage, setSelectedMessage] = useState<GroupMessage | null>(null);
  const [messageMenuAnchor, setMessageMenuAnchor] = useState<{ [key: string]: HTMLElement | null }>({});
  const [reactionMenuAnchor, setReactionMenuAnchor] = useState<{ [key: string]: HTMLElement | null }>({});
  const reactions = ['👍', '❤️', '😊', '😮', '😢', '🙏'];
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [isMemberActive, setIsMemberActive] = useState(true);
  const [memberStatus, setMemberStatus] = useState<'active' | 'left' | 'removed' | null>(null);
  const [userToRemove, setUserToRemove] = useState<GroupMember | null>(null);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [addMemberLoading, setAddMemberLoading] = useState(false);
  const [userToAddQuery, setUserToAddQuery] = useState('');
  const [leaveGroupConfirmOpen, setLeaveGroupConfirmOpen] = useState(false);

  // Kullanıcı ID'sine göre renk üreten fonksiyon
  const getUserColor = (userId: string) => {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      hash = userId.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = hash % 360;
    return `hsl(${hue}, 70%, 60%)`;
  };

  // Grup bilgilerini getir
  useEffect(() => {
    if (!groupId || !currentUser) return;
    console.log(`useEffect for group ${groupId} triggered. currentUser: ${currentUser.uid}`);
    setLoading(true); // Başlangıçta yükleniyor olarak ayarla

    const groupRef = doc(db, 'groups', groupId);
    const unsubscribe = onSnapshot(groupRef, (doc) => {
      console.log(`onSnapshot triggered for group ${groupId}`);
      if (doc.exists()) {
        const groupData = { id: doc.id, ...doc.data() } as Group;
        console.log('Raw groupData.members:', groupData.members); // Log 3: Üye dizisini gör
        setGroup(groupData);
        setGroupName(groupData.name);
        setGroupDescription(groupData.description || '');
        
        // Admin durumunu kontrol et
        const isAdmin = groupData.members.some(
          member => member.uid === currentUser.uid && member.role === 'admin'
        );
        setIsAdmin(isAdmin);
        console.log(`Admin check: isAdmin = ${isAdmin}`); // Log 4: Admin mi?

        // Kullanıcının üyelik nesnesini bul
        const currentMember = groupData.members.find(member => member.uid === currentUser.uid);
        console.log('Found currentMember:', currentMember); // Log 5: Üye nesnesi bulundu mu?
        
        // Status kontrolü ve state ayarı
        const userStatus = currentMember?.status;
        const isActive = userStatus === 'active';
        setIsMemberActive(isActive); // Aktif üye mi?
        setMemberStatus(userStatus || null); // Statüyü sakla
        console.log(`Status check: userStatus = ${userStatus}, isActive = ${isActive}`); // Log 6: Statü ve aktiflik durumu
      } else {
        console.log(`Group ${groupId} not found.`);
        setLoading(false); // Grup yoksa yüklemeyi bitir
        navigate('/');
      }
    }, (error) => { // Hata durumunu handle et
        console.error(`Error fetching group ${groupId}:`, error);
        setLoading(false);
        navigate('/'); // Hata durumunda ana sayfaya yönlendir
    });
    return () => {
      console.log(`Unsubscribing from group ${groupId}`);
      unsubscribe();
    }
  }, [groupId, currentUser]);

  // Effect for fetching messages, marking as read, and scrolling
  useEffect(() => {
    if (!groupId || !currentUser || !group) return; // group'un yüklenmesini bekle

    const messagesRef = collection(db, 'groups', groupId, 'messages');
    const q = query(messagesRef, orderBy('timestamp', 'asc'));

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      let firstUnreadMessageId: string | null = null;
      const fetchedMessages = snapshot.docs.map(doc => {
        const data = doc.data();
        const message = {
          id: doc.id,
          ...data,
          timestamp: data.timestamp?.toDate ? data.timestamp.toDate() : null,
        } as GroupMessage; // Use GroupMessage type

        // Find the first unread message
        if (!firstUnreadMessageId && 
            message.senderId !== currentUser.uid && 
            (!data.readBy || !data.readBy.includes(currentUser.uid))) {
          firstUnreadMessageId = message.id;
        }
        return message;
      });

      setMessages(fetchedMessages);
      
      // --- Mark messages as read (Batch update) ---
      const batch = writeBatch(db);
      let unreadFound = false;
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.senderId !== currentUser.uid && (!data.readBy || !data.readBy.includes(currentUser.uid))) {
          batch.update(doc.ref, { readBy: arrayUnion(currentUser.uid) });
          unreadFound = true;
        }
      });
      if (unreadFound) {
        try { await batch.commit(); console.log('Unread group messages marked as read.'); }
        catch (error) { console.error('Error marking group messages as read:', error); }
      }
      // Update local unread count state
      // ... (calculate unread based on fetchedMessages)

      // --- Scrolling Logic ---
      setTimeout(() => {
        if (firstUnreadMessageId) {
          const element = document.getElementById(`message-${firstUnreadMessageId}`);
          if (element) {
            console.log('Scrolling to first unread group message:', firstUnreadMessageId);
            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
          } else {
            console.log('First unread group message element not found, scrolling to bottom.');
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
          }
        } else {
          console.log('No unread group messages, scrolling to bottom.');
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
      }, 100);

      setLoading(false); // Hem grup hem mesajlar yüklendiğinde yüklemeyi bitir
    }, (error) => { // Hata durumunu handle et
        console.error(`Error fetching messages for group ${groupId}:`, error);
        setLoading(false); // Mesajları çekerken hata olursa da yüklemeyi bitir
    });

    return () => unsubscribe();
  }, [groupId, currentUser, group]);

  // Kullanılabilir kullanıcıları getir
  useEffect(() => {
    if (!currentUser || !group) return;

    const usersRef = collection(db, 'users');
    const q = query(usersRef);

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const userData = snapshot.docs
        .map(doc => ({
          uid: doc.id,
          ...doc.data()
        }))
        .filter(user => 
          user.uid !== currentUser.uid && 
          !group.members.some(member => member.uid === user.uid)
        );
      
      setAvailableUsers(userData);
    });

    return () => unsubscribe();
  }, [currentUser, group]);

  // Tüm kullanıcıları getir (Üye Ekle için)
  useEffect(() => {
    const usersRef = collection(db, 'users');
    const q = query(usersRef);
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const usersData = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as User));
      setAllUsers(usersData);
    }, (error) => {
      console.error("Error fetching all users:", error);
    });
    return () => unsubscribe();
  }, []);

  // Mesaj gönderme
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('handleSendMessage triggered in GroupChat.tsx');
    console.log('State values:', { newMessage: newMessage.trim(), currentUser, groupId, attachments });

    if ((!newMessage.trim() && attachments.length === 0) || !currentUser || !groupId) {
      console.log('Exiting handleSendMessage early due to missing data or empty message/attachments');
      return;
    }

    try {
      let attachmentUrls: string[] = [];
      if (attachments.length > 0) {
        console.log('Uploading attachments...');
        const uploadPromises = attachments.map(async (file) => {
          const storageRef = ref(storage, `group_chats/${groupId}/${Date.now()}_${file.name}`);
          await uploadBytes(storageRef, file);
          const downloadURL = await getDownloadURL(storageRef);
          return downloadURL;
        });
        attachmentUrls = await Promise.all(uploadPromises);
        console.log('Attachments uploaded:', attachmentUrls);
      }

      // Kullanıcı adını belirle
      const senderName = currentUser.displayName || currentUser.email?.split('@')[0] || 'Kullanıcı';
      
      // Log'u daha detaylı hale getir
      console.log(
        `firstName: ${currentUser.displayName}, calculatedSenderName: ${senderName}`
      );

      const messageData: MessageData = {
        text: newMessage.trim(),
        senderId: currentUser.uid,
        senderName: senderName,
        senderPhotoURL: currentUser.photoURL || '',
        timestamp: serverTimestamp(),
        isEdited: false,
        isDeleted: false,
        isStarred: false,
        isPinned: false,
        quotedMessage: replyingTo ? {
          id: replyingTo.id,
          text: replyingTo.text,
          senderName: replyingTo.senderName || 'Bilinmeyen Kullanıcı',
        } : null,
        readBy: [currentUser.uid],
      };

      // Eğer ek varsa attachments alanını ekle
      if (attachmentUrls.length > 0) {
        messageData.attachments = attachmentUrls;
      }

      const messagesRef = collection(db, 'groups', groupId, 'messages');
      console.log('Attempting to add document to Firestore:', messageData);
      await addDoc(messagesRef, messageData);
      console.log('Document added successfully');

      // Grup belgesindeki lastMessage alanını güncelle
      const groupRef = doc(db, 'groups', groupId);
      try {
          await updateDoc(groupRef, {
            lastMessage: {
              text: messageData.text,
              senderName: messageData.senderName, 
              timestamp: messageData.timestamp // Use the same timestamp object
            }
          });
          console.log('[GroupChat.tsx] Group lastMessage updated successfully.'); // Success Log 1
      } catch (updateError) {
          console.error('[GroupChat.tsx] ERROR updating group lastMessage:', updateError); // Error Log 1
      }

      console.log('[GroupChat.tsx] Attempting to clear newMessage state...'); // Log 2
      setNewMessage('');
      console.log('[GroupChat.tsx] newMessage state supposedly cleared.'); // Log 3
      setReplyingTo(null);
      setAttachments([]); 
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    } catch (error) {
      console.error('Error sending message in GroupChat.tsx:', error);
    }
  };

  const handleReaction = async (messageId: string, emoji: string) => {
    if (!currentUser || !groupId) return;

    try {
      const messageRef = doc(db, 'groups', groupId, 'messages', messageId);
      const messageDoc = await getDoc(messageRef);
      
      if (messageDoc.exists()) {
        const message = messageDoc.data() as GroupMessage;
        
        // Mevcut tepkiler (varsayılan olarak boş obje)
        const currentReactions = message.reactions || {};
        
        // Seçilen tepkide kullanıcı ID'lerinin listesi (varsayılan olarak boş dizi)
        const userIds: string[] = currentReactions[emoji] || []; 
        
        // Eğer kullanıcı zaten tepki verdiyse kaldır, yoksa ekle
        if (userIds.includes(currentUser.uid)) { // includes string[] üzerinde çalışır
          // Kullanıcının tepkisini kaldır
          const updatedUserIds = userIds.filter((id: string) => id !== currentUser.uid); // filter string[] üzerinde çalışır
          
          // Eğer bu tepkide kimse kalmadıysa, tepkiyi tamamen kaldır
          if (updatedUserIds.length === 0) {
            const { [emoji]: _, ...remainingReactions } = currentReactions;
            await updateDoc(messageRef, { 
              reactions: remainingReactions,
              // lastReactionAt: serverTimestamp() // İsteğe bağlı: son tepki zamanı
            });
          } else {
            // Tepkiyi güncelle
            await updateDoc(messageRef, { 
              // reactions alanının tamamını güncellemek yerine sadece ilgili emojiyi güncelle
              [`reactions.${emoji}`]: updatedUserIds,
              // lastReactionAt: serverTimestamp()
            });
          }
        } else {
          // Kullanıcının tepkisini ekle
          // userIds zaten string[] olduğu için spread operatörü doğru çalışır
          await updateDoc(messageRef, { 
            [`reactions.${emoji}`]: [...userIds, currentUser.uid],
            // lastReactionAt: serverTimestamp()
          });
        }
      }
    } catch (error) {
      console.error('Reaksiyon eklenirken hata oluştu:', error);
    }
  };

  const handleStar = async (messageId: string) => {
    if (!currentUser || !groupId) return;

    try {
      const messageRef = doc(db, 'groups', groupId, 'messages', messageId);
      const message = messages.find(m => m.id === messageId);
      
      if (!message) {
        console.error("Mesaj bulunamadı:", messageId);
        return;
      }
      
      // Firestore'u güncelle
      await updateDoc(messageRef, {
        isStarred: !message.isStarred // isStarred değerini tersine çevir
      });
      console.log(`Message ${messageId} starred status toggled to ${!message.isStarred}`);

      // State'i güncellemeye gerek YOK, onSnapshot otomatik olarak yapacak.
      // Sadece menüyü kapatabiliriz.
      handleMessageMenuClose(messageId);

    } catch (error) {
      console.error('Error starring message:', error);
    }
  };

  // Grup ayarlarını aç/kapat
  const handleSettingsClick = () => {
    setShowSettings(true);
  };

  // Grup ayarlarını kapat
  const handleCloseSettings = () => {
    setShowSettings(false);
    setShowAddMembers(false);
    setEditingGroup(false);
  };

  // Grup düzenleme
  const handleEditGroup = async () => {
    if (!groupId || !groupName.trim()) return;

    try {
      await updateDoc(doc(db, 'groups', groupId), {
        name: groupName.trim(),
        description: groupDescription.trim(),
      });
      
      setEditingGroup(false);
    } catch (error) {
      console.error('Grup düzenlenirken hata oluştu:', error);
    }
  };

  // Üye ekleme
  const handleAddMembers = async () => {
    if (!group || selectedUsers.length === 0 || !currentUser) return;
    setAddMemberLoading(true);

    try {
      const currentMembers = group.members ? [...group.members] : [];
      const addedUserNames: string[] = [];

      const updatedMembers = currentMembers.map(member => 
        selectedUsers.includes(member.uid) ? { ...member, status: 'active', role: member.role || 'member' } : member
      );

      for (const userId of selectedUsers) {
        if (!currentMembers.some(member => member.uid === userId)) {
          const userToAdd = allUsers.find(u => u.uid === userId);
          if (userToAdd) {
            const displayName = userToAdd.displayName || userToAdd.email?.split('@')[0] || 'Kullanıcı';
            updatedMembers.push({
              uid: userId,
              role: 'member',
              joinedAt: serverTimestamp(),
              displayName: userToAdd.displayName,
              photoURL: userToAdd.photoURL,
              email: userToAdd.email,
              status: 'active' as const
            });
            addedUserNames.push(displayName);
          }
        }
      }

      const groupRef = doc(db, 'groups', group.id);
      await updateDoc(groupRef, { members: updatedMembers });

      // Sistem mesajları gönder
      const batch = writeBatch(db);
      addedUserNames.forEach(name => {
        const systemMessageData = {
          type: 'system',
          text: `${name} gruba katıldı.`,
          timestamp: serverTimestamp()
        };
        const messageRef = doc(collection(db, 'groups', group.id, 'messages')); // Yeni doküman referansı
        batch.set(messageRef, systemMessageData);
      });
      await batch.commit();

      console.log('Members added/updated successfully and system messages sent.');
      setOpenAddMemberDialog(false);
      setSelectedUsers([]);

    } catch (error) {
      console.error('Error adding members:', error);
      // Hata mesajı gösterilebilir
    } finally {
      setAddMemberLoading(false);
    }
  };

  // Gruptan ayrılma
  const handleLeaveGroup = async () => {
    setShowLeaveConfirm(false); 
    if (!currentUser || !groupId || !group) return;

    try {
      // Admin ise ve başka admin yoksa engelle...
      if (isAdmin && group.members.filter(m => m.role === 'admin').length <= 1) { /* ... */ return; }

      // Kullanıcının mevcut member nesnesini bul
      const currentMemberIndex = group.members.findIndex(m => m.uid === currentUser.uid);
      if (currentMemberIndex === -1) return; // Üye zaten yoksa çık

      const updatedMembers = [...group.members];
      updatedMembers[currentMemberIndex] = { 
        ...updatedMembers[currentMemberIndex], 
        status: 'left' // Statüyü 'left' yap
      };

      // Firestore'da members dizisini güncelle
      const groupRef = doc(db, 'groups', groupId);
      await updateDoc(groupRef, { members: updatedMembers });
      console.log(`User ${currentUser.uid} status set to 'left' in group ${groupId}`);

      // Sistem mesajı gönder
      const userName = currentUser.displayName || currentUser.email?.split('@')[0] || 'Kullanıcı';
      const systemMessageData = {
        type: 'system', 
        text: `${userName} gruptan ayrıldı.`, 
        timestamp: serverTimestamp(),
        senderId: 'system'
      };
      const messagesRef = collection(db, 'groups', groupId, 'messages');
      await addDoc(messagesRef, systemMessageData);
      console.log(`System message sent for user ${currentUser.uid} leaving group ${groupId}`);

      // Yönlendir...
      navigate('/');

    } catch (error) { /* ... */ } 
    finally { /* ... */ }
  };

  // Kullanıcı seçimi
  const handleToggleUserSelection = (userId: string) => {
    setSelectedUsers((prevSelected: string[]) => {
      return prevSelected.includes(userId)
        ? prevSelected.filter((id: string) => id !== userId)
        : [...prevSelected, userId];
    });
  };

  // Mesaj zamanını formatla
  const formatMessageTimestamp = (timestamp: Timestamp | FieldValue | null | undefined): string => {
    if (!timestamp || !(timestamp instanceof Timestamp)) {
      // Geçici olarak 'Şimdi' veya boş string döndür veya null handle et
      // Firestore'dan gerçek zaman damgası gelene kadar
      return ''; 
    }

    const date = timestamp.toDate();
    const now = new Date();

    // Her zaman saati HH:mm formatında göster
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;

    // Önceki formatlama mantığı (referans için):
    /*
    if (
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear()
    ) {
      // Bugün gönderildiyse: Saat:Dakika
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');
      return `${hours}:${minutes}`;
    } else if (
      date.getDate() === now.getDate() - 1 &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear()
    ) {
      // Dün gönderildiyse: 'Dün'
      return 'Dün';
    } else {
      // Daha eski ise: Gün Adı (örneğin 'Perşembe') veya Tarih (örneğin 15.05.2024)
      // return date.toLocaleDateString('tr-TR', { weekday: 'long' }); 
       return date.toLocaleDateString('tr-TR'); // Veya DD.MM.YYYY formatı
    }
    */
  };

  // Mesaj menüsünü aç/kapat
  const handleMenuClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  // Dosya yükleme
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setAttachments(Array.from(e.target.files));
    }
  };

  // Arka plan resmi değiştirme
  const handleBackgroundChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      
      reader.onload = (event) => {
        if (event.target?.result) {
          setBackgroundImage(event.target.result as string);
        }
      };
      
      reader.readAsDataURL(file);
    }
  };

  // Arka plan opaklığını değiştirme
  const handleOpacityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setWallpaperOpacity(parseFloat(e.target.value));
  };

  const handlePin = async (message: GroupMessage) => {
    if (!currentUser || !groupId) return;

    try {
      const messageRef = doc(db, 'groups', groupId, 'messages', message.id);
      await updateDoc(messageRef, {
        isPinned: !message.isPinned,
        pinnedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error pinning message:', error);
    }
    handleMessageMenuClose(message.id);
  };

  const handleDelete = async (messageId: string) => {
    if (!currentUser || !groupId) return;

    try {
      const messageRef = doc(db, 'groups', groupId, 'messages', messageId);
      await updateDoc(messageRef, {
        isDeleted: true,
        text: 'Bu mesaj silindi',
        deletedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error deleting message:', error);
    }
    setSelectedMessage(null);
  };

  const handleReply = (message: GroupMessage) => {
    setReplyingTo(message);
    handleMessageMenuClose(message.id);
  };

  const handleMessageMenuOpen = (event: React.MouseEvent<HTMLElement>, messageId: string) => {
    setMessageMenuAnchor({ [messageId]: event.currentTarget });
  };

  const handleMessageMenuClose = (messageId: string) => {
    setMessageMenuAnchor({ [messageId]: null });
  };

  const handleReactionsMenuOpen = (messageId: string) => (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    setReactionMenuAnchor(prev => ({ ...prev, [messageId]: event.currentTarget }));
  };

  const handleReactionsMenuClose = (messageId: string) => {
    setReactionMenuAnchor(prev => ({ ...prev, [messageId]: null }));
  };

  // Üye çıkarma fonksiyonu
  const handleRemoveMember = async () => {
    if (!isAdmin || !currentUser || !group || !userToRemove) return;
    // Kendini çıkarma engeli...
    if (userToRemove.uid === currentUser.uid) { /* ... */ return; }
    // Son admin engeli...
    if (userToRemove.role === 'admin' && group.members.filter(m => m.role === 'admin').length <= 1) { /* ... */ return; }

    try {
      // Çıkarılacak üyenin index'ini bul
      const memberToRemoveIndex = group.members.findIndex(m => m.uid === userToRemove.uid);
      if (memberToRemoveIndex === -1) return; // Üye zaten yoksa çık

      const updatedMembers = [...group.members];
      updatedMembers[memberToRemoveIndex] = { 
        ...updatedMembers[memberToRemoveIndex],
        status: 'removed' // Statüyü 'removed' yap
      };

      // Firestore'da members dizisini güncelle
      const groupRef = doc(db, 'groups', group.id);
      await updateDoc(groupRef, { members: updatedMembers });
      console.log(`Member ${userToRemove.uid} status set to 'removed' in group ${group.id} by admin ${currentUser.uid}`);

      // Sistem mesajı gönder
      const adminName = currentUser.displayName || currentUser.email?.split('@')[0] || 'Admin';
      const removedUserName = userToRemove.displayName || userToRemove.email?.split('@')[0] || 'Bu üye';
      const systemMessageData = {
        type: 'system',
        text: `${removedUserName}, ${adminName} tarafından gruptan çıkarıldı.`, 
        timestamp: serverTimestamp(),
        senderId: 'system'
      };
      const messagesRef = collection(db, 'groups', group.id, 'messages');
      await addDoc(messagesRef, systemMessageData);

    } catch (error) { /* ... */ } 
    finally { /* ... */ }
  };

  // Üye Ekle Dialog'u için filtrelenmiş kullanıcı listesi
  const filteredAvailableUsers = allUsers
    .filter(user => {
      const isCurrentUser = user.uid === currentUser?.uid;
      const isMember = group?.members?.some(m => m.uid === user.uid);
      return !isCurrentUser && !isMember;
    })
    .filter(user => // Arama sorgusu
      (user.displayName || user.email?.split('@')[0] || '').toLowerCase().includes(userToAddQuery.toLowerCase())
    );

  if (loading) {
    return (
      <Box
        sx={{
          height: '100vh',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          background: isDarkMode
            ? 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)'
            : 'linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%)',
        }}
      >
        <CircularProgress size={60} />
      </Box>
    );
  }

  if (!group) {
    return null;
  }

  return (
    <Box
      sx={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: backgroundImage
          ? `url(${backgroundImage}) center/cover no-repeat fixed`
          : isDarkMode
          ? 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)'
          : '#eef2f7',
        '&::before': backgroundImage ? {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: isDarkMode
            ? `rgba(0, 0, 0, ${1 - wallpaperOpacity})`
            : `rgba(255, 255, 255, ${1 - wallpaperOpacity})`,
          zIndex: 0,
        } : {},
      }}
    >
      {/* Grup Başlığı */}
      <Paper
        elevation={3}
        sx={{
          p: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: isDarkMode
            ? 'rgba(30, 41, 59, 0.9)'
            : 'rgba(255, 255, 255, 0.9)',
          backdropFilter: 'blur(10px)',
          zIndex: 1,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <IconButton onClick={() => navigate('/')}>
            <ArrowBackIcon />
          </IconButton>
          <AvatarGroup max={3}>
            {group.members.map((member) => (
              <Tooltip key={member.uid} title={member.displayName}>
                <Avatar
                  src={member.photoURL || undefined}
                  alt={member.displayName || member.email?.split('@')[0] || 'Kullanıcı'}
                  sx={{ border: `2px solid ${theme.palette.primary.main}` }}
                />
              </Tooltip>
            ))}
          </AvatarGroup>
          <Box>
            <Typography variant="h6">{group.name}</Typography>
            <Typography variant="caption" color="text.secondary">
              {group.members.filter(m => m.status === 'active').length} üye
            </Typography>
          </Box>
        </Box>
        <Box>
          <IconButton onClick={handleMenuClick}>
            <MoreVertIcon />
          </IconButton>
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleMenuClose}
          >
            <MenuItem onClick={() => { handleMenuClose(); handleSettingsClick(); }}>
              <ListItemIcon>
                <SettingsIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>Grup Ayarları</ListItemText>
            </MenuItem>
            <MenuItem onClick={() => setShowLeaveConfirm(true)}>
              <ListItemIcon>
                <ExitToAppIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>Gruptan Ayrıl</ListItemText>
            </MenuItem>
          </Menu>
        </Box>
      </Paper>

      {/* Mesajlar veya Ayrılma Bildirimi */}
      <Box
        sx={{
          flex: 1,
          overflow: 'auto',
          p: 2,
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
          zIndex: 1,
          justifyContent: isMemberActive ? 'flex-start' : 'center',
          alignItems: isMemberActive ? 'stretch' : 'center' 
        }}
      >
        {isMemberActive ? (
          // Üye ise mesajları göster
          <>
            {messages.map((message) => (
              // Sistem mesajı ise farklı render et
              message.type === 'system' ? (
                <Box key={message.id} sx={{ textAlign: 'center', my: 1 }}>
                  <Chip 
                    label={message.text} 
                    size="small" 
                    sx={{ backgroundColor: theme.palette.grey[300] }}
                  />
                </Box>
              ) : (
                // Kullanıcı mesajı ise normal render et
                <Box
                  key={message.id}
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: message.senderId === currentUser?.uid ? 'flex-end' : 'flex-start',
                    mb: 1,
                    position: 'relative',
                  }}
                >
                  {message.quotedMessage && (
                    <Paper
                      sx={{
                        p: 1,
                        mb: 0.5,
                        maxWidth: '80%',
                        background: isDarkMode
                          ? 'rgba(30, 41, 59, 0.5)'
                          : 'rgba(241, 245, 249, 0.5)',
                        borderLeft: `3px solid ${theme.palette.primary.main}`,
                      }}
                    >
                      <Typography variant="caption" color="primary">
                        {message.quotedMessage.senderName}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" noWrap>
                        {message.quotedMessage.text}
                      </Typography>
                    </Paper>
                  )}

                  <Paper
                    sx={{
                      p: 1.5,
                      maxWidth: '70%',
                      position: 'relative',
                      background: message.senderId === currentUser?.uid
                        ? 'linear-gradient(135deg, #0ea5e9, #2563eb)'
                        : isDarkMode
                        ? 'linear-gradient(135deg, rgba(30, 41, 59, 0.9), rgba(15, 23, 42, 0.9))'
                        : 'linear-gradient(135deg, rgba(255, 255, 255, 0.9), rgba(241, 245, 249, 0.9))',
                      color: message.senderId === currentUser?.uid ? '#ffffff' : 'inherit',
                      borderRadius: 2,
                    }}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5 }}>
                      {message.senderId !== currentUser?.uid && (
                        <Typography variant="caption" sx={{ color: getUserColor(message.senderId), fontWeight: 'bold' }}>
                          {message.senderName}
                        </Typography>
                      )}
                      <IconButton
                        size="small"
                        onClick={(e) => handleMessageMenuOpen(e, message.id)}
                        sx={{
                          padding: 0.5,
                          ml: 1,
                          color: message.senderId === currentUser?.uid ? 'rgba(255,255,255,0.7)' : 'text.secondary',
                        }}
                      >
                        <MoreVertIcon fontSize="small" />
                      </IconButton>
                    </Box>

                    <Typography variant="body1" sx={{
                      wordBreak: 'break-word',
                      color: message.senderId !== currentUser?.uid && isDarkMode ? 'rgba(255, 255, 255, 0.9)' : (message.senderId === currentUser?.uid ? '#ffffff' : 'inherit'),
                    }}>
                      {message.text}
                    </Typography>

                    {/* Ekleri Göster (Eğer varsa) */}
                    {message.attachments && message.attachments.length > 0 && (
                      <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                        {message.attachments.map((url, index) => (
                          <a key={index} href={url} target="_blank" rel="noopener noreferrer">
                            <img 
                              src={url} 
                              alt={`attachment-${index}`}
                              style={{ 
                                maxWidth: '100px', 
                                maxHeight: '100px', 
                                borderRadius: '8px', 
                                objectFit: 'cover'
                              }}
                            />
                          </a>
                        ))}
                      </Box>
                    )}

                    {/* Zaman Damgası ve Durum Göstergeleri (Mesajın sağ altı) */}
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'flex-end', // Sağa yasla
                        gap: 0.5,
                        mt: 0.5, // Üstteki içerikle boşluk
                        width: '100%', // Genişliği doldur
                      }}
                    >
                      {message.isEdited && (
                        <Typography variant="caption" color={message.senderId === currentUser?.uid ? 'rgba(255,255,255,0.7)' : 'text.secondary'}>
                          düzenlendi
                        </Typography>
                      )}
                      {/* FORMATLANMIŞ ZAMAN DAMGASI BURADA */}
                      <Typography variant="caption" color={message.senderId === currentUser?.uid ? 'rgba(255,255,255,0.7)' : 'text.secondary'}>
                        {formatMessageTimestamp(message.timestamp)} 
                      </Typography>
                      {message.isStarred && (
                         <StarIcon 
                           sx={{ 
                             fontSize: '0.875rem',
                             color: message.senderId === currentUser?.uid ? 'rgba(255,255,255,0.7)' : theme.palette.warning.main, // Yıldız rengi
                             verticalAlign: 'middle' 
                           }}
                         />
                       )}
                      {message.isPinned && (
                        <PushPinIcon 
                          sx={{ 
                            fontSize: '0.875rem',
                            color: message.senderId === currentUser?.uid ? 'rgba(255,255,255,0.7)' : theme.palette.primary.main,
                            verticalAlign: 'middle'
                          }} 
                        />
                      )}
                    </Box>

                    {/* Reaksiyonlar (Eğer varsa) */}
                    <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                      {message.reactions && Object.keys(message.reactions).length > 0 && (
                        <Box
                          sx={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: 0.5,
                            mb: 0.5,
                          }}
                        >
                          {Object.entries(message.reactions).map(([emoji, userIds]) => {
                            if (Array.isArray(userIds) && userIds.length > 0) {
                              return (
                                <Chip
                                  key={emoji}
                                  label={`${emoji} ${userIds.length}`}
                                  size="small"
                                  onClick={() => handleReaction(message.id, emoji)}
                                  sx={{
                                    backgroundColor: userIds.includes(currentUser?.uid || '')
                                      ? theme.palette.primary.main
                                      : isDarkMode
                                      ? 'rgba(30, 41, 59, 0.5)'
                                      : 'rgba(241, 245, 249, 0.5)',
                                    color: userIds.includes(currentUser?.uid || '')
                                      ? '#ffffff'
                                      : 'inherit',
                                  }}
                                />
                              );
                            }
                            return null;
                          })}
                        </Box>
                      )}
                    </Box>
                  </Paper>

                  <Menu
                    anchorEl={messageMenuAnchor[message.id]}
                    open={Boolean(messageMenuAnchor[message.id])}
                    onClose={() => handleMessageMenuClose(message.id)}
                  >
                    <MenuItem onClick={() => handleReply(message)}>
                      <ListItemIcon>
                        <ReplyIcon fontSize="small" />
                      </ListItemIcon>
                      <ListItemText>Yanıtla</ListItemText>
                    </MenuItem>
                    <MenuItem onClick={() => handleStar(message.id)}>
                      <ListItemIcon>
                        <StarIcon fontSize="small" color={message.isStarred ? 'warning' : 'inherit'} />
                      </ListItemIcon>
                      <ListItemText>{message.isStarred ? 'Yıldızı Kaldır' : 'Yıldızla'}</ListItemText>
                    </MenuItem>
                    <MenuItem onClick={() => handlePin(message)}>
                      <ListItemIcon>
                        <PushPinIcon fontSize="small" color={message.isPinned ? 'primary' : 'inherit'} />
                      </ListItemIcon>
                      <ListItemText>{message.isPinned ? 'Sabitlemeyi Kaldır' : 'Sabitle'}</ListItemText>
                    </MenuItem>
                    <MenuItem onClick={handleReactionsMenuOpen(message.id)}>
                      <ListItemIcon>
                        <AddReactionIcon fontSize="small" />
                      </ListItemIcon>
                      <ListItemText>Tepki Ekle</ListItemText>
                    </MenuItem>
                    {message.senderId === currentUser?.uid ? [
                      <Divider key="divider" />,
                      <MenuItem key="delete" onClick={() => handleDelete(message.id)} sx={{ color: 'error.main' }}>
                        <ListItemIcon>
                          <CloseIcon fontSize="small" color="error" />
                        </ListItemIcon>
                        <ListItemText>Sil</ListItemText>
                      </MenuItem>
                    ] : null}
                  </Menu>

                  {/* Tepki Menüsü */}
                  <Menu
                    anchorEl={reactionMenuAnchor[message.id]}
                    open={Boolean(reactionMenuAnchor[message.id])}
                    onClose={() => handleReactionsMenuClose(message.id)}
                  >
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', p: 1, gap: 0.5 }}>
                      {reactions.map((emoji) => (
                        <IconButton
                          key={emoji}
                          size="small"
                          onClick={() => {
                            handleReaction(message.id, emoji);
                            handleReactionsMenuClose(message.id);
                          }}
                          sx={{
                            fontSize: '1.5rem',
                            transition: 'transform 0.2s',
                            '&:hover': {
                              transform: 'scale(1.2)',
                            },
                          }}
                        >
                          {emoji}
                        </IconButton>
                      ))}
                    </Box>
                  </Menu>
                </Box>
              )
            ))}
            <div ref={messagesEndRef} />
          </>
        ) : (
          // Üye değilse ayrılma bildirimini göster
          <Typography 
            variant="h6" 
            color="text.secondary"
            sx={{ fontFamily: "'Dancing Script', cursive", textAlign: 'center' }}
          >
            {memberStatus === 'left' ? 'Bu gruptan ayrıldınız.' : 
             memberStatus === 'removed' ? 'Bu gruptan çıkarıldınız.' : 
             'Bu gruba erişiminiz yok.'}
          </Typography>
        )}
      </Box>

      {replyingTo && (
        <Paper
          sx={{
            p: 1,
            mx: 2,
            mb: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: isDarkMode
              ? 'linear-gradient(135deg, rgba(30, 41, 59, 0.9), rgba(15, 23, 42, 0.9))'
              : 'linear-gradient(135deg, rgba(255, 255, 255, 0.9), rgba(241, 245, 249, 0.9))',
            borderLeft: `4px solid ${theme.palette.primary.main}`,
          }}
        >
          <Box>
            <Typography variant="caption" color="primary">
              {replyingTo?.senderName || 'Bilinmeyen Kullanıcı'}
            </Typography>
            <Typography variant="body2" color="text.secondary" noWrap sx={{ maxWidth: '300px' }}>
              {replyingTo?.text || ''}
            </Typography>
          </Box>
          <IconButton size="small" onClick={() => setReplyingTo(null)}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Paper>
      )}

      {/* Mesaj Gönderme */}
      <Paper
        component="form"
        onSubmit={handleSendMessage}
        elevation={3}
        sx={{
          p: 2,
          background: isDarkMode
            ? 'rgba(30, 41, 59, 0.9)'
            : 'rgba(255, 255, 255, 0.9)',
          backdropFilter: 'blur(10px)',
          zIndex: 1,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <IconButton size="small">
            <EmojiIcon />
          </IconButton>
          <IconButton
            size="small"
            component="label"
          >
            <input
              type="file"
              hidden
              multiple
              onChange={handleFileUpload}
            />
            <AttachFileIcon />
          </IconButton>
          <TextField
            fullWidth
            placeholder="Mesajınızı yazın..."
            variant="outlined"
            size="small"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: 3,
              },
            }}
            disabled={!isMemberActive}
          />
          <IconButton
            color="primary"
            type="submit"
            disabled={(!newMessage.trim() && attachments.length === 0) || !isMemberActive}
          >
            <SendIcon />
          </IconButton>
        </Box>
        {attachments.length > 0 && (
          <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {attachments.map((file, index) => (
              <Chip
                key={index}
                icon={<FileIcon />}
                label={file.name}
                onDelete={() => {
                  setAttachments(attachments.filter((_, i) => i !== index));
                }}
                size="small"
              />
            ))}
          </Box>
        )}
      </Paper>

      {/* Grup Ayarları Modal */}
      <Dialog
        open={showSettings}
        onClose={handleCloseSettings}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ 
          fontFamily: "'Dancing Script', cursive", 
          color: theme.palette.primary.main,
          borderBottom: `1px solid ${theme.palette.divider}`,
        }}>
          Grup Ayarları
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          {editingGroup ? (
            <>
              <TextField
                autoFocus
                margin="dense"
                label="Grup Adı"
                type="text"
                fullWidth
                variant="outlined"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                sx={{ mb: 2 }}
              />
              <TextField
                margin="dense"
                label="Grup Açıklaması"
                type="text"
                fullWidth
                variant="outlined"
                multiline
                rows={2}
                value={groupDescription}
                onChange={(e) => setGroupDescription(e.target.value)}
                sx={{ mb: 3 }}
              />
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                <Button onClick={() => setEditingGroup(false)}>
                  İptal
                </Button>
                <Button
                  variant="contained"
                  onClick={handleEditGroup}
                  disabled={!groupName.trim()}
                >
                  Kaydet
                </Button>
              </Box>
            </>
          ) : showAddMembers ? (
            <>
              <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 600 }}>
                Üye Ekle
              </Typography>
              <List sx={{ maxHeight: 300, overflow: 'auto', bgcolor: 'background.paper', borderRadius: 1 }}>
                {filteredAvailableUsers.map((user: User) => (
                  <ListItem key={user.uid} divider>
                    <ListItemAvatar>
                      <Avatar 
                        src={user.photoURL || undefined} 
                        alt={user.displayName || user.email?.split('@')[0]}
                      />
                    </ListItemAvatar>
                    <ListItemText 
                      primary={user.displayName || user.email?.split('@')[0]}
                      secondary={user.email} 
                    />
                    <ListItemSecondaryAction>
                      <Checkbox
                        edge="end"
                        checked={Array.isArray(selectedUsers) && selectedUsers.includes(user.uid)}
                        onChange={() => handleToggleUserSelection(user.uid)}
                      />
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
              </List>
              {Array.isArray(selectedUsers) && selectedUsers.length > 0 && (
                <Box sx={{ mt: 2, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {selectedUsers.map((userId: string) => {
                    const user = allUsers.find(u => u.uid === userId);
                    if (!user) return null;
                    const chipLabel = user.displayName || user.email?.split('@')[0] || 'Kullanıcı';
                    return (
                      <Chip
                        key={userId}
                        avatar={<Avatar src={user.photoURL || undefined} alt={chipLabel} />}
                        label={chipLabel}
                        onDelete={() => handleToggleUserSelection(userId)}
                        color="primary"
                        variant="outlined"
                      />
                    );
                  })}
                </Box>
              )}
              <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                <Button onClick={() => setShowAddMembers(false)}>
                  İptal
                </Button>
                <Button
                  variant="contained"
                  onClick={handleAddMembers}
                  disabled={addMemberLoading || !Array.isArray(selectedUsers) || selectedUsers.length === 0}
                >
                  Ekle
                </Button>
              </Box>
            </>
          ) : (
            <>
              <Box sx={{ mb: 3 }}>
                <Typography variant="h6" sx={{ mb: 1 }}>
                  {group.name}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {group.description || 'Açıklama yok'}
                </Typography>
              </Box>
              
              <Divider sx={{ my: 2 }} />
              
              <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 600 }}>
                Üyeler ({group.members.filter(m => m.status === 'active').length})
              </Typography>
              <List sx={{ maxHeight: 300, overflow: 'auto', bgcolor: 'background.paper', borderRadius: 1 }}>
                {group.members
                  .filter(member => member.status === 'active') // Sadece aktif üyeleri filtrele
                  .map((member) => (
                  <ListItem 
                    key={member.uid}
                    secondaryAction={
                      // Admin ise ve üye kendisi değilse Çıkar butonunu göster
                      isAdmin && member.uid !== currentUser?.uid ? (
                        <IconButton 
                          edge="end" 
                          aria-label="remove member" 
                          onClick={() => {
                            setUserToRemove(member);
                            setShowRemoveConfirm(true);
                          }}
                          // Son admini çıkarma butonunu devre dışı bırak
                          disabled={member.role === 'admin' && group.members.filter(m => m.role === 'admin').length <= 1}
                        >
                          <RemoveCircleOutlineIcon color="error" />
                        </IconButton>
                      ) : null
                    }
                  >
                    <ListItemAvatar>
                      <Avatar src={member.photoURL || undefined} alt={member.displayName || member.email?.split('@')[0] || 'Kullanıcı'} />
                    </ListItemAvatar>
                    <MuiListItemText 
                      primary={member.displayName || member.email?.split('@')[0] || 'Kullanıcı'} 
                      secondary={member.role === 'admin' ? 'Admin' : 'Üye'} 
                    />
                  </ListItem>
                ))}
              </List>
              
              <Box sx={{ mt: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
                {isAdmin && (
                  <>
                    <Button
                      variant="outlined"
                      startIcon={<EditIcon />}
                      onClick={() => setEditingGroup(true)}
                      fullWidth
                    >
                      Grubu Düzenle
                    </Button>
                    <Button
                      variant="outlined"
                      startIcon={<PersonAddIcon />}
                      onClick={() => setShowAddMembers(true)}
                      fullWidth
                    >
                      Üye Ekle
                    </Button>
                  </>
                )}
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<ExitToAppIcon />}
                  onClick={handleLeaveGroup}
                  fullWidth
                >
                  Gruptan Ayrıl
                </Button>
              </Box>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Gruptan Ayrılma Onay Dialog'u */}
      <Dialog
        open={showLeaveConfirm}
        onClose={() => setShowLeaveConfirm(false)}
      >
        <DialogTitle>Gruptan Ayrıl</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Bu gruptan ayrılmak istediğinize emin misiniz? Ayrıldıktan sonra mesaj gönderemezsiniz ancak grup listenizde kalır.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowLeaveConfirm(false)}>İptal</Button>
          <Button onClick={handleLeaveGroup} color="error">
            Ayrıl
          </Button>
        </DialogActions>
      </Dialog>

      {/* Üye Çıkarma Onay Dialog'u */}
      <Dialog
        open={showRemoveConfirm}
        onClose={() => {
          setShowRemoveConfirm(false);
          setUserToRemove(null);
        }}
      >
        <DialogTitle>Üyeyi Çıkar</DialogTitle>
        <DialogContent>
          <DialogContentText>
            '{(userToRemove?.displayName || userToRemove?.email?.split('@')[0] || 'Bu üye')} adlı üyeyi gruptan çıkarmak istediğinize emin misiniz?'
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setShowRemoveConfirm(false);
            setUserToRemove(null);
          }}>İptal</Button>
          <Button onClick={handleRemoveMember} color="error">
            Çıkar
          </Button>
        </DialogActions>
      </Dialog>

      {/* Üye Ekle Dialog */}
      <Dialog 
        open={openAddMemberDialog} 
        onClose={() => !addMemberLoading && setOpenAddMemberDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ /* ... */ }}>
          Gruba Üye Ekle
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <TextField
            autoFocus
            margin="dense"
            label="Kullanıcı Ara"
            type="text"
            fullWidth
            variant="standard"
            value={userToAddQuery}
            onChange={(e) => setUserToAddQuery(e.target.value)}
            sx={{ mb: 2 }}
          />
          <List sx={{ maxHeight: 300, overflow: 'auto', bgcolor: 'background.paper', borderRadius: 1 }}>
            {filteredAvailableUsers.map((user: User) => (
              <ListItem key={user.uid} divider>
                <ListItemAvatar>
                  <Avatar 
                    src={user.photoURL || undefined} 
                    alt={user.displayName || user.email?.split('@')[0]}
                  />
                </ListItemAvatar>
                <ListItemText 
                  primary={user.displayName || user.email?.split('@')[0]}
                  secondary={user.email} 
                />
                <ListItemSecondaryAction>
                  <Checkbox
                    edge="end"
                    checked={Array.isArray(selectedUsers) && selectedUsers.includes(user.uid)}
                    onChange={() => handleToggleUserSelection(user.uid)}
                  />
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
          {Array.isArray(selectedUsers) && selectedUsers.length > 0 && (
            <Box sx={{ mt: 2, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {selectedUsers.map((userId: string) => {
                const user = allUsers.find(u => u.uid === userId);
                if (!user) return null;
                const chipLabel = user.displayName || user.email?.split('@')[0] || 'Kullanıcı';
                return (
                  <Chip
                    key={userId}
                    avatar={<Avatar src={user.photoURL || undefined} alt={chipLabel} />}
                    label={chipLabel}
                    onDelete={() => handleToggleUserSelection(userId)}
                    color="primary"
                    variant="outlined"
                  />
                );
              })}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, borderTop: `1px solid ${theme.palette.divider}` }}>
          <Button 
            onClick={() => { setOpenAddMemberDialog(false); setSelectedUsers([]); setUserToAddQuery(''); }}
            disabled={addMemberLoading}
          >
            İptal
          </Button>
          <Button 
            onClick={handleAddMembers}
            variant="contained"
            disabled={addMemberLoading || !Array.isArray(selectedUsers) || selectedUsers.length === 0}
            startIcon={addMemberLoading ? <CircularProgress size={20} /> : <PersonAddIcon />}
          >
            {addMemberLoading ? 'Ekleniyor...' : 'Seçilenleri Ekle'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default GroupChat; 