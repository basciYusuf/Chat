import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useThemeMode } from '../contexts/ThemeContext';
import { db } from '../config/firebase';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  getDocs,
  doc as firestoreDoc,
  getDoc,
  addDoc,
  setDoc,
} from 'firebase/firestore';
import {
  Box,
  Typography,
  TextField,
  Avatar,
  Card,
  CardContent,
  IconButton,
  Badge,
  Grid,
  Paper,
  InputAdornment,
  Tabs,
  Tab,
  Button,
  Divider,
  useTheme,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  ListItemSecondaryAction,
  Checkbox,
  Chip,
  AvatarGroup,
  Tooltip,
  ListItemButton,
} from '@mui/material';
import {
  Search as SearchIcon,
  Settings as SettingsIcon,
  Chat as ChatIcon,
  Person as PersonIcon,
  Group as GroupIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import { User } from '../types/User';  // User interface'ini types dosyasından import et
import Sohbetler from './Sohbetler'; // Sohbetler komponentini import et

// Define interfaces with explicit 'type' discriminant
interface Chat {
  id: string;
  otherUser: User;
  lastMessage: {
    text: string;
    timestamp: Date;
    senderId: string;
  };
  unreadCount: number;
  type: 'chat'; // Discriminant
}

interface Group {
  id: string;
  name: string;
  description: string;
  members: {
    uid: string;
    displayName: string;
    photoURL: string;
    role: string;
    status: string;
    // Add email if it's part of your group member structure in Firestore
    email?: string | null; 
  }[];
  lastMessage?: {
    text: string;
    timestamp: Date;
    senderName: string; // Groups might use senderName
  };
  unreadCount?: number;
  type: 'group'; // Discriminant
}

// Unified type for combined list
type CombinedChatItem = Chat | Group;

// Add generateChatId helper function somewhere accessible, e.g., outside the component
const generateChatId = (uid1: string, uid2: string): string => {
  return uid1 < uid2 ? `${uid1}_${uid2}` : `${uid2}_${uid1}`;
};

const Home = () => {
  const { currentUser } = useAuth();
  const { isDarkMode } = useThemeMode();
  const navigate = useNavigate();
  const theme = useTheme();
  const [users, setUsers] = useState<User[]>([]);
  const [chats, setChats] = useState<Chat[]>([]);
  const [groups, setGroups] = useState<Group[]>([]); // Keep groups state separate for potential 'Groups' tab
  const [combinedChatList, setCombinedChatList] = useState<CombinedChatItem[]>([]); // New state for unified list
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(0);
  const [unreadCounts, setUnreadCounts] = useState<{ [key: string]: number }>({});
  const [openCreateGroup, setOpenCreateGroup] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<User[]>([]);
  const [createGroupLoading, setCreateGroupLoading] = useState(false);

  useEffect(() => {
    if (!currentUser) {
       console.log("[Effect] currentUser is null, returning.");
       setLoading(false); // Kullanıcı yoksa yüklemeyi durdur
       setChats([]);
       setGroups([]);
       setUsers([]);
       setCombinedChatList([]); // Clear combined list as well
       return;
    }
    console.log("[Effect] Running effect for currentUser:", currentUser.uid); // Log currentUser.uid

    setLoading(true); // Yeniden veri çekerken yükleme durumunu başlat

    // Fetch users
    const usersRef = collection(db, 'users');
    const q = query(usersRef);

    const unsubscribeUsers = onSnapshot(q, (snapshot) => {
      try {
        const userData = snapshot.docs
          .map(doc => ({
            uid: doc.id,
            ...doc.data()
          } as User))
          .filter(user => user.uid !== currentUser.uid); // Filter out current user
        
        console.log('Fetched users:', userData); // Debug log
        setUsers(userData);
      } catch (error) {
        console.error('Error fetching users:', error);
      }
    }, (error) => {
      console.error('Error in users snapshot:', error);
    });

    // Fetch chats
    const chatsRef = collection(db, 'chats');
    const chatsQuery = query(chatsRef, where('participants', 'array-contains', currentUser.uid));

    const unsubscribeChats = onSnapshot(chatsQuery, async (snapshot) => {
      console.log(`[Chats] Snapshot received: ${snapshot.docs.length} potential chats.`); // Log 1: Gelen doküman sayısı
      try {
        const chatPromises = snapshot.docs
          .map(async (doc) => {
            const chatData = doc.data();
            const otherUserId = chatData.participants.find(
              (id: string) => id !== currentUser.uid
            );

            if (!otherUserId) return null;

            const userDoc = await getDoc(firestoreDoc(db, 'users', otherUserId));
            if (!userDoc.exists()) return null;

            const userData = {
              uid: userDoc.id,
              ...userDoc.data()
            } as User;

            // Okunmamış mesajları say
            let unreadCount = 0;
            try {
              const messagesRef = collection(db, 'chats', doc.id, 'messages');
              // Sadece diğer kullanıcıdan gelen mesajları sorgula
              const otherUserMessagesQuery = query(
                 messagesRef,
                 where('senderId', '==', otherUserId)
              );
              const messageSnapshot = await getDocs(otherUserMessagesQuery);
              messageSnapshot.docs.forEach(msgDoc => {
                const msgData = msgDoc.data();
                // readBy alanı yoksa veya currentUser.uid'yi içermiyorsa okunmamış say
                if (!msgData.readBy || !msgData.readBy.includes(currentUser.uid)) {
                  unreadCount++;
                }
              });
            } catch (msgError) {
               console.error(`[Chats] Error fetching messages for chat ${doc.id}:`, msgError);
            }

            return {
              id: doc.id,
              otherUser: userData,
              lastMessage: chatData.lastMessage ? {
                text: chatData.lastMessage.text,
                timestamp: chatData.lastMessage.timestamp?.toDate ? chatData.lastMessage.timestamp.toDate() : new Date(0),
                senderId: chatData.lastMessage.senderId,
              } : { timestamp: new Date(0), text: '', senderId: ''},
              unreadCount,
              type: 'chat' as const
            } as Chat;
          });

        const resolvedChats = await Promise.all(chatPromises);
        const validChats = resolvedChats.filter((chat): chat is Chat => chat !== null);
        setChats(validChats);

        // Update combined list (will be done in the next effect)

      } catch (error) {
        console.error('[Chats] Error processing chats:', error);
        setChats([]); // Hata durumunda boşalt
      } finally {
         // Ensure loading is set to false after both chats and groups are processed
         // setLoading(false); // Moved loading logic
      }
    });

    // Fetch groups
    const groupsRef = collection(db, 'groups');
    const groupsQuery = query(
      groupsRef
    );

    const unsubscribeGroups = onSnapshot(groupsQuery, async (snapshot) => {
      try {
        // Grup verilerini ve okunmamış sayılarını almak için Promise'ler oluştur
        const groupPromises = snapshot.docs.map(async (doc) => {
          const groupData = doc.data();
          
          // Kullanıcının bu grubun üyesi olup olmadığını kontrol et (status != 'removed' && status != 'left')
          const currentUserMember = groupData.members?.find((m: any) => m.uid === currentUser?.uid && m.status === 'active');
          if (!currentUserMember) {
            return null; // Kullanıcı aktif üye değilse bu grubu dahil etme
          }

          // Okunmamış mesajları say
          let unreadCount = 0;
          try {
            const messagesRef = collection(db, 'groups', doc.id, 'messages');
            // Şimdilik tüm mesajları çekip filtreliyoruz:
            const messagesQuery = query(
              messagesRef,
              orderBy('timestamp', 'desc'), // Son mesaja göre sırala
              // limit(50) // Performans için limit ekleyebilirsiniz
            );
            const messageSnapshot = await getDocs(messagesQuery);

            // Okunmamışları say (currentUser tarafından okunmamış ve göndereni currentUser olmayan)
            messageSnapshot.docs.forEach(msgDoc => {
               const msgData = msgDoc.data();
               if (msgData.senderId !== currentUser.uid && (!msgData.readBy || !msgData.readBy.includes(currentUser.uid))) {
                 unreadCount++;
               }
            });

          } catch (msgError) {
             console.error(`[Groups] Error fetching messages for group ${doc.id}:`, msgError);
          }

          return {
            id: doc.id,
            name: groupData.name,
            description: groupData.description,
            members: groupData.members,
            lastMessage: groupData.lastMessage ? {
              text: groupData.lastMessage.text,
              timestamp: groupData.lastMessage.timestamp?.toDate ? groupData.lastMessage.timestamp.toDate() : new Date(0),
              senderName: groupData.lastMessage.senderName,
            } : { timestamp: new Date(0), text: '', senderName: ''},
            unreadCount: unreadCount,
            type: 'group' as const
          } as Group;
        });

        const resolvedGroups = await Promise.all(groupPromises);
        const validGroups = resolvedGroups.filter((group): group is Group => group !== null);

        setGroups(validGroups);

        // Update combined list (will be done in the next effect)

      } catch (error) {
        console.error('[Groups] Error processing groups:', error);
        setGroups([]); // Hata durumunda boşalt
      } finally {
         // Ensure loading is set to false after both chats and groups are processed
         // setLoading(false); // Moved loading logic
      }
    });

    return () => {
      console.log("[Effect] Cleaning up listeners.");
      unsubscribeUsers();
      unsubscribeChats();
      unsubscribeGroups();
    };
  }, [currentUser]); // Dependency on currentUser only

  // New effect to combine and sort chats and groups
  useEffect(() => {
    console.log("[Combine Effect] Combining chats and groups.");
    console.log("[Combine Effect] Chats:", chats);
    console.log("[Combine Effect] Groups:", groups);

    const combined = [...chats, ...groups];

    const sortedCombined = combined.sort((a, b) => {
      const timeA = a.lastMessage?.timestamp instanceof Date ? a.lastMessage.timestamp.getTime() : 0;
      const timeB = b.lastMessage?.timestamp instanceof Date ? b.lastMessage.timestamp.getTime() : 0;
      return timeB - timeA; // Sort descending (newest first)
    });

    console.log("[Combine Effect] Sorted Combined List:", sortedCombined);
    setCombinedChatList(sortedCombined);

    // Set loading to false once combining is done
    // Consider a more robust loading strategy if fetching takes long
    if (chats.length > 0 || groups.length > 0 || !currentUser) { // Check if data is loaded or user is null
        setLoading(false);
    }

  }, [chats, groups, currentUser]); // Run when chats or groups change

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  // Filter logic remains the same
  const lowerCaseQuery = searchQuery.toLowerCase();

  const filteredCombinedList = combinedChatList.filter((item) => {
     if (item.type === 'chat') {
       const chat = item as Chat;
       return (
         (chat.otherUser.displayName?.toLowerCase() || '').includes(lowerCaseQuery) ||
         (chat.otherUser.email?.toLowerCase() || '').includes(lowerCaseQuery) ||
         (chat.lastMessage?.text?.toLowerCase() || '').includes(lowerCaseQuery)
       );
     } else if (item.type === 'group') {
       const group = item as Group;
       return (
         (group.name?.toLowerCase() || '').includes(lowerCaseQuery) ||
         (group.description?.toLowerCase() || '').includes(lowerCaseQuery) ||
         (group.lastMessage?.text?.toLowerCase() || '').includes(lowerCaseQuery)
       );
     }
     return false;
   });

  const filteredUsers = users.filter((user) =>
    (user.displayName?.toLowerCase() || '').includes(lowerCaseQuery) ||
    (user.email?.toLowerCase() || '').includes(lowerCaseQuery)
  );

  // Mesaj zamanını formatla
  const formatMessageTime = (date: Date | any) => {
    if (!date) return '';
    
    // Eğer date bir Firestore Timestamp ise, toDate() metodunu kullan
    const dateObj = date.toDate ? date.toDate() : date;
    
    // Eğer hala geçerli bir Date nesnesi değilse, boş string döndür
    if (!(dateObj instanceof Date) || isNaN(dateObj.getTime())) {
      return '';
    }
    
    const now = new Date();
    const diff = now.getTime() - dateObj.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) {
      return dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (days === 1) {
      return 'Dün';
    } else if (days < 7) {
      return dateObj.toLocaleDateString([], { weekday: 'long' });
    } else {
      return dateObj.toLocaleDateString();
    }
  };

  const renderChatList = () => {
     if (loading) {
       return <CircularProgress sx={{ display: 'block', margin: 'auto', mt: 4 }} />;
     }
     if (filteredCombinedList.length === 0) {
       return <Typography sx={{ textAlign: 'center', mt: 4 }}>Henüz sohbet veya grup yok.</Typography>;
     }
     return (
       <Box sx={{ p: 1 }}>
         {filteredCombinedList.map((item) => {
           if (item.type === 'chat') {
             const chat = item as Chat;
             return (
               <Card key={chat.id} onClick={() => navigate(`/chat/${chat.otherUser.uid}`)} sx={{ mb: 1, cursor: 'pointer', '&:hover': { backgroundColor: theme.palette.action.hover }, display: 'flex', alignItems: 'center', p: 1 }}>
                 {/* Chat Avatar Section */}
                 <Box sx={{ mr: 1.5 }}>
                    <Badge
                      overlap="circular"
                      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                      variant="dot"
                      sx={{
                        '& .MuiBadge-dot': {
                          backgroundColor: chat.otherUser.isOnline ? theme.palette.success.main : theme.palette.grey[400],
                          boxShadow: `0 0 0 2px ${theme.palette.background.paper}`,
                          width: 10,
                          height: 10,
                          borderRadius: '50%',
                        },
                      }}
                    >
                       <Avatar src={chat.otherUser.photoURL || undefined} alt={chat.otherUser.displayName || chat.otherUser.email?.split('@')[0] || 'Kullanıcı'} sx={{ width: 45, height: 45 }}/>
                    </Badge>
                 </Box>
                 {/* Chat Text Content */}
                 <CardContent sx={{ flexGrow: 1, p: '0 !important', overflow: 'hidden' }}>
                   <Typography variant="subtitle1" noWrap sx={{ fontWeight: chat.unreadCount && chat.unreadCount > 0 ? 'bold' : 'normal' }}>
                      {chat.otherUser.displayName || chat.otherUser.email?.split('@')[0] || 'Kullanıcı'}
                   </Typography>
                   <Typography variant="body2" color="text.secondary" noWrap sx={{ fontWeight: chat.unreadCount && chat.unreadCount > 0 ? 'bold' : 'normal' }}>
                     {chat.lastMessage?.senderId === currentUser?.uid ? 'Siz: ' : ''}{chat.lastMessage?.text || 'Sohbet başlatıldı'}
                   </Typography>
                 </CardContent>
                 {/* Chat Timestamp & Badge */}
                 <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', ml: 1, flexShrink: 0 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5 }}>
                       {chat.lastMessage?.timestamp instanceof Date ? chat.lastMessage.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                    </Typography>
                    {chat.unreadCount && chat.unreadCount > 0 && <Badge badgeContent={chat.unreadCount} color="primary" />}
                 </Box>
               </Card>
             );
           } else if (item.type === 'group') {
             const group = item as Group;
             return (
                <Card key={group.id} onClick={() => navigate(`/group/${group.id}`)} sx={{ mb: 1, cursor: 'pointer', '&:hover': { backgroundColor: theme.palette.action.hover }, display: 'flex', alignItems: 'center', p: 1 }}>
                    {/* Group Avatar Section */}
                    <Box sx={{ mr: 1.5 }}>
                        <AvatarGroup max={3} sx={{ '& .MuiAvatar-root': { width: 30, height: 30, fontSize: '0.75rem' } }}>
                           {group.members?.slice(0, 3).map(member => (
                             <Tooltip key={member.uid} title={member.displayName || 'Üye'}>
                                <Avatar src={member.photoURL || undefined} alt={member.displayName || 'Üye'} />
                             </Tooltip>
                           ))}
                        </AvatarGroup>
                    </Box>
                    {/* Group Text Content */}
                    <CardContent sx={{ flexGrow: 1, p: '0 !important', overflow: 'hidden' }}>
                        <Typography variant="subtitle1" noWrap sx={{ fontWeight: group.unreadCount && group.unreadCount > 0 ? 'bold' : 'normal' }}>
                           {group.name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" noWrap sx={{ fontWeight: group.unreadCount && group.unreadCount > 0 ? 'bold' : 'normal' }}>
                            {group.lastMessage?.senderName ? `${group.lastMessage.senderName}: ` : ''}{group.lastMessage?.text || 'Grup oluşturuldu'}
                        </Typography>
                    </CardContent>
                    {/* Group Timestamp & Badge */}
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', ml: 1, flexShrink: 0 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5 }}>
                            {group.lastMessage?.timestamp instanceof Date ? group.lastMessage.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                        </Typography>
                        {group.unreadCount && group.unreadCount > 0 && <Badge badgeContent={group.unreadCount} color="primary" />}
                    </Box>
                </Card>
             );
           }
           return null; // Should not happen
         })}
       </Box>
     );
   };

   const renderUserList = () => {
     if (loading) {
       return <CircularProgress sx={{ display: 'block', margin: 'auto', mt: 4 }} />;
     }
      if (filteredUsers.length === 0) {
          return <Typography sx={{ textAlign: 'center', mt: 4 }}>Kullanıcı bulunamadı.</Typography>;
      }
      return (
          <Box sx={{ p: 1 }}>
              {filteredUsers.map((user) => (
                  <Card
                      key={user.uid}
                      onClick={() => handleCreateChat(user.uid)} // Use handleCreateChat
                      sx={{
                          mb: 1,
                          cursor: 'pointer',
                          '&:hover': { backgroundColor: theme.palette.action.hover },
                          display: 'flex',
                          alignItems: 'center',
                          p: 1
                      }}
                  >
                      <Box sx={{ mr: 1.5 }}>
                          <Badge
                              overlap="circular"
                              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                              variant="dot"
                              sx={{
                                  '& .MuiBadge-dot': {
                                      backgroundColor: user.isOnline ? theme.palette.success.main : theme.palette.grey[400],
                                      boxShadow: `0 0 0 2px ${theme.palette.background.paper}`,
                                      width: 10, height: 10, borderRadius: '50%',
                                  },
                              }}
                          >
                              <Avatar
                                  src={user.photoURL || undefined}
                                  alt={user.displayName || user.email?.split('@')[0] || 'Kullanıcı'}
                                  sx={{ width: 45, height: 45 }}
                              />
                          </Badge>
                      </Box>
                      <CardContent sx={{ flexGrow: 1, p: '0 !important', overflow: 'hidden' }}>
                          <Typography variant="subtitle1" noWrap>
                              {user.displayName || user.email?.split('@')[0] || 'Kullanıcı'}
                          </Typography>
                          <Typography variant="body2" color="text.secondary" noWrap>
                              {user.email} 
                          </Typography>
                      </CardContent>
                      <IconButton size="small" onClick={(e) => { e.stopPropagation(); handleCreateChat(user.uid); }}>
                         <ChatIcon />
                      </IconButton>
                  </Card>
              ))}
          </Box>
      );
  };

  const renderGroupList = () => {
    if (loading) { return <CircularProgress sx={{ display: 'block', margin: 'auto', mt: 4 }} />; }
    const onlyGroups = groups.filter(group => 
        (group.name?.toLowerCase() || '').includes(lowerCaseQuery) ||
        (group.description?.toLowerCase() || '').includes(lowerCaseQuery)
    ); // Filter groups based on search query for this tab
    if (onlyGroups.length === 0) { return <Typography sx={{ textAlign: 'center', mt: 4 }}>Henüz grup yok.</Typography>; }
    return (
      <Box sx={{ p: 1 }}>
        {onlyGroups.map((group) => (
          <Card key={group.id} onClick={() => navigate(`/group/${group.id}`)} sx={{ mb: 1, cursor: 'pointer', '&:hover': { backgroundColor: theme.palette.action.hover }, display: 'flex', alignItems: 'center', p: 1 }}>
             <Box sx={{ mr: 1.5 }}>
                 <AvatarGroup max={3} sx={{ '& .MuiAvatar-root': { width: 30, height: 30, fontSize: '0.75rem' } }}>
                    {group.members?.slice(0, 3).map(member => (
                      <Tooltip key={member.uid} title={member.displayName || 'Üye'}>
                         <Avatar src={member.photoURL || undefined} alt={member.displayName || 'Üye'} />
                      </Tooltip>
                    ))}
                 </AvatarGroup>
             </Box>
             <CardContent sx={{ flexGrow: 1, p: '0 !important', overflow: 'hidden' }}>
                 <Typography variant="subtitle1" noWrap sx={{ fontWeight: group.unreadCount && group.unreadCount > 0 ? 'bold' : 'normal' }}>
                    {group.name}
                 </Typography>
                 <Typography variant="body2" color="text.secondary" noWrap sx={{ fontWeight: group.unreadCount && group.unreadCount > 0 ? 'bold' : 'normal' }}>
                     {group.lastMessage?.senderName ? `${group.lastMessage.senderName}: ` : ''}{group.lastMessage?.text || 'Grup oluşturuldu'}
                 </Typography>
             </CardContent>
             <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', ml: 1, flexShrink: 0 }}>
                 <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5 }}>
                     {group.lastMessage?.timestamp instanceof Date ? group.lastMessage.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                 </Typography>
                 {group.unreadCount && group.unreadCount > 0 && <Badge badgeContent={group.unreadCount} color="primary" />}
             </Box>
          </Card>
        ))}
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpenCreateGroup(true)} sx={{ display: 'block', margin: '16px auto' }}>
          Yeni Grup Oluştur
        </Button>
      </Box>
    );
  }

  // Handle creating a chat when clicking on a user
  const handleCreateChat = async (otherUserId: string) => {
      if (!currentUser) return;

      // Generate consistent chat ID
      const chatId = generateChatId(currentUser.uid, otherUserId);
      const chatRef = firestoreDoc(db, 'chats', chatId);

      try {
          const chatDoc = await getDoc(chatRef);

          if (!chatDoc.exists()) {
              // Create new chat document if it doesn't exist
              await setDoc(chatRef, {
                  participants: [currentUser.uid, otherUserId],
                  createdAt: new Date(), // Use client date or serverTimestamp()
                  lastMessage: null,
              });
              console.log('New chat document created with ID:', chatId);
          } else {
              console.log('Existing chat found with ID:', chatId);
          }
          // Navigate to the chat page
          navigate(`/chat/${otherUserId}`);
      } catch (error) {
          console.error("Error creating or checking chat:", error);
          // Handle error appropriately
      }
  };

  // Handle selecting/deselecting users for a new group
  const handleToggleUserSelection = (user: User) => {
      setSelectedUsers(prev => {
          const isSelected = prev.some(u => u.uid === user.uid);
          if (isSelected) {
              return prev.filter(u => u.uid !== user.uid);
          } else {
              return [...prev, user];
          }
      });
  };

  // Handle creating the group
  const handleCreateGroup = async () => {
      if (!currentUser || selectedUsers.length === 0 || !groupName) return;

      setCreateGroupLoading(true);
      try {
          const adminMember = {
              uid: currentUser.uid,
              role: 'admin' as const,
              displayName: currentUser.displayName || currentUser.email?.split('@')[0] || 'Admin',
              photoURL: currentUser.photoURL || '',
              status: 'active' as const,
              joinedAt: new Date() // Or use serverTimestamp() if preferred for consistency
          };

          const newMembers = selectedUsers.map(user => ({
              uid: user.uid,
              role: 'member' as const,
              displayName: user.displayName || user.email?.split('@')[0] || 'Üye',
              photoURL: user.photoURL || '',
              status: 'active' as const,
              joinedAt: new Date() // Or use serverTimestamp()
          }));

          const groupData = {
              name: groupName,
              description: groupDescription,
              createdBy: currentUser.uid,
              createdAt: new Date(), // Or use serverTimestamp()
              members: [adminMember, ...newMembers],
              lastMessage: null // Initially no last message
          };

          const groupRef = await addDoc(collection(db, 'groups'), groupData);

          // Reset state and close dialog
          setOpenCreateGroup(false);
          setGroupName('');
          setGroupDescription('');
          setSelectedUsers([]);
          // Optionally navigate to the new group: navigate(`/group/${groupRef.id}`);
          // Or show a success message
          console.log("Grup başarıyla oluşturuldu:", groupRef.id);

      } catch (error) {
          console.error('Grup oluşturma hatası:', error);
          // Show error message to user (e.g., using a Snackbar)
      } finally {
          setCreateGroupLoading(false);
      }
  };

  return (
    <Box sx={{ display: 'flex', height: '100vh', backgroundColor: theme.palette.background.default }}>
       {/* Sidebar/Navigation can go here if needed */}
      <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
          {/* Header */}
          <Paper elevation={2} sx={{ p: 2, borderBottom: `1px solid ${theme.palette.divider}` }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <Avatar
                          src={currentUser?.photoURL || undefined}
                          alt={currentUser?.displayName || undefined}
                          sx={{ width: 40, height: 40, mr: 2 }}
                      />
                      <Typography variant="h6">{currentUser?.displayName || 'Kullanıcı'}</Typography>
                  </Box>
                  <TextField
                      variant="outlined"
                      size="small"
                      placeholder="Sohbetlerde veya kişilerde ara..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      InputProps={{
                          startAdornment: (
                              <InputAdornment position="start">
                                  <SearchIcon />
                              </InputAdornment>
                          ),
                      }}
                      sx={{ width: '40%' }} // Adjust width as needed
                  />
                   <IconButton onClick={() => navigate('/settings')}>
                      <SettingsIcon />
                  </IconButton>
              </Box>
          </Paper>

           {/* Tabs */}
          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
              <Tabs value={activeTab} onChange={handleTabChange} centered variant="fullWidth">
                  <Tab label="Sohbetler" icon={<ChatIcon />} iconPosition="start" />
                  <Tab label="Kişiler" icon={<PersonIcon />} iconPosition="start" />
                  <Tab label="Gruplar" icon={<GroupIcon />} iconPosition="start" />
              </Tabs>
          </Box>

          {/* Content Area */}
          <Box sx={{ flexGrow: 1, overflowY: 'auto', p: 0 }}> {/* Remove padding */}
              {activeTab === 0 && renderChatList()}
              {activeTab === 1 && renderUserList()}
              {activeTab === 2 && renderGroupList()} {/* Render groups in the third tab */}
          </Box>
          {/* Sohbetler komponentini kaldırabiliriz veya farklı bir amaçla kullanabiliriz */}
          {/* <Sohbetler /> */}

           {/* Create Group Dialog */}
            <Dialog open={openCreateGroup} onClose={() => !createGroupLoading && setOpenCreateGroup(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Yeni Grup Oluştur</DialogTitle>
                <DialogContent>
                    <TextField autoFocus margin="dense" id="groupName" label="Grup Adı" type="text" fullWidth variant="standard" value={groupName} onChange={(e) => setGroupName(e.target.value)} required />
                    <TextField margin="dense" id="groupDescription" label="Grup Açıklaması (isteğe bağlı)" type="text" fullWidth variant="standard" value={groupDescription} onChange={(e) => setGroupDescription(e.target.value)} />
                    <Typography sx={{ mt: 2, mb: 1 }}>Üyeleri Seçin:</Typography>
                    <List sx={{ maxHeight: 300, overflow: 'auto' }}>
                        {users.map((user) => (
                            <ListItemButton key={user.uid} dense onClick={() => handleToggleUserSelection(user)}>
                                <ListItemAvatar>
                                    <Avatar src={user.photoURL || undefined} alt={user.displayName || user.email?.split('@')[0]} />
                                </ListItemAvatar>
                                <ListItemText primary={user.displayName || user.email?.split('@')[0]} />
                                <ListItemSecondaryAction>
                                    <Checkbox edge="end" onChange={() => handleToggleUserSelection(user)} checked={selectedUsers.some(u => u.uid === user.uid)} />
                                </ListItemSecondaryAction>
                            </ListItemButton>
                        ))}
                    </List>
                     {/* Show selected users */}
                     <Box sx={{ mt: 2 }}>
                        {selectedUsers.map(user => (
                            <Chip key={user.uid} avatar={<Avatar src={user.photoURL || undefined} />} label={user.displayName || user.email?.split('@')[0]} onDelete={() => handleToggleUserSelection(user)} sx={{ mr: 0.5, mb: 0.5 }} />
                        ))}
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpenCreateGroup(false)} disabled={createGroupLoading}>İptal</Button>
                    <Button onClick={handleCreateGroup} disabled={createGroupLoading || !groupName || selectedUsers.length === 0} variant="contained">
                        {createGroupLoading ? <CircularProgress size={24} /> : 'Oluştur'}
                    </Button>
                </DialogActions>
            </Dialog>

      </Box>
    </Box>
  );
};

export default Home; 