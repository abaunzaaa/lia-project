import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
  Auth,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  deleteDoc,
  addDoc,
  orderBy,
  Firestore,
} from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL, FirebaseStorage } from 'firebase/storage';
import { firebaseConfig, FIREBASE_ENABLED } from '../config/firebase';
import { User, Medication, Reminder, MedicationHistory } from '../types';

let app: FirebaseApp;
let auth: Auth;
let db: Firestore;
let storage: FirebaseStorage;

export function initFirebase() {
  if (!FIREBASE_ENABLED) {
    throw new Error('Firebase no configurado');
  }
  if (!getApps().length) {
    app = initializeApp(firebaseConfig);
  } else {
    app = getApps()[0];
  }
  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);
  return { app, auth, db, storage };
}

export function getFirebaseAuth() {
  if (!auth) initFirebase();
  return auth;
}

export function getFirebaseDb() {
  if (!db) initFirebase();
  return db;
}

export function getFirebaseStorage() {
  if (!storage) initFirebase();
  return storage;
}

// ─── Auth ───────────────────────────────────────────

export async function loginUser(email: string, password: string) {
  const authInstance = getFirebaseAuth();
  const credential = await signInWithEmailAndPassword(authInstance, email, password);
  const userDoc = await getDoc(doc(getFirebaseDb(), 'users', credential.user.uid));
  return userDoc.data() as User;
}

export async function registerUser(data: {
  fullName: string;
  email: string;
  password: string;
  age: number;
  emergencyContact: string;
}) {
  const authInstance = getFirebaseAuth();
  const credential = await createUserWithEmailAndPassword(authInstance, data.email, data.password);
  await updateProfile(credential.user, { displayName: data.fullName });

  const user: User = {
    uid: credential.user.uid,
    fullName: data.fullName,
    email: data.email,
    age: data.age,
    emergencyContact: data.emergencyContact,
    createdAt: new Date().toISOString(),
  };

  await setDoc(doc(getFirebaseDb(), 'users', credential.user.uid), user);
  return user;
}

export async function logoutUser() {
  await signOut(getFirebaseAuth());
}

export async function resetPassword(email: string) {
  await sendPasswordResetEmail(getFirebaseAuth(), email);
}

export async function getUserProfile(uid: string): Promise<User | null> {
  const snap = await getDoc(doc(getFirebaseDb(), 'users', uid));
  return snap.exists() ? (snap.data() as User) : null;
}

export async function updateUserProfile(uid: string, data: Partial<User>) {
  await updateDoc(doc(getFirebaseDb(), 'users', uid), data);
}

// ─── Medications ────────────────────────────────────

export async function addMedication(medication: Omit<Medication, 'id'>) {
  const ref = await addDoc(collection(getFirebaseDb(), 'medications'), medication);
  return { ...medication, id: ref.id };
}

export async function getMedications(userId: string): Promise<Medication[]> {
  const q = query(
    collection(getFirebaseDb(), 'medications'),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Medication));
}

export async function updateMedication(id: string, data: Partial<Medication>) {
  await updateDoc(doc(getFirebaseDb(), 'medications', id), data);
}

export async function deleteMedication(id: string) {
  await deleteDoc(doc(getFirebaseDb(), 'medications', id));
}

// ─── Reminders ──────────────────────────────────────

export async function getReminders(userId: string, date: string): Promise<Reminder[]> {
  const q = query(
    collection(getFirebaseDb(), 'reminders'),
    where('userId', '==', userId),
    where('date', '==', date)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Reminder));
}

export async function updateReminderStatus(id: string, status: Reminder['status']) {
  await updateDoc(doc(getFirebaseDb(), 'reminders', id), { status });
}

// ─── History ────────────────────────────────────────

export async function getHistory(userId: string): Promise<MedicationHistory[]> {
  const q = query(
    collection(getFirebaseDb(), 'history'),
    where('userId', '==', userId),
    orderBy('date', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as MedicationHistory));
}

export async function addHistoryEntry(entry: Omit<MedicationHistory, 'id'>) {
  await addDoc(collection(getFirebaseDb(), 'history'), entry);
}

// ─── Storage ────────────────────────────────────────

export async function uploadImage(uri: string, path: string): Promise<string> {
  const response = await fetch(uri);
  const blob = await response.blob();
  const storageRef = ref(getFirebaseStorage(), path);
  await uploadBytes(storageRef, blob);
  return getDownloadURL(storageRef);
}
