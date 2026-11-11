/* ==========================================================
   PROCESAMIENTO Y TRANSFORMACIÓN DE DATOS (Lógica de Negocio)
   Archivo: js/logica/procesamiento.js
   ----------------------------------------------------------
   ¿Para qué sirve este archivo?
   Es la "calculadora analítica y motor de búsqueda" del sistema.
   Contiene funciones puras (Pure Functions):
   - Reciben arreglos de datos como entrada.
   - Devuelven arreglos filtrados, ordenados o métricas calculadas como salida.
   - NUNCA tocan el DOM (pantalla) ni la base de datos directamente.
   - NUNCA modifican el arreglo original recibido (trabajan sobre copias con `[...]`),
     lo que evita efectos secundarios y bugs misteriosos.

   Aquí residen:
   1. Búsqueda y filtrado multi-criterio de postres y pedidos.
   2. Ordenamientos alfabéticos, por fecha y por precio.
   3. Agrupación por categorías para el catálogo visual.
   4. Cálculo de KPIs financieros y de negocio para el Panel de Administración
      (ventas totales, dinero cobrado, dinero por cobrar, ticket promedio y postres más vendidos).
   ========================================================== */

// Importamos las categorías oficiales y los estados del flujo de pedidos
import { CATEGORIAS, ESTADOS } from '../config/app-config.js';

// Importamos la función de limpieza de texto (sin tildes) y la de redondeo a 2 decimales
import { normalizar, redondear } from './formato.js';

// ==========================================================
// 1. PROCESAMIENTO DE POSTRES (Catálogo y Tienda)
// ==========================================================

/* ----------------------------------------------------------
   precioDesde(postre)
   ¿Para qué sirve?
   Encuentra el precio más bajo entre todas las presentaciones de un postre.
   Por ejemplo, si el Cheesecake tiene porción a $5.50 y entero a $42.00,
   esta función devuelve $5.50.
   Se usa para mostrar en la tarjeta: "Desde $5.50" y para ordenar de menor a mayor.
   ---------------------------------------------------------- */
export function precioDesde(postre) {
    return Math.min(...postre.variantes.map((v) => v.precio));
}

/* ----------------------------------------------------------
   buscarPostres(postres, texto)
   ¿Para qué sirve?
   Filtra la lista de postres según lo que el usuario escribe en la cajita de búsqueda.
   Compara tanto contra el nombre como contra la descripción.
   Ambos textos se pasan por `normalizar()` para que no importen mayúsculas ni tildes.
   ---------------------------------------------------------- */
export function buscarPostres(postres, texto) {
    const consulta = normalizar(texto);
    // Si la cajita de búsqueda está vacía, devuelve todos los postres sin filtrar
    if (!consulta) return postres;
    return postres.filter((p) =>
        normalizar(`${p.nombre} ${p.descripcion}`).includes(consulta)
    );
}

/* ----------------------------------------------------------
   filtrarPostres(postres, opciones)
   ¿Para qué sirve?
   Permite aplicar filtros combinados:
   - Por categoría: 'todas', 'tartas', 'individuales', etc.
   - Por disponibilidad: si `soloDisponibles === true`, oculta los postres agotados.
   ---------------------------------------------------------- */
export function filtrarPostres(postres, { categoria = 'todas', soloDisponibles = false } = {}) {
    return postres.filter((p) =>
        (categoria === 'todas' || p.categoria === categoria) &&
        (!soloDisponibles || p.disponible)
    );
}

/* ----------------------------------------------------------
   ordenarPostres(postres, criterio)
   ¿Para qué sirve?
   Reordena las tarjetas del catálogo según la opción elegida por el usuario:
   - 'precio-asc': del más barato al más caro.
   - 'precio-desc': del más caro al más barato.
   - 'recientes': los últimos postres agregados o modificados primero.
   - 'nombre': orden alfabético A-Z usando `localeCompare('es')` (respeta el alfabeto en español).

   Nota pedagógica: Usamos `[...postres]` para clonar el arreglo,
   porque el método `.sort()` nativo de JavaScript altera el arreglo original.
   ---------------------------------------------------------- */
