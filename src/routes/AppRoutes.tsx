import { Routes, Route } from 'react-router-dom';
import PrivateRoute from '../components/PrivateRoute';
import Login from '../components/Login';
import Register from '../components/Register';
import Home from '../components/Home';
import Chat from '../components/Chat';
import CreateGroup from '../components/CreateGroup';
import GroupChat from '../components/GroupChat';
import Groups from '../components/Groups';
import Settings from '../components/Settings';
import ResetPassword from '../components/ResetPassword';

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/" element={<PrivateRoute><Home /></PrivateRoute>} />
      <Route path="/chat/:userId" element={<PrivateRoute><Chat /></PrivateRoute>} />
      <Route path="/create-group" element={<PrivateRoute><CreateGroup /></PrivateRoute>} />
      <Route path="/group/:groupId" element={<PrivateRoute><GroupChat /></PrivateRoute>} />
      <Route path="/groups" element={<PrivateRoute><Groups /></PrivateRoute>} />
      <Route path="/settings" element={<PrivateRoute><Settings /></PrivateRoute>} />
    </Routes>
  );
}

export default AppRoutes; 