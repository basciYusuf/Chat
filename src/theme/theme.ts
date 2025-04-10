import { createTheme } from '@mui/material/styles';

// Özel renk paleti
const colors = {
  primary: {
    main: '#6B46C1', // Mor
    light: '#9F7AEA',
    dark: '#553C9A',
    contrastText: '#FFFFFF',
  },
  secondary: {
    main: '#3182CE', // Mavi
    light: '#63B3ED',
    dark: '#2C5282',
    contrastText: '#FFFFFF',
  },
  accent: {
    main: '#E53E3E', // Kırmızı
    light: '#FC8181',
    dark: '#C53030',
    contrastText: '#FFFFFF',
  },
  background: {
    default: '#F7FAFC',
    paper: '#FFFFFF',
    dark: '#1A202C',
  },
  text: {
    primary: '#2D3748',
    secondary: '#4A5568',
    dark: '#FFFFFF',
  },
  error: {
    main: '#E53E3E',
    light: '#FC8181',
    dark: '#C53030',
  },
  success: {
    main: '#38A169',
    light: '#68D391',
    dark: '#2F855A',
  },
  warning: {
    main: '#ECC94B',
    light: '#F6E05E',
    dark: '#D69E2E',
  },
  info: {
    main: '#3182CE',
    light: '#63B3ED',
    dark: '#2C5282',
  },
};

// Neon efekti
const neonEffect = {
  boxShadow: '0 0 5px rgba(255, 255, 255, 0.5), 0 0 10px rgba(255, 255, 255, 0.3), 0 0 15px rgba(255, 255, 255, 0.1)',
  transition: 'all 0.3s ease-in-out',
  '&:hover': {
    boxShadow: '0 0 10px rgba(255, 255, 255, 0.7), 0 0 20px rgba(255, 255, 255, 0.5), 0 0 30px rgba(255, 255, 255, 0.3)',
  },
};

