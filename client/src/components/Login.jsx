import React, { useState } from 'react';
import axios from 'axios';
import logoPng from '../assets/k2mac_logo2.png'; 
import './Login.css';

function Login({ onLoginSuccess }) {
  const [employeeID, setEmployeeID] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      const response = await axios.post('http://localhost:4000/api/login', {
        employeeID,
        password
      });

      onLoginSuccess(response.data);
    } catch (err) {
      console.error(err);
      
      // ✨ UPDATED ERROR HANDLING
      // If the backend sends a specific error message (like "Unauthorized..."), use it.
      if (err.response && err.response.data && err.response.data.error) {
        setError(err.response.data.error);
      } else {
        // Fallback for network errors or server crashes
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
            placeholder=""
          />

          <label className="input-label">Password</label>
          <input 
            type="password" 
            className="login-input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder=""
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

export default Login;