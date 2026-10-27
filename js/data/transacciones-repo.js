/* ==========================================================
   REPOSITORIO DE TRANSACCIONES (compras simuladas)
   - Cliente: crea compras, ve SOLO las suyas y puede modificar
     o cancelar mientras el pedido esté "pendiente".
   - Administrador: ve todas, cambia estados, edita y elimina.
   Los precios se toman siempre del catálogo guardado, nunca del
   carrito, para que nadie pueda alterar el total desde el navegador.
   ========================================================== */

import { CLAVES, ROLES, NEGOCIO, ESTADOS } from '../config/app-config.js';
import { leer, escribir, leerSync, escribirSync, simularRed, generarId } from './almacenamiento.js';
import { requerirSesion, requerirRol, ErrorAutorizacion } from './auth.js';
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

function siguienteFolio() {
    const numero = (leerSync(CLAVES.contadorFolio, 0) || 0) + 1;
    escribirSync(CLAVES.contadorFolio, numero);
    return `FRG-${String(numero).padStart(5, '0')}`;
}

function puedeVer(usuario, transaccion) {
    return usuario.rol === ROLES.ADMIN || transaccion.clienteId === usuario.id;
}

// ---------- Consultar ----------

export async function obtenerTransacciones() {
    const usuario = requerirSesion();
    const todas = await leer(CLAVES.transacciones, []);
    return usuario.rol === ROLES.ADMIN ? todas : todas.filter((t) => t.clienteId === usuario.id);
}

// Busca por id o por folio (el comprobante usa el folio en la URL)
export async function obtenerTransaccion(idOFolio) {
    const usuario = requerirSesion();
    const todas = await leer(CLAVES.transacciones, []);
    const transaccion = todas.find((t) => t.id === idOFolio || t.folio === idOFolio);
    if (!transaccion) throw new Error('No se encontró la transacción.');
    if (!puedeVer(usuario, transaccion)) throw new ErrorAutorizacion('Esta transacción pertenece a otro cliente.');
    return transaccion;
}

