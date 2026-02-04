import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { TextField, Button, Container, Typography, Grid } from '@mui/material';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from './firebase-config';
import { httpApi as api } from './api';
import { useUser } from './UserContext';

const Register = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [zerodhaUserId, setZerodhaUserId] = useState('');
  const [zerodhaApiKey, setZerodhaApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [registerError, setRegisterError] = useState('');
  const navigate = useNavigate();
  const { setUser } = useUser();

  const handleRegister = async (e) => {
    e.preventDefault();
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const firebaseUserId = userCredential.user.uid;

      const registerResponse = await api.post('/register_user', {
        firebaseUserId,
        email,
        zerodhaUserId,
        zerodhaApiKey,
        apiSecret,
      });

      if (registerResponse.data && registerResponse.data.zerodhaUserId) {
        const kiteConnectResponse = await api.get('/initiate_kiteconnect', {
          params: { email: email }
        });

        if (kiteConnectResponse.data && kiteConnectResponse.data.userid) {
          setUser({
            email: email,
            id: kiteConnectResponse.data.userid,
          });

          navigate('/dashboard');
        } else {
          setRegisterError('Failed to initiate Kite Connect.');
        }
      } else {
        setRegisterError('Registration error. Please try again.');
      }
    } catch (error) {
      setRegisterError(error.message);
    }
  };

  return (
    <Container component="main" maxWidth="xs">
      <Typography component="h1" variant="h5" sx={{ mb: 2 }}>
        Sign Up
      </Typography>
      <form onSubmit={handleRegister} noValidate>
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
          onChange={e => setEmail(e.target.value)}
          sx={{ mb: 2 }}
        />
        <TextField
          variant="outlined"
          margin="normal"
          required
          fullWidth
          id="password"
          label="Password"
          type="password"
          name="password"
          autoComplete="current-password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          sx={{ mb: 2 }}
        />
        <TextField
          variant="outlined"
          margin="normal"
          required
          fullWidth
          id="zerodhaUserId"
          label="Zerodha User Id"
          name="zerodhaUserId"
          value={zerodhaUserId}
          onChange={e => setZerodhaUserId(e.target.value)}
          sx={{ mb: 2 }}
        />
        <TextField
          variant="outlined"
          margin="normal"
          required
          fullWidth
          id="zerodhaApiKey"
          label="Zerodha API Key"
          name="zerodhaApiKey"
          value={zerodhaApiKey}
          onChange={e => setZerodhaApiKey(e.target.value)}
          sx={{ mb: 2 }}
        />
        <TextField
          variant="outlined"
          margin="normal"
          required
          fullWidth
          id="apiSecret"
          label="API Secret"
          type="password"
          name="apiSecret"
          value={apiSecret}
          onChange={e => setApiSecret(e.target.value)}
          sx={{ mb: 2 }}
        />
        <Button
          type="submit"
          fullWidth
          variant="contained"
          sx={{ mb: 2 }}
        >
          Sign Up
        </Button>
        <Grid container justifyContent="flex-end">
          <Grid item>
            <Link to="/login" variant="body2" style={{ textDecoration: 'none', color: 'primary.main' }}>
              Already have an account? Sign in
            </Link>
          </Grid>
        </Grid>
      </form>
    </Container>
  );
};

export default Register;
