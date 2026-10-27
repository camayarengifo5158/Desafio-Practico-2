/* ==========================================================
   VALIDACIONES
   Cada función recibe los datos de un formulario y devuelve un
   objeto { campo: 'mensaje de error' }. Si el objeto está vacío,
   los datos son válidos. Las mismas validaciones se ejecutan en
   la interfaz (para avisar al usuario) y en los repositorios
   (para que nunca se guarde información inválida).
   ========================================================== */

import { CATEGORIAS, NEGOCIO, SUCURSALES, METODOS_PAGO, TIPOS_ENTREGA, ESTADOS } from '../config/app-config.js';
import { fechaISOLocal } from './formato.js';

const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

function vacio(valor) {
    return valor === undefined || valor === null || String(valor).trim() === '';
}

// ---------- Usuarios ----------

export function validarRegistro({ nombre, email, contrasena, confirmacion }) {
    const errores = {};
    if (vacio(nombre) || nombre.trim().length < 3) {
        errores.nombre = 'Escribe tu nombre completo (mínimo 3 letras).';
    } else if (!/^[\p{L} .'-]+$/u.test(nombre.trim())) {
        errores.nombre = 'El nombre solo puede contener letras y espacios.';
    }
    if (vacio(email) || !REGEX_EMAIL.test(email.trim())) {
        errores.email = 'Escribe un correo válido, por ejemplo nombre@correo.com.';
    }
    if (vacio(contrasena) || contrasena.length < 8) {
        errores.contrasena = 'La contraseña debe tener al menos 8 caracteres.';
    } else if (!/[A-Za-z]/.test(contrasena) || !/\d/.test(contrasena)) {
        errores.contrasena = 'Usa al menos una letra y un número.';
    }
    if (confirmacion !== contrasena) {
        errores.confirmacion = 'Las contraseñas no coinciden.';
    }
    return errores;
}

export function validarLogin({ email, contrasena }) {
    const errores = {};
    if (vacio(email) || !REGEX_EMAIL.test(email.trim())) errores.email = 'Escribe un correo válido.';
    if (vacio(contrasena)) errores.contrasena = 'Escribe tu contraseña.';
    return errores;
}

// ---------- Postres ----------

export function validarPostre({ nombre, categoria, descripcion, imagen, variantes, minimo }) {
    const errores = {};
    if (vacio(nombre) || nombre.trim().length < 3 || nombre.trim().length > 80) {
        errores.nombre = 'El nombre debe tener entre 3 y 80 caracteres.';
    }
    if (!CATEGORIAS.some((c) => c.id === categoria)) {
        errores.categoria = 'Selecciona una categoría.';
    }
    if (vacio(descripcion) || descripcion.trim().length < 10 || descripcion.trim().length > 300) {
        errores.descripcion = 'La descripción debe tener entre 10 y 300 caracteres.';
    }
    if (vacio(imagen)) {
        errores.imagen = 'Selecciona una imagen o escribe una URL.';
    } else if (!/^(img\/|https:\/\/)/.test(imagen.trim())) {
        errores.imagen = 'La imagen debe ser de la carpeta img/ o una URL https://';
    }
    if (!Array.isArray(variantes) || variantes.length === 0) {
        errores.variantes = 'Agrega al menos una presentación con su precio.';
    } else {
        const nombres = new Set();
        for (const v of variantes) {
            if (vacio(v.nombre)) { errores.variantes = 'Cada presentación necesita un nombre.'; break; }
            if (!(Number(v.precio) > 0) || Number(v.precio) > 1000) { errores.variantes = 'Cada precio debe ser mayor que $0 y menor que $1,000.'; break; }
            const clave = v.nombre.trim().toLowerCase();
            if (nombres.has(clave)) { errores.variantes = 'No repitas el nombre de una presentación.'; break; }
            nombres.add(clave);
        }
    }
    if (!Number.isInteger(Number(minimo)) || Number(minimo) < 1 || Number(minimo) > 100) {
        errores.minimo = 'El mínimo debe ser un número entero entre 1 y 100.';
    }
    return errores;
}

// ---------- Carrito y transacciones ----------

// Regla de negocio: algunos postres se venden con un mínimo de unidades
export function validarCantidad(postre, cantidad) {
    const n = Number(cantidad);
    if (!Number.isInteger(n) || n < 1) return 'La cantidad debe ser un número entero mayor que 0.';
    if (n > NEGOCIO.maxCantidadPorLinea) return `La cantidad máxima por producto es ${NEGOCIO.maxCantidadPorLinea}.`;
    if (postre && n < postre.minimo) return `${postre.nombre} se vende con un mínimo de ${postre.minimo} unidades.`;
    return null;
}

export function fechaMinimaEntrega(ahora = new Date()) {
    return fechaISOLocal(new Date(ahora.getTime() + NEGOCIO.horasAnticipacion * 3600 * 1000));
}

// opciones.exigirAnticipacion = false permite al admin reprogramar sin la regla de 48 h
export function validarEntrega({ tipo, sucursal, fecha, direccion }, { exigirAnticipacion = true } = {}) {
    const errores = {};
    if (!(tipo in TIPOS_ENTREGA)) errores.tipo = 'Selecciona cómo recibirás tu pedido.';
    if (!SUCURSALES.includes(sucursal)) errores.sucursal = 'Selecciona una sucursal.';
    if (vacio(fecha) || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
        errores.fecha = 'Selecciona la fecha de entrega.';
    } else if (exigirAnticipacion && fecha < fechaMinimaEntrega()) {
        errores.fecha = `Los encargos se hacen con ${NEGOCIO.horasAnticipacion} h de anticipación.`;
    }
    if (tipo === 'domicilio' && (vacio(direccion) || direccion.trim().length < 10)) {
        errores.direccion = 'Escribe una dirección completa (mínimo 10 caracteres).';
    }
    return errores;
}

export function validarCheckout(datos) {
    const errores = validarEntrega(datos.entrega || {});
    if (!(datos.metodoPago in METODOS_PAGO)) errores.metodoPago = 'Selecciona un método de pago.';
    if (datos.notas && datos.notas.length > 250) errores.notas = 'Las notas no pueden pasar de 250 caracteres.';
    return errores;
}

export function validarCambioEstado(estadoActual, estadoNuevo) {
    if (estadoActual === estadoNuevo) return null;
    if (!(estadoNuevo in ESTADOS)) return 'Estado desconocido.';
    if (!ESTADOS[estadoActual].siguientes.includes(estadoNuevo)) {
        return `No se puede pasar de "${ESTADOS[estadoActual].etiqueta}" a "${ESTADOS[estadoNuevo].etiqueta}".`;
    }
    return null;
}
