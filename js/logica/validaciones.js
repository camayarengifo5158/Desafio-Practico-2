/* ==========================================================
   VALIDACIONES DE NEGOCIO (Lógica de Negocio)
   Archivo: js/logica/validaciones.js
   ----------------------------------------------------------
   ¿Para qué sirve este archivo?
   Es el "control de calidad" de toda la pastelería. Se encarga de
   revisar que todo lo que escriban los usuarios o administradores
   tenga sentido antes de intentar procesarlo o guardarlo.

   Patrón de diseño:
   Cada función recibe un objeto con los datos y devuelve un objeto
   con los errores: `{ campo: 'mensaje explicativo' }`.
   - Si todo está bien, devuelve `{}` (objeto vacío).
   - Si algo falla, el objeto contiene exactamente cuál campo falló
     y qué mensaje mostrar.

   ¿Por qué se usan tanto en la interfaz como en los repositorios?
   Porque si un usuario malicioso intenta saltarse las validaciones
   del navegador (por ejemplo deshabilitando JavaScript en la consola),
   el repositorio volverá a ejecutar estas mismas reglas y bloqueará
   el intento. Es validación defensiva en dos capas.
   ========================================================== */

// Importamos las opciones válidas del negocio (categorías de postres, sucursales, métodos de pago, etc.)
import { CATEGORIAS, NEGOCIO, SUCURSALES, METODOS_PAGO, TIPOS_ENTREGA, ESTADOS } from '../config/app-config.js';

// Importamos la función para obtener la fecha local en formato AAAA-MM-DD
import { fechaISOLocal } from './formato.js';

// Expresión regular estándar para verificar que un correo tenga formato correcto (usuario@dominio.com)
const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

/* ----------------------------------------------------------
   FUNCIÓN AUXILIAR: vacio(valor)
   ¿Para qué sirve?
   Detecta si un campo fue dejado en blanco, es nulo, indefinido
   o solo contiene espacios vacíos.
   ---------------------------------------------------------- */
function vacio(valor) {
    return valor === undefined || valor === null || String(valor).trim() === '';
}

// ==========================================================
// 1. VALIDACIONES DE USUARIOS (Registro e Inicio de Sesión)
// ==========================================================

/* ----------------------------------------------------------
   validarRegistro({ nombre, email, contrasena, confirmacion })
   ¿Para qué sirve?
   Revisa los 4 campos del formulario de creación de cuenta:
   - Nombre: mínimo 3 letras, solo caracteres alfabéticos y espacios.
   - Email: formato de correo válido.
   - Contraseña: mínimo 8 caracteres con combinación de letras y números.
   - Confirmación: que sea exactamente idéntica a la contraseña escrita arriba.
   ---------------------------------------------------------- */