// ---------- Crear (simular una compra) ----------
// items: [{ postreId, variante, cantidad }]
export async function crearTransaccion({ items, entrega, metodoPago, notas = '' }) {
    const usuario = requerirSesion();

    if (!Array.isArray(items) || items.length === 0) {
        throw errorDeValidacion('El carrito está vacío.');
    }
    const errores = validarCheckout({ entrega, metodoPago, notas });
    if (Object.keys(errores).length) throw errorDeValidacion('Revisa los datos de entrega y pago.', errores);

    // Se vuelve a leer el catálogo para usar precios y disponibilidad actuales
    const postres = await leer(CLAVES.postres, []);
    const lineas = items.map((item) => {
        const postre = postres.find((p) => p.id === item.postreId);
        if (!postre) throw errorDeValidacion('Uno de los productos del carrito ya no existe. Quítalo e intenta de nuevo.');
        if (!postre.disponible) throw errorDeValidacion(`${postre.nombre} no está disponible en este momento.`);
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

    // Simulación del procesamiento del pago con tarjeta (sin datos reales)
    if (metodoPago === 'tarjeta') await simularRed();

    const ahora = new Date().toISOString();
    const transaccion = {
        id: generarId('trx'),
        folio: siguienteFolio(),
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

    const todas = await leer(CLAVES.transacciones, []);
    todas.push(transaccion);
    await escribir(CLAVES.transacciones, todas);
    return transaccion;
}

// ---------- Actualizar ----------
// cambios puede incluir: estado, pagado, entrega, notas, items [{ postreId, variante, cantidad }]
export async function actualizarTransaccion(id, cambios) {
    const usuario = requerirSesion();
    const esAdmin = usuario.rol === ROLES.ADMIN;
    const todas = await leer(CLAVES.transacciones, []);
    const indice = todas.findIndex((t) => t.id === id);
    if (indice === -1) throw new Error('No se encontró la transacción.');

    const actual = todas[indice];
    if (!puedeVer(usuario, actual)) throw new ErrorAutorizacion('Esta transacción pertenece a otro cliente.');

    // Regla: el cliente solo puede modificar pedidos que aún no se están preparando
    if (!esAdmin && actual.estado !== 'pendiente') {
        throw new ErrorAutorizacion('Solo puedes modificar pedidos en estado "Pendiente".');
    }
    // Un pedido entregado o cancelado está cerrado: solo se permiten notas
    const cerrado = ESTADOS[actual.estado].siguientes.length === 0;
    const camposNoPermitidos = Object.keys(cambios)
        .filter((campo) => campo !== 'notas' && !(campo === 'estado' && cambios.estado === actual.estado));
    if (cerrado && camposNoPermitidos.length > 0) {
        throw errorDeValidacion(`Un pedido "${ESTADOS[actual.estado].etiqueta}" ya no puede modificarse (solo sus notas).`);
    }

    const nueva = { ...actual, entrega: { ...actual.entrega }, historial: [...actual.historial] };

    // Estado y pago: solo el administrador
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

    // Entrega: el cliente debe respetar las 48 h; el admin puede reprogramar libremente
    if (cambios.entrega) {
        const entrega = { ...actual.entrega, ...cambios.entrega };
        const errores = validarEntrega(entrega, { exigirAnticipacion: !esAdmin });
        if (Object.keys(errores).length) throw errorDeValidacion('Revisa los datos de entrega.', errores);
        nueva.entrega = { ...entrega, direccion: entrega.tipo === 'domicilio' ? entrega.direccion.trim() : '' };
    }

    if ('notas' in cambios) {
        const notas = String(cambios.notas ?? '').trim();
        if (notas.length > 250) throw errorDeValidacion('Las notas no pueden pasar de 250 caracteres.', { notas: 'Máximo 250 caracteres.' });
        nueva.notas = notas;
    }

    // Productos: se pueden cambiar cantidades o quitar líneas, conservando el precio de compra
    if (cambios.items) {
        if (!['pendiente', 'en_preparacion'].includes(actual.estado)) {
            throw errorDeValidacion('Los productos solo se pueden modificar antes de que el pedido esté listo.');
        }
        const postres = await leer(CLAVES.postres, []);
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
        if (items.length === 0) throw errorDeValidacion('El pedido debe tener al menos un producto. Si no lo quieres, cancélalo.');
        nueva.items = items;
    }

    Object.assign(nueva, calcularTotales(nueva.items, nueva.entrega.tipo));
    nueva.actualizadaEn = new Date().toISOString();
    todas[indice] = nueva;
    await escribir(CLAVES.transacciones, todas);
    return nueva;
}

// Cancelar es una actualización especial que también puede hacer el cliente
export async function cancelarTransaccion(id) {
    const usuario = requerirSesion();
    const todas = await leer(CLAVES.transacciones, []);
    const indice = todas.findIndex((t) => t.id === id);
    if (indice === -1) throw new Error('No se encontró la transacción.');

    const actual = todas[indice];
    if (!puedeVer(usuario, actual)) throw new ErrorAutorizacion('Esta transacción pertenece a otro cliente.');
    if (usuario.rol !== ROLES.ADMIN && actual.estado !== 'pendiente') {
        throw new ErrorAutorizacion('Tu pedido ya se está preparando. Contáctanos para cancelarlo.');
    }
    const error = validarCambioEstado(actual.estado, 'cancelada');
    if (error) throw errorDeValidacion(error);

    const ahora = new Date().toISOString();
    todas[indice] = {
        ...actual,
        estado: 'cancelada',
        historial: [...actual.historial, { fecha: ahora, estado: 'cancelada', por: usuario.nombre }],
        actualizadaEn: ahora
    };
    await escribir(CLAVES.transacciones, todas);
    return todas[indice];
}

// ---------- Eliminar (solo administración) ----------
export async function eliminarTransaccion(id) {
    requerirRol(ROLES.ADMIN);
    const todas = await leer(CLAVES.transacciones, []);
    const restantes = todas.filter((t) => t.id !== id);
    if (restantes.length === todas.length) throw new Error('La transacción no existe o ya fue eliminada.');
    await escribir(CLAVES.transacciones, restantes);
    return true;
}
