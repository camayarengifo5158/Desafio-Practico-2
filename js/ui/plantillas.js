/* ==========================================================
   PLANTILLAS Y COMPONENTES VISUALES HTML (Capa UI)
   Archivo: js/ui/plantillas.js
   ----------------------------------------------------------
   ¿Para qué sirve este archivo?
   Es la "fábrica de etiquetas y fragmentos HTML" reutilizables.
   En vez de concatenar cadenas HTML a mano en cada archivo, aquí
   centralizamos la generación de:
   1. Insignias de colores para estados de pedidos (Pendiente, En preparación, Lista, Entregada, Cancelada).
   2. Insignias de estado de pago (Pagado en verde / Por cobrar en ámbar).
   3. Traducción de códigos internos a nombres legibles (categorías y métodos de pago).
   4. Resúmenes de logística de entrega (sucursal vs domicilio).
   5. Generador dinámico de opciones `<option>` para menús desplegables `<select>`.
   6. Renderizado seguro de imágenes con carga diferida (`loading="lazy"`) y
      mecanismo de respaldo automático (`onerror`) por si una foto se borra del servidor.
   
   Regla de oro:
   Todo texto dinámico pasa estrictamente por `escaparHTML()` para
   garantizar inmunidad contra ataques de inyección XSS.
   ========================================================== */

// Importamos diccionarios de configuración del negocio y la imagen de respaldo
import { ESTADOS, CATEGORIAS, METODOS_PAGO, TIPOS_ENTREGA, IMAGEN_POR_DEFECTO } from '../config/app-config.js';

// Traemos las funciones para sanitizar HTML, dar formato a dólares y fechas
import { escaparHTML, dinero, fecha } from '../logica/formato.js';

/* ----------------------------------------------------------
   insigniaEstado(estado)
   ¿Para qué sirve?
   Genera una pastillita o chip con colores distintivos según la etapa del pedido:
   - Amarillo/Ámbar para "Pendiente"
   - Azul para "En preparación"
   - Morado para "Lista"
   - Verde para "Entregada"
   - Rojo/Gris para "Cancelada"
   ---------------------------------------------------------- */
export function insigniaEstado(estado) {
    const etiqueta = ESTADOS[estado]?.etiqueta || estado;
    return `<span class="insignia insignia--${escaparHTML(estado)}">${escaparHTML(etiqueta)}</span>`;
}

/* ----------------------------------------------------------
   insigniaPago(pagado)
   ¿Para qué sirve?
   Genera una insignia visual rápida para los cajeros y administradores:
   - Verde con "Pagado" si ya se recibió el dinero.
   - Naranja con "Por cobrar" si es un pedido en efectivo pendiente de entrega.
   ---------------------------------------------------------- */
export function insigniaPago(pagado) {
    return pagado
        ? '<span class="insignia insignia--pagado">Pagado</span>'
        : '<span class="insignia insignia--por-cobrar">Por cobrar</span>';
}

/* ----------------------------------------------------------
   nombreCategoria(id)
   ¿Para qué sirve?
   Traduce el código interno (ej. 'tartas') al título comercial
   bonito ('Tartas y Cheesecakes').
   ---------------------------------------------------------- */
export function nombreCategoria(id) {
    return CATEGORIAS.find((c) => c.id === id)?.nombre || 'Sin categoría';
}

/* ----------------------------------------------------------
   textoMetodoPago(metodo)
   ¿Para qué sirve?
   Traduce 'tarjeta' a 'Tarjeta de crédito / débito (Wompi / Pagadito)'.
   ---------------------------------------------------------- */
export function textoMetodoPago(metodo) {
    return METODOS_PAGO[metodo] || metodo;
}

/* ----------------------------------------------------------
   textoEntrega(entrega)
   ¿Para qué sirve?
   Construye un resumen logístico de una sola línea para tablas y tarjetas.
   Ejemplo retiro: "Retiro en tienda · 04 oct 2026 · La Mascota"
   Ejemplo domicilio: "Envío a domicilio · 08 oct 2026 · Col. Escalón #45"
   ---------------------------------------------------------- */
export function textoEntrega(entrega) {
    const base = `${TIPOS_ENTREGA[entrega.tipo] || entrega.tipo} · ${fecha(entrega.fecha)}`;
    return entrega.tipo === 'domicilio' ? `${base} · ${entrega.direccion}` : `${base} · ${entrega.sucursal}`;
}

/* ----------------------------------------------------------
   opciones(lista, seleccionado)
   ¿Para qué sirve?
   Genera una serie de etiquetas `<option value="...">...</option>` a partir
   de un arreglo de objetos `{ valor, texto }`, marcando automáticamente
   con `selected` la que coincida con el valor actual.
   ---------------------------------------------------------- */
export function opciones(lista, seleccionado) {
    return lista.map(({ valor, texto }) =>
        `<option value="${escaparHTML(valor)}" ${valor === seleccionado ? 'selected' : ''}>${escaparHTML(texto)}</option>`
    ).join('');
}

/* ----------------------------------------------------------
   textoPrecios(postre)
   ¿Para qué sirve?
   Genera una línea compacta con todas las presentaciones del postre.
   Ejemplo: "Porción: $4.75 | Entero: $38.00"
   ---------------------------------------------------------- */
export function textoPrecios(postre) {
    return postre.variantes.map((v) => `${v.nombre}: ${dinero(v.precio)}`).join(' | ');
}

/* ----------------------------------------------------------
   imagenPostre(postre, clase)
   ¿Para qué sirve?
   Renderiza la etiqueta `<img>` del postre con 2 optimizaciones clave:
   1. `loading="lazy"`: el navegador no gasta datos descargando la foto
      hasta que el usuario hace scroll y la imagen está por aparecer en pantalla.
   2. `onerror`: si el enlace de la imagen está roto o el archivo fue borrado,
      el evento de error reemplaza la foto al vuelo por `IMAGEN_POR_DEFECTO`
      (un pastelito genérico de respaldo) para que nunca se vea el icono de imagen rota.
   ---------------------------------------------------------- */
export function imagenPostre(postre, clase) {
    return `<img class="${clase}" src="${escaparHTML(postre.imagen || IMAGEN_POR_DEFECTO)}" alt="${escaparHTML(postre.nombre)}"
        loading="lazy" onerror="this.onerror=null;this.src='${IMAGEN_POR_DEFECTO}'">`;
}
