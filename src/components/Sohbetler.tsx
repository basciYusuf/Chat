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
  Timestamp, // Import Timestamp
} from 'firebase/firestore';
import {
  Box,
  Typography,
  Avatar,
  Card,
  CardContent,
  Badge,
  useTheme,
  CircularProgress,
  AvatarGroup,
  Tooltip,
  Alert, // Import Alert for error display
} from '@mui/material';
import { User } from '../types/User'; // Assuming User type exists

// Interface for individual chat preview
interface ChatPreviewData {
  id: string;
  otherUser: User;
  lastMessage?: {
    text: string;
    timestamp: Timestamp | null; // Use Firestore Timestamp initially
    senderId: string;
  };
  unreadCount: number;
}

// Interface for group preview
interface GroupPreviewData {
  id: string;
  name: string;
  members: {
    uid: string;
    displayName: string;
    photoURL: string;
    status: string;
    email?: string; // email eklendi
  }[];
  lastMessage?: {
    text: string;
    timestamp: Timestamp | null; // Use Firestore Timestamp initially
    senderName: string;
  };
  unreadCount: number;
}

// Unified interface for rendering
interface ConversationPreview {
  id: string; // chat ID or group ID
  type: 'chat' | 'group';
  name: string; // otherUser's name or group name
  avatarUrl?: string; // otherUser's avatar or null/placeholder for group
  avatarGroupMembers?: { uid: string; photoURL?: string; displayName: string }[]; // For group avatars
  lastMessage?: {
    text: string;
    timestamp: Date | null; // Converted to Date for sorting/display
    senderName: string; // "Siz" or otherUser's name or group member's name
    senderId?: string; // Needed for "Siz:" logic
  };
  unreadCount: number;
  navigateTo: string; // Path to navigate to (e.g., `/chat/uid` or `/group/gid`)
}

interface SohbetlerProps {
  searchQuery: string;
}