export function ordenarPostres(postres, criterio = 'nombre') {
    const copia = [...postres];
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

/* ----------------------------------------------------------
   agruparPorCategoria(postres)
   ¿Para qué sirve?
   Organiza los postres en bloques por categoría para pintarlos
   en el catálogo con sus respectivos encabezados y separadores.
   - Respeta el orden visual definido en CATEGORIAS.
   - Si una categoría no tiene postres en ese momento, la descarta para no mostrar secciones vacías.
   ---------------------------------------------------------- */
export function agruparPorCategoria(postres) {
    return CATEGORIAS
        .map((categoria) => ({ 
            categoria, 
            postres: postres.filter((p) => p.categoria === categoria.id) 
        }))
        .filter((grupo) => grupo.postres.length > 0);
}

// ==========================================================
// 2. PROCESAMIENTO DE TRANSACCIONES (Pedidos y Auditoría)
// ==========================================================

/* ----------------------------------------------------------
   filtrarTransacciones(transacciones, opciones)
   ¿Para qué sirve?
   Es el motor de filtrado de la tabla de pedidos del Administrador y de "Mis Pedidos":
   - Búsqueda por texto: busca coincidencias en el folio (FRG-...), nombre del cliente o correo.
   - Filtro por estado: 'todos', 'pendiente', 'en_preparacion', 'lista', 'entregada', 'cancelada'.
   - Rango de fechas: filtra pedidos creados `desde` y `hasta` una fecha determinada.
   ---------------------------------------------------------- */
export function filtrarTransacciones(transacciones, { texto = '', estado = 'todos', desde = '', hasta = '' } = {}) {
    const consulta = normalizar(texto);
    return transacciones.filter((t) => {
        // Obtenemos solo la fecha AAAA-MM-DD del pedido
        const dia = t.creadaEn.slice(0, 10);
        
        // Coincidencia con folio, nombre o email
        const coincideTexto = !consulta ||
            normalizar(`${t.folio} ${t.clienteNombre} ${t.clienteEmail}`).includes(consulta);
            
        return coincideTexto &&
            (estado === 'todos' || t.estado === estado) &&
            (!desde || dia >= desde) &&
            (!hasta || dia <= hasta);
    });
}

/* ----------------------------------------------------------
   ordenarTransacciones(transacciones, criterio)
   ¿Para qué sirve?
   Ordena las órdenes según la necesidad del operador:
   - 'recientes': pedidos más nuevos primero (por defecto).
   - 'antiguas': pedidos más antiguos primero.
   - 'total-desc': pedidos de mayor valor económico primero.
   - 'total-asc': pedidos de menor valor primero.
   - 'entrega': pedidos según la fecha programada para entrega (ideal para organizar la cocina).
   ---------------------------------------------------------- */
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

// ==========================================================
// 3. INDICADORES DE NEGOCIO (KPIs del Panel de Control)
// ==========================================================

/* ----------------------------------------------------------
   calcularIndicadores(transacciones)
   ¿Para qué sirve? (MUY IMPORTANTE EN LA EVALUACIÓN ORAL)
   Genera todas las métricas de inteligencia de negocio que se
   muestran en el resumen ejecutivo del administrador:
   
   1. `pedidosValidos`: Excluye los pedidos cancelados (una venta cancelada
      no debe inflar las ventas de la empresa).
   2. `ventasTotales`: Suma del total de todos los pedidos válidos usando `.reduce()`.
   3. `cobrado`: Dinero efectivamente recibido (pagos con tarjeta, transferencias o entregas pagadas).
   4. `porCobrar`: Ventas totales menos lo cobrado (pedidos pendientes en efectivo).
   5. `ticketPromedio`: Cuánto gasta un cliente en promedio por pedido (`ventas / validas.length`).
   6. `activos`: Pedidos que requieren acción inmediata en cocina ('pendiente', 'en_preparacion', 'lista').
   7. `porEstado`: Desglose cuantitativo de pedidos por cada etapa del flujo.
   8. `porCategoria`: Ventas en dólares desglosadas por categoría de postre usando `.flatMap()` y `.reduce()`.
   9. `topPostres`: Los 5 postres más vendidos ordenados por unidades totales despachadas
      utilizando una estructura de datos `Map` para máxima eficiencia algorítmica.
   ---------------------------------------------------------- */
export function calcularIndicadores(transacciones) {
    // Descartamos cancelados para no falsear ingresos
    const validas = transacciones.filter((t) => t.estado !== 'cancelada');
    
    // Sumamos el valor total de todas las ventas válidas
    const ventasTotales = redondear(validas.reduce((s, t) => s + t.total, 0));
    
    // Sumamos únicamente lo que ya fue pagado
    const cobrado = redondear(validas.filter((t) => t.pagado).reduce((s, t) => s + t.total, 0));

    // Conteo de pedidos por cada uno de los estados posibles
    const porEstado = Object.keys(ESTADOS).map((clave) => ({
        estado: clave,
        etiqueta: ESTADOS[clave].etiqueta,
        cantidad: transacciones.filter((t) => t.estado === clave).length
    }));

    // Agrupación de ventas en dólares por categoría usando flatMap + reduce
    const acumulado = validas.flatMap((t) => t.items).reduce((mapa, item) => {
        mapa[item.categoria] = (mapa[item.categoria] || 0) + item.subtotal;
        return mapa;
    }, {});
    
    const porCategoria = CATEGORIAS.map((c) => ({ 
        nombre: c.nombre, 
        total: redondear(acumulado[c.id] || 0) 
    })).sort((a, b) => b.total - a.total);

    // Ranking de los postres más vendidos por unidades despachadas
    const porPostre = validas.flatMap((t) => t.items).reduce((mapa, item) => {
        const actual = mapa.get(item.nombre) || { nombre: item.nombre, unidades: 0, total: 0 };
        actual.unidades += item.cantidad;
        actual.total = redondear(actual.total + item.subtotal);
        mapa.set(item.nombre, actual);
        return mapa;
    }, new Map());
    
    // Tomamos los primeros 5 más vendidos
    const topPostres = [...porPostre.values()].sort((a, b) => b.unidades - a.unidades).slice(0, 5);

    // Devolvemos el reporte consolidado
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
