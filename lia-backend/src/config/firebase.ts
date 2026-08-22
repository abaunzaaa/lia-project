import admin from 'firebase-admin';
import { config } from './index';

let initialized = false;

export function initFirebaseAdmin() {
  if (initialized) return admin;

  if (config.firebase.projectId && config.firebase.clientEmail && config.firebase.privateKey) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: config.firebase.projectId,
        clientEmail: config.firebase.clientEmail,
        privateKey: config.firebase.privateKey,
      }),
    });
    initialized = true;
    console.log('✅ Firebase Admin inicializado');
  } else {
    console.log('⚠️  Firebase Admin no configurado — modo demo activo');
  }

  return admin;
}

export function getFirestore() {
  initFirebaseAdmin();
  return initialized ? admin.firestore() : null;
}

export function getAuth() {
  initFirebaseAdmin();
  return initialized ? admin.auth() : null;
}
