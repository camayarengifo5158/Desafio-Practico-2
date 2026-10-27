/* ==========================================================
   PLANTILLAS HTML REUTILIZABLES
   Pequeñas funciones que devuelven fragmentos de HTML. Todo
   texto que viene de los datos pasa por escaparHTML().
   ========================================================== */

import { ESTADOS, CATEGORIAS, METODOS_PAGO, TIPOS_ENTREGA, IMAGEN_POR_DEFECTO } from '../config/app-config.js';
import { escaparHTML, dinero, fecha } from '../logica/formato.js';

export function insigniaEstado(estado) {
    const etiqueta = ESTADOS[estado]?.etiqueta || estado;
    return `<span class="insignia insignia--${escaparHTML(estado)}">${escaparHTML(etiqueta)}</span>`;
}

export function insigniaPago(pagado) {
    return pagado
        ? '<span class="insignia insignia--pagado">Pagado</span>'
        : '<span class="insignia insignia--por-cobrar">Por cobrar</span>';
}

export function nombreCategoria(id) {
    return CATEGORIAS.find((c) => c.id === id)?.nombre || 'Sin categoría';
}

export function textoMetodoPago(metodo) {
    return METODOS_PAGO[metodo] || metodo;
}

export function textoEntrega(entrega) {
    const base = `${TIPOS_ENTREGA[entrega.tipo] || entrega.tipo} · ${fecha(entrega.fecha)}`;
    return entrega.tipo === 'domicilio' ? `${base} · ${entrega.direccion}` : `${base} · ${entrega.sucursal}`;
}

// <option> a partir de un arreglo [{ valor, texto }]
export function opciones(lista, seleccionado) {
    return lista.map(({ valor, texto }) =>
        `<option value="${escaparHTML(valor)}" ${valor === seleccionado ? 'selected' : ''}>${escaparHTML(texto)}</option>`
    ).join('');
}

export function textoPrecios(postre) {
    return postre.variantes.map((v) => `${v.nombre}: ${dinero(v.precio)}`).join(' | ');
}

// Imagen con respaldo si la URL no carga
export function imagenPostre(postre, clase) {
    return `<img class="${clase}" src="${escaparHTML(postre.imagen || IMAGEN_POR_DEFECTO)}" alt="${escaparHTML(postre.nombre)}"
        loading="lazy" onerror="this.onerror=null;this.src='${IMAGEN_POR_DEFECTO}'">`;
}
