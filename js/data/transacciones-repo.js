/* ==========================================================
   REPOSITORIO DE TRANSACCIONES (Firestore - Colección "transacciones")
   ========================================================== */

import { ROLES, NEGOCIO, ESTADOS } from '../config/app-config.js';
import { 
    db, 
    collection, 
    getDocs, 
    getDoc, 
    doc, 
    setDoc, 
    updateDoc, 
    deleteDoc, 
    query, 
    where 
} from '../config/firebase.js';
import { requerirSesion, requerirRol, ErrorAutorizacion } from './auth.js';
import { obtenerPostres } from './postres-repo.js';
import { validarCheckout, validarCantidad, validarEntrega, validarCambioEstado } from '../logica/validaciones.js';
import { redondear } from '../logica/formato.js';

function errorDeValidacion(mensaje, campos = {}) {
    const error = new Error(mensaje);
    error.campos = campos;
    return error;
}

function claveLinea(linea) {
    return `${linea.postreId}|${linea.variante}`;
}

function calcularTotales(items, tipoEntrega) {
    const subtotal = redondear(items.reduce((suma, i) => suma + i.subtotal, 0));
    const envio = tipoEntrega === 'domicilio' ? NEGOCIO.costoEnvio : 0;
    return { subtotal, envio, total: redondear(subtotal + envio) };
}

function generarFolio() {
    const num = Math.floor(1000 + Math.random() * 90000);
    return `FRG-${num}`;
}

function puedeVer(usuario, transaccion) {
    return usuario.rol === ROLES.ADMIN || transaccion.clienteId === usuario.id;
}

// ---------- Consultar ----------

export async function obtenerTransacciones() {
    const usuario = requerirSesion();
    const coleccionRef = collection(db, 'transacciones');
    let q;

    if (usuario.rol === ROLES.ADMIN) {
        q = query(coleccionRef);
    } else {
        q = query(coleccionRef, where('clienteId', '==', usuario.id));
    }

    const snap = await getDocs(q);
    const transacciones = [];
    snap.forEach((d) => transacciones.push({ id: d.id, ...d.data() }));
    return transacciones;
}

export async function obtenerTransaccion(idOFolio) {
    const usuario = requerirSesion();
    const esAdmin = usuario.rol === ROLES.ADMIN;
    const esFolio = String(idOFolio).trim().toUpperCase().startsWith('FRG-');

    // 1. Si el parámetro corresponde al formato de folio ('FRG-...')
    if (esFolio) {
        const restricciones = [where('folio', '==', String(idOFolio).trim())];
        if (!esAdmin) {
            restricciones.push(where('clienteId', '==', usuario.id));
        }
        const q = query(collection(db, 'transacciones'), ...restricciones);
        const querySnap = await getDocs(q);
        if (!querySnap.empty) {
            const primerDoc = querySnap.docs[0];
            return { id: primerDoc.id, ...primerDoc.data() };
        }
        throw new Error('No se encontró la transacción.');
    }

    // 2. Si es un ID de documento en Firestore
    try {
        const docRef = doc(db, 'transacciones', idOFolio);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
            const transaccion = { id: snap.id, ...snap.data() };
            if (!puedeVer(usuario, transaccion)) {
                throw new ErrorAutorizacion('Esta transacción pertenece a otro cliente.');
            }
            return transaccion;
        }
    } catch (error) {
        if (error instanceof ErrorAutorizacion) throw error;
        // Si falló en Firestore (por formato de ID o restricción), continuamos con el fallback
    }

    // 3. Fallback: buscar por campo 'folio' por si se usó un folio sin prefijo 'FRG-'
    const restriccionesFallback = [where('folio', '==', idOFolio)];
    if (!esAdmin) {
        restriccionesFallback.push(where('clienteId', '==', usuario.id));
    }
    const qFallback = query(collection(db, 'transacciones'), ...restriccionesFallback);
    const querySnapFallback = await getDocs(qFallback);
    if (!querySnapFallback.empty) {
        const primerDoc = querySnapFallback.docs[0];
        return { id: primerDoc.id, ...primerDoc.data() };
    }

    throw new Error('No se encontró la transacción.');
}

// ---------- Crear ----------

export async function crearTransaccion({ items, entrega, metodoPago, notas = '' }) {
    const usuario = requerirSesion();

    if (!Array.isArray(items) || items.length === 0) {
        throw errorDeValidacion('El carrito está vacío.');
    }
    const errores = validarCheckout({ entrega, metodoPago, notas });
    if (Object.keys(errores).length) throw errorDeValidacion('Revisa los datos de entrega y pago.', errores);

    const postres = await obtenerPostres();
    const lineas = items.map((item) => {
        const postre = postres.find((p) => p.id === item.postreId);
        if (!postre) throw errorDeValidacion('Uno de los productos ya no existe.');
        if (!postre.disponible) throw errorDeValidacion(`${postre.nombre} no está disponible.`);
        const variante = postre.variantes.find((v) => v.nombre === item.variante);
        if (!variante) throw errorDeValidacion(`La presentación "${item.variante}" de ${postre.nombre} ya no existe.`);
        const errorCantidad = validarCantidad(postre, item.cantidad);
        if (errorCantidad) throw errorDeValidacion(errorCantidad);

        const cantidad = Number(item.cantidad);
        return {
            postreId: postre.id,
            nombre: postre.nombre,
            categoria: postre.categoria,
            variante: variante.nombre,
            precioUnitario: variante.precio,
            cantidad,
            subtotal: redondear(variante.precio * cantidad)
        };
    });

    const ahora = new Date().toISOString();
    const id = `trx_${Date.now().toString(36)}`;
    const transaccion = {
        folio: generarFolio(),
        clienteId: usuario.id,
        clienteNombre: usuario.nombre,
        clienteEmail: usuario.email,
        items: lineas,
        ...calcularTotales(lineas, entrega.tipo),
        metodoPago,
        pagado: metodoPago !== 'efectivo',
        estado: 'pendiente',
        entrega: {
            tipo: entrega.tipo,
            sucursal: entrega.sucursal,
            fecha: entrega.fecha,
            direccion: entrega.tipo === 'domicilio' ? entrega.direccion.trim() : ''
        },
        notas: notas.trim(),
        historial: [{ fecha: ahora, estado: 'pendiente', por: usuario.nombre }],
        creadaEn: ahora,
        actualizadaEn: ahora
    };

    await setDoc(doc(db, 'transacciones', id), transaccion);
    return { id, ...transaccion };
}

