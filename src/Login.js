import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from './firebase-config';
import { TextField, Button, Container, Grid, Typography, Alert } from '@mui/material';
import { Link } from 'react-router-dom';
import { useUser } from './UserContext';
import { httpApi as api } from './api';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const navigate = useNavigate();
  const { setUser } = useUser();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
  
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const { user } = userCredential;
      
      // Update user context
      setUser(user);
      
      // Redirect to dashboard
      navigate('/dashboard');
    } catch (authError) {
      console.error('Login error:', authError);
      setLoginError('Failed to login. Please check your credentials and try again.');
    }
  };

  return (
    <Container component="main" maxWidth="md" sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', backgroundImage: 'url("path-to-your-background-image.jpg")', backgroundSize: 'cover' }}>
      <Grid container spacing={2} sx={{ maxWidth: 600, p: 4, backgroundColor: 'rgba(255, 255, 255, 0.8)', borderRadius: '8px' }}>
        <Grid item xs={12} sx={{ display: 'flex', justifyContent: 'center' }}>
          <img src={`${process.env.PUBLIC_URL}/Zatamap.webp`} alt="Zatamap Logo" style={{ maxWidth: '350px' }} />
        </Grid>
        <Grid item xs={12}>
          <Typography variant="h5" component="h1" sx={{ textAlign: 'center' }}>Login</Typography>
          {loginError && <Alert severity="error" sx={{ my: 2 }}>{loginError}</Alert>}
          <form onSubmit={handleLogin} noValidate>
            <TextField
              variant="outlined"
              margin="normal"
              required
              fullWidth
              id="email"
              label="Email Address"
              name="email"
              autoComplete="email"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              sx={{ mb: 2 }}
            />
            <TextField
              variant="outlined"
              margin="normal"
              required
              fullWidth
              name="password"
              label="Password"
              type="password"
              id="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              sx={{ mb: 2 }}
            />
            <Button
              type="submit"
              fullWidth
              variant="contained"
              sx={{ mb: 2 }}
            >
              Sign In
            </Button>
            <Grid container justifyContent="space-between">
              <Grid item>
                <Link to="/forgot-password" style={{ textDecoration: 'none' }}>
                  Forgot password?
                </Link>
              </Grid>
              {<Grid item>
                <Link to="/register" style={{ textDecoration: 'none' }}>
                  Don't have an account? Sign Up
                </Link>
              </Grid>}
            </Grid>
          </form>
        </Grid>
      </Grid>
    </Container>
  );
};

export default Login;
