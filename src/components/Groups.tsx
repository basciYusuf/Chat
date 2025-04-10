import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useThemeMode } from '../contexts/ThemeContext';
import { db } from '../config/firebase';
import {
  collection,
  query,
  where,
  onSnapshot,
} from 'firebase/firestore';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Avatar,
  AvatarGroup,
  useTheme,
  CircularProgress,
} from '@mui/material';

interface Group {
  id: string;
  name: string;
  description: string;
  members: {
    uid: string;
    displayName: string;
    photoURL: string;
    role: string;
  }[];
  lastMessage?: {
    text: string;
    timestamp: Date;
    senderName: string;
  };
}

const Groups: React.FC = () => {
  const { currentUser } = useAuth();
  const { isDarkMode } = useThemeMode();
  const navigate = useNavigate();
  const theme = useTheme();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser) return;

    const groupsRef = collection(db, 'groups');
    const q = query(
      groupsRef,
      where('members', 'array-contains', {
        uid: currentUser.uid,
        displayName: currentUser.displayName || 'Kullanıcı',
        photoURL: currentUser.photoURL || '',
        role: 'member'
      })
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const groupsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Group[];
      
      setGroups(groupsData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser]);

  const formatLastMessageTime = (date: Date) => {
    if (!date) return '';
    
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
        minHeight: '100vh',
        background: isDarkMode
          ? 'linear-gradient(135deg, #1A202C 0%, #2D3748 100%)'
          : 'linear-gradient(135deg, #F7FAFC 0%, #EDF2F7 100%)',
        p: { xs: 2, sm: 3, md: 4 },
      }}
    >
      <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
        <Typography
          variant="h4"
          sx={{
            mb: 4,
            fontFamily: "'Dancing Script', cursive",
            color: theme.palette.primary.main,
          }}
        >
          Gruplarım
        </Typography>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',
              sm: 'repeat(2, 1fr)',
              md: 'repeat(3, 1fr)'
            },
            gap: 3,
          }}
        >
          {groups.length > 0 ? (
            groups.map((group) => (
              <Card
                key={group.id}
                sx={{
                  cursor: 'pointer',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: theme.shadows[8],
                  },
                  background: isDarkMode
                    ? 'linear-gradient(135deg, rgba(45, 55, 72, 0.9), rgba(30, 41, 59, 0.9))'
                    : 'linear-gradient(135deg, rgba(255, 255, 255, 0.9), rgba(241, 245, 249, 0.9))',
                  backdropFilter: 'blur(10px)',
                }}
                onClick={() => navigate(`/group/${group.id}`)}
              >
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <AvatarGroup max={3} sx={{ mr: 2 }}>
                      {group.members.map((member) => (
                        <Avatar
                          key={member.uid}
                          src={member.photoURL}
                          alt={member.displayName}
                          sx={{
                            width: 40,
                            height: 40,
                            border: `2px solid ${theme.palette.primary.main}`,
                          }}
                        />
                      ))}
                    </AvatarGroup>
                    <Box sx={{ flex: 1 }}>
                      <Typography
                        variant="h6"
                        sx={{
                          fontFamily: "'Dancing Script', cursive",
                          color: isDarkMode ? '#fff' : theme.palette.primary.main,
                        }}
                      >
                        {group.name}
                      </Typography>
                      <Typography
                        variant="body2"
                        sx={{
                          color: isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'text.secondary',
                        }}
                      >
                        {group.members.length} üye
                      </Typography>
                    </Box>
                  </Box>
                  {group.lastMessage && (
                    <Box sx={{ mt: 1 }}>
                      <Typography
                        variant="body2"
                        sx={{
                          color: isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'text.secondary',
                        }}
                      >
                        <strong>{group.lastMessage.senderName}:</strong> {group.lastMessage.text}
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{
                          color: isDarkMode ? 'rgba(255, 255, 255, 0.5)' : 'text.secondary',
                        }}
                      >
                        {formatLastMessageTime(group.lastMessage.timestamp)}
                      </Typography>
                    </Box>
                  )}
                </CardContent>
              </Card>
            ))
          ) : (
            <Box sx={{ gridColumn: '1/-1' }}>
              <Typography
                variant="h6"
                align="center"
                sx={{
                  color: isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'text.secondary',
                  fontFamily: "'Dancing Script', cursive",
                  fontSize: '1.5rem'
                }}
              >
                Henüz hiç grubunuz yok.
              </Typography>
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
};

export default Groups; 