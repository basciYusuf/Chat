import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { db, storage } from '../config/firebase';
import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  where,
  getDocs,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Avatar,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Checkbox,
  CircularProgress,
  IconButton,
} from '@mui/material';
import {
  Group as GroupIcon,
  PhotoCamera as PhotoCameraIcon,
} from '@mui/icons-material';
import { memberColors } from '../utils/constants';

const CreateGroup: React.FC = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [groupPhoto, setGroupPhoto] = useState<File | null>(null);
  const [photoURL, setPhotoURL] = useState('');
  const [loading, setLoading] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<any[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);

  useEffect(() => {
    const fetchUsers = async () => {
      if (!currentUser) return;

      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('uid', '!=', currentUser.uid));
      
      try {
        const querySnapshot = await getDocs(q);
        const users = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setAvailableUsers(users);
      } catch (error) {
        console.error('Error fetching users:', error);
      }
    };

    fetchUsers();
  }, [currentUser]);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setGroupPhoto(e.target.files[0]);
      setPhotoURL(URL.createObjectURL(e.target.files[0]));
    }
  };

  const handleUserToggle = (userId: string) => {
    setSelectedUsers(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleCreateGroup = async () => {
    if (!currentUser || !groupName.trim() || selectedUsers.length === 0) return;

    setLoading(true);
    try {
      let groupPhotoURL = '';
      
      if (groupPhoto) {
        const photoRef = ref(storage, `group-photos/${Date.now()}-${groupPhoto.name}`);
        const uploadResult = await uploadBytes(photoRef, groupPhoto);
        groupPhotoURL = await getDownloadURL(uploadResult.ref);
      }

      const selectedMembers = availableUsers
        .filter(user => selectedUsers.includes(user.uid))
        .map((user, index) => ({
          uid: user.uid,
          displayName: user.displayName,
          photoURL: user.photoURL,
          role: 'member' as const,
          color: memberColors[index % memberColors.length],
          joinedAt: serverTimestamp(),
        }));

      // Add group creator as admin
      const adminMember = {
        uid: currentUser.uid,
        displayName: currentUser.displayName,
        photoURL: currentUser.photoURL,
        role: 'admin' as const,
        color: memberColors[selectedMembers.length % memberColors.length],
        joinedAt: serverTimestamp(),
      };

      const groupData = {
        name: groupName,
        description: groupDescription,
        photoURL: groupPhotoURL,
        createdAt: serverTimestamp(),
        createdBy: currentUser.uid,
        members: [adminMember, ...selectedMembers],
      };

      const groupRef = await addDoc(collection(db, 'groups'), groupData);
      navigate(`/group/${groupRef.id}`);
    } catch (error) {
      console.error('Error creating group:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ p: 3, maxWidth: 600, mx: 'auto' }}>
      <Paper elevation={3} sx={{ p: 3 }}>
        <Typography variant="h5" gutterBottom>
          Yeni Grup Oluştur
        </Typography>

        <Box sx={{ mt: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Avatar
              src={photoURL}
              sx={{ width: 64, height: 64 }}
            >
              <GroupIcon />
            </Avatar>
            <IconButton
              color="primary"
              component="label"
              sx={{ bgcolor: 'background.default' }}
            >
              <input
                type="file"
                hidden
                accept="image/*"
                onChange={handlePhotoChange}
              />
              <PhotoCameraIcon />
            </IconButton>
          </Box>

          <TextField
            label="Grup Adı"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            fullWidth
            required
          />

          <TextField
            label="Grup Açıklaması"
            value={groupDescription}
            onChange={(e) => setGroupDescription(e.target.value)}
            multiline
            rows={3}
            fullWidth
          />

          <Typography variant="h6" sx={{ mt: 2 }}>
            Üyeleri Seç
          </Typography>

          <List sx={{ bgcolor: 'background.paper' }}>
            {availableUsers.map((user) => (
              <ListItem
                key={user.uid}
                onClick={() => handleUserToggle(user.uid)}
                sx={{
                  cursor: 'pointer',
                  '&:hover': { bgcolor: 'action.hover' },
                }}
              >
                <ListItemAvatar>
                  <Avatar src={user.photoURL} />
                </ListItemAvatar>
                <ListItemText
                  primary={user.displayName}
                  secondary={user.email}
                />
                <Checkbox
                  edge="end"
                  checked={selectedUsers.includes(user.uid)}
                />
              </ListItem>
            ))}
          </List>

          <Button
            variant="contained"
            onClick={handleCreateGroup}
            disabled={!groupName.trim() || selectedUsers.length === 0 || loading}
            sx={{ mt: 2 }}
          >
            {loading ? (
              <CircularProgress size={24} />
            ) : (
              'Grup Oluştur'
            )}
          </Button>
        </Box>
      </Paper>
    </Box>
  );
};

export default CreateGroup; 