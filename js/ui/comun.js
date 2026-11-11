/* ==========================================================
   UTILIDADES COMUNES DE INTERFAZ DE USUARIO (Capa UI)
   Archivo: js/ui/comun.js
   ----------------------------------------------------------
   ¿Para qué sirve este archivo?
   Es la "caja de herramientas visual" compartida por todas las
   páginas del sitio web. En vez de reinventar la rueda en cada
   pantalla, aquí centralizamos:
   1. Control de acceso por página (guards de navegación para proteger
      rutas privadas como el Panel de Administración).
   2. Menú de navegación interactivo con estado de sesión y carrito.
   3. Notificaciones flotantes (Toasts de éxito, advertencia y error).
   4. Mensajes persistentes entre páginas (Flash messages con `sessionStorage`).
   5. Estados visuales estándar: "Cargando…", "No hay datos" y "Error de conexión".
   6. Protección contra doble clic en botones asíncronos (`conCarga`).
   7. Modales de confirmación accesibles usando la etiqueta nativa `<dialog>`.
   8. Resaltado de errores por campo en formularios con accesibilidad `aria-invalid`.
   ========================================================== */

// Importamos la sesión actual, la acción de cerrar sesión y la clase de error de permisos
import { usuarioActual, cerrarSesion, ErrorAutorizacion } from '../data/auth.js';

// Traemos el contador de productos del carrito y el escuchador de eventos
import { contarUnidades, alCambiarCarrito } from '../logica/carrito.js';

// Traemos la función de protección contra ataques XSS
import { escaparHTML } from '../logica/formato.js';

// Traemos los roles permitidos en el sistema
import { ROLES } from '../config/app-config.js';

// ==========================================================
// 1. INICIALIZACIÓN DE PÁGINA Y GUARDIAS DE NAVEGACIÓN
// ==========================================================

/* ----------------------------------------------------------
   iniciarPagina({ requiere })
   ¿Para qué sirve?
   Es lo PRIMERO que ejecuta cualquier página al cargarse:
   - Si `requiere = null`: la página es pública (ej. Inicio o Catálogo).
   - Si `requiere = 'sesion'`: exige que haya un usuario conectado. Si no lo hay,
     lo manda a `ingresar.html` guardando en la URL la página a la que quería ir
     (`?volver=...`) para devolverlo ahí una vez inicie sesión.
   - Si `requiere = 'admin'`: exige rol de Administrador. Si un cliente común
     intenta entrar directamente escribiendo "admin.html" en la barra de direcciones,
     el sistema lo rebota inmediatamente a sus pedidos con una advertencia.
   - Pinta el menú de usuario en la barra superior.
   - Conecta el contador del carrito.
   - Muestra cualquier mensaje pendiente guardado en la sesión anterior.
   ---------------------------------------------------------- */
export function iniciarPagina({ requiere = null } = {}) {
    const usuario = usuarioActual();

    // Filtro 1: Requiere sesión pero no hay nadie conectado
    if (requiere && !usuario) {
        const volver = encodeURIComponent(location.pathname.split('/').pop() + location.search);
        location.replace(`ingresar.html?volver=${volver}`);
        return null;
    }

    // Filtro 2: Requiere administrador pero es un cliente común
    if (requiere === 'admin' && usuario.rol !== ROLES.ADMIN) {
        location.replace('pedidos.html?aviso=sin-permiso');
        return null;
    }

    // Dibujamos la barra de navegación según el estado de la sesión
    pintarSesionEnCabecera(usuario);

    // Conectamos el contador del carrito para que cambie en vivo
    alCambiarCarrito(() => actualizarContadorCarrito());

    // Mostramos cualquier aviso pendiente (ej. "¡Bienvenido de nuevo!")
    mostrarAvisoPendiente();

    return usuario;
}

/* ----------------------------------------------------------
   pintarSesionEnCabecera(usuario)
   ¿Para qué sirve?
   Genera el HTML del área de usuario en el menú superior:
   - Si es visitante anónimo: muestra el botón "Ingresar" y el carrito.
   - Si inició sesión: muestra un menú desplegable `<details>` con su primer nombre,
     su etiqueta de rol ("admin" si aplica), acceso a "Mis pedidos", acceso al
     "Panel de administración" (solo si es admin) y el botón de "Cerrar sesión".
   ---------------------------------------------------------- */
