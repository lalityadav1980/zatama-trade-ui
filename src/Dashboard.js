import React, { useState, useEffect } from 'react';
import {
  Container,
  Box,
  TextField,
  Button,
  Paper,
  Typography
} from '@mui/material';
import { useUser } from './UserContext';
import CustomAppBar from './CustomAppBar';
import { httpApi } from './api';

const textFieldSx = {
  '& .MuiInputLabel-root': { 
    color: '#00ffaa'
  },
  '& .MuiOutlinedInput-root': {
    background: 'rgba(255,255,255,0.05)',
    color: '#e0e0e0',
    '& .MuiOutlinedInput-notchedOutline': {
      borderColor: 'rgba(255,255,255,0.2)'
    },
    '&:hover .MuiOutlinedInput-notchedOutline': {
      borderColor: '#00ffaa'
    },
    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
      borderColor: '#00ffaa'
    }
  }
};

const Dashboard = () => {
  const { user } = useUser();
  const [formData, setFormData] = useState({
    user_id: '',
    initial_stop_loss_percentage: 0,
    pnl_max_threshold: 0,
    pnl_min_threshold: 0,
    trailing_step_increment_pct: 0,
    trailing_step_threshold_pct: 0,
    trailing_stop_loss_percentage: 0,
    trailing_trigger_percentage: 0,
    buffer_percentage: 0,
    target_percentage: 0
  });

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const userIdResponse = await httpApi.get(
          `/api/userid-by-email?emailid=${encodeURIComponent(user.email)}`
        );
        const userId = userIdResponse.data.userid;

        const paramsResponse = await httpApi.get(
          `/api/trailing-stop-parameters?userid=${userId}`
        );
        
        setFormData({
          ...paramsResponse.data,
          user_id: userId
        });

      } catch (error) {
        console.error('Error fetching user data:', error);
      }
    };

    if (user.email) {
      fetchUserData();
    }
  }, [user.email]);

  const handleKillSwitch = async () => {
    const dataToSend = { user_id: formData.user_id };
    try {
      await httpApi.post('/restart-zatamap', dataToSend);
    } catch (error) {
      console.error('Error restarting service:', error);
      throw error; // Re-throw to handle in calling function
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // Create payload with only required fields
      const payload = {
        pnl_min_threshold: formData.pnl_min_threshold,
        pnl_max_threshold: formData.pnl_max_threshold,
        initial_stop_loss_percentage: formData.initial_stop_loss_percentage,
        trailing_trigger_percentage: formData.trailing_trigger_percentage,
        trailing_step_threshold_pct: formData.trailing_step_threshold_pct,
        trailing_step_increment_pct: formData.trailing_step_increment_pct,
      };

      // Update parameters
      await httpApi.put(
        `/api/trailing-stop-parameters/${formData.user_id}`,
        payload
      );
      
      // Restart service after successful update
      await handleKillSwitch();
      
    } catch (error) {
      console.error('Error updating parameters:', error);
      // Add error handling UI feedback here
    }
  };

  return (
    <>
      <CustomAppBar />
      <Container maxWidth="sm" sx={{ 
        mt: { xs: 2, md: 4 }, 
        px: { xs: 1, sm: 2, md: 3 }
      }}>
        <Paper
          sx={{
            p: { xs: 2, sm: 3, md: 4 },
            background: '#070B0A',
            borderRadius: { xs: 1, md: 2 },
            border: '1px solid rgba(255,255,255,0.15)',
            boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
          }}
        >
          <Typography 
            variant="h4" 
            sx={{ 
              color: '#00ffaa', 
              fontWeight: 700, 
              mb: 3,
              textAlign: 'center',
              fontSize: { xs: '1.5rem', sm: '2rem' }
            }}
          >
            🎛️ Trading Parameters
          </Typography>
          
          <Typography 
            variant="body1" 
            sx={{ 
              color: '#9ecbff',
              mb: 4,
              textAlign: 'center',
              fontSize: { xs: '0.9rem', sm: '1rem' }
            }}
          >
            Configure your trading parameters and manage system operations
          </Typography>
          
          <form onSubmit={handleSubmit}>
          <Box display="flex" flexDirection="column" gap={2}>
            <TextField
              name="user_id"
              label="User ID"
              value={formData.user_id}
              disabled
              fullWidth
              sx={{
                '& .MuiInputLabel-root': { 
                  color: '#00ffaa',
                  '&.Mui-disabled': { color: 'rgba(0,255,170,0.5)' }
                },
                '& .MuiOutlinedInput-root': {
                  background: 'rgba(255,255,255,0.03)',
                  color: '#e0e0e0',
                  '&.Mui-disabled': {
                    background: 'rgba(255,255,255,0.02)',
                    color: 'rgba(224,224,224,0.5)'
                  },
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'rgba(255,255,255,0.2)'
                  },
                  '&:hover .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#00ffaa'
                  },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#00ffaa'
                  }
                }
              }}
            />

            <TextField
              name="pnl_min_threshold"
              label="PNL Min Threshold"
              type="number"
              inputProps={{ step: "0.01" }}
              value={formData.pnl_min_threshold}
              onChange={handleInputChange}
              fullWidth
              sx={textFieldSx}
            />

            <TextField
              name="pnl_max_threshold"
              label="PNL Max Threshold"
              type="number"
              inputProps={{ step: "0.01" }}
              value={formData.pnl_max_threshold}
              onChange={handleInputChange}
              fullWidth
              sx={textFieldSx}
            />

            <TextField
              name="initial_stop_loss_percentage"
              label="Initial Stop Loss (%)"
              type="number"
              inputProps={{ step: "0.01" }}
              value={formData.initial_stop_loss_percentage}
              onChange={handleInputChange}
              fullWidth
              sx={textFieldSx}
            />

            <TextField
              name="trailing_trigger_percentage"
              label="Trailing Trigger (%)"
              type="number"
              inputProps={{ step: "0.01" }}
              value={formData.trailing_trigger_percentage}
              onChange={handleInputChange}
              fullWidth
              sx={textFieldSx}
            />

            <TextField
              name="trailing_step_threshold_pct"
              label="Trailing Step Threshold (%)"
              type="number"
              inputProps={{ step: "0.01" }}
              value={formData.trailing_step_threshold_pct}
              onChange={handleInputChange}
              fullWidth
              sx={textFieldSx}
            />

            <TextField
              name="trailing_step_increment_pct"
              label="Trailing Step Increment (%)"
              type="number"
              inputProps={{ step: "0.01" }}
              value={formData.trailing_step_increment_pct}
              onChange={handleInputChange}
              fullWidth
              sx={textFieldSx}
            />

            <Box display="flex" flexDirection={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={2}>
              <Button 
                type="submit" 
                variant="contained" 
                sx={{ 
                  flexGrow: 1,
                  bgcolor: '#00ffaa',
                  color: '#070B0A',
                  fontWeight: 600,
                  '&:hover': {
                    bgcolor: '#00e699',
                    boxShadow: '0 4px 12px rgba(0,255,170,0.3)'
                  }
                }}
              >
                Update & Restart
              </Button>
              <Button 
                type="button" 
                variant="contained" 
                onClick={handleKillSwitch} 
                sx={{ 
                  flexGrow: 1,
                  bgcolor: 'rgba(244,67,54,0.8)',
                  color: '#ffffff',
                  fontWeight: 600,
                  '&:hover': {
                    bgcolor: 'rgba(244,67,54,1)',
                    boxShadow: '0 4px 12px rgba(244,67,54,0.3)'
                  }
                }}
              >
                Restart Only
              </Button>
            </Box>
          </Box>
        </form>
      </Paper>
    </Container>
    </>
  );
};

export default Dashboard;