/* ==========================================================
   PROCESAMIENTO DE DATOS
   Funciones "puras": reciben arreglos y devuelven arreglos o
   resultados nuevos, sin tocar el DOM ni el almacenamiento.
   Aquí están la búsqueda, el filtrado, el ordenamiento, la
   agrupación y el cálculo de indicadores.
   ========================================================== */

import { CATEGORIAS, ESTADOS } from '../config/app-config.js';
import { normalizar, redondear } from './formato.js';

// ---------- Postres ----------

export function precioDesde(postre) {
    return Math.min(...postre.variantes.map((v) => v.precio));
}

export function buscarPostres(postres, texto) {
    const consulta = normalizar(texto);
    if (!consulta) return postres;
    return postres.filter((p) =>
        normalizar(`${p.nombre} ${p.descripcion}`).includes(consulta)
    );
}

export function filtrarPostres(postres, { categoria = 'todas', soloDisponibles = false } = {}) {
    return postres.filter((p) =>
        (categoria === 'todas' || p.categoria === categoria) &&
        (!soloDisponibles || p.disponible)
    );
}

export function ordenarPostres(postres, criterio = 'nombre') {
    const copia = [...postres]; // sort modifica el arreglo, por eso trabajamos sobre una copia
    switch (criterio) {
        case 'precio-asc':
            return copia.sort((a, b) => precioDesde(a) - precioDesde(b));
        case 'precio-desc':
            return copia.sort((a, b) => precioDesde(b) - precioDesde(a));
        case 'recientes':
            return copia.sort((a, b) => b.actualizadoEn.localeCompare(a.actualizadoEn));
        default:
            return copia.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    }
}

// Devuelve [{ categoria, postres: [...] }] respetando el orden de CATEGORIAS
export function agruparPorCategoria(postres) {
    return CATEGORIAS
        .map((categoria) => ({ categoria, postres: postres.filter((p) => p.categoria === categoria.id) }))
        .filter((grupo) => grupo.postres.length > 0);
}

// ---------- Transacciones ----------

export function filtrarTransacciones(transacciones, { texto = '', estado = 'todos', desde = '', hasta = '' } = {}) {
    const consulta = normalizar(texto);
    return transacciones.filter((t) => {
        const dia = t.creadaEn.slice(0, 10);
        const coincideTexto = !consulta ||
            normalizar(`${t.folio} ${t.clienteNombre} ${t.clienteEmail}`).includes(consulta);
        return coincideTexto &&
            (estado === 'todos' || t.estado === estado) &&
            (!desde || dia >= desde) &&
            (!hasta || dia <= hasta);
    });
}

export function ordenarTransacciones(transacciones, criterio = 'recientes') {
    const copia = [...transacciones];
    switch (criterio) {
        case 'antiguas': return copia.sort((a, b) => a.creadaEn.localeCompare(b.creadaEn));
        case 'total-desc': return copia.sort((a, b) => b.total - a.total);
        case 'total-asc': return copia.sort((a, b) => a.total - b.total);
        case 'entrega': return copia.sort((a, b) => a.entrega.fecha.localeCompare(b.entrega.fecha));
        default: return copia.sort((a, b) => b.creadaEn.localeCompare(a.creadaEn));
    }
}

// Indicadores del negocio. Las ventas canceladas no cuentan como ingreso.
export function calcularIndicadores(transacciones) {
    const validas = transacciones.filter((t) => t.estado !== 'cancelada');
    const ventasTotales = redondear(validas.reduce((s, t) => s + t.total, 0));
    const cobrado = redondear(validas.filter((t) => t.pagado).reduce((s, t) => s + t.total, 0));

    // Conteo por estado
    const porEstado = Object.keys(ESTADOS).map((clave) => ({
        estado: clave,
        etiqueta: ESTADOS[clave].etiqueta,
        cantidad: transacciones.filter((t) => t.estado === clave).length
    }));

    // Agrupación de ventas por categoría con reduce
    const acumulado = validas.flatMap((t) => t.items).reduce((mapa, item) => {
        mapa[item.categoria] = (mapa[item.categoria] || 0) + item.subtotal;
        return mapa;
    }, {});
    const porCategoria = CATEGORIAS.map((c) => ({ nombre: c.nombre, total: redondear(acumulado[c.id] || 0) }))
        .sort((a, b) => b.total - a.total);

    // Postres más vendidos (por unidades)
    const porPostre = validas.flatMap((t) => t.items).reduce((mapa, item) => {
        const actual = mapa.get(item.nombre) || { nombre: item.nombre, unidades: 0, total: 0 };
        actual.unidades += item.cantidad;
        actual.total = redondear(actual.total + item.subtotal);
        mapa.set(item.nombre, actual);
        return mapa;
    }, new Map());
    const topPostres = [...porPostre.values()].sort((a, b) => b.unidades - a.unidades).slice(0, 5);

    return {
        pedidos: transacciones.length,
        pedidosValidos: validas.length,
        ventasTotales,
        cobrado,
        porCobrar: redondear(ventasTotales - cobrado),
        ticketPromedio: validas.length ? redondear(ventasTotales / validas.length) : 0,
        activos: transacciones.filter((t) => ['pendiente', 'en_preparacion', 'lista'].includes(t.estado)).length,
        porEstado,
        porCategoria,
        topPostres
    };
}