function pintarSesionEnCabecera(usuario) {
    const zona = document.querySelector('[data-nav-sesion]');
    if (!zona) return;

    // Botón del carrito con su contador numérico
    const carrito = `
        <a class="nav-sesion__carrito" href="catalogo.html#carrito" data-abrir-carrito aria-label="Ver carrito">
            Carrito <span class="nav-sesion__contador" data-contador-carrito>0</span>
        </a>`;

    if (!usuario) {
        zona.innerHTML = `${carrito}<a class="nav-sesion__enlace" href="ingresar.html">Ingresar</a>`;
    } else {
        // Obtenemos solo el primer nombre y lo sanitizamos contra XSS
        const primerNombre = escaparHTML(usuario.nombre.split(' ')[0]);
        const enlaceAdmin = usuario.rol === ROLES.ADMIN
            ? '<li><a href="admin.html">Panel de administración</a></li>' : '';
            
        zona.innerHTML = `
            ${carrito}
            <details class="nav-sesion__menu">
                <summary>Hola, ${primerNombre}${usuario.rol === ROLES.ADMIN ? ' <span class="etiqueta-rol">admin</span>' : ''}</summary>
                <ul>
                    ${enlaceAdmin}
                    <li><a href="pedidos.html">Mis pedidos</a></li>
                    <li><button type="button" data-cerrar-sesion>Cerrar sesión</button></li>
                </ul>
            </details>`;

        // Conectamos el botón de cerrar sesión
        zona.querySelector('[data-cerrar-sesion]').addEventListener('click', async (e) => {
            e.target.disabled = true;
            e.target.textContent = 'Cerrando…';
            await cerrarSesion();
            location.href = 'index.html';
        });
    }
    actualizarContadorCarrito();
}

/* ----------------------------------------------------------
   actualizarContadorCarrito()
   Refresca el número en la burbujita del carrito en el encabezado.
   ---------------------------------------------------------- */
function actualizarContadorCarrito() {
    const contador = document.querySelector('[data-contador-carrito]');
    if (contador) contador.textContent = contarUnidades();
}

// ==========================================================
// 2. SISTEMA DE AVISOS Y NOTIFICACIONES (Toasts Flotantes)
// ==========================================================

/* ----------------------------------------------------------
   contenedorToasts()
   Crea o recupera el contenedor flotante en el body para
   apilar los mensajes de notificación.
   Usa `role="status"` y `aria-live="polite"` para que lectores
   de pantalla para personas ciegas puedan anunciar los mensajes.
   ---------------------------------------------------------- */
function contenedorToasts() {
    let zona = document.querySelector('.toasts');
    if (!zona) {
        zona = document.createElement('div');
        zona.className = 'toasts';
        zona.setAttribute('role', 'status');
        zona.setAttribute('aria-live', 'polite');
        document.body.appendChild(zona);
    }
    return zona;
}

/* ----------------------------------------------------------
   mostrarToast(mensaje, tipo)
   ¿Para qué sirve?
   Hace aparecer un mensajito flotante temporal en la pantalla:
   - tipos disponibles: 'exito' (verde), 'error' (rojo), 'info' (azul).
   - Se autodestruye suavemente con una animación CSS después de 4 segundos.
   ---------------------------------------------------------- */
export function mostrarToast(mensaje, tipo = 'exito') {
    const toast = document.createElement('div');
    toast.className = `toast toast--${tipo}`;
    toast.textContent = mensaje;
    contenedorToasts().appendChild(toast);
    
    // Animación de salida a los 3.8s y eliminación del DOM a los 4.2s
    setTimeout(() => toast.classList.add('toast--saliendo'), 3800);
    setTimeout(() => toast.remove(), 4200);
}

/* ----------------------------------------------------------
   avisarAlLlegar(mensaje, tipo) y mostrarAvisoPendiente()
   ¿Para qué sirve? (Patrón Flash Message)
   A veces haces una acción y de inmediato la página se redirige a otra
   (por ejemplo, al iniciar sesión te redirige al inicio). Si mostraras
   el toast en ese momento, desaparecería en un milisegundo por la recarga.
   
   Esta función guarda el mensaje en `sessionStorage` antes de viajar,
   y la siguiente página lo lee, lo muestra y lo borra para que no se repita.
   ---------------------------------------------------------- */
