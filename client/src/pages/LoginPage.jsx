import { useState } from 'react';
import api from '@utils/api';
import logoPng from '@assets/k2mac_logo2.png';
import '@styles/pages/login.css';

function LoginPage({ onLoginSuccess }) {
  const [employeeID, setEmployeeID] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      const response = await api.post('/login', { employeeID, password });
      const token = response.data.activeToken || response.data.token;

      if (token) localStorage.setItem('token', token);
      if (response.data.user) localStorage.setItem('user', JSON.stringify(response.data.user));

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
          <input
            type="password"
            className="login-input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

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
