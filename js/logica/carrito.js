/* ==========================================================
   CARRITO DE COMPRAS
   Vive solo en este navegador (localStorage). Guarda únicamente
   qué se quiere comprar: { postreId, variante, cantidad }.
   Los precios se consultan del catálogo al mostrarlo y se
   vuelven a validar al confirmar la compra.
   ========================================================== */

import { CLAVES } from '../config/app-config.js';
import { leerSync, escribirSync } from '../data/almacenamiento.js';
import { validarCantidad } from './validaciones.js';
import { redondear } from './formato.js';

const EVENTO = 'carrito:cambio';

function guardar(carrito) {
    escribirSync(CLAVES.carrito, carrito);
    // Avisamos a la cabecera y demás componentes que el carrito cambió
    document.dispatchEvent(new CustomEvent(EVENTO, { detail: carrito }));
    return carrito;
}

export function alCambiarCarrito(funcion) {
    document.addEventListener(EVENTO, (e) => funcion(e.detail));
}

export function obtenerCarrito() {
    return leerSync(CLAVES.carrito, []);
}

export function contarUnidades(carrito = obtenerCarrito()) {
    return carrito.reduce((suma, linea) => suma + linea.cantidad, 0);
}

export function agregarAlCarrito(postre, variante, cantidad) {
    if (!postre.disponible) throw new Error(`${postre.nombre} no está disponible en este momento.`);
    if (!postre.variantes.some((v) => v.nombre === variante)) throw new Error('Selecciona una presentación válida.');

    const carrito = obtenerCarrito();
    const existente = carrito.find((l) => l.postreId === postre.id && l.variante === variante);
    const cantidadFinal = (existente ? existente.cantidad : 0) + Number(cantidad);

    const error = validarCantidad(postre, cantidadFinal);
    if (error) throw new Error(error);

    if (existente) {
        existente.cantidad = cantidadFinal;
    } else {
        carrito.push({ postreId: postre.id, variante, cantidad: cantidadFinal });
    }
    return guardar(carrito);
}

export function actualizarCantidad(postre, variante, cantidad) {
    const error = validarCantidad(postre, cantidad);
    if (error) throw new Error(error);
    const carrito = obtenerCarrito().map((l) =>
        l.postreId === postre.id && l.variante === variante ? { ...l, cantidad: Number(cantidad) } : l
    );
    return guardar(carrito);
}

export function quitarDelCarrito(postreId, variante) {
    return guardar(obtenerCarrito().filter((l) => !(l.postreId === postreId && l.variante === variante)));
}

export function vaciarCarrito() {
    return guardar([]);
}

// Une el carrito con el catálogo actual: precio, nombre, imagen y avisos
export function detallarCarrito(postres, carrito = obtenerCarrito()) {
    const lineas = carrito.map((linea) => {
        const postre = postres.find((p) => p.id === linea.postreId);
        const variante = postre?.variantes.find((v) => v.nombre === linea.variante);
        let aviso = null;
        if (!postre) aviso = 'Este producto ya no existe en el catálogo.';
        else if (!postre.disponible) aviso = 'No disponible por ahora.';
        else if (!variante) aviso = 'Esta presentación ya no existe.';
        else aviso = validarCantidad(postre, linea.cantidad);

        const precio = variante ? variante.precio : 0;
        return {
            ...linea,
            postre,
            nombre: postre ? postre.nombre : 'Producto eliminado',
            imagen: postre ? postre.imagen : '',
            precioUnitario: precio,
            subtotal: redondear(precio * linea.cantidad),
            aviso
        };
    });
    return {
        lineas,
        subtotal: redondear(lineas.reduce((s, l) => s + l.subtotal, 0)),
        valido: lineas.length > 0 && lineas.every((l) => !l.aviso)
    };
}
