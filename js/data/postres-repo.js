/* ARCHIVO: js/data/postres-repo.js
   REPOSITORIO DE POSTRES (Capa de Datos / Persistencia)

   ÍNDICE:
   - normalizarPostre()
   - errorDeValidacion()
   - export obtenerPostres()
   - export obtenerPostre()
   - export crearPostre()
   - export actualizarPostre()
   - export cambiarDisponibilidad()
   - export eliminarPostre()
*/

import { ROLES } from '../config/app-config.js';

import {
    db,
    collection,
    getDocs,
    getDoc,
    doc,
    setDoc,
    updateDoc,
    deleteDoc
} from '../config/firebase.js';

import { requerirRol } from './auth.js';

import { validarPostre } from '../logica/validaciones.js';

import { redondear } from '../logica/formato.js';

function normalizarPostre(datos) {
    return {
        nombre: String(datos.nombre ?? '').trim(),
        categoria: datos.categoria,
        descripcion: String(datos.descripcion ?? '').trim(),
        imagen: String(datos.imagen ?? '').trim(),
        variantes: (datos.variantes || []).map((v) => ({
            nombre: String(v.nombre ?? '').trim(),
            precio: redondear(v.precio)
        })),
        minimo: Number(datos.minimo) || 1,
        disponible: Boolean(datos.disponible)
    };
}

function errorDeValidacion(errores) {
    const error = new Error('Revisa los campos marcados.');
    error.campos = errores;
    return error;
}

export async function obtenerPostres() {
    const snap = await getDocs(collection(db, 'postres'));
    const postres = [];

    snap.forEach((d) => postres.push({ id: d.id, ...d.data() }));

    return postres;
}

export async function obtenerPostre(id) {
    const docRef = doc(db, 'postres', id);
    const snap = await getDoc(docRef);

    if (!snap.exists()) throw new Error('El postre no existe o fue eliminado.');

    return { id: snap.id, ...snap.data() };
}

export async function crearPostre(datos) {
    requerirRol(ROLES.ADMIN);

    const limpio = normalizarPostre(datos);

    const errores = validarPostre(limpio);
    if (Object.keys(errores).length) throw errorDeValidacion(errores);

    const postres = await obtenerPostres();
    if (postres.some((p) => p.nombre.toLowerCase() === limpio.nombre.toLowerCase())) {
        throw errorDeValidacion({ nombre: 'Ya existe un postre con ese nombre.' });
    }

    const ahora = new Date().toISOString();

    const id = `pst_${Date.now().toString(36)}`;
    const nuevo = { ...limpio, creadoEn: ahora, actualizadoEn: ahora };

    await setDoc(doc(db, 'postres', id), nuevo);

    return { id, ...nuevo };
}

export async function actualizarPostre(id, cambios) {
    requerirRol(ROLES.ADMIN);

    const postreActual = await obtenerPostre(id);

    const limpio = normalizarPostre({ ...postreActual, ...cambios });

    const errores = validarPostre(limpio);
    if (Object.keys(errores).length) throw errorDeValidacion(errores);

    const todos = await obtenerPostres();
    const repetido = todos.some((p) => p.id !== id && p.nombre.toLowerCase() === limpio.nombre.toLowerCase());
    if (repetido) throw errorDeValidacion({ nombre: 'Ya existe otro postre con ese nombre.' });

    const datosActualizados = {
        ...limpio,
        actualizadoEn: new Date().toISOString()
    };

    await updateDoc(doc(db, 'postres', id), datosActualizados);
    return { id, ...datosActualizados };
}

export async function cambiarDisponibilidad(id, disponible) {
    requerirRol(ROLES.ADMIN);

    await updateDoc(doc(db, 'postres', id), { disponible: Boolean(disponible) });
    return { id, disponible: Boolean(disponible) };
}

export async function eliminarPostre(id) {
    requerirRol(ROLES.ADMIN);

    const docRef = doc(db, 'postres', id);
    await deleteDoc(docRef);
    return true;
}
