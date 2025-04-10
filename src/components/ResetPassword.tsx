import React, { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Container,
  Box,
  TextField,
  Button,
  Typography,
  Paper,
  Snackbar,
  Alert,
  CircularProgress,
  Link, // Import Link
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { getAuth, sendPasswordResetEmail } from 'firebase/auth';
import { useThemeMode } from '../contexts/ThemeContext';

const ResetPassword = () => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const { isDarkMode } = useThemeMode();
  const theme = useTheme();
  const auth = getAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    setLoading(true);

    try {
      await sendPasswordResetEmail(auth, email);
      setSuccessMessage('Şifre sıfırlama e-postası gönderildi. Lütfen gelen kutunuzu kontrol edin.');
      setShowSuccess(true);
      setEmail(''); // E-posta alanını temizle
    } catch (err: any) {
      console.error('Password reset error:', err);
      if (err.code === 'auth/user-not-found') {
        setError('Bu e-posta adresi ile kayıtlı bir kullanıcı bulunamadı.');
      } else if (err.code === 'auth/invalid-email') {
        setError('Geçersiz e-posta adresi formatı.');
      } else if (err.code === 'auth/network-request-failed') {
          setError('İnternet bağlantınızı kontrol edin.');
      } else {
        setError('Şifre sıfırlama e-postası gönderilirken bir hata oluştu.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCloseSuccess = (event?: React.SyntheticEvent | Event, reason?: string) => {
    if (reason === 'clickaway') {
      return;
    }
    setShowSuccess(false);
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
            background: isDarkMode ? 'rgba(30, 41, 59, 0.9)' : 'rgba(255, 255, 255, 0.9)',
            backdropFilter: 'blur(10px)',
            color: isDarkMode ? '#fff' : 'inherit',
          }}
        >
          <Typography component="h1" variant="h5" sx={{ mb: 3 }}>
            Şifre Sıfırlama
          </Typography>
          {error && (
            <Alert severity="error" sx={{ width: '100%', mb: 2 }}>
              {error}
            </Alert>
          )}
          <Box component="form" onSubmit={handleSubmit} sx={{ mt: 1, width: '100%' }}>
            <TextField
              margin="normal"
              required
              fullWidth
              id="email"
              label="E-posta Adresiniz"
              name="email"
              autoComplete="email"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              InputLabelProps={{
                sx: { color: isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'inherit' },
              }}
              InputProps={{
                sx: { color: isDarkMode ? '#fff' : 'inherit' },
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  '& fieldset': {
                    borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.23)' : 'rgba(0, 0, 0, 0.23)',
                  },
                  '&:hover fieldset': {
                    borderColor: isDarkMode ? theme.palette.primary.light : theme.palette.primary.main,
                  },
                },
              }}
            />
            <Button
              type="submit"
              fullWidth
              variant="contained"
              sx={{ mt: 3, mb: 2 }}
              disabled={loading}
            >
              {loading ? <CircularProgress size={24} /> : 'Sıfırlama Bağlantısı Gönder'}
            </Button>
             <Typography variant="body2" align="center">
                <Link component={RouterLink} to="/login" variant="body2">
                  Giriş Sayfasına Dön
                </Link>
             </Typography>
          </Box>
        </Paper>
      </Box>
      <Snackbar
        open={showSuccess}
        autoHideDuration={6000}
        onClose={handleCloseSuccess}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={handleCloseSuccess} severity="success" sx={{ width: '100%' }}>
          {successMessage}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default ResetPassword;