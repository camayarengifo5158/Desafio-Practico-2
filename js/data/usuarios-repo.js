/* ==========================================================
   REPOSITORIO DE USUARIOS (Firestore - Colección "usuarios")
   ========================================================== */

import { ROLES } from '../config/app-config.js';
import { db, collection, getDocs, doc, getDoc, updateDoc } from '../config/firebase.js';
import { requerirRol, usuarioPublico } from './auth.js';

export async function obtenerUsuarios() {
    requerirRol(ROLES.ADMIN);
    const snap = await getDocs(collection(db, 'usuarios'));
    const usuarios = [];
    snap.forEach((d) => usuarios.push({ id: d.id, ...d.data() }));
    return usuarios.map(usuarioPublico);
}

export async function cambiarRol(id, rolNuevo) {
    const admin = requerirRol(ROLES.ADMIN);
    if (!Object.values(ROLES).includes(rolNuevo)) throw new Error('Rol desconocido.');
    if (id === admin.id) throw new Error('No puedes cambiar tu propio rol.');

    const docRef = doc(db, 'usuarios', id);
    await updateDoc(docRef, { rol: rolNuevo });
    const snap = await getDoc(docRef);

    return usuarioPublico({ id, ...snap.data() });
}