export function avisarAlLlegar(mensaje, tipo = 'exito') {
    sessionStorage.setItem('fragola.aviso', JSON.stringify({ mensaje, tipo }));
}

function mostrarAvisoPendiente() {
    const pendiente = sessionStorage.getItem('fragola.aviso');
    if (!pendiente) return;
    sessionStorage.removeItem('fragola.aviso');
    const { mensaje, tipo } = JSON.parse(pendiente);
    mostrarToast(mensaje, tipo);
}

/* ----------------------------------------------------------
   mensajeDeError(error)
   Traduce excepciones técnicas a mensajes amigables en español.
   ---------------------------------------------------------- */
export function mensajeDeError(error) {
    if (error instanceof ErrorAutorizacion) return `Acceso denegado: ${error.message}`;
    return error?.message || 'Ocurrió un error inesperado. Intenta de nuevo.';
}

// ==========================================================
// 3. ESTADOS VISUALES DE CONTENEDORES (Cargando / Vacío / Error)
// ==========================================================

/* ----------------------------------------------------------
   mostrarCargando(contenedor, texto)
   Muestra un spinner circular animado mientras llegan los datos de Firestore.
   ---------------------------------------------------------- */
export function mostrarCargando(contenedor, texto = 'Cargando…') {
    contenedor.setAttribute('aria-busy', 'true');
    contenedor.innerHTML = `
        <div class="estado estado--cargando">
            <span class="spinner" aria-hidden="true"></span>
            <p>${escaparHTML(texto)}</p>
        </div>`;
}

/* ----------------------------------------------------------
   mostrarVacio(contenedor, titulo, texto, accionHTML)
   Muestra un estado amigable cuando no hay registros
   (ej. "Aún no tienes pedidos", con un botón "Explorar catálogo").
   ---------------------------------------------------------- */
export function mostrarVacio(contenedor, titulo, texto = '', accionHTML = '') {
    contenedor.removeAttribute('aria-busy');
    contenedor.innerHTML = `
        <div class="estado estado--vacio">
            <p class="estado__titulo">${escaparHTML(titulo)}</p>
            ${texto ? `<p>${escaparHTML(texto)}</p>` : ''}
            ${accionHTML}
        </div>`;
}

/* ----------------------------------------------------------
   mostrarError(contenedor, error, alReintentar)
   Muestra una alerta con un botón para reintentar la operación si falló el internet.
   ---------------------------------------------------------- */
export function mostrarError(contenedor, error, alReintentar) {
    contenedor.removeAttribute('aria-busy');
    contenedor.innerHTML = `
        <div class="estado estado--error" role="alert">
            <p class="estado__titulo">No pudimos cargar la información</p>
            <p>${escaparHTML(mensajeDeError(error))}</p>
            ${alReintentar ? '<button type="button" class="boton boton--secundario" data-reintentar>Reintentar</button>' : ''}
        </div>`;
    if (alReintentar) {
        contenedor.querySelector('[data-reintentar]').addEventListener('click', alReintentar);
    }
}

// ==========================================================
// 4. PREVENCIÓN DE DOBLE CLIC Y ASINCRONISMO
// ==========================================================

/* ----------------------------------------------------------
   conCarga(boton, textoCargando, operacion)
   ¿Para qué sirve?
   Evita que un usuario ansioso haga 5 clics seguidos en "Confirmar pedido"
   y mande 5 compras duplicadas.
   - Deshabilita el botón de inmediato.
   - Cambia su texto a "Guardando…" con un mini spinner.
   - Ejecuta la operación asíncrona.
   - En el bloque `finally` (pase lo que pase, con éxito o con error),
     restaura el botón a su estado original.
   ---------------------------------------------------------- */
export async function conCarga(boton, textoCargando, operacion) {
    const textoOriginal = boton.innerHTML;
    boton.disabled = true;
    boton.innerHTML = `<span class="spinner spinner--pequeno" aria-hidden="true"></span> ${escaparHTML(textoCargando)}`;
    try {
        return await operacion();
    } finally {
        boton.disabled = false;
        boton.innerHTML = textoOriginal;
    }
}

