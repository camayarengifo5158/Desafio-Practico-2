/* ==========================================================
   FORMATO
   Funciones pequeñas para mostrar dinero, fechas y texto seguro.
   ========================================================== */

const formatoDinero = new Intl.NumberFormat('es-SV', { style: 'currency', currency: 'USD' });

export function dinero(valor) {
    return formatoDinero.format(Number(valor) || 0);
}

export function redondear(valor) {
    return Math.round((Number(valor) || 0) * 100) / 100;
}

export function fecha(iso) {
    if (!iso) return '—';
    // Las fechas de entrega vienen como "AAAA-MM-DD": se leen como fecha local
    const d = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T12:00:00`) : new Date(iso);
    return d.toLocaleDateString('es-SV', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function fechaHora(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('es-SV', {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
}

// Fecha local en formato AAAA-MM-DD (lo que usa <input type="date">)
export function fechaISOLocal(d) {
    const ajustada = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
    return ajustada.toISOString().slice(0, 10);
}

// Evita que texto escrito por usuarios se interprete como HTML (protección XSS)
export function escaparHTML(texto) {
    return String(texto ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

// Quita tildes y pasa a minúsculas para que la búsqueda sea flexible
export function normalizar(texto) {
    return String(texto ?? '')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .trim();
}
