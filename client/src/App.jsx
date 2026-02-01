import { useState } from 'react';
import { LoginPage, DesktopApp, MobileApp } from '@pages';

function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);

  const handleLoginSuccess = (loginData) => {
    setUser(loginData.user);
    setToken(loginData.token || loginData.activeToken);
  };

  const handleLogout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  if (!user) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  if (user.role === 'Admin' || user.role === 'Operations') {
    return <DesktopApp user={user} token={token} onLogout={handleLogout} />;
  }

  return <MobileApp user={user} token={token} onLogout={handleLogout} />;
}

export default App;
