import React from 'react';
import { BrowserRouter as Router, Route, Routes, Link } from 'react-router-dom';
import Login from './Login';
import Register from './Register';
import Dashboard from './Dashboard';
import ForgotPassword from './ForgotPassword';
import DomainRegistration from './DomainRegistration';
import FabricBuilder from './FabricBuilder';


function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} /> {/* Keep if you want the login at root */}
        <Route path="/login" element={<Login />} /> {/* Add this line */}
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/domain-registration" element={<DomainRegistration />} />
        <Route path="/fabric-builder" element={<FabricBuilder />} />
      </Routes>
    </Router>
  );
}

export default App;