const Sohbetler: React.FC<SohbetlerProps> = ({ searchQuery }) => {
  const { currentUser } = useAuth();
  const { isDarkMode } = useThemeMode();
  const navigate = useNavigate();
  const theme = useTheme();
  const [sortedConversations, setSortedConversations] = useState<ConversationPreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null); // error -> errorMessage

  // --- Data Fetching useEffect ---\
  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      setSortedConversations([]);
      setErrorMessage(null); // Clear error on logout
      return;
    }
    setLoading(true);
    setErrorMessage(null); // Clear previous errors
    console.log('[Sohbetler] Fetching data for user:', currentUser.uid);

    let unsubscribeChats = () => {};
    let unsubscribeGroups = () => {};

    try {
      // 1. Fetch Chats Listener
      const chatsRef = collection(db, 'chats');
      const chatsQuery = query(chatsRef, where('participants', 'array-contains', currentUser.uid));
      unsubscribeChats = onSnapshot(chatsQuery, async (chatsSnapshot) => {
        console.log(`[Sohbetler] Chats snapshot: ${chatsSnapshot.docs.length} chats found.`);
        const chatPromises = chatsSnapshot.docs.map(async (doc): Promise<ConversationPreview | null> => {
          // ... (rest of chat processing logic from previous step) ...
           const chatData = doc.data();
            const otherUserId = chatData.participants.find((id: string) => id !== currentUser.uid);
            if (!otherUserId) {
                console.warn(`[Sohbetler] Chat ${doc.id} missing otherUserId.`);
                return null;
            }

            let otherUser: User | null = null;
            try {
                const userDoc = await getDoc(firestoreDoc(db, 'users', otherUserId));
                if (!userDoc.exists()) {
                    console.warn(`[Sohbetler] User ${otherUserId} not found for chat ${doc.id}.`);
                    return null;
                }
                otherUser = { uid: userDoc.id, ...userDoc.data() } as User;
            } catch (userError) {
                console.error(`[Sohbetler] Error fetching user ${otherUserId} for chat ${doc.id}:`, userError);
                return null; // Skip chat if user data fails
            }

            let unreadCount = 0;
            try {
              const messagesRef = collection(db, 'chats', doc.id, 'messages');
              const q = query(messagesRef, where('senderId', '==', otherUserId)); // Only count messages FROM other user
              const msgSnapshot = await getDocs(q);
              msgSnapshot.docs.forEach(msgDoc => {
                const msgData = msgDoc.data();
                if (!msgData.readBy || !msgData.readBy.includes(currentUser.uid)) {
                  unreadCount++;
                }
              });
            } catch (e) { console.error(`[Sohbetler] Error counting chat messages for ${doc.id}:`, e); }

            const lastMsgTimestamp = chatData.lastMessage?.timestamp as Timestamp | null;
            const senderName = chatData.lastMessage?.senderId === currentUser.uid ? 'Siz' : (otherUser?.displayName || otherUser?.email?.split('@')[0] || undefined);

            return {
              id: doc.id,
              type: 'chat',
              name: otherUser?.displayName || (otherUser?.firstName && otherUser?.lastName ? `${otherUser.firstName} ${otherUser.lastName}` : otherUser?.email?.split('@')[0]) || 'Kullanıcı',
              avatarUrl: otherUser?.photoURL || undefined,
              lastMessage: chatData.lastMessage ? {
                text: chatData.lastMessage.text || (chatData.lastMessage.attachments?.length > 0 ? 'Dosya' : ''), // Handle empty text with attachments
                timestamp: lastMsgTimestamp?.toDate() ?? null,
                senderName: senderName || '...',
                senderId: chatData.lastMessage.senderId,
              } : undefined,
              unreadCount: unreadCount,
              navigateTo: `/chat/${otherUserId}`,
            };
        });

        // Wait for chat processing before triggering state update
        const resolvedChats = (await Promise.all(chatPromises)).filter(Boolean) as ConversationPreview[];
        // Combine with existing groups (or fetch groups if needed, see note)
        setSortedConversations(prev => {
            const groupConversations = prev.filter(c => c.type === 'group');
            const combined = [...resolvedChats, ...groupConversations];
            combined.sort((a, b) => (b.lastMessage?.timestamp?.getTime() ?? 0) - (a.lastMessage?.timestamp?.getTime() ?? 0));
            return combined;
        });
        setLoading(false); // Potentially set loading false only after both listeners run initially

      }, (error) => { // Add error handler for chat listener
        console.error("[Sohbetler] Error in chats listener:", error);
        setErrorMessage("Sohbetler yüklenirken bir hata oluştu.");
        setLoading(false);
      });

      // 2. Fetch Groups Listener (Parallel)
      const groupsRef = collection(db, 'groups');
      const groupsQuery = query(groupsRef); // Fetch all, filter client-side
      unsubscribeGroups = onSnapshot(groupsQuery, async (groupsSnapshot) => {
        console.log(`[Sohbetler] Groups snapshot: ${groupsSnapshot.docs.length} total groups found.`);
        const groupPromises = groupsSnapshot.docs
            .filter(doc => { // Client-side filter for active membership
                const members = doc.data().members as GroupPreviewData['members'] | undefined;
                return !!currentUser && members?.some(m => m.uid === currentUser.uid && m.status === 'active');
            })
            .map(async (doc): Promise<ConversationPreview | null> => {
                // ... (rest of group processing logic from previous step) ...
                const groupData = doc.data();
                let unreadCount = 0;
                try {
                  const messagesRef = collection(db, 'groups', doc.id, 'messages');
                  const q = query(messagesRef, where('senderId', '!=', currentUser.uid));
                  const msgSnapshot = await getDocs(q);
                  msgSnapshot.docs.forEach(msgDoc => {
                    const msgData = msgDoc.data();
                    if (!msgData.readBy || !msgData.readBy.includes(currentUser.uid)) {
                      unreadCount++;
                    }
                  });
                } catch (e) { console.error(`[Sohbetler] Error counting group messages for ${doc.id}:`, e); }

                const lastMsgTimestamp = groupData.lastMessage?.timestamp as Timestamp | null;
                const members = (groupData.members || []) as GroupPreviewData['members'];
                 const senderName = groupData.lastMessage?.senderId === currentUser.uid ? 'Siz' : (groupData.lastMessage?.senderName || undefined);


                return {
                  id: doc.id,
                  type: 'group',
                  name: groupData.name || 'İsimsiz Grup',
                  avatarGroupMembers: members.filter(m => m.status === 'active').map(m => ({
                      uid: m.uid,
                      photoURL: m.photoURL,
                      displayName: m.displayName || m.email?.split('@')[0] || 'Üye',
                  })),
                  lastMessage: groupData.lastMessage ? {
                    text: groupData.lastMessage.text || (groupData.lastMessage.attachments?.length > 0 ? 'Dosya' : ''),
                    timestamp: lastMsgTimestamp?.toDate() ?? null,
                    senderName: senderName || '...',
                    senderId: groupData.lastMessage.senderId,
                  } : undefined,
                  unreadCount: unreadCount,
                  navigateTo: `/group/${doc.id}`,
                };
            });

         // Wait for group processing before triggering state update
         const resolvedGroups = (await Promise.all(groupPromises)).filter(Boolean) as ConversationPreview[];
         // Combine with existing chats
         setSortedConversations(prev => {
             const chatConversations = prev.filter(c => c.type === 'chat');
             const combined = [...chatConversations, ...resolvedGroups];
             combined.sort((a, b) => (b.lastMessage?.timestamp?.getTime() ?? 0) - (a.lastMessage?.timestamp?.getTime() ?? 0));
             console.log(`[Sohbetler] Updated with groups. Total: ${combined.length}`);
             return combined;
         });
         setLoading(false); // Set loading false after both listeners have run at least once

      }, (error) => { // Add error handler for group listener
         console.error("[Sohbetler] Error in groups listener:", error);
         setErrorMessage("Gruplar yüklenirken bir hata oluştu.");
         setLoading(false);
      });

    } catch (initialError) {
       console.error("[Sohbetler] Error setting up listeners:", initialError);
       setErrorMessage("Veri dinleyicileri kurulurken bir hata oluştu.");
       setLoading(false);
       setSortedConversations([]);
    }

    // Cleanup function
    return () => {
      console.log('[Sohbetler] Unsubscribing...');
      unsubscribeChats();
      unsubscribeGroups();
    };

  }, [currentUser]); // End of main useEffect


  // --- Filtering based on search query ---\
  const lowerCaseQuery = searchQuery.toLowerCase();
  const filteredConversations = sortedConversations.filter(conv => {
     if (!searchQuery) return true; // No query, show all
     // Check name
     if (conv.name.toLowerCase().includes(lowerCaseQuery)) return true;
     // If chat, check other user details (name check above might be sufficient)
      if (conv.type === 'chat' && conv.avatarUrl) { // Check avatarUrl as a proxy for otherUser data
          const user = (conv as any).otherUser as User | undefined; // Need to access original otherUser if possible, cast for now
          if(user?.firstName?.toLowerCase().includes(lowerCaseQuery)) return true;
          if(user?.lastName?.toLowerCase().includes(lowerCaseQuery)) return true;
          if(user?.email?.toLowerCase().includes(lowerCaseQuery)) return true;
      }
     // If group, check member names (optional, can be slow)
     if (conv.type === 'group' && conv.avatarGroupMembers?.some(m => m.displayName.toLowerCase().includes(lowerCaseQuery))) return true;
     return false;
  });

  // --- Helper Function for Time Formatting ---\
  const formatMessageTime = (date: Date | null): string => {
    if (!date) return '';
    if (!(date instanceof Date) || isNaN(date.getTime())) {
      console.warn("Invalid date passed to formatMessageTime:", date);
      return '';
    }
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (days === 1) {
      return 'Dün';
    } else if (days < 7) {
      return date.toLocaleDateString([], { weekday: 'long' });
    } else {
      return date.toLocaleDateString();
    }
  };

  // --- Render Helper ---\
  const renderConversationCard = (conv: ConversationPreview) => {
    const hasUnread = conv.unreadCount > 0;

    return (
      <Box
        key={conv.id}
        onClick={() => navigate(conv.navigateTo)}
        sx={{ cursor: 'pointer', overflow: 'hidden' }}
      >
        <Card
          sx={{
             transition: 'transform 0.2s, box-shadow 0.2s',
             '&:hover': { transform: 'translateY(-4px)', boxShadow: theme.shadows[8] },
             background: isDarkMode ? 'linear-gradient(135deg, rgba(45, 55, 72, 0.9), rgba(30, 41, 59, 0.9))' : 'linear-gradient(135deg, rgba(255, 255, 255, 0.9), rgba(241, 245, 249, 0.9))',
             backdropFilter: 'blur(10px)',
          }}
        >
          <CardContent>
            <Box display="flex" alignItems="center" gap={2}>
              {/* Avatar / AvatarGroup with Badge */}
              <Badge
                badgeContent={conv.unreadCount}
                color="error"
                overlap="circular"
                invisible={!hasUnread}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                sx={{
                  '& .MuiBadge-badge': {
                    fontWeight: 'bold',
                    border: `2px solid ${theme.palette.background.paper}`,
                    padding: '0 4px', minWidth: '18px', height: '18px',
                  }
                }}
              >
                {conv.type === 'chat' ? (
                  <Avatar src={conv.avatarUrl || ''} alt={conv.name} />
                ) : (
                  <AvatarGroup
                    max={3}
                    sx={{ '& .MuiAvatar-root': { width: 24, height: 24, fontSize: '0.75rem', border: `1px solid ${theme.palette.background.paper}` } }}
                  >
                    {conv.avatarGroupMembers?.map(member => (
                      <Tooltip key={member.uid} title={member.displayName}>
                        <Avatar alt={member.displayName} src={member.photoURL || undefined} />
                      </Tooltip>
                    ))}
                     {/* Add a placeholder if no members */}
                     {(!conv.avatarGroupMembers || conv.avatarGroupMembers.length === 0) && (
                        <Avatar>?</Avatar>
                     )}
                  </AvatarGroup>
                )}
              </Badge>

              {/* Name and Last Message */}
              <Box flex={1} overflow="hidden">
                <Typography variant="h6" noWrap>{conv.name}</Typography>
                {conv.lastMessage ? (
                  <Typography variant="body2" color="text.secondary" noWrap>
                    {/* Ensure senderName has a value */}
                    {conv.lastMessage.senderName || '...'}: {conv.lastMessage.text}
                  </Typography>
                ) : (
                  <Typography variant="body2" color="text.secondary" fontStyle="italic" noWrap>
                    Henüz mesaj yok
                  </Typography>
                )}
              </Box>

              {/* Timestamp */}
              {conv.lastMessage?.timestamp && (
                <Typography variant="caption" color="text.secondary" alignSelf="flex-start">
                  {formatMessageTime(conv.lastMessage.timestamp)}
                </Typography>
              )}
            </Box>
          </CardContent>
        </Card>
      </Box>
    );
  };


  // --- Main Render --- (Corrected Structure)
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '200px' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (errorMessage) { // Check errorMessage state
      return (
         <Box sx={{ gridColumn: '1/-1', p: 2 }}> {/* Added padding for Alert */}
           <Alert severity="error">{errorMessage}</Alert> {/* Use Alert component */}
         </Box>
      );
  }

  // Corrected JSX structure for displaying content
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
        gap: 3,
      }}
    >
      {filteredConversations.length > 0 ? (
        filteredConversations.map(renderConversationCard) // Use the helper function
      ) : (
        <Box sx={{ gridColumn: '1/-1', textAlign: 'center' }}>
          <Typography variant="h6" color="text.secondary">
            {searchQuery ? 'Aramayla eşleşen sohbet/grup yok' : 'Henüz sohbet veya grup yok'}
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default Sohbetler;
