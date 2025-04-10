import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { db, storage } from '../config/firebase';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import {
  Box,
  Typography,
  TextField,
  Button,
  Avatar,
  Paper,
  IconButton,
  Divider,
  Switch,
  FormControlLabel,
  useTheme,
  useMediaQuery,
  Alert,
  Snackbar,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  PhotoCamera as PhotoCameraIcon,
  Save as SaveIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { useThemeMode } from '../contexts/ThemeContext';

const Settings: React.FC = () => {
  const { currentUser, logout } = useAuth();
  const { isDarkMode, setThemeMode } = useThemeMode();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [displayName, setDisplayName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [photoURL, setPhotoURL] = useState('');
  const [newPhoto, setNewPhoto] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [notifications, setNotifications] = useState(true);
  const [darkMode, setDarkMode] = useState(isDarkMode);

  // Kullanıcı bilgilerini Firestore'dan getir
  useEffect(() => {
    const fetchUserData = async () => {
      if (!currentUser) return;

      try {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setDisplayName(userData.displayName || '');
          setFirstName(userData.firstName || '');
          setLastName(userData.lastName || '');
          setPhotoURL(userData.photoURL || '');
          setNotifications(userData.notifications !== false);
          setDarkMode(userData.theme === 'dark');
        } else {
          // Kullanıcı dokümanı yoksa, varsayılan değerleri kullan
          setDisplayName(currentUser.displayName || '');
          setFirstName('');
          setLastName('');
          setPhotoURL(currentUser.photoURL || '');
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
      }
    };

    fetchUserData();
  }, [currentUser]);

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      try {
        setLoading(true);
        setError('');
        
        const file = e.target.files[0];
        setNewPhoto(file);
        
        // Önizleme için URL oluştur
        const previewURL = URL.createObjectURL(file);
        setPhotoURL(previewURL);
        
        // Firebase Storage'a yükle
        const storageRef = ref(storage, `profile-photos/${currentUser?.uid}`);
        await uploadBytes(storageRef, file);
        
        // Yüklenen fotoğrafın URL'sini al
        const downloadURL = await getDownloadURL(storageRef);
        
        // Firestore'da kullanıcı dokümanını güncelle
        if (currentUser) {
          await updateDoc(doc(db, 'users', currentUser.uid), {
            displayName,
            firstName,
            lastName,
            photoURL: downloadURL
          });
        }
        
        setSuccess(true);
      } catch (error) {
        console.error('Profil fotoğrafı yüklenirken hata oluştu:', error);
        setError('Profil fotoğrafı yüklenirken bir hata oluştu. Lütfen tekrar deneyin.');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      setError('');

      if (!currentUser) return;

      let updatedPhotoURL = photoURL;

      // Yeni fotoğraf yükle
      if (newPhoto) {
        const storageRef = ref(storage, `profile-photos/${currentUser.uid}`);
        await uploadBytes(storageRef, newPhoto);
        updatedPhotoURL = await getDownloadURL(storageRef);
      }

      // Kullanıcı bilgilerini güncelle
      await updateDoc(doc(db, 'users', currentUser.uid), {
        displayName,
        firstName,
        lastName,
        photoURL: updatedPhotoURL,
        notifications,
        theme: darkMode ? 'dark' : 'light',
      });

      setSuccess(true);
      setTimeout(() => {
        navigate('/');
      }, 2000);
    } catch (error) {
      console.error('Ayarlar kaydedilirken hata oluştu:', error);
      setError('Ayarlar kaydedilirken bir hata oluştu. Lütfen tekrar deneyin.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Çıkış yapılırken hata oluştu:', error);
    }
  };

  const handleThemeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = event.target.checked;
    setDarkMode(newValue);
    setThemeMode(newValue ? 'dark' : 'light');
    
    // Kullanıcı tercihini Firestore'a kaydet
    if (currentUser) {
      updateDoc(doc(db, 'users', currentUser.uid), {
        theme: newValue ? 'dark' : 'light'
      }).catch(error => {
        console.error('Tema tercihi kaydedilirken hata oluştu:', error);
      });
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: theme.palette.mode === 'dark'
          ? 'linear-gradient(135deg, #1A202C 0%, #2D3748 100%)'
          : 'linear-gradient(135deg, #F7FAFC 0%, #EDF2F7 100%)',
        p: { xs: 2, sm: 3, md: 4 },
      }}
    >
      <Paper
        elevation={3}
        sx={{
          p: 3,
          borderRadius: 4,
          background: theme.palette.mode === 'dark'
            ? 'rgba(45, 55, 72, 0.9)'
            : 'rgba(255, 255, 255, 0.9)',
          backdropFilter: 'blur(10px)',
          maxWidth: 800,
          mx: 'auto',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <IconButton onClick={() => navigate('/')} sx={{ mr: 2 }}>
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h4" sx={{ fontFamily: "'Dancing Script', cursive", color: theme.palette.primary.main }}>
            Ayarlar
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 4 }}>
          <Box sx={{ position: 'relative', mb: 2 }}>
            <Avatar
              src={photoURL}
              alt={displayName}
              sx={{
                width: 120,
                height: 120,
                border: `3px solid ${theme.palette.primary.main}`,
                boxShadow: '0 0 10px rgba(107, 70, 193, 0.3)',
              }}
            />
            <IconButton
              color="primary"
              component="label"
              sx={{
                position: 'absolute',
                bottom: 0,
                right: 0,
                backgroundColor: theme.palette.background.paper,
                boxShadow: 1,
                '&:hover': {
                  backgroundColor: theme.palette.action.hover,
                },
              }}
            >
              <input
                type="file"
                accept="image/*"
                hidden
                onChange={handlePhotoChange}
              />
              <PhotoCameraIcon />
            </IconButton>
          </Box>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            {displayName}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {currentUser?.email}
          </Typography>
        </Box>

        <Divider sx={{ my: 4 }} />

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3 }}>
          <TextField
            label="Görünen Ad"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            fullWidth
            variant="outlined"
          />
          <TextField
            label="Ad"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            fullWidth
            variant="outlined"
          />
          <TextField
            label="Soyad"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            fullWidth
            variant="outlined"
          />
          <TextField
            label="E-posta"
            value={currentUser?.email || ''}
            disabled
            fullWidth
            variant="outlined"
          />
        </Box>

        <Divider sx={{ my: 4 }} />

        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
            Tercihler
          </Typography>
          <FormControlLabel
            control={
              <Switch
                checked={notifications}
                onChange={(e) => setNotifications(e.target.checked)}
                color="primary"
              />
            }
            label="Bildirimler"
          />
          <FormControlLabel
            control={
              <Switch
                checked={darkMode}
                onChange={handleThemeChange}
                color="primary"
              />
            }
            label="Koyu Tema"
          />
        </Box>

        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
          <Button
            variant="outlined"
            color="error"
            onClick={handleLogout}
            startIcon={<DeleteIcon />}
          >
            Çıkış Yap
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={handleSave}
            disabled={loading}
            startIcon={<SaveIcon />}
          >
            Kaydet
          </Button>
        </Box>

        <Snackbar
          open={success}
          autoHideDuration={2000}
          onClose={() => setSuccess(false)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert severity="success" sx={{ width: '100%' }}>
            Ayarlar başarıyla kaydedildi!
          </Alert>
        </Snackbar>

        <Snackbar
          open={!!error}
          autoHideDuration={3000}
          onClose={() => setError('')}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert severity="error" sx={{ width: '100%' }}>
            {error}
          </Alert>
        </Snackbar>
      </Paper>
    </Box>
  );
};

export default Settings; 