export function validarRegistro({ nombre, email, contrasena, confirmacion }) {
    const errores = {};

    // 1. Nombre completo
    if (vacio(nombre) || nombre.trim().length < 3) {
        errores.nombre = 'Escribe tu nombre completo (mínimo 3 letras).';
    } else if (!/^[\p{L} .'-]+$/u.test(nombre.trim())) {
        errores.nombre = 'El nombre solo puede contener letras y espacios.';
    }

    // 2. Correo electrónico
    if (vacio(email) || !REGEX_EMAIL.test(email.trim())) {
        errores.email = 'Escribe un correo válido, por ejemplo nombre@correo.com.';
    }

    // 3. Contraseña (seguridad básica)
    if (vacio(contrasena) || contrasena.length < 8) {
        errores.contrasena = 'La contraseña debe tener al menos 8 caracteres.';
    } else if (!/[A-Za-z]/.test(contrasena) || !/\d/.test(contrasena)) {
        errores.contrasena = 'Usa al menos una letra y un número.';
    }

    // 4. Confirmación de contraseña
    if (confirmacion !== contrasena) {
        errores.confirmacion = 'Las contraseñas no coinciden.';
    }

    return errores;
}

/* ----------------------------------------------------------
   validarLogin({ email, contrasena })
   ¿Para qué sirve?
   Revisión rápida antes de enviar credenciales a Firebase Auth:
   avisa de inmediato si el usuario olvidó escribir el correo
   o la contraseña para no hacer peticiones de red innecesarias.
   ---------------------------------------------------------- */
export function validarLogin({ email, contrasena }) {
    const errores = {};
    if (vacio(email) || !REGEX_EMAIL.test(email.trim())) errores.email = 'Escribe un correo válido.';
    if (vacio(contrasena)) errores.contrasena = 'Escribe tu contraseña.';
    return errores;
}

// ==========================================================
// 2. VALIDACIONES DE PRODUCTOS (Formulario de Postres del Admin)
// ==========================================================

/* ----------------------------------------------------------
   validarPostre({ nombre, categoria, descripcion, imagen, variantes, minimo })
   ¿Para qué sirve?
   Garantiza que ningún postre incompleto o con precios disparatados
   se publique en el catálogo de la pastelería:
   - Nombre: entre 3 y 80 caracteres.
   - Categoría: debe existir en la lista oficial (tartas, individuales, etc.).
   - Descripción: entre 10 y 300 caracteres para informar bien al cliente.
   - Imagen: debe ser un archivo de la carpeta `img/` o un enlace seguro `https://`.
   - Presentaciones/Variantes: al menos una con nombre y precio entre $0 y $1,000.
   - Mínimo de unidades: número entero entre 1 y 100.
   ---------------------------------------------------------- */
export function validarPostre({ nombre, categoria, descripcion, imagen, variantes, minimo }) {
    const errores = {};

    // 1. Nombre del postre
    if (vacio(nombre) || nombre.trim().length < 3 || nombre.trim().length > 80) {
        errores.nombre = 'El nombre debe tener entre 3 y 80 caracteres.';
    }

    // 2. Categoría
    if (!CATEGORIAS.some((c) => c.id === categoria)) {
        errores.categoria = 'Selecciona una categoría.';
    }

    // 3. Descripción
    if (vacio(descripcion) || descripcion.trim().length < 10 || descripcion.trim().length > 300) {
        errores.descripcion = 'La descripción debe tener entre 10 y 300 caracteres.';
    }

    // 4. Imagen
    if (vacio(imagen)) {
        errores.imagen = 'Selecciona una imagen o escribe una URL.';
    } else if (!/^(img\/|https:\/\/)/.test(imagen.trim())) {
        errores.imagen = 'La imagen debe ser de la carpeta img/ o una URL https://';
    }

    // 5. Presentaciones y Precios
    if (!Array.isArray(variantes) || variantes.length === 0) {
        errores.variantes = 'Agrega al menos una presentación con su precio.';
    } else {
        const nombres = new Set();
        for (const v of variantes) {
            if (vacio(v.nombre)) { 
                errores.variantes = 'Cada presentación necesita un nombre.'; 
                break; 
            }
            if (!(Number(v.precio) > 0) || Number(v.precio) > 1000) { 
                errores.variantes = 'Cada precio debe ser mayor que $0 y menor que $1,000.'; 
                break; 
            }
            const clave = v.nombre.trim().toLowerCase();
            if (nombres.has(clave)) { 
                errores.variantes = 'No repitas el nombre de una presentación.'; 
                break; 
            }
            nombres.add(clave);
        }
    }

    // 6. Mínimo de unidades de compra
    if (!Number.isInteger(Number(minimo)) || Number(minimo) < 1 || Number(minimo) > 100) {
        errores.minimo = 'El mínimo debe ser un número entero entre 1 y 100.';
    }

    return errores;
}

// ==========================================================
// 3. VALIDACIONES DE CARRITO Y COMPRA (Reglas de Venta)
// ==========================================================

/* ----------------------------------------------------------
   validarCantidad(postre, cantidad)
   ¿Para qué sirve?
   Aplica dos reglas del negocio sobre la cantidad solicitada:
   1. Límite máximo: nadie puede pedir más de 50 unidades de un solo golpe.
   2. Mínimo por producto: ciertos postres pequeños como los Cake Shooters
      o Mini Donas solo se hornean por docena o por lote (ej. mínimo 12 o 20 unidades).
   ---------------------------------------------------------- */
export function validarCantidad(postre, cantidad) {
    const n = Number(cantidad);
    if (!Number.isInteger(n) || n < 1) {
        return 'La cantidad debe ser un número entero mayor que 0.';
    }
    if (n > NEGOCIO.maxCantidadPorLinea) {
        return `La cantidad máxima por producto es ${NEGOCIO.maxCantidadPorLinea}.`;
    }
    if (postre && n < postre.minimo) {
        return `${postre.nombre} se vende con un mínimo de ${postre.minimo} unidades.`;
    }
    return null; // Todo correcto
}

/* ----------------------------------------------------------
   fechaMinimaEntrega(ahora)
   ¿Para qué sirve?
   Calcula la fecha más próxima en la que la pastelería puede entregar.
   Regla de negocio: Todos los postres son artesanales y frescos,
   por lo que se requiere un mínimo de 48 horas de anticipación.
   ---------------------------------------------------------- */
export function fechaMinimaEntrega(ahora = new Date()) {
    return fechaISOLocal(new Date(ahora.getTime() + NEGOCIO.horasAnticipacion * 3600 * 1000));
}

/* ----------------------------------------------------------
   validarEntrega({ tipo, sucursal, fecha, direccion }, { exigirAnticipacion })
   ¿Para qué sirve?
   Revisa los detalles logísticos del pedido:
   - Tipo de entrega: debe ser 'retiro' en tienda o 'domicilio'.
   - Sucursal: debe ser 'La Mascota' o 'Epic Plaza'.
   - Fecha de entrega: no puede ser en el pasado ni antes de las 48h de anticipación.
     (Nota: el admin puede desactivar `exigirAnticipacion` para reprogramar pedidos urgentes).
   - Dirección: obligatoria si eligió envío a domicilio (mínimo 10 caracteres).
   ---------------------------------------------------------- */
export function validarEntrega({ tipo, sucursal, fecha, direccion }, { exigirAnticipacion = true } = {}) {
    const errores = {};

    if (!(tipo in TIPOS_ENTREGA)) errores.tipo = 'Selecciona cómo recibirás tu pedido.';
    if (!SUCURSALES.includes(sucursal)) errores.sucursal = 'Selecciona una sucursal.';

    if (vacio(fecha) || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
        errores.fecha = 'Selecciona la fecha de entrega.';
    } else if (exigirAnticipacion && fecha < fechaMinimaEntrega()) {
        errores.fecha = `Los encargos se hacen con ${NEGOCIO.horasAnticipacion} h de anticipación.`;
    }

    if (tipo === 'domicilio' && (vacio(direccion) || direccion.trim().length < 10)) {
        errores.direccion = 'Escribe una dirección completa (mínimo 10 caracteres).';
    }

    return errores;
}

/* ----------------------------------------------------------
   validarCheckout(datos)
   ¿Para qué sirve?
   Revisa todo el formulario de confirmación de compra:
   combina la validación de entrega con la revisión del método de pago
   (tarjeta, transferencia o efectivo) y el límite de notas (250 letras).
   ---------------------------------------------------------- */
export function validarCheckout(datos) {
    const errores = validarEntrega(datos.entrega || {});
    if (!(datos.metodoPago in METODOS_PAGO)) errores.metodoPago = 'Selecciona un método de pago.';
    if (datos.notas && datos.notas.length > 250) errores.notas = 'Las notas no pueden pasar de 250 caracteres.';
    return errores;
}

// ==========================================================
// 4. MÁQUINA DE ESTADOS FINITOS (FSM - Flujo del Pedido)
// ==========================================================

/* ----------------------------------------------------------
   validarCambioEstado(estadoActual, estadoNuevo)
   ¿Para qué sirve?
   Protege el flujo lógico de la pastelería impidiendo saltos ilegales
   en el ciclo de vida del pedido:
   - Flujo normal: pendiente -> en_preparacion -> lista -> entregada
   - Cancelación: se puede cancelar desde 'pendiente' o 'en_preparacion'.
   - Una vez 'entregada' o 'cancelada', el pedido queda CERRADO para siempre.
   
   Ejemplo de salto ilegal bloqueado:
   Si un pedido está "pendiente", no puedes marcarlo de golpe como "entregada"
   sin pasar por la cocina ("en_preparacion").
   ---------------------------------------------------------- */
export function validarCambioEstado(estadoActual, estadoNuevo) {
    // Si no cambió el estado, no hay error
    if (estadoActual === estadoNuevo) return null;

    // Si el estado propuesto no existe en el sistema
    if (!(estadoNuevo in ESTADOS)) return 'Estado desconocido.';

    // Verificamos si la máquina de estados permite pasar del estado actual al nuevo
    if (!ESTADOS[estadoActual].siguientes.includes(estadoNuevo)) {
        return `No se puede pasar de "${ESTADOS[estadoActual].etiqueta}" a "${ESTADOS[estadoNuevo].etiqueta}".`;
    }

    return null; // Transición legal
}
