import { BrowserRouter as Router } from 'react-router-dom';
import { ThemeModeProvider } from './contexts/ThemeContext';
import { AuthProvider } from './contexts/AuthContext';
import AppRoutes from './routes/AppRoutes';

function App() {
  return (
    <Router>
      <AuthProvider>
        <ThemeModeProvider>
          <AppRoutes />
        </ThemeModeProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
