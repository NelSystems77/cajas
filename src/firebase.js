import { initializeApp } from 'firebase/app'
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  collection,
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore'

const app = initializeApp({
  apiKey: 'AIzaSyCAxXiTxylfRCSDIixGf5GaeEYUZIoU57M',
  authDomain: 'cajas-2ef1b.firebaseapp.com',
  projectId: 'cajas-2ef1b',
  storageBucket: 'cajas-2ef1b.firebasestorage.app',
  messagingSenderId: '620172289303',
  appId: '1:620172289303:web:8687f4df9d1756031f4352',
})

// Caché local persistente: la app sigue funcionando sin conexión y sincroniza al volver.
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
})

const COL = 'presentaciones'

export const getPresentacion = async (codigo) => {
  const snap = await getDoc(doc(db, COL, codigo))
  return snap.exists() ? snap.data() : null
}

export const savePresentacion = (codigo, data) =>
  setDoc(doc(db, COL, codigo), { ...data, actualizado: serverTimestamp() })

/** Suscripción en vivo a todas las presentaciones → Map<codigo, data>. */
export const watchPresentaciones = (cb, onError) =>
  onSnapshot(
    collection(db, COL),
    (snap) => cb(new Map(snap.docs.map((d) => [d.id, d.data()]))),
    onError,
  )
