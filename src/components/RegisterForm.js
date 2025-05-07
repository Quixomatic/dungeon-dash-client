// src/components/RegisterForm.js
import React, { useState } from 'react';
import networkManager from '../systems/NetworkManager.js';

const RegisterForm = ({ onRegisterSuccess }) => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const handleRegister = async (e) => {
    e.preventDefault();
    
    if (!username || !email || !password) {
      setError('Username, email, and password are required');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      const userData = await networkManager.register(
        username, 
        email, 
        password, 
        { displayName: displayName || username }
      );
      
      console.log('Registration successful:', userData);
      
      if (onRegisterSuccess) {
        onRegisterSuccess(userData);
      }
    } catch (error) {
      console.error('Registration failed:', error);
      setError(error.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="register-form">
      <h2>Create Account</h2>
      
      {error && <div className="error-message">{error}</div>}
      
      <form onSubmit={handleRegister}>
        <div className="form-group">
          <label htmlFor="username">Username</label>
          <input
            type="text"
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={loading}
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="email">Email</label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="password">Password</label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="displayName">Display Name (optional)</label>
          <input
            type="text"
            id="displayName"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            disabled={loading}
          />
        </div>
        
        <button type="submit" disabled={loading}>
          {loading ? 'Creating Account...' : 'Register'}
        </button>
      </form>
      
      <div className="form-footer">
        <p>Already have an account? <a href="#login">Login</a></p>
      </div>
    </div>
  );
};

export default RegisterForm;