// ---------- Actualizar ----------

export async function actualizarTransaccion(id, cambios) {
    const usuario = requerirSesion();
    const esAdmin = usuario.rol === ROLES.ADMIN;
    const actual = await obtenerTransaccion(id);

    if (!esAdmin && actual.estado !== 'pendiente') {
        throw new ErrorAutorizacion('Solo puedes modificar pedidos en estado "Pendiente".');
    }

    const cerrado = ESTADOS[actual.estado].siguientes.length === 0;
    const camposNoPermitidos = Object.keys(cambios)
        .filter((campo) => campo !== 'notas' && !(campo === 'estado' && cambios.estado === actual.estado));
    if (cerrado && camposNoPermitidos.length > 0) {
        throw errorDeValidacion(`Un pedido "${ESTADOS[actual.estado].etiqueta}" ya no puede modificarse.`);
    }

    const nueva = { ...actual, entrega: { ...actual.entrega }, historial: [...actual.historial] };

    if ('estado' in cambios && cambios.estado !== actual.estado) {
        if (!esAdmin) throw new ErrorAutorizacion('Solo la administración puede cambiar el estado.');
        const error = validarCambioEstado(actual.estado, cambios.estado);
        if (error) throw errorDeValidacion(error, { estado: error });
        nueva.estado = cambios.estado;
        nueva.historial.push({ fecha: new Date().toISOString(), estado: cambios.estado, por: usuario.nombre });
        if (cambios.estado === 'entregada') nueva.pagado = true;
    }

    if ('pagado' in cambios) {
        if (!esAdmin) throw new ErrorAutorizacion('Solo la administración puede registrar pagos.');
        nueva.pagado = Boolean(cambios.pagado) || nueva.estado === 'entregada';
    }

    if (cambios.entrega) {
        const entrega = { ...actual.entrega, ...cambios.entrega };
        const errores = validarEntrega(entrega, { exigirAnticipacion: !esAdmin });
        if (Object.keys(errores).length) throw errorDeValidacion('Revisa los datos de entrega.', errores);
        nueva.entrega = { ...entrega, direccion: entrega.tipo === 'domicilio' ? entrega.direccion.trim() : '' };
    }

    if ('notas' in cambios) {
        const notas = String(cambios.notas ?? '').trim();
        if (notas.length > 250) throw errorDeValidacion('Las notas no pueden pasar de 250 caracteres.');
        nueva.notas = notas;
    }

    if (cambios.items) {
        if (!['pendiente', 'en_preparacion'].includes(actual.estado)) {
            throw errorDeValidacion('Los productos solo se pueden modificar antes de que el pedido esté listo.');
        }
        const postres = await obtenerPostres();
        const originales = new Map(actual.items.map((l) => [claveLinea(l), l]));
        const items = cambios.items
            .filter((i) => Number(i.cantidad) > 0)
            .map((i) => {
                const original = originales.get(claveLinea(i));
                if (!original) throw errorDeValidacion('Solo puedes modificar productos que ya están en el pedido.');
                const postre = postres.find((p) => p.id === i.postreId) || { nombre: original.nombre, minimo: 1 };
                const errorCantidad = validarCantidad(postre, i.cantidad);
                if (errorCantidad) throw errorDeValidacion(errorCantidad);
                const cantidad = Number(i.cantidad);
                return { ...original, cantidad, subtotal: redondear(original.precioUnitario * cantidad) };
            });
        if (items.length === 0) throw errorDeValidacion('El pedido debe tener al menos un producto.');
        nueva.items = items;
    }

    Object.assign(nueva, calcularTotales(nueva.items, nueva.entrega.tipo));
    nueva.actualizadaEn = new Date().toISOString();

    const { id: _, ...datosParaGuardar } = nueva;
    await updateDoc(doc(db, 'transacciones', id), datosParaGuardar);
    return nueva;
}

export async function cancelarTransaccion(id) {
    const usuario = requerirSesion();
    const actual = await obtenerTransaccion(id);

    if (usuario.rol !== ROLES.ADMIN && actual.estado !== 'pendiente') {
        throw new ErrorAutorizacion('Tu pedido ya se está preparando. Contáctanos para cancelarlo.');
    }
    const error = validarCambioEstado(actual.estado, 'cancelada');
    if (error) throw errorDeValidacion(error);

    const ahora = new Date().toISOString();
    const historial = [...actual.historial, { fecha: ahora, estado: 'cancelada', por: usuario.nombre }];

    await updateDoc(doc(db, 'transacciones', id), {
        estado: 'cancelada',
        historial,
        actualizadaEn: ahora
    });

    return { ...actual, estado: 'cancelada', historial, actualizadaEn: ahora };
}

export async function eliminarTransaccion(id) {
    requerirRol(ROLES.ADMIN);
    await deleteDoc(doc(db, 'transacciones', id));
    return true;
}