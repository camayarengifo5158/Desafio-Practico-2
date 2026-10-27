/* ==========================================================
   REPOSITORIO DE USUARIOS (solo administración)
   El rol de administrador solo lo puede otorgar otro
   administrador: nadie se lo asigna a sí mismo al registrarse.
   ========================================================== */

import { CLAVES, ROLES } from '../config/app-config.js';
import { leer, escribir } from './almacenamiento.js';
import { requerirRol, usuarioPublico } from './auth.js';

export async function obtenerUsuarios() {
    requerirRol(ROLES.ADMIN);
    const usuarios = await leer(CLAVES.usuarios, []);
    return usuarios.map(usuarioPublico);
}

export async function cambiarRol(id, rolNuevo) {
    const admin = requerirRol(ROLES.ADMIN);
    if (!Object.values(ROLES).includes(rolNuevo)) throw new Error('Rol desconocido.');
    if (id === admin.id) throw new Error('No puedes cambiar tu propio rol.');

    const usuarios = await leer(CLAVES.usuarios, []);
    const indice = usuarios.findIndex((u) => u.id === id);
    if (indice === -1) throw new Error('El usuario no existe.');

    usuarios[indice] = { ...usuarios[indice], rol: rolNuevo };
    await escribir(CLAVES.usuarios, usuarios);
    return usuarioPublico(usuarios[indice]);
}
