import React, { useState, useEffect } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import {
  Container,
  Box,
  TextField,
  Button,
  Typography,
  Link,
  Paper,
  IconButton,
  InputAdornment,
  Avatar,
  Snackbar,
  Alert,
  CircularProgress,
} from '@mui/material';
import { Visibility, VisibilityOff, PhotoCamera } from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { db, storage } from '../config/firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { updateProfile as firebaseUpdateProfile, User as FirebaseUser } from 'firebase/auth';
import { useThemeMode } from '../contexts/ThemeContext'; // useThemeMode importu

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/png', 'image/gif'];

const Register: React.FC = () => {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    username: '',
    email: '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [profileImage, setProfileImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const navigate = useNavigate();
  const { register } = useAuth();
  const { isDarkMode } = useThemeMode(); // isDarkMode state'ini al

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      
      // Dosya boyutu kontrolü
      if (file.size > MAX_FILE_SIZE) {
        setError('Dosya boyutu 5MB\'dan küçük olmalıdır.');
        return;
      }

      // Dosya tipi kontrolü
      if (!ALLOWED_FILE_TYPES.includes(file.type)) {
        setError('Sadece JPEG, PNG ve GIF dosyaları yüklenebilir.');
        return;
      }

      setProfileImage(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const checkUsername = async (username: string) => {
    const userDoc = await getDoc(doc(db, 'usernames', username));
    return !userDoc.exists();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError('');
      setLoading(true);

      // Form doğrulama
      if (!formData.firstName || !formData.lastName || !formData.username || !formData.email || !formData.password) {
        setError('Lütfen tüm alanları doldurun.');
        setLoading(false);
        return;
      }

      // E-posta doğrulama
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email)) {
        setError('Geçerli bir e-posta adresi girin.');
        setLoading(false);
        return;
      }

      // Şifre doğrulama
      if (formData.password.length < 6) {
        setError('Şifre en az 6 karakter olmalıdır.');
        setLoading(false);
        return;
      }

      console.log('Kullanıcı adı kontrolü başlıyor:', formData.username);
      
      // Kullanıcı adı kontrolü
      try {
        const isUsernameAvailable = await checkUsername(formData.username);
        console.log('Kullanıcı adı kontrolü sonucu:', isUsernameAvailable);
        
        if (!isUsernameAvailable) {
          setError('Bu kullanıcı adı zaten kullanılıyor.');
          setLoading(false);
          return;
        }
      } catch (usernameError) {
        console.error('Kullanıcı adı kontrolü hatası:', usernameError);
        setError('Kullanıcı adı kontrolü sırasında bir hata oluştu. Lütfen internet bağlantınızı kontrol edin.');
        setLoading(false);
        return;
      }

      console.log('Firebase Authentication ile kullanıcı oluşturuluyor...');
      
      // Firebase Authentication ile kullanıcı oluştur
      let user: FirebaseUser;
      try {
        // register fonksiyonu artık FirebaseUser döndürüyor
        user = await register(
          formData.email, 
          formData.password, 
          `${formData.firstName} ${formData.lastName}`
        );
        console.log('Kullanıcı başarıyla oluşturuldu:', user.uid);
      } catch (authError: any) {
        console.error('Kimlik doğrulama hatası:', authError);
        if (authError.code === 'auth/email-already-in-use') {
          setError('Bu e-posta adresi zaten kullanılıyor.');
        } else if (authError.code === 'auth/weak-password') {
          setError('Şifre çok zayıf. Daha güçlü bir şifre seçin.');
        } else if (authError.code === 'auth/network-request-failed') {
          setError('İnternet bağlantınızı kontrol edin.');
        } else {
          setError('Kayıt olurken bir hata oluştu: ' + authError.message);
        }
        setLoading(false);
        return;
      }

      // Profil fotoğrafı yükleme
      let photoURL = '';
      if (profileImage) {
        try {
          console.log('Profil fotoğrafı yükleniyor...');
          const storageRef = ref(storage, `profileImages/${user.uid}`);
          await uploadBytes(storageRef, profileImage);
          photoURL = await getDownloadURL(storageRef);
          console.log('Profil fotoğrafı başarıyla yüklendi:', photoURL);
          
          // Update user profile with photo URL
          await firebaseUpdateProfile(user, {
            photoURL: photoURL,
          });
        } catch (storageError) {
          console.error('Fotoğraf yükleme hatası:', storageError);
          // Fotoğraf yüklenemese bile kullanıcı kaydına devam et
        }
      }

      console.log('Firestore\'da kullanıcı bilgileri kaydediliyor...');
      
      // Firestore'da kullanıcı bilgilerini sakla
      try {
        await setDoc(doc(db, 'users', user.uid), {
          firstName: formData.firstName,
          lastName: formData.lastName,
          username: formData.username,
          email: formData.email,
          photoURL,
          displayName: `${formData.firstName} ${formData.lastName}`,
          createdAt: new Date().toISOString(),
        });
        console.log('Kullanıcı bilgileri Firestore\'a kaydedildi');

        // Kullanıcı adını rezerve et
        await setDoc(doc(db, 'usernames', formData.username), {
          uid: user.uid,
        });
        console.log('Kullanıcı adı rezerve edildi');
      } catch (firestoreError) {
        console.error('Firestore hatası:', firestoreError);
        setError('Kullanıcı bilgileri kaydedilirken bir hata oluştu. Lütfen tekrar deneyin.');
        setLoading(false);
        return;
      }

      // Başarı mesajını göster
      setSuccessMessage('Kayıt başarılı! Giriş sayfasına yönlendiriliyorsunuz...');
      setShowSuccess(true);

      // 2 saniye sonra giriş sayfasına yönlendir
      setTimeout(() => {
        navigate('/');
      }, 2000);

    } catch (err) {
      console.error('Kayıt hatası:', err);
      setError('Kayıt olurken beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  return (
    <Container component="main" maxWidth="xs">
      <Box
        sx={{
          marginTop: 8,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <Paper
          elevation={3}
          sx={{
            padding: 4,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            width: '100%',
            // Paper arka planını ve rengini ayarla
            background: isDarkMode ? 'rgba(30, 41, 59, 0.9)' : 'rgba(255, 255, 255, 0.9)',
            backdropFilter: 'blur(10px)',
            color: isDarkMode ? '#fff' : 'inherit',
          }}
        >
          <Typography component="h1" variant="h4" sx={{ mb: 3, color: 'primary.main', fontWeight: 700 }}>
            MerYus
          </Typography>
          <Typography component="h2" variant="h5" sx={{ mb: 3, fontWeight: 600 }}>
            Kayıt Ol
          </Typography>

          {/* ... Profil fotoğrafı bölümü ... Avatar içindeki IconButton rengi ayarlanabilir */}
          <Box sx={{ mb: 3, position: 'relative' }}>
            <Avatar
              src={imagePreview || undefined}
              sx={{ width: 100, height: 100, mb: 1 }}
            />
            <IconButton
              color="primary"
              component="label"
              sx={{ 
                position: 'absolute',
                bottom: 8,
                right: 8,
                backgroundColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)', 
                color: isDarkMode ? '#fff' : 'inherit',
                '&:hover': { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)' }
              }}
            >
              <input type="file" hidden onChange={handleImageChange} accept="image/*" />
              <PhotoCamera />
            </IconButton>
          </Box>

          {error && (
            <Typography color="error" sx={{ mb: 2 }}>
              {error}
            </Typography>
          )}

          <Box component="form" onSubmit={handleSubmit} sx={{ mt: 1, width: '100%' }}>
             {/* Login.tsx'teki gibi TextField stil güncellemelerini buraya da uygula */}
            <TextField
              margin="normal"
              required
              fullWidth
              label="Ad"
              name="firstName"
              value={formData.firstName}
              onChange={handleChange}
              InputLabelProps={{ sx: { color: isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'inherit' } }}
              InputProps={{ sx: { color: isDarkMode ? '#fff' : 'inherit' } }}
              sx={{ /* ... Login.tsx'teki sx ... */ 
                 '& .MuiOutlinedInput-root': {
                  '& fieldset': {
                    borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.23)' : 'rgba(0, 0, 0, 0.23)',
                  },
                  '&:hover fieldset': {
                    borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.87)' : 'rgba(0, 0, 0, 0.87)',
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: 'primary.main',
                  },
                },
              }}
            />
            <TextField
              margin="normal"
              required
              fullWidth
              label="Soyad"
              name="lastName"
              value={formData.lastName}
              onChange={handleChange}
              InputLabelProps={{ sx: { color: isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'inherit' } }}
              InputProps={{ sx: { color: isDarkMode ? '#fff' : 'inherit' } }}
              sx={{ /* ... Login.tsx'teki sx ... */ 
                 '& .MuiOutlinedInput-root': {
                  '& fieldset': {
                    borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.23)' : 'rgba(0, 0, 0, 0.23)',
                  },
                  '&:hover fieldset': {
                    borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.87)' : 'rgba(0, 0, 0, 0.87)',
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: 'primary.main',
                  },
                },
              }}
            />
            <TextField
              margin="normal"
              required
              fullWidth
              label="Kullanıcı Adı"
              name="username"
              value={formData.username}
              onChange={handleChange}
              InputLabelProps={{ sx: { color: isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'inherit' } }}
              InputProps={{ sx: { color: isDarkMode ? '#fff' : 'inherit' } }}
              sx={{ /* ... Login.tsx'teki sx ... */ 
                 '& .MuiOutlinedInput-root': {
                  '& fieldset': {
                    borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.23)' : 'rgba(0, 0, 0, 0.23)',
                  },
                  '&:hover fieldset': {
                    borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.87)' : 'rgba(0, 0, 0, 0.87)',
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: 'primary.main',
                  },
                },
              }}
            />
            <TextField
              margin="normal"
              required
              fullWidth
              label="E-posta Adresi"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              InputLabelProps={{ sx: { color: isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'inherit' } }}
              InputProps={{ sx: { color: isDarkMode ? '#fff' : 'inherit' } }}
              sx={{ /* ... Login.tsx'teki sx ... */ 
                 '& .MuiOutlinedInput-root': {
                  '& fieldset': {
                    borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.23)' : 'rgba(0, 0, 0, 0.23)',
                  },
                  '&:hover fieldset': {
                    borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.87)' : 'rgba(0, 0, 0, 0.87)',
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: 'primary.main',
                  },
                },
              }}
            />
            <TextField
              margin="normal"
              required
              fullWidth
              label="Şifre"
              name="password"
              type={showPassword ? 'text' : 'password'}
              value={formData.password}
              onChange={handleChange}
              InputLabelProps={{ sx: { color: isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'inherit' } }}
              InputProps={{
                sx: { color: isDarkMode ? '#fff' : 'inherit' },
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowPassword(!showPassword)}
                      edge="end"
                      sx={{ color: isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'inherit' }}
                    >
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
              sx={{ /* ... Login.tsx'teki sx ... */ 
                 '& .MuiOutlinedInput-root': {
                  '& fieldset': {
                    borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.23)' : 'rgba(0, 0, 0, 0.23)',
                  },
                  '&:hover fieldset': {
                    borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.87)' : 'rgba(0, 0, 0, 0.87)',
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: 'primary.main',
                  },
                },
              }}
            />
            <Button
              type="submit"
              fullWidth
              variant="contained"
              sx={{ mt: 3, mb: 2, py: 1.5 }}
              disabled={loading}
            >
              {loading ? <CircularProgress size={24} color="inherit" /> : 'Kayıt Ol'}
            </Button>
            <Box sx={{ textAlign: 'center' }}>
              <Link 
                component={RouterLink} 
                to="/login" 
                variant="body2"
                sx={{ color: isDarkMode ? 'primary.light' : 'primary.main' }} // Link rengi
              >
                Zaten bir hesabın var mı? Giriş Yap
              </Link>
            </Box>
          </Box>
        </Paper>
      </Box>

      <Snackbar
        open={showSuccess}
        autoHideDuration={2000}
        onClose={() => setShowSuccess(false)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert 
          onClose={() => setShowSuccess(false)} 
          severity="success" 
          sx={{ width: '100%', fontWeight: 600 }}
        >
          {successMessage}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default Register; 