// ==========================================================
// 5. VENTANAS MODALES DE CONFIRMACIÓN (<dialog>)
// ==========================================================

/* ----------------------------------------------------------
   confirmar(mensaje, opciones)
   ¿Para qué sirve?
   Reemplaza el feo y bloqueante `window.confirm()` del navegador
   por una ventana modal moderna construida con el estándar HTML5 `<dialog>`.
   Devuelve una Promesa que se resuelve en `true` si el usuario aceptó
   o `false` si hizo clic en "Volver" o presionó la tecla Escape.
   ---------------------------------------------------------- */
export function confirmar(mensaje, { titulo = '¿Estás seguro?', textoAceptar = 'Confirmar', peligro = false } = {}) {
    return new Promise((resolver) => {
        const dialogo = document.createElement('dialog');
        dialogo.className = 'dialogo dialogo--pequeno';
        dialogo.innerHTML = `
            <form method="dialog" class="dialogo__cuerpo">
                <h2 class="dialogo__titulo">${escaparHTML(titulo)}</h2>
                <p>${escaparHTML(mensaje)}</p>
                <div class="dialogo__acciones">
                    <button value="no" class="boton boton--secundario">Volver</button>
                    <button value="si" class="boton ${peligro ? 'boton--peligro' : 'boton--primario'}">${escaparHTML(textoAceptar)}</button>
                </div>
            </form>`;
        document.body.appendChild(dialogo);
        dialogo.addEventListener('close', () => {
            resolver(dialogo.returnValue === 'si');
            dialogo.remove();
        });
        dialogo.showModal();
    });
}

// ==========================================================
// 6. VALIDACIÓN VISUAL DE FORMULARIOS (Manejo de Errores)
// ==========================================================

/* ----------------------------------------------------------
   limpiarErroresCampos(formulario)
   Borra cualquier mensajito de error rojo previo y quita los
   atributos `aria-invalid` para dejar el formulario limpio.
   ---------------------------------------------------------- */
export function limpiarErroresCampos(formulario) {
    formulario.querySelectorAll('.campo-error').forEach((el) => el.remove());
    formulario.querySelectorAll('[aria-invalid]').forEach((el) => el.removeAttribute('aria-invalid'));
}

/* ----------------------------------------------------------
   mostrarErroresCampos(formulario, errores)
   ¿Para qué sirve?
   Recibe el diccionario de errores `{ campo: 'mensaje' }` producido
   por las funciones de validación y:
   1. Encuentra el input correspondiente por su atributo `name`.
   2. Le coloca el borde rojo accesible con `aria-invalid="true"`.
   3. Le inyecta un párrafo con la clase `.campo-error` debajo.
   4. Enlaza el error con el input mediante `aria-describedby`.
   5. Hace auto-foco en el primer campo que falló para que el usuario
      pueda empezar a escribir la corrección de inmediato.
   ---------------------------------------------------------- */
export function mostrarErroresCampos(formulario, errores = {}) {
    limpiarErroresCampos(formulario);
    let primero = null;
    for (const [campo, mensaje] of Object.entries(errores)) {
        const input = formulario.querySelector(`[name="${campo}"]`) || formulario.querySelector(`[data-campo="${campo}"]`);
        if (!input) continue;
        input.setAttribute('aria-invalid', 'true');
        const aviso = document.createElement('p');
        aviso.className = 'campo-error';
        aviso.id = `error-${campo}-${Math.random().toString(36).slice(2, 6)}`;
        aviso.textContent = mensaje;
        input.setAttribute('aria-describedby', aviso.id);
        const destino = input.matches('fieldset') ? input : (input.closest('.campo-formulario') || input.parentElement);
        destino.appendChild(aviso);
        primero = primero || input;
    }
    if (primero && typeof primero.focus === 'function') {
        primero.focus();
    }
}

/* ----------------------------------------------------------
   parametroURL(nombre)
   Lee valores de la barra de direcciones (Query Params).
   Ejemplo: si la URL es `comprobante.html?folio=FRG-48192`,
   `parametroURL('folio')` devuelve `'FRG-48192'`.
   ---------------------------------------------------------- */
export function parametroURL(nombre) {
    return new URLSearchParams(location.search).get(nombre);
}
