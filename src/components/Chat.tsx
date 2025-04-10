import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useThemeMode } from '../contexts/ThemeContext';
import { db, storage } from '../config/firebase';
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
  Timestamp,
  FieldValue,
  writeBatch,
  increment,
  getDocs,
  arrayUnion,
} from 'firebase/firestore';
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage';
import {
  Box,
  Typography,
  TextField,
  IconButton,
  Avatar,
  Paper,
  useTheme,
  useMediaQuery,
  ImageList,
  ImageListItem,
  Menu,
  MenuItem,
  Divider,
  CircularProgress,
  ListItemIcon,
  ListItemText,
  Chip,
  Slider,
  Dialog,
  DialogTitle,
  DialogContent,
  List,
  ListItem,
  DialogActions,
  Button,
} from '@mui/material';
import {
  Send as SendIcon,
  AttachFile as AttachFileIcon,
  MoreVert as MoreVertIcon,
  Delete as DeleteIcon,
  Image as ImageIcon,
  ArrowBack as ArrowBackIcon,
  EmojiEmotions as EmojiEmotionsIcon,
  FormatQuote as FormatQuoteIcon,
  Edit as EditIcon,
  Reply as ReplyIcon,
  Star as StarIcon,
  PushPin as PushPinIcon,
  AddReaction as AddReactionIcon,
  Close as CloseIcon,
} from '@mui/icons-material';

interface Message {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  senderPhotoURL: string;
  timestamp: Timestamp;
  chatId: string;
  receiverId: string;
  attachments?: string[];
  reactions?: { [key: string]: string[] }; // userId: reaction
  quotedMessage?: {
    id: string;
    text: string;
    senderName: string;
  };
  isEdited?: boolean;
  isDeleted?: boolean;
  isStarred?: boolean;
  isPinned?: boolean;
  isRead?: boolean;
}

interface User {
  uid: string;
  displayName: string | null;
  photoURL: string | null;
  firstName?: string;
  lastName?: string;
  email: string | null;
}

interface MessageData {
  text: string;
  senderId: string;
  senderName: string;
  senderPhotoURL: string;
  receiverId: string;
  timestamp: FieldValue;
  chatId: string;
  isEdited: boolean;
  isRead: boolean;
  quotedMessage?: {
    id: string;
    text: string;
    senderName: string;
  };
}

const generateChatId = (uid1: string, uid2: string): string => {
  return uid1 < uid2 ? `${uid1}_${uid2}` : `${uid2}_${uid1}`;
};

