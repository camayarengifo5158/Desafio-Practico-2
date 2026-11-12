/* ARCHIVO: js/logica/formato.js
   FORMATEO, SANITIZACIÓN Y UTILIDADES (Lógica de Negocio)

   ÍNDICE:
   - formatoDinero
   - export dinero()
   - export redondear()
   - export fecha()
   - export fechaHora()
   - export fechaISOLocal()
   - export escaparHTML()
   - export normalizar()
*/

const formatoDinero = new Intl.NumberFormat('es-SV', { style: 'currency', currency: 'USD' });

export function dinero(valor) {
    return formatoDinero.format(Number(valor) || 0);
}

export function redondear(valor) {
    return Math.round((Number(valor) || 0) * 100) / 100;
}

export function fecha(iso) {
    if (!iso) return '—';
    const d = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T12:00:00`) : new Date(iso);
    return d.toLocaleDateString('es-SV', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function fechaHora(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('es-SV', {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
}

export function fechaISOLocal(d) {
    const ajustada = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
    return ajustada.toISOString().slice(0, 10);
}

export function escaparHTML(texto) {
    return String(texto ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

export function normalizar(texto) {
    return String(texto ?? '')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .trim();
}
