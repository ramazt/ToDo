import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBCOntjShf6wG7XGR_c03791oeQ7srsDyY",
  authDomain: "taskmanagerapp-ff33e.firebaseapp.com",
  projectId: "taskmanagerapp-ff33e",
  storageBucket: "taskmanagerapp-ff33e.appspot.com",
  messagingSenderId: "886743484151",
  appId: "1:886743484151:web:9780b9e8d8cd1d570475f2",
  measurementId: "G-T7QPH74BXP"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { auth, db };