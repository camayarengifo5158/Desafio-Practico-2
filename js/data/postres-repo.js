/* ==========================================================
   REPOSITORIO DE POSTRES (catálogo)
   CRUD completo. Leer el catálogo es público; crear, modificar
   y eliminar exige rol de administrador.
   ========================================================== */

import { CLAVES, ROLES } from '../config/app-config.js';
import { leer, escribir, generarId } from './almacenamiento.js';
import { requerirRol } from './auth.js';
import { validarPostre } from '../logica/validaciones.js';
import { redondear } from '../logica/formato.js';

// Limpia los datos que vienen del formulario antes de validarlos y guardarlos
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

// ---------- Consultar ----------

export async function obtenerPostres() {
    return leer(CLAVES.postres, []);
}

export async function obtenerPostre(id) {
    const postres = await obtenerPostres();
    const postre = postres.find((p) => p.id === id);
    if (!postre) throw new Error('El postre no existe o fue eliminado.');
    return postre;
}

// ---------- Crear ----------

export async function crearPostre(datos) {
    requerirRol(ROLES.ADMIN);
    const limpio = normalizarPostre(datos);
    const errores = validarPostre(limpio);
    if (Object.keys(errores).length) throw errorDeValidacion(errores);

    const postres = await leer(CLAVES.postres, []);
    if (postres.some((p) => p.nombre.toLowerCase() === limpio.nombre.toLowerCase())) {
        throw errorDeValidacion({ nombre: 'Ya existe un postre con ese nombre.' });
    }

    const ahora = new Date().toISOString();
    const nuevo = { id: generarId('pst'), ...limpio, creadoEn: ahora, actualizadoEn: ahora };
    postres.push(nuevo);
    await escribir(CLAVES.postres, postres);
    return nuevo;
}

// ---------- Actualizar ----------

export async function actualizarPostre(id, cambios) {
    requerirRol(ROLES.ADMIN);
    const postres = await leer(CLAVES.postres, []);
    const indice = postres.findIndex((p) => p.id === id);
    if (indice === -1) throw new Error('El postre no existe o fue eliminado.');

    const limpio = normalizarPostre({ ...postres[indice], ...cambios });
    const errores = validarPostre(limpio);
    if (Object.keys(errores).length) throw errorDeValidacion(errores);

    const repetido = postres.some((p) => p.id !== id && p.nombre.toLowerCase() === limpio.nombre.toLowerCase());
    if (repetido) throw errorDeValidacion({ nombre: 'Ya existe otro postre con ese nombre.' });

    postres[indice] = { ...postres[indice], ...limpio, actualizadoEn: new Date().toISOString() };
    await escribir(CLAVES.postres, postres);
    return postres[indice];
}

export async function cambiarDisponibilidad(id, disponible) {
    return actualizarPostre(id, { disponible });
}

// ---------- Eliminar ----------
// Las transacciones guardan una copia del nombre y precio, así que
// eliminar un postre no altera los comprobantes ya emitidos.
export async function eliminarPostre(id) {
    requerirRol(ROLES.ADMIN);
    const postres = await leer(CLAVES.postres, []);
    const restantes = postres.filter((p) => p.id !== id);
    if (restantes.length === postres.length) throw new Error('El postre no existe o ya fue eliminado.');
    await escribir(CLAVES.postres, restantes);
    return true;
}
