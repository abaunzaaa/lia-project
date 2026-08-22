/**
 * Firebase desactivado hasta configurar credenciales reales.
 * La app funciona en modo demo sin Firebase.
 */
export const FIREBASE_ENABLED = false;

export const firebaseConfig = {
  apiKey: 'YOUR_API_KEY',
  authDomain: 'YOUR_PROJECT.firebaseapp.com',
  projectId: 'YOUR_PROJECT_ID',
  storageBucket: 'YOUR_PROJECT.appspot.com',
  messagingSenderId: 'YOUR_SENDER_ID',
  appId: 'YOUR_APP_ID',
};

/** En celular físico, localhost no funciona — usa EXPO_PUBLIC_API_URL en .env */
export { API_BASE_URL } from './api';
