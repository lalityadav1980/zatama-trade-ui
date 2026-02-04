// Firebase v9 and later
// src/firebase-config.js
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
const firebaseConfig = {
    apiKey: "AIzaSyAocl_Fe_TYTIu5CEA1QYgqVi1jb3NhV1U",
    authDomain: "boozeonwheels-dev.firebaseapp.com",
    databaseURL: "https://boozeonwheels-dev-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "boozeonwheels-dev",
    storageBucket: "boozeonwheels-dev.appspot.com",
    messagingSenderId: "542525862637",
    appId: "1:542525862637:web:79bc67c48a6781a92fd2e4",
    measurementId: "G-RJC09CXM5R"
  };

  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  
  export { auth };