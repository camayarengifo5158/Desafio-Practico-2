/* ==========================================================
   GESTOR DEL CARRITO DE COMPRAS (Lógica de Negocio)
   Archivo: js/logica/carrito.js
   ----------------------------------------------------------
   ¿Para qué sirve este archivo?
   Es la bolsa de compras virtual del cliente mientras navega por la tienda.
   Controla qué productos agrega, cuántas unidades lleva y calcula
   los subtotales en tiempo real.

   Decisión de diseño clave (Arquitectura Segura):
   En `localStorage` solo guardamos lo estrictamente necesario:
   `{ postreId, variante, cantidad }`.
   NUNCA guardamos el precio en el almacenamiento local. ¿Por qué?
   Porque si guardáramos el precio ahí, cualquier usuario con conocimientos
   técnicos podría abrir la consola del navegador, cambiar el precio
   de $42.00 a $0.01 y robarse el pastel.
   
   Aquí los precios se consultan siempre en vivo desde el catálogo
   oficial mediante la función `detallarCarrito()`.
   ========================================================== */

// Traemos la clave para acceder al espacio del carrito en localStorage
import { CLAVES } from '../config/app-config.js';

// Traemos las funciones seguras de lectura y escritura en almacenamiento local
import { leerSync, escribirSync } from '../data/almacenamiento.js';

// Traemos la validación de cantidades (mínimos por producto y límite de 50)
import { validarCantidad } from './validaciones.js';

// Traemos el redondeo a 2 decimales para que las sumas cuadren exactas
import { redondear } from './formato.js';

// Nombre del evento personalizado para sincronizar la interfaz
const EVENTO = 'carrito:cambio';

/* ----------------------------------------------------------
   FUNCIÓN PRIVADA: guardar(carrito)
   ¿Para qué sirve?
   Guarda el arreglo de productos en `localStorage` y de inmediato
   dispara un evento personalizado en el navegador (`carrito:cambio`).
   
   ¿Por qué es genial esto?
   Porque no importa en qué página estés, la campanita o burbujita roja
   del menú superior escucha este evento y se actualiza al instante
   sin necesidad de recargar la página.
   ---------------------------------------------------------- */
function guardar(carrito) {
    escribirSync(CLAVES.carrito, carrito);
    // Disparamos el evento pasando la lista actualizada como detalle
    document.dispatchEvent(new CustomEvent(EVENTO, { detail: carrito }));
    return carrito;
}

/* ----------------------------------------------------------
   alCambiarCarrito(funcion)
   ¿Para qué sirve?
   Permite que cualquier componente de la pantalla (como el contador del menú)
   se "suscriba" para enterarse cada vez que alguien agrega, modifica
   o elimina un postre del carrito.
   ---------------------------------------------------------- */
export function alCambiarCarrito(funcion) {
    document.addEventListener(EVENTO, (e) => funcion(e.detail));
}

/* ----------------------------------------------------------
   obtenerCarrito()
   ¿Para qué sirve?
   Lee la lista de productos guardados en el navegador.
   Si la bolsa está vacía, devuelve un arreglo vacío `[]`.
   ---------------------------------------------------------- */
export function obtenerCarrito() {
    return leerSync(CLAVES.carrito, []);
}

/* ----------------------------------------------------------
   contarUnidades(carrito)
   ¿Para qué sirve?
   Suma todas las unidades de todos los postres en la bolsa.
   Si llevas 2 porciones de Torta y 12 Cake Shooters, devuelve 14.
   Es el número que se dibuja dentro de la bolita roja del carrito en el encabezado.
   ---------------------------------------------------------- */
export function contarUnidades(carrito = obtenerCarrito()) {
    return carrito.reduce((suma, linea) => suma + linea.cantidad, 0);
}

