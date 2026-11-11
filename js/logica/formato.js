/* ==========================================================
   FORMATEO, SANITIZACIÓN Y UTILIDADES (Lógica de Negocio)
   Archivo: js/logica/formato.js
   ----------------------------------------------------------
   ¿Para qué sirve este archivo?
   Es el "traductor y pulidor visual" de datos. Contiene pequeñas
   funciones que se encargan de tres tareas esenciales:
   1. Presentación visual: convertir números crudos como `4.75` en
      moneda formal como `$4.75`, y fechas ISO de base de datos
      en texto legible en español salvadoreño (ej. `04 oct 2026`).
   2. Seguridad web (Protección XSS): limpiar textos escritos por usuarios
      para que si alguien escribe `<script>` en una nota o en su nombre,
      no se ejecute código malicioso en el navegador de los demás.
   3. Búsqueda inteligente: quitar tildes y mayúsculas para que si el
      cliente busca "tiramisu" sin tilde, encuentre "Healthy Tiramisú".
   ========================================================== */

// Configuramos el formateador oficial de moneda para El Salvador (USD) usando la API nativa Intl
const formatoDinero = new Intl.NumberFormat('es-SV', { style: 'currency', currency: 'USD' });

/* ----------------------------------------------------------
   dinero(valor)
   ¿Para qué sirve?
   Toma un número (o texto numérico) y lo convierte en formato
   de dólares con su signo `$`, comas de miles y dos decimales.
   Ejemplo: `1250.5` -> `$1,250.50`
   ---------------------------------------------------------- */
export function dinero(valor) {
    return formatoDinero.format(Number(valor) || 0);
}

/* ----------------------------------------------------------
   redondear(valor)
   ¿Para qué sirve?
   Evita el famoso problema de los números flotantes en JavaScript
   (donde `0.1 + 0.2 === 0.30000000000000004`).
   Multiplica por 100, redondea al entero más cercano y divide entre 100.
   Garantiza que ningún centavo quede flotando en el aire.
   ---------------------------------------------------------- */
export function redondear(valor) {
    return Math.round((Number(valor) || 0) * 100) / 100;
}

/* ----------------------------------------------------------
   fecha(iso)
   ¿Para qué sirve?
   Convierte una fecha en formato ISO (ej: '2026-10-04') en una
   fecha corta y bonita para las tarjetas y tablas (ej: '04 oct 2026').
   
   Detalle técnico importante sobre zonas horarias:
   Si la fecha viene como "AAAA-MM-DD", forzamos la hora a las 12:00 del mediodía
   (`T12:00:00`) antes de convertirla. Esto evita que por diferencias de zona
   horaria con UTC, la fecha se retrase un día al mostrarse en El Salvador (GMT-6).
   ---------------------------------------------------------- */
export function fecha(iso) {
    if (!iso) return '—';
    const d = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T12:00:00`) : new Date(iso);
    return d.toLocaleDateString('es-SV', { day: '2-digit', month: 'short', year: 'numeric' });
}

/* ----------------------------------------------------------
   fechaHora(iso)
   ¿Para qué sirve?
   Convierte una marca de tiempo completa en fecha y hora legible.
   Se usa en el historial de pedidos y en las notas de auditoría.
   Ejemplo: '2026-10-02T15:20:00.000Z' -> '02 oct 2026, 03:20 p. m.'
   ---------------------------------------------------------- */
export function fechaHora(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('es-SV', {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
}

/* ----------------------------------------------------------
   fechaISOLocal(d)
   ¿Para qué sirve?
   Obtiene la fecha local actual ajustada por la diferencia de zona horaria
   en formato estricto `AAAA-MM-DD`.
   Es el formato exacto que exigen los campos `<input type="date">` de HTML5
   para fijar el atributo `min` de los calendarios de entrega.
   ---------------------------------------------------------- */
export function fechaISOLocal(d) {
    const ajustada = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
    return ajustada.toISOString().slice(0, 10);
}

/* ----------------------------------------------------------
   escaparHTML(texto)
   ¿Para qué sirve? (CRÍTICO PARA SEGURIDAD / XSS)
   Esta función es el escudo contra ataques Cross-Site Scripting (XSS).
   Si un usuario travieso escribe en las notas de entrega:
   `<script>alert('hackeado')</script>`
   Esta función reemplaza los caracteres peligrosos por sus entidades HTML seguras:
   - `<` se convierte en `&lt;`
   - `>` se convierte en `&gt;`
   - `"` se convierte en `&quot;`
   - `'` se convierte en `&#39;`
   - `&` se convierte en `&amp;`
   
   Así el navegador muestra el texto como texto plano inofensivo
   y jamás lo ejecuta como código de programación.
   ---------------------------------------------------------- */
export function escaparHTML(texto) {
    return String(texto ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

/* ----------------------------------------------------------
   normalizar(texto)
   ¿Para qué sirve?
   Prepara cualquier palabra para comparaciones de búsqueda flexibles:
   1. `normalize('NFD')`: descompone letras con tilde en la letra base + el acento.
   2. `replace(/[̀-ͯ]/g, '')`: borra los acentos diacríticos.
   3. `toLowerCase()`: pasa todo a minúsculas.
   4. `trim()`: quita espacios en las orillas.
   
   Gracias a esto, si buscas "limon", el buscador encontrará "Limón"
   sin importar mayúsculas ni acentos.
   ---------------------------------------------------------- */
export function normalizar(texto) {
    return String(texto ?? '')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .trim();
}