// Açık tema
export const lightTheme = createTheme({
  palette: {
    mode: 'light',
    primary: colors.primary,
    secondary: colors.secondary,
    error: colors.error,
    success: colors.success,
    warning: colors.warning,
    info: colors.info,
    background: {
      default: colors.background.default,
      paper: colors.background.paper,
    },
    text: {
      primary: colors.text.primary,
      secondary: colors.text.secondary,
    },
  },
  typography: {
    fontFamily: "'Poppins', 'Roboto', 'Helvetica', 'Arial', sans-serif",
    h1: {
      fontFamily: "'Dancing Script', cursive",
      fontWeight: 700,
      fontSize: '3.5rem',
      color: colors.primary.main,
    },
    h2: {
      fontFamily: "'Dancing Script', cursive",
      fontWeight: 600,
      fontSize: '2.5rem',
      color: colors.primary.main,
    },
    h3: {
      fontFamily: "'Dancing Script', cursive",
      fontWeight: 600,
      fontSize: '2rem',
      color: colors.primary.main,
    },
    h4: {
      fontFamily: "'Playfair Display', serif",
      fontWeight: 600,
      fontSize: '1.5rem',
      color: colors.primary.main,
    },
    h5: {
      fontFamily: "'Playfair Display', serif",
      fontWeight: 500,
      fontSize: '1.25rem',
      color: colors.primary.main,
    },
    h6: {
      fontFamily: "'Playfair Display', serif",
      fontWeight: 500,
      fontSize: '1rem',
      color: colors.primary.main,
    },
    body1: {
      fontFamily: "'Poppins', sans-serif",
      fontWeight: 400,
      fontSize: '1rem',
      color: colors.text.primary,
    },
    body2: {
      fontFamily: "'Poppins', sans-serif",
      fontWeight: 400,
      fontSize: '0.875rem',
      color: colors.text.secondary,
    },
    button: {
      fontFamily: "'Poppins', sans-serif",
      fontWeight: 600,
      textTransform: 'none',
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: '8px',
          padding: '8px 16px',
          ...neonEffect,
        },
        contained: {
          background: `linear-gradient(45deg, ${colors.primary.main}, ${colors.secondary.main})`,
          color: '#FFFFFF',
          boxShadow: '0 3px 5px 2px rgba(107, 70, 193, .3)',
        },
        outlined: {
          borderColor: colors.primary.main,
          color: colors.primary.main,
        },
        text: {
          color: colors.primary.main,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: '12px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: '12px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)',
          transition: 'transform 0.3s ease-in-out, box-shadow 0.3s ease-in-out',
          '&:hover': {
            transform: 'translateY(-5px)',
            boxShadow: '0 8px 30px rgba(0, 0, 0, 0.1)',
          },
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: '8px',
            '&:hover fieldset': {
              borderColor: colors.primary.light,
            },
            '&.Mui-focused fieldset': {
              borderColor: colors.primary.main,
            },
          },
        },
      },
    },
    MuiAvatar: {
      styleOverrides: {
        root: {
          border: `2px solid ${colors.primary.light}`,
          boxShadow: '0 0 10px rgba(107, 70, 193, 0.3)',
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          background: 'rgba(255, 255, 255, 0.9)',
          backdropFilter: 'blur(10px)',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)',
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          background: 'rgba(255, 255, 255, 0.9)',
          backdropFilter: 'blur(10px)',
          borderRight: 'none',
          boxShadow: '4px 0 20px rgba(0, 0, 0, 0.05)',
        },
      },
    },
    MuiListItem: {
      styleOverrides: {
        root: {
          borderRadius: '8px',
          margin: '4px 8px',
          '&.Mui-selected': {
            background: `linear-gradient(45deg, ${colors.primary.light}, ${colors.secondary.light})`,
            color: '#FFFFFF',
            '& .MuiListItemIcon-root': {
              color: '#FFFFFF',
            },
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: '16px',
          fontWeight: 500,
        },
        filled: {
          background: `linear-gradient(45deg, ${colors.primary.light}, ${colors.secondary.light})`,
          color: '#FFFFFF',
        },
        outlined: {
          borderColor: colors.primary.main,
          color: colors.primary.main,
        },
      },
    },
    MuiDivider: {
      styleOverrides: {
        root: {
          background: `linear-gradient(to right, ${colors.primary.light}, ${colors.secondary.light})`,
          height: '2px',
        },
      },
    },
  },
  shape: {
    borderRadius: 8,
  },
  shadows: [
    'none',
    '0 2px 4px rgba(0,0,0,0.05)',
    '0 4px 8px rgba(0,0,0,0.05)',
    '0 8px 16px rgba(0,0,0,0.05)',
    '0 16px 24px rgba(0,0,0,0.05)',
    '0 24px 32px rgba(0,0,0,0.05)',
    '0 32px 40px rgba(0,0,0,0.05)',
    '0 40px 48px rgba(0,0,0,0.05)',
    '0 48px 56px rgba(0,0,0,0.05)',
    '0 56px 64px rgba(0,0,0,0.05)',
    '0 64px 72px rgba(0,0,0,0.05)',
    '0 72px 80px rgba(0,0,0,0.05)',
    '0 80px 88px rgba(0,0,0,0.05)',
    '0 88px 96px rgba(0,0,0,0.05)',
    '0 96px 104px rgba(0,0,0,0.05)',
    '0 104px 112px rgba(0,0,0,0.05)',
    '0 112px 120px rgba(0,0,0,0.05)',
    '0 120px 128px rgba(0,0,0,0.05)',
    '0 128px 136px rgba(0,0,0,0.05)',
    '0 136px 144px rgba(0,0,0,0.05)',
    '0 144px 152px rgba(0,0,0,0.05)',
    '0 152px 160px rgba(0,0,0,0.05)',
    '0 160px 168px rgba(0,0,0,0.05)',
    '0 168px 176px rgba(0,0,0,0.05)',
    '0 176px 184px rgba(0,0,0,0.05)',
  ],
});

// Koyu tema
export const darkTheme = createTheme({
  ...lightTheme,
  palette: {
    mode: 'dark',
    primary: colors.primary,
    secondary: colors.secondary,
    error: colors.error,
    success: colors.success,
    warning: colors.warning,
    info: colors.info,
    background: {
      default: colors.background.dark,
      paper: '#2D3748',
    },
    text: {
      primary: colors.text.dark,
      secondary: 'rgba(255, 255, 255, 0.7)',
    },
  },
  components: {
    ...lightTheme.components,
    MuiAppBar: {
      styleOverrides: {
        root: {
          background: 'rgba(26, 32, 44, 0.9)',
          backdropFilter: 'blur(10px)',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)',
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          background: 'rgba(26, 32, 44, 0.9)',
          backdropFilter: 'blur(10px)',
          borderRight: 'none',
          boxShadow: '4px 0 20px rgba(0, 0, 0, 0.2)',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          background: 'rgba(45, 55, 72, 0.9)',
          backdropFilter: 'blur(10px)',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)',
        },
      },
    },
  },
});

// Tema değişkenlerini dışa aktar
export const theme = {
  colors,
  neonEffect,
}; 