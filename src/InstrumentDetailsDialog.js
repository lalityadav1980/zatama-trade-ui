import React, { useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Typography, Grid } from '@mui/material';

const InstrumentDetailsDialog = ({ open, onClose, details }) => {
  const [riskPercentage, setRiskPercentage] = useState('');

  const handleRiskChange = (event) => {
    setRiskPercentage(event.target.value);
  };

  const handlePlaceOrder = () => {
    console.log('Placing order with:', {
      instrument: details.name,
      currentPrice: details.price,
      riskPercentage
    });
    // Here you would typically call an API to place the order
    onClose(); // Close dialog after placing order
  };

  const handleReset = () => {
    setRiskPercentage(''); // Reset risk percentage
  };

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>Instrument Details</DialogTitle>
      <DialogContent>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <Typography variant="body1"><strong>Instrument:</strong> {details.symbol_full_name}</Typography>
          </Grid>
          <Grid item xs={12}>
            <Typography variant="body1"><strong>Current Price:</strong> {details.price}</Typography>
          </Grid>
          <Grid item xs={12}>
            <TextField
              label="Risk %"
              type="number"
              fullWidth
              value={riskPercentage}
              onChange={handleRiskChange}
              inputProps={{ step: "0.01" }} // Allows decimal inputs for percentages
            />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={handlePlaceOrder} color="primary" variant="contained">
          Place Order
        </Button>
        <Button onClick={handleReset} color="secondary">
          Reset
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default InstrumentDetailsDialog;
