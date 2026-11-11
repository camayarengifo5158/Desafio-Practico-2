/* ==========================================================
   PÁGINAS GENERALES E INFORMATIVAS (Capa UI)
   Archivo: js/ui/pagina-general.js
   ----------------------------------------------------------
   ¿Para qué sirve este archivo?
   Es el controlador liviano para las páginas públicas y estáticas
   del sitio web:
   - index.html (Página principal / Portada)
   - nosotros.html (Sobre la historia y valores de Fragola)
   - contacto.html (Ubicaciones, teléfonos y formulario de contacto)

   ¿Qué hace?
   Simplemente llama a `iniciarPagina()`. Esto se encarga de:
   1. Leer la sesión activa en el navegador.
   2. Pintar el saludo del usuario o el botón "Ingresar" en el encabezado.
   3. Conectar el contador numérico del carrito.
   4. Mostrar cualquier notificación toast pendiente.
   ========================================================== */

import { iniciarPagina } from './comun.js';

// Iniciamos la página pública (sin requerir autenticación)
iniciarPagina();
