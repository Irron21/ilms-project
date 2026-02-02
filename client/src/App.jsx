import { useState, useEffect } from 'react';
import { LoginPage, DesktopApp, MobileApp } from '@pages';

function App() {
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem('user');
    try { return raw ? JSON.parse(raw) : null; } catch { return null; }
  });
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [tabId] = useState(() => {
    let id = sessionStorage.getItem('tabId');
    if (!id) {
      const gen = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
      sessionStorage.setItem('tabId', gen);
      id = gen;
    }
    return id;
  });

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

  useEffect(() => {
    const handler = () => handleLogout();
    window.addEventListener('session-expired', handler);
    return () => {
      window.removeEventListener('session-expired', handler);
    };
  }, [handleLogout]);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      const bc = new BroadcastChannel('session');
      bc.onmessage = (e) => {
        const data = e.data || {};
        if (data.senderId === tabId) return;
        if (data.type === 'login') {
          if (user && data.userID === user.userID) {
            handleLogout();
          }
        }
      };
      return () => bc.close();
    }
  }, [tabId, user, handleLogout]);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      const bc = new BroadcastChannel('session');
      bc.onmessageerror = () => {};
      return () => bc.close();
    }
  }, []);

  if (!user) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  if (user.role === 'Admin' || user.role === 'Operations') {
    return <DesktopApp user={user} token={token} onLogout={handleLogout} />;
  }

  return <MobileApp user={user} token={token} onLogout={handleLogout} />;
}

export default App;
