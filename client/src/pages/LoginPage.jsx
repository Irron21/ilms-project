import { useState } from 'react';
import api from '@utils/api';
import { Icons } from '@shared';
import logoPng from '@assets/k2mac_logo2.png';
import '@styles/pages/login.css';

function LoginPage({ onLoginSuccess }) {
  const [employeeID, setEmployeeID] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      const response = await api.post('/login', { employeeID, password });
      const token = response.data.activeToken || response.data.token;

      if (token) sessionStorage.setItem('token', token);
      if (response.data.user) sessionStorage.setItem('user', JSON.stringify(response.data.user));

      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        let senderId = sessionStorage.getItem('tabId');
        if (!senderId) {
          const gen = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
          sessionStorage.setItem('tabId', gen);
          senderId = gen;
        }
        const bc = new BroadcastChannel('session');
        bc.postMessage({ type: 'login', token, userID: response.data.user?.userID, senderId });
        bc.close();
      }

      onLoginSuccess(response.data);
    } catch (err) {
      console.error(err);
      if (err.response?.data?.error) {
        setError(err.response.data.error);
      } else {
        setError('Invalid Employee ID or Password');
      }
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="logo-wrapper">
          <img src={logoPng} alt="K2MAC Logo" className="login-logo" />
        </div>

        <form onSubmit={handleSubmit}>
          <label className="input-label">Employee ID</label>
          <input
            type="text"
            className="login-input"
            value={employeeID}
            onChange={(e) => setEmployeeID(e.target.value)}
          />

          <label className="input-label">Password</label>
          <div className="password-wrapper">
            <input
              type={showPassword ? "text" : "password"}
              className="login-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <div 
              className="password-toggle-icon" 
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <Icons.EyeOff /> : <Icons.Eye />}
            </div>
          </div>

          <div className="error-msg">{error}</div>

          <button type="submit" className="login-btn">
            Log In
          </button>
        </form>
      </div>
    </div>
  );
}

export default LoginPage;
