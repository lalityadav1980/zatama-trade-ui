// In App.js
import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Login from './Login';
import Register from './Register';
import Dashboard from './Dashboard';
import ForgotPassword from './ForgotPassword';
import Positions from './Positions';
import { UserProvider } from './UserContext'; // Make sure this is correctly imported
import Signal from './Signal';
import OrderBook from './OrderBook';
import TradeSummary from './trade_summary';
import TrailData from './TrailData';
import LiveTradeOrderBook from './live_trade_order_book';
import Fusion from './fusion';
import FusionEvents from './FusionEvents';

// NEW: import MarketStream page
import MarketStream from './MarketStream';
function App() {
  return (
    <UserProvider> {/* Wrap your application with UserProvider */}
      <Router>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/login" element={<Login />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />

          {/* <Route path="/positions" element={<Positions />} /> */}
          <Route path="/signal" element={<Signal />} />
          <Route path="/orders" element={<OrderBook />} />

          {/* <Route path="/trade-summary" element={<TradeSummary />} /> */}
          <Route path="/trail-data" element={<TrailData />} />

          {/* <Route path="/live-trade-orders" element={<LiveTradeOrderBook />} /> */}
          <Route path="/fusion" element={<Fusion />} />
          <Route path="/fusion-events" element={<FusionEvents />} />
          <Route path="/market-stream" element={<MarketStream />} />
        </Routes>
      </Router>
    </UserProvider>
  );
}

export default App;