/* ----------------------------------------------------------
   agregarAlCarrito(postre, variante, cantidad)
   ¿Para qué sirve?
   Agrega un postre a la bolsa de compras con validación estricta:
   1. Verifica que el postre esté disponible para la venta.
   2. Verifica que la variante elegida (ej. "Porción" o "Entero") exista.
   3. Si el postre ya estaba en el carrito con esa misma presentación,
      suma la nueva cantidad a la que ya tenía.
   4. Revisa que el acumulado no sobrepase el máximo ni incumpla el mínimo.
   5. Guarda y notifica a la interfaz.
   ---------------------------------------------------------- */
export function agregarAlCarrito(postre, variante, cantidad) {
    if (!postre.disponible) {
        throw new Error(`${postre.nombre} no está disponible en este momento.`);
    }
    if (!postre.variantes.some((v) => v.nombre === variante)) {
        throw new Error('Selecciona una presentación válida.');
    }

    const carrito = obtenerCarrito();
    // Buscamos si ya existía esta misma combinación de postre + variante
    const existente = carrito.find((l) => l.postreId === postre.id && l.variante === variante);
    const cantidadFinal = (existente ? existente.cantidad : 0) + Number(cantidad);

    // Validamos que la cantidad total acumulada sea legal
    const error = validarCantidad(postre, cantidadFinal);
    if (error) throw new Error(error);

    if (existente) {
        existente.cantidad = cantidadFinal;
    } else {
        carrito.push({ postreId: postre.id, variante, cantidad: cantidadFinal });
    }
    return guardar(carrito);
}

/* ----------------------------------------------------------
   actualizarCantidad(postre, variante, cantidad)
   ¿Para qué sirve?
   Permite al cliente cambiar el número de unidades directamente
   desde la cajita numérica de la tabla del carrito.
   ---------------------------------------------------------- */
export function actualizarCantidad(postre, variante, cantidad) {
    const error = validarCantidad(postre, cantidad);
    if (error) throw new Error(error);
    
    const carrito = obtenerCarrito().map((l) =>
        l.postreId === postre.id && l.variante === variante ? { ...l, cantidad: Number(cantidad) } : l
    );
    return guardar(carrito);
}

/* ----------------------------------------------------------
   quitarDelCarrito(postreId, variante)
   ¿Para qué sirve?
   Elimina una fila específica del carrito (cuando el usuario
   hace clic en el icono del basurero o la X).
   ---------------------------------------------------------- */
export function quitarDelCarrito(postreId, variante) {
    return guardar(obtenerCarrito().filter((l) => !(l.postreId === postreId && l.variante === variante)));
}

/* ----------------------------------------------------------
   vaciarCarrito()
   ¿Para qué sirve?
   Borra todo el contenido de la bolsa de compras. Se ejecuta
   automáticamente cuando el pedido se confirma con éxito
   o cuando el usuario cierra su sesión.
   ---------------------------------------------------------- */
export function vaciarCarrito() {
    return guardar([]);
}

/* ----------------------------------------------------------
   detallarCarrito(postres, carrito)
   ¿Para qué sirve?
   Es el "cruzador de información" más importante del carrito:
   Toma la lista simple de compras `{ postreId, variante, cantidad }`
   y la combina con el catálogo oficial `postres` traído de Firestore.
   
   ¿Qué calcula y detecta?
   - Asigna el precio real y la foto actual del postre.
   - Calcula el subtotal de cada fila (`precio * cantidad`).
   - Calcula la suma total de la compra.
   - Detección de anomalías en tiempo real:
     * Si el postre fue borrado del menú mientras el cliente compraba.
     * Si el postre fue marcado como no disponible (agotado).
     * Si la presentación elegida ya no existe.
     * Si la cantidad elegida viola el mínimo requerido.
   - Devuelve un booleano `valido`: true solo si hay productos y NINGUNO
     tiene avisos de advertencia. Si `valido === false`, el botón de pago
     se desactiva para no dejar pasar una orden rota.
   ---------------------------------------------------------- */
export function detallarCarrito(postres, carrito = obtenerCarrito()) {
    const lineas = carrito.map((linea) => {
        const postre = postres.find((p) => p.id === linea.postreId);
        const variante = postre?.variantes.find((v) => v.nombre === linea.variante);
        let aviso = null;

        // Detección de inconsistencias
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
