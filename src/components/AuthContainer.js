// src/components/AuthContainer.js
import React, { useState, useEffect } from 'react';
import LoginForm from './LoginForm';
import RegisterForm from './RegisterForm';
import networkManager from '../systems/NetworkManager';

const AuthContainer = ({ onAuthComplete }) => {
  const [showLogin, setShowLogin] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
  
  // Check for existing auth on mount
  useEffect(() => {
    const checkAuth = async () => {
      const isAuthenticated = networkManager.isUserAuthenticated();
      
      if (isAuthenticated) {
        // User is already authenticated
        const userData = networkManager.getUserData();
        if (onAuthComplete) {
          onAuthComplete(userData);
        }
      }
      
      setAuthChecked(true);
    };
    
    checkAuth();
  }, [onAuthComplete]);
  
  // Handle successful authentication
  const handleAuthSuccess = (userData) => {
    if (onAuthComplete) {
      onAuthComplete(userData);
    }
  };
  
  if (!authChecked) {
    return <div>Checking authentication...</div>;
  }
  
  return (
    <div className="auth-container">
      {showLogin ? (
        <>
          <LoginForm onLoginSuccess={handleAuthSuccess} />
          <p>
            Don't have an account?{' '}
            <button onClick={() => setShowLogin(false)}>Register</button>
          </p>
        </>
      ) : (
        <>
          <RegisterForm onRegisterSuccess={handleAuthSuccess} />
          <p>
            Already have an account?{' '}
            <button onClick={() => setShowLogin(true)}>Login</button>
          </p>
        </>
      )}
    </div>
  );
};

export default AuthContainer;