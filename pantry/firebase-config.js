// firebase-config.js - your Firebase project's web settings.
// These values are NOT secret (every Firebase web app shows them); your data is protected by
// the sign-in + the security rules set in the Firebase console.
// Leave it as null to run in "this device only" mode.

export const firebaseConfig = {                              // the settings for my "virtual-pantry" Firebase project
  apiKey: "AIzaSyAl9iF67TLtdUB8WHouKh3skkHBRU_TLeM",         // public key that lets the app talk to Firebase
  authDomain: "virtual-pantry-8ea95.firebaseapp.com",          // the Firebase address that handles sign-in
  projectId: "virtual-pantry-8ea95",                           // which Firebase project the data lives in
  storageBucket: "virtual-pantry-8ea95.firebasestorage.app",   // file storage spot (not used yet)
  messagingSenderId: "949564220144",                           // project number Firebase uses internally
  appId: "1:949564220144:web:5cfa0e53e29488ea819835",          // the ID of the "pantry" web app I registered
};                                                             // end of the settings