const Chat: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const { currentUser } = useAuth();
  const { isDarkMode } = useThemeMode();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [otherUser, setOtherUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [backgroundImage, setBackgroundImage] = useState<string | null>(null);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [reactionMenuAnchor, setReactionMenuAnchor] = useState<{ [key: string]: HTMLElement | null }>({});
  const [quoteMessage, setQuoteMessage] = useState<Message | null>(null);
  const [messageMenuAnchor, setMessageMenuAnchor] = useState<{ [key: string]: HTMLElement | null }>({});
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [reactionsMenuAnchor, setReactionsMenuAnchor] = useState<{ [key: string]: HTMLElement | null }>({});
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [wallpaperOpacity, setWallpaperOpacity] = useState<number>(0.5);
  const [showStarredMessages, setShowStarredMessages] = useState<boolean>(false);
  const [pinnedMessages, setPinnedMessages] = useState<Message[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [chatId, setChatId] = useState<string>('');

  const reactions = ['👍', '❤️', '😊', '😮', '😢', '🙏'];

  useEffect(() => {
    if (currentUser && userId) {
      const generatedChatId = generateChatId(currentUser.uid, userId);
      setChatId(generatedChatId);
      console.log('Chat ID set to:', generatedChatId);
      setLoading(true);

      const fetchUserData = async () => {
        if (!userId) { setLoading(false); return; }
        try {
          const userDoc = await getDoc(doc(db, 'users', userId));
          if (userDoc.exists()) {
            setOtherUser(userDoc.data() as User);
          } else {
             console.error('Other user not found');
             setLoading(false);
          }
        } catch (error) {
          console.error('Kullanıcı bilgileri alınırken hata oluştu:', error);
          setLoading(false);
        }
      };
      fetchUserData();
    } else {
      setChatId('');
      setLoading(false);
    }
  }, [currentUser, userId]);

  useEffect(() => {
    if (!chatId || !currentUser || !otherUser) return;

    const messagesRef = collection(db, 'chats', chatId, 'messages');
    console.log('Listening to chat:', chatId);
    const q = query(messagesRef, orderBy('timestamp', 'asc'));

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      let firstUnreadMessageId: string | null = null;
      const fetchedMessages = snapshot.docs.map(doc => {
        const data = doc.data();
        const message = {
          id: doc.id,
          ...data,
          timestamp: data.timestamp?.toDate ? data.timestamp.toDate() : null,
        } as Message;

        if (!firstUnreadMessageId && 
            message.senderId !== currentUser.uid && 
            (!data.readBy || !data.readBy.includes(currentUser.uid))) {
          firstUnreadMessageId = message.id;
        }
        return message;
      });
      
      setMessages(fetchedMessages);
      
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
        try {
          await batch.commit();
          console.log('Unread messages marked as read.');
        } catch (error) {
          console.error('Error marking messages as read:', error);
        }
      }

      const currentUnreadCount = fetchedMessages.filter(
        m => m.senderId !== currentUser.uid && (!m.isRead && !((m as any).readBy?.includes(currentUser.uid)))
      ).length;
      setUnreadCount(currentUnreadCount);
      document.title = currentUnreadCount > 0 ? `(${currentUnreadCount}) Yeni Mesaj` : 'Chat';

      setTimeout(() => {
        if (firstUnreadMessageId) {
          const element = document.getElementById(`message-${firstUnreadMessageId}`);
          if (element) {
            console.log('Scrolling to first unread message:', firstUnreadMessageId);
            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
          } else {
            console.log('First unread message element not found, scrolling to bottom.');
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
          }
        } else {
          console.log('No unread messages, scrolling to bottom.');
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
      }, 100);

      setLoading(false);
    }, (error) => {
        console.error(`Error fetching messages for chat ${chatId}:`, error);
        setLoading(false);
    });

    return () => unsubscribe();
  }, [chatId, currentUser, otherUser]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleReply = (message: Message) => {
    const messageWithSenderName = {
      ...message,
      senderName: message.senderName || 'Bilinmeyen Kullanıcı' 
    };
    setReplyingTo(messageWithSenderName);
    handleMessageMenuClose(message.id);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('handleSendMessage triggered in Chat.tsx');
    console.log('State values:', { newMessage: newMessage.trim(), currentUser, userId, otherUser });

    if (!newMessage.trim() || !currentUser || !userId || !otherUser) {
      console.log('Exiting handleSendMessage early due to missing data');
      return;
    }

    try {
      const messageData: any = {
        text: newMessage.trim(),
        senderId: currentUser.uid,
        senderName: currentUser.displayName || currentUser.email?.split('@')[0] || 'Kullanıcı',
        senderPhotoURL: currentUser.photoURL || '',
        receiverId: userId,
        timestamp: serverTimestamp(),
        chatId,
        isEdited: false,
        isRead: false,
      };

      if (replyingTo) {
        messageData.quotedMessage = {
          id: replyingTo.id,              
          text: replyingTo.text || '',
          senderName: replyingTo.senderName || 'Bilinmeyen Kullanıcı'
        };
      }

      console.log('Attempting to add document to Firestore:', messageData);
      const messagesRef = collection(db, 'chats', chatId, 'messages');
      const addedMessageRef = await addDoc(messagesRef, messageData);
      console.log('Message added with ID:', addedMessageRef.id);

      // 2. Update parent chat doc using state chatId
      const chatDocRef = doc(db, 'chats', chatId);
      try {
        await updateDoc(chatDocRef, {
          lastMessage: {
            text: newMessage || (messageData.attachments && messageData.attachments.length > 0 ? 'Ek gönderildi' : ''),
            timestamp: serverTimestamp(),
            senderId: currentUser.uid,
          },
        });
        console.log('[Chat.tsx] Chat document updated with lastMessage successfully.'); // Success Log 1
      } catch (updateError) {
        console.error('[Chat.tsx] ERROR updating chat document lastMessage:', updateError); // Error Log 1
        // Hata olsa bile input temizlemeye devam etmeyi deneyebiliriz, ancak temel sorunu bulmak önemli.
      }

      // --- Clear state --- 
      console.log('[Chat.tsx] Attempting to clear newMessage state...'); // Log 2
      setNewMessage('');
      console.log('[Chat.tsx] newMessage state supposedly cleared.'); // Log 3
      console.log('Attempting to clear replyingTo state...');
      setReplyingTo(null); 
      console.log('replyingTo state cleared.');
      console.log('Attempting to scroll into view...');
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      console.log('Scroll into view complete.');

    } catch (error) {
      console.error('Error sending message (in catch block):', error);
    } finally {
      console.log('handleSendMessage finally block reached.');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setAttachments(prev => [...prev, ...newFiles]);
    }
  };

  const handleRemoveAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleBackgroundChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onloadend = () => {
        setBackgroundImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveBackground = () => {
    setBackgroundImage(null);
    setAnchorEl(null);
  };

  const handleMenuClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  useEffect(() => {
    const requestNotificationPermission = async () => {
      try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          console.log('Bildirim izni verildi');
        }
      } catch (error) {
        console.error('Bildirim izni alınamadı:', error);
      }
    };

    requestNotificationPermission();
  }, []);

  const sendNotification = async (message: Message) => {
    if (!currentUser || message.senderId === currentUser.uid) return;

    try {
      const receiverDoc = await getDoc(doc(db, 'users', message.senderId));
      if (!receiverDoc.exists() || !receiverDoc.data().notifications) return;

      const notification = new Notification('Yeni Mesaj', {
        body: `${message.senderName}: ${message.text}`,
        icon: message.senderPhotoURL || '/logo192.png',
        badge: '/logo192.png',
        tag: `chat-${message.chatId}`,
      });

      notification.onclick = () => {
        window.focus();
        navigate(`/chat/${message.chatId}`);
      };

      setNotifications(prev => [...prev, notification]);
    } catch (error) {
      console.error('Bildirim gönderilirken hata oluştu:', error);
    }
  };

  useEffect(() => {
    if (!currentUser || !userId) return;

    const chatId = [currentUser.uid, userId].sort().join('_');
    const q = query(
      collection(db, 'chats', chatId, 'messages'),
      orderBy('timestamp', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const message = change.doc.data() as Message;
          if (message.senderId !== currentUser.uid) {
            sendNotification(message);
          }
        }
      });
    });

    return () => unsubscribe();
  }, [currentUser, userId]);

  const handleReaction = async (messageId: string, reaction: string) => {
    if (!currentUser || !userId) return;

    try {
      const chatId = [currentUser.uid, userId].sort().join('_');
      const messageRef = doc(db, 'chats', chatId, 'messages', messageId);
      const messageDoc = await getDoc(messageRef);
      
      if (messageDoc.exists()) {
        const message = messageDoc.data() as Message;
        const currentReactions = message.reactions || {};
        const userReactions = currentReactions[reaction] || [];
        
        if (userReactions.includes(currentUser.uid)) {
          userReactions.splice(userReactions.indexOf(currentUser.uid), 1);
        } else {
          userReactions.push(currentUser.uid);
        }
        
        currentReactions[reaction] = userReactions;
        
        await updateDoc(messageRef, {
          reactions: currentReactions,
          lastReactionAt: serverTimestamp()
        });
      }
    } catch (error) {
      console.error('Reaksiyon eklenirken hata oluştu:', error);
    }
  };

  const handleQuote = (message: Message) => {
    setQuoteMessage(message);
    setNewMessage(prev => `> ${message.text}\n\n${prev}`);
  };

  const handleEdit = (messageId: string, messageText: string) => {
    setEditingMessageId(messageId);
    setNewMessage(messageText);
    setIsEditing(true);
  };

  const handleDelete = async (messageId: string) => {
    if (!currentUser || !userId) return;

    try {
      const chatId = [currentUser.uid, userId].sort().join('_');
      const messageRef = doc(db, 'chats', chatId, 'messages', messageId);
      await updateDoc(messageRef, {
        isDeleted: true,
        text: 'Bu mesaj silindi',
        deletedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Mesaj silinirken hata oluştu:', error);
    }
    
    setSelectedMessage(null);
  };

  const handleMessageMenuOpen = (event: React.MouseEvent<HTMLElement>, messageId: string) => {
    event.preventDefault();
    setMessageMenuAnchor(prev => ({ ...prev, [messageId]: event.currentTarget }));
  };

  const handleMessageMenuClose = (messageId: string) => {
    setMessageMenuAnchor(prev => ({ ...prev, [messageId]: null }));
  };

  const handleStar = async (message: Message) => {
    if (!currentUser || !userId) return;

    try {
      const chatId = [currentUser.uid, userId].sort().join('_');
      const messageRef = doc(db, 'chats', chatId, 'messages', message.id);
      await updateDoc(messageRef, {
        isStarred: !message.isStarred,
        starredAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Mesaj yıldızlanırken hata oluştu:', error);
    }
    handleMessageMenuClose(message.id);
  };

  const handlePin = async (message: Message) => {
    if (!currentUser || !userId) return;

    try {
      const chatId = [currentUser.uid, userId].sort().join('_');
      const messageRef = doc(db, 'chats', chatId, 'messages', message.id);
      await updateDoc(messageRef, {
        isPinned: !message.isPinned,
        pinnedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Mesaj sabitlenirken hata oluştu:', error);
    }
    handleMessageMenuClose(message.id);
  };

  const formatMessageTimestamp = (timestamp: Timestamp | FieldValue | null | undefined): string => {
    if (!timestamp || !(timestamp instanceof Timestamp)) {
      return ''; 
    }

    const date = timestamp.toDate();

    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  const handleReactionsMenuOpen = (messageId: string) => (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    setReactionMenuAnchor(prev => ({ ...prev, [messageId]: event.currentTarget }));
  };

  const handleReactionsMenuClose = (messageId: string) => {
    setReactionMenuAnchor(prev => ({ ...prev, [messageId]: null }));
  };

  const renderMessage = (message: Message) => {
    const isCurrentUser = message.senderId === currentUser?.uid;
    const formattedTime = formatMessageTimestamp(message.timestamp);

    return (
      <Box
        key={message.id}
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: isCurrentUser ? 'flex-end' : 'flex-start',
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
            background: isCurrentUser
              ? 'linear-gradient(135deg, #0ea5e9, #2563eb)'
              : isDarkMode
              ? 'linear-gradient(135deg, rgba(30, 41, 59, 0.9), rgba(15, 23, 42, 0.9))'
              : 'linear-gradient(135deg, rgba(255, 255, 255, 0.9), rgba(241, 245, 249, 0.9))',
            color: isCurrentUser ? '#ffffff' : 'inherit',
            borderRadius: 2,
            ml: isCurrentUser ? 'auto' : 0,
            mr: isCurrentUser ? 0 : 'auto',
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5 }}>
            {!isCurrentUser && (
              <Typography variant="caption" color={theme.palette.primary.main}>
                {message.senderName}
              </Typography>
            )}
            <IconButton
              size="small"
              onClick={(e) => handleMessageMenuOpen(e, message.id)}
              sx={{
                padding: 0.5,
                ml: 1,
                color: isCurrentUser ? 'rgba(255,255,255,0.7)' : 'text.secondary',
              }}
            >
              <MoreVertIcon fontSize="small" />
            </IconButton>
          </Box>

          <Typography variant="body1" sx={{
            wordBreak: 'break-word',
            color: !isCurrentUser && isDarkMode ? 'rgba(255, 255, 255, 0.9)' : 'inherit',
          }}>
            {message.text}
          </Typography>

          {/* Zaman Damgası ve Durum Göstergeleri (Mesajın sağ altı) */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end', // Sağa yasla
              gap: 0.5,
              mt: 0.5, // Üstündeki içerikle arasında boşluk
              width: '100%', // Genişliği doldurmasını sağla (opsiyonel)
            }}
          >
            {message.isEdited && (
              <Typography variant="caption" color={isCurrentUser ? 'rgba(255,255,255,0.7)' : 'text.secondary'}>
                düzenlendi
              </Typography>
            )}
            {/* FORMATLANMIŞ ZAMAN DAMGASI BURADA */}
            <Typography variant="caption" color={isCurrentUser ? 'rgba(255,255,255,0.7)' : 'text.secondary'}>
              {formattedTime} 
            </Typography>
            {message.isStarred && (
              <StarIcon 
                sx={{ 
                  fontSize: '0.875rem',
                  color: isCurrentUser ? 'rgba(255,255,255,0.7)' : theme.palette.primary.main,
                  verticalAlign: 'middle' // Dikey hizalama
                }} 
              />
            )}
             {message.isPinned && (
              <PushPinIcon 
                sx={{ 
                  fontSize: '0.875rem',
                  color: isCurrentUser ? 'rgba(255,255,255,0.7)' : theme.palette.primary.main,
                   verticalAlign: 'middle' // Dikey hizalama
                }} 
              />
            )}
          </Box>

          {message.reactions && Object.keys(message.reactions).length > 0 && (
            <Box
              sx={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 0.5,
                mt: 0.5,
              }}
            >
              {Object.entries(message.reactions).map(([reaction, users]) => (
                users.length > 0 && (
                  <Chip
                    key={reaction}
                    label={`${reaction} ${users.length}`}
                    size="small"
                    onClick={() => handleReaction(message.id, reaction)}
                    sx={{
                      backgroundColor: users.includes(currentUser?.uid || '')
                        ? theme.palette.primary.main
                        : isDarkMode
                        ? 'rgba(30, 41, 59, 0.5)'
                        : 'rgba(241, 245, 249, 0.5)',
                      color: users.includes(currentUser?.uid || '')
                        ? '#ffffff'
                        : 'inherit',
                    }}
                  />
                )
              ))}
            </Box>
          )}
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
          <MenuItem onClick={() => handleStar(message)}>
            <ListItemIcon>
              <StarIcon fontSize="small" color={message.isStarred ? 'primary' : 'inherit'} />
            </ListItemIcon>
            <ListItemText>Yıldızla</ListItemText>
          </MenuItem>
          <MenuItem onClick={() => handlePin(message)}>
            <ListItemIcon>
              <PushPinIcon fontSize="small" color={message.isPinned ? 'primary' : 'inherit'} />
            </ListItemIcon>
            <ListItemText>Sabitle</ListItemText>
          </MenuItem>
          <MenuItem onClick={handleReactionsMenuOpen(message.id)}>
            <ListItemIcon>
              <AddReactionIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Tepki Ekle</ListItemText>
          </MenuItem>
          {isCurrentUser ? [
            <Divider key="divider" />,
            <MenuItem key="edit" onClick={() => handleEdit(message.id, message.text)}>
              <ListItemIcon>
                <EditIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>Düzenle</ListItemText>
            </MenuItem>,
            <MenuItem key="delete" onClick={() => handleDelete(message.id)} sx={{ color: 'error.main' }}>
              <ListItemIcon>
                <DeleteIcon fontSize="small" color="error" />
              </ListItemIcon>
              <ListItemText>Sil</ListItemText>
            </MenuItem>
          ] : null}
        </Menu>

        <Menu
          anchorEl={reactionMenuAnchor[message.id]}
          open={Boolean(reactionMenuAnchor[message.id])}
          onClose={() => handleReactionsMenuClose(message.id)}
        >
          <Box sx={{ display: 'flex', flexWrap: 'wrap', p: 1, gap: 0.5 }}>
            {reactions.map((reaction) => (
              <IconButton
                key={reaction}
                size="small"
                onClick={() => {
                  handleReaction(message.id, reaction);
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
                {reaction}
              </IconButton>
            ))}
          </Box>
        </Menu>
      </Box>
    );
  };

  useEffect(() => {
    setPinnedMessages(messages.filter(m => m.isPinned).slice(0, 3));
  }, [messages]);

  useEffect(() => {
    if (!currentUser) return;
    
    const unread = messages.filter(
      m => !m.isRead && m.senderId !== currentUser.uid
    ).length;
    
    setUnreadCount(unread);
    
    document.title = unread > 0 ? `(${unread}) Yeni Mesaj` : 'Chat';
  }, [messages, currentUser]);

  const markMessagesAsRead = async (messageIds: string[]) => {
    if (!currentUser || !userId) return;
    
    try {
      const chatId = [currentUser.uid, userId].sort().join('_');
      const batch = writeBatch(db);
      
      messageIds.forEach(messageId => {
        const messageRef = doc(db, 'chats', chatId, 'messages', messageId);
        batch.update(messageRef, { isRead: true });
      });

      await batch.commit();

      const chatRef = doc(db, 'chats', chatId);
      await updateDoc(chatRef, {
        [`unreadCount.${currentUser.uid}`]: 0
      });
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  };

  useEffect(() => {
    const handleFocus = () => {
      markMessagesAsRead(messages.map(m => m.id));
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [messages, currentUser, userId]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
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
          : 'linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%)',
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
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <IconButton onClick={() => navigate('/')} sx={{ mr: 2 }}>
            <ArrowBackIcon />
          </IconButton>
          <Box sx={{ position: 'relative' }}>
            <Avatar
              src={otherUser?.photoURL || undefined}
              alt={otherUser?.displayName || undefined}
              sx={{ width: 40, height: 40, mr: 2 }}
            />
            {unreadCount > 0 && (
              <Box
                sx={{
                  position: 'absolute',
                  top: -5,
                  right: 12,
                  backgroundColor: theme.palette.error.main,
                  color: theme.palette.error.contrastText,
                  borderRadius: '50%',
                  width: 20,
                  height: 20,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.75rem',
                  fontWeight: 'bold',
                  border: `2px solid ${theme.palette.background.paper}`,
                }}
              >
                {unreadCount}
              </Box>
            )}
          </Box>
          <Typography variant="h6">{(otherUser?.firstName && otherUser?.lastName) ? `${otherUser.firstName} ${otherUser.lastName}` : (otherUser?.email?.split('@')[0] || 'Kullanıcı')}</Typography>
        </Box>
        <IconButton onClick={handleMenuClick}>
          <MoreVertIcon />
        </IconButton>
        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={handleMenuClose}
        >
          <MenuItem>
            <Box sx={{ width: '100%' }}>
              <Typography variant="body2" gutterBottom>
                Duvar Kağıdı Opaklığı
              </Typography>
              <Slider
                value={wallpaperOpacity}
                onChange={(_, value) => setWallpaperOpacity(value as number)}
                min={0.1}
                max={1}
                step={0.1}
                valueLabelDisplay="auto"
                valueLabelFormat={(value) => `${Math.round(value * 100)}%`}
              />
            </Box>
          </MenuItem>
          <MenuItem component="label">
            <input
              type="file"
              accept="image/*"
              hidden
              onChange={handleBackgroundChange}
            />
            <ImageIcon sx={{ mr: 1 }} /> Duvar Kağıdı Ekle
          </MenuItem>
          {backgroundImage && (
            <MenuItem onClick={handleRemoveBackground}>
              <DeleteIcon sx={{ mr: 1 }} /> Duvar Kağıdını Kaldır
            </MenuItem>
          )}
          <Divider />
          <MenuItem onClick={() => setShowStarredMessages(true)}>
            <StarIcon sx={{ mr: 1 }} /> Yıldızlı Mesajlar
          </MenuItem>
        </Menu>
      </Paper>

      {pinnedMessages.length > 0 && (
        <Paper
          sx={{
            mx: 2,
            mt: 1,
            background: isDarkMode
              ? 'rgba(30, 41, 59, 0.9)'
              : 'rgba(255, 255, 255, 0.9)',
            backdropFilter: 'blur(10px)',
          }}
        >
          <List dense>
            {pinnedMessages.map((message) => (
              <ListItem
                key={message.id}
                sx={{
                  borderLeft: `3px solid ${theme.palette.primary.main}`,
                  '&:hover': {
                    backgroundColor: theme.palette.action.hover,
                  },
                }}
              >
                <ListItemIcon>
                  <PushPinIcon color="primary" fontSize="small" />
                </ListItemIcon>
                <ListItemText
                  primary={message.text}
                  secondary={`${message.senderName} • ${formatMessageTimestamp(message.timestamp)}`}
                  sx={{
                    '& .MuiListItemText-primary': {
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    },
                  }}
                />
                <IconButton
                  size="small"
                  onClick={() => handlePin(message)}
                  sx={{ ml: 1 }}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </ListItem>
            ))}
          </List>
        </Paper>
      )}

      <Box
        sx={{
          flex: 1,
          overflow: 'auto',
          p: 2,
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          backdropFilter: 'blur(10px)',
          backgroundColor: isDarkMode
            ? 'rgba(15, 23, 42, 0.8)'
            : '#eef2f7',
        }}
      >
        {messages.map((message) => (
          <Box
            key={message.id}
            id={`message-${message.id}`}
            sx={{
              position: 'relative',
              '&:hover': {
                '& .message-actions': {
                  opacity: 1,
                },
              },
            }}
          >
            {renderMessage(message)}
          </Box>
        ))}
        <div ref={messagesEndRef} />
      </Box>

      {replyingTo && (
        <Paper
          sx={{
            p: 2,
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
            <Typography variant="subtitle2" color="primary">
              {replyingTo.senderName}
            </Typography>
            <Typography variant="body2" color="text.secondary" noWrap sx={{ maxWidth: '300px' }}>
              {replyingTo.text}
            </Typography>
          </Box>
          <IconButton size="small" onClick={() => setReplyingTo(null)}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Paper>
      )}

      {attachments.length > 0 && (
        <Box sx={{ p: 2, background: theme.palette.background.paper }}>
          <ImageList cols={4} rowHeight={164}>
            {attachments.map((file, index) => (
              <ImageListItem key={index}>
                <img
                  src={URL.createObjectURL(file)}
                  alt={`attachment-${index}`}
                  loading="lazy"
                  style={{ borderRadius: 8 }}
                />
                <IconButton
                  size="small"
                  sx={{
                    position: 'absolute',
                    top: 4,
                    right: 4,
                    backgroundColor: 'rgba(0, 0, 0, 0.5)',
                    '&:hover': {
                      backgroundColor: 'rgba(0, 0, 0, 0.7)',
                    },
                  }}
                  onClick={() => handleRemoveAttachment(index)}
                >
                  <DeleteIcon sx={{ color: 'white' }} />
                </IconButton>
              </ImageListItem>
            ))}
          </ImageList>
        </Box>
      )}

      <Paper
        component="form"
        onSubmit={handleSendMessage}
        sx={{
          p: 2,
          background: isDarkMode
            ? 'linear-gradient(135deg, rgba(30, 41, 59, 0.9), rgba(15, 23, 42, 0.9))'
            : 'linear-gradient(135deg, rgba(255, 255, 255, 0.9), rgba(241, 245, 249, 0.9))',
          backdropFilter: 'blur(10px)',
        }}
      >
        <Box sx={{ display: 'flex', gap: 1 }}>
          <IconButton
            color="primary"
            component="label"
          >
            <input
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={handleFileChange}
            />
            <AttachFileIcon />
          </IconButton>
          <TextField
            fullWidth
            variant="outlined"
            placeholder="Mesajınızı yazın..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: 2,
                backgroundColor: isDarkMode
                  ? 'rgba(30, 41, 59, 0.5)'
                  : 'rgba(255, 255, 255, 0.5)',
              },
            }}
          />
          <IconButton
            color="primary"
            type="submit"
            disabled={!newMessage.trim() && attachments.length === 0}
            sx={{
              background: 'linear-gradient(135deg, #0ea5e9, #2563eb)',
              color: '#ffffff',
              '&:hover': {
                background: 'linear-gradient(135deg, #0284c7, #1d4ed8)',
              },
              '&:disabled': {
                background: theme.palette.action.disabledBackground,
              },
            }}
          >
            <SendIcon />
          </IconButton>
        </Box>
      </Paper>

      <Dialog
        open={showStarredMessages}
        onClose={() => setShowStarredMessages(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <StarIcon color="primary" />
            Yıldızlı Mesajlar
          </Box>
        </DialogTitle>
        <DialogContent>
          <List>
            {messages
              .filter(message => message.isStarred)
              .map(message => (
                <ListItem
                  key={message.id}
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    gap: 1,
                    mb: 1,
                    backgroundColor: isDarkMode
                      ? 'rgba(30, 41, 59, 0.5)'
                      : 'rgba(241, 245, 249, 0.5)',
                    borderRadius: 1,
                    p: 2,
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                    <Avatar
                      src={message.senderPhotoURL}
                      sx={{ width: 24, height: 24 }}
                    />
                    <Typography variant="subtitle2">
                      {message.senderName}
                    </Typography>
                    <Typography variant="caption" sx={{ ml: 'auto' }}>
                      {formatMessageTimestamp(message.timestamp)}
                    </Typography>
                  </Box>
                  <Typography variant="body1">
                    {message.text}
                  </Typography>
                  <Button
                    size="small"
                    onClick={() => {
                      const element = document.getElementById(`message-${message.id}`);
                      if (element) {
                        element.scrollIntoView({ behavior: 'smooth' });
                        element.style.backgroundColor = theme.palette.primary.main;
                        setTimeout(() => {
                          element.style.backgroundColor = '';
                        }, 2000);
                      }
                      setShowStarredMessages(false);
                    }}
                  >
                    Mesaja Git
                  </Button>
                </ListItem>
              ))}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowStarredMessages(false)}>
            Kapat
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Chat; 