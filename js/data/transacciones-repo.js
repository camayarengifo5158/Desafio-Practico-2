/* ==========================================================
   REPOSITORIO DE TRANSACCIONES / PEDIDOS (Capa de Datos)
   Archivo: js/data/transacciones-repo.js
   ----------------------------------------------------------
   ¿Para qué sirve este archivo?
   Es el "cerebro operativo" de todos los pedidos de la pastelería.
   Maneja el ciclo de vida completo de una orden:
   1. Creación: cuando el cliente pasa por caja (Checkout) y confirma su compra.
   2. Consulta: cuando el cliente entra a "Mis Pedidos" para ver el estado,
      o cuando el administrador revisa el tablero general de ventas.
   3. Búsqueda por folio: para encontrar un pedido por su código (ej: FRG-45892).
   4. Actualización: para avanzar el estado (Pendiente -> En preparación -> Lista -> Entregada).
   5. Cancelación: permite al cliente cancelar a tiempo o al admin anular una orden.

   Todo se guarda directamente en Google Cloud Firestore, en la colección
   "transacciones", cumpliendo con las Reglas de Seguridad oficiales.
   ========================================================== */

// Importamos la configuración global: roles, costos de negocio y la máquina de estados
import { ROLES, NEGOCIO, ESTADOS } from '../config/app-config.js';

// Importamos las herramientas de Firebase Firestore:
// - query y where: para hacer filtros directos en los servidores de Google (ej: traer solo pedidos de este cliente)
import { 
    db, 
    collection, 
    getDocs, 
    getDoc, 
    doc, 
    setDoc, 
    updateDoc, 
    deleteDoc, 
    query, 
    where 
} from '../config/firebase.js';

// Importamos los guardias de autenticación para proteger las operaciones
import { requerirSesion, requerirRol, ErrorAutorizacion } from './auth.js';

// Traemos el catálogo de postres para verificar precios reales y existencias
import { obtenerPostres } from './postres-repo.js';

// Traemos las reglas de validación (fechas, cantidades, estados permitidos)
import { validarCheckout, validarCantidad, validarEntrega, validarCambioEstado } from '../logica/validaciones.js';

// Traemos la utilidad de redondeo financiero (evita decimales raros)
import { redondear } from '../logica/formato.js';

/* ----------------------------------------------------------
   FUNCIÓN AUXILIAR: errorDeValidacion(mensaje, campos)
   Crea un error con un mensaje general y adjunta qué campos
   específicos del formulario fallaron para poder pintarlos en rojo.
   ---------------------------------------------------------- */
function errorDeValidacion(mensaje, campos = {}) {
    const error = new Error(mensaje);
    error.campos = campos;
    return error;
}

/* ----------------------------------------------------------
   FUNCIÓN AUXILIAR: claveLinea(linea)
   Genera una clave combinando el ID del postre y la presentación
   (ej: 'pst_paleo_choco|Porción'). Sirve para identificar de forma
   única cada fila dentro de una orden y no mezclar porciones con enteros.
   ---------------------------------------------------------- */
function claveLinea(linea) {
    return `${linea.postreId}|${linea.variante}`;
}

/* ----------------------------------------------------------
   FUNCIÓN AUXILIAR: calcularTotales(items, tipoEntrega)
   ¿Para qué sirve?
   Calcula la matemática financiera de la orden:
   - Suma los subtotales de cada postre.
   - Si la entrega es a "domicilio", suma el recargo de envío ($3.00).
   - Si es "retiro" en sucursal, el envío es $0.00.
   - Redondea todo a dos decimales para que las cuentas cuadren al centavo.
   ---------------------------------------------------------- */
function calcularTotales(items, tipoEntrega) {
    const subtotal = redondear(items.reduce((suma, i) => suma + i.subtotal, 0));
    const envio = tipoEntrega === 'domicilio' ? NEGOCIO.costoEnvio : 0;
    return { subtotal, envio, total: redondear(subtotal + envio) };
}

/* ----------------------------------------------------------
   FUNCIÓN AUXILIAR: generarFolio()
   ¿Para qué sirve?
   Crea un número de comprobante fácil de recordar para el cliente,
   por ejemplo "FRG-58412". Así el cliente no tiene que dictar
   un ID largo y feo de base de datos cuando llame por teléfono.
   ---------------------------------------------------------- */
function generarFolio() {
    const num = Math.floor(1000 + Math.random() * 90000);
    return `FRG-${num}`;
}

/* ----------------------------------------------------------
   FUNCIÓN AUXILIAR: puedeVer(usuario, transaccion)
   Regla de privacidad:
   Un pedido solo lo puede ver el Administrador de la pastelería
   O el Cliente dueño de ese pedido en específico. Nadie más.
   ---------------------------------------------------------- */
function puedeVer(usuario, transaccion) {
    return usuario.rol === ROLES.ADMIN || transaccion.clienteId === usuario.id;
}

// ==========================================================
// CONSULTAS (Lectura de Pedidos)
// ==========================================================

/* ----------------------------------------------------------
   obtenerTransacciones()
   ¿Para qué sirve?
   Trae la lista de pedidos desde Firestore según quién esté conectado:
   - Si es Administrador: trae TODOS los pedidos de la historia de la pastelería.
   - Si es Cliente: filtra en el servidor de Google con `where('clienteId', '==', usuario.id)`
     para que solo reciba sus propios pedidos.

   NOTA PEDAGÓGICA SOBRE FIRESTORE:
   En Firestore las reglas de seguridad NO filtran automáticamente
   los resultados. Si un cliente intentara pedir todos los documentos
   sin el filtro `where`, Firestore rechazaría la petición con "Missing permissions".
   Por eso aquí aplicamos el filtro explícito en la consulta.
   ---------------------------------------------------------- */
export async function obtenerTransacciones() {
    // Verificamos que haya alguien conectado; si no, rebota
    const usuario = requerirSesion();
    const coleccionRef = collection(db, 'transacciones');
    let q;

    // Si es admin pide todo; si es cliente, filtra por su propio ID
    if (usuario.rol === ROLES.ADMIN) {
        q = query(coleccionRef);
    } else {
        q = query(coleccionRef, where('clienteId', '==', usuario.id));
    }

    // Ejecutamos la consulta en Firestore
    const snap = await getDocs(q);
    const transacciones = [];
    snap.forEach((d) => transacciones.push({ id: d.id, ...d.data() }));
    return transacciones;
}

/* ----------------------------------------------------------
   obtenerTransaccion(idOFolio)
   ¿Para qué sirve?
   Permite buscar un pedido en específico, aceptando indistintamente:
   - Un código de comprobante/folio (ej: 'FRG-12345').
   - O el ID interno del documento en Firestore (ej: 'trx_lks98f').

   Estrategia robusta en 3 pasos:
   1. Si parece folio ('FRG-...'), busca por el campo `folio` con filtro
      de cliente si no es admin (cumple al 100% las reglas de Firestore).
   2. Si no es folio, intenta leer el documento directo por su ID (`getDoc`).
   3. Si no lo halló, intenta una búsqueda de respaldo por si el folio no traía prefijo.
   ---------------------------------------------------------- */
export async function obtenerTransaccion(idOFolio) {
    const usuario = requerirSesion();
    const esAdmin = usuario.rol === ROLES.ADMIN;
    const esFolio = String(idOFolio).trim().toUpperCase().startsWith('FRG-');

    // Paso 1: Si el texto tiene formato de folio ('FRG-...')
    if (esFolio) {
        const restricciones = [where('folio', '==', String(idOFolio).trim())];
        // Si no es admin, agregamos la restricción de que le pertenezca a este cliente
        if (!esAdmin) {
            restricciones.push(where('clienteId', '==', usuario.id));
        }
        const q = query(collection(db, 'transacciones'), ...restricciones);
        const querySnap = await getDocs(q);
        if (!querySnap.empty) {
            const primerDoc = querySnap.docs[0];
            return { id: primerDoc.id, ...primerDoc.data() };
        }
        throw new Error('No se encontró la transacción.');
    }

    // Paso 2: Si es un ID directo de documento en Firestore
    try {
        const docRef = doc(db, 'transacciones', idOFolio);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
            const transaccion = { id: snap.id, ...snap.data() };
            // Verificamos que el usuario tenga derecho a ver este pedido
            if (!puedeVer(usuario, transaccion)) {
                throw new ErrorAutorizacion('Esta transacción pertenece a otro cliente.');
            }
            return transaccion;
        }
    } catch (error) {
        // Si fue un error de autorización nuestro, lo relanzamos
        if (error instanceof ErrorAutorizacion) throw error;
        // Si falló en Firestore por formato de ID, continuamos al paso 3 de respaldo
    }

    // Paso 3: Respaldo final buscando por campo 'folio' sin importar prefijo
    const restriccionesFallback = [where('folio', '==', idOFolio)];
    if (!esAdmin) {
        restriccionesFallback.push(where('clienteId', '==', usuario.id));
    }
    const qFallback = query(collection(db, 'transacciones'), ...restriccionesFallback);
    const querySnapFallback = await getDocs(qFallback);
    if (!querySnapFallback.empty) {
        const primerDoc = querySnapFallback.docs[0];
        return { id: primerDoc.id, ...primerDoc.data() };
    }

    throw new Error('No se encontró la transacción.');
}

// ==========================================================
// CREACIÓN DE PEDIDOS (Checkout de la tienda)
// ==========================================================

/* ----------------------------------------------------------
   crearTransaccion({ items, entrega, metodoPago, notas })
   ¿Para qué sirve?
   Convierte el carrito temporal del cliente en un pedido oficial
   guardado en la nube.
   
   Filtros y validaciones rigurosas que realiza:
   1. Exige que el cliente tenga sesión iniciada.
   2. Verifica que el carrito no esté vacío.
   3. Valida la información de entrega (sucursal, fecha con anticipación mínima de 48h, etc.).
   4. Consulta el catálogo oficial de Firestore para verificar que los productos
      sigan existiendo, que estén disponibles y que los precios no hayan sido
      manipulados en el navegador del cliente.
   5. Calcula subtotales, costo de envío y total general.
   6. Genera un folio único y un historial de seguimiento donde queda registrado
      quién creó el pedido y a qué hora.
   7. Guarda en Firestore con `setDoc`.
   ---------------------------------------------------------- */
export async function crearTransaccion({ items, entrega, metodoPago, notas = '' }) {
    // Paso 1: Guardia de sesión obligatoria
    const usuario = requerirSesion();

    // Paso 2: Validamos que haya productos en el carrito
    if (!Array.isArray(items) || items.length === 0) {
        throw errorDeValidacion('El carrito está vacío.');
    }

    // Paso 3: Validamos datos del formulario de entrega y método de pago
    const errores = validarCheckout({ entrega, metodoPago, notas });
    if (Object.keys(errores).length) throw errorDeValidacion('Revisa los datos de entrega y pago.', errores);

    // Paso 4: Validamos contra los productos reales en Firestore (protección contra manipulación)
    const postres = await obtenerPostres();
    const lineas = items.map((item) => {
        const postre = postres.find((p) => p.id === item.postreId);
        if (!postre) throw errorDeValidacion('Uno de los productos ya no existe.');
        if (!postre.disponible) throw errorDeValidacion(`${postre.nombre} no está disponible.`);
        
        const variante = postre.variantes.find((v) => v.nombre === item.variante);
        if (!variante) throw errorDeValidacion(`La presentación "${item.variante}" de ${postre.nombre} ya no existe.`);
        
        // Verificamos si cumple con el pedido mínimo del postre (ej: mínimo 12 unidades)
        const errorCantidad = validarCantidad(postre, item.cantidad);
        if (errorCantidad) throw errorDeValidacion(errorCantidad);

        const cantidad = Number(item.cantidad);
        return {
            postreId: postre.id,
            nombre: postre.nombre,
            categoria: postre.categoria,
            variante: variante.nombre,
            precioUnitario: variante.precio,
            cantidad,
            subtotal: redondear(variante.precio * cantidad)
        };
    });

    // Paso 5: Construimos el objeto completo del pedido
    const ahora = new Date().toISOString();
    const id = `trx_${Date.now().toString(36)}`;
    
    const transaccion = {
        folio: generarFolio(),
        clienteId: usuario.id,
        clienteNombre: usuario.nombre,
        clienteEmail: usuario.email,
        items: lineas,
        ...calcularTotales(lineas, entrega.tipo),
        metodoPago,
        // Si paga con tarjeta o transferencia se asume cobrado; si es efectivo, queda pendiente de cobro
        pagado: metodoPago !== 'efectivo',
        estado: 'pendiente', // Todo pedido nace en estado 'pendiente'
        entrega: {
            tipo: entrega.tipo,
            sucursal: entrega.sucursal,
            fecha: entrega.fecha,
            direccion: entrega.tipo === 'domicilio' ? entrega.direccion.trim() : ''
        },
        notas: notas.trim(),
        // Historial de auditoría para la trazabilidad del pedido
        historial: [{ fecha: ahora, estado: 'pendiente', por: usuario.nombre }],
        creadaEn: ahora,
        actualizadaEn: ahora
    };

    // Paso 6: Guardamos en Firestore
    await setDoc(doc(db, 'transacciones', id), transaccion);
    return { id, ...transaccion };
}

// ==========================================================
// MODIFICACIÓN DE PEDIDOS (Transiciones de Estado y Edición)
// ==========================================================

/* ----------------------------------------------------------
   actualizarTransaccion(id, cambios)
   ¿Para qué sirve?
   Es la función más versátil del módulo de pedidos. Permite:
   - Al Administrador: cambiar el estado del pedido siguiendo el flujo
     (Pendiente -> En preparación -> Lista -> Entregada), marcarlo como pagado,
     o ajustar fecha y notas.
   - Al Cliente: corregir su dirección, notas o cantidades MIENTRAS el pedido
     siga en estado "Pendiente" (si la cocina ya empezó a hornear, ya no puede cambiarlo).
   ---------------------------------------------------------- */
export async function actualizarTransaccion(id, cambios) {
    const usuario = requerirSesion();
    const esAdmin = usuario.rol === ROLES.ADMIN;
    
    // Obtenemos el pedido actual
    const actual = await obtenerTransaccion(id);

    // Regla de negocio: El cliente común solo puede tocar pedidos "Pendientes"
    if (!esAdmin && actual.estado !== 'pendiente') {
        throw new ErrorAutorizacion('Solo puedes modificar pedidos en estado "Pendiente".');
    }

    // Regla de estados cerrados: Si el pedido ya está "Entregado" o "Cancelado",
    // ya no se puede cambiar casi nada (solo notas informativas de servicio al cliente).
    const cerrado = ESTADOS[actual.estado].siguientes.length === 0;
    const camposNoPermitidos = Object.keys(cambios)
        .filter((campo) => campo !== 'notas' && !(campo === 'estado' && cambios.estado === actual.estado));
    if (cerrado && camposNoPermitidos.length > 0) {
        throw errorDeValidacion(`Un pedido "${ESTADOS[actual.estado].etiqueta}" ya no puede modificarse.`);
    }

    // Clonamos el objeto actual para aplicarle los cambios de forma segura
    const nueva = { ...actual, entrega: { ...actual.entrega }, historial: [...actual.historial] };

    // 1. Cambio de estado (solo admin)
    if ('estado' in cambios && cambios.estado !== actual.estado) {
        if (!esAdmin) throw new ErrorAutorizacion('Solo la administración puede cambiar el estado.');
        
        // Verificamos que la transición sea válida según la máquina de estados
        const error = validarCambioEstado(actual.estado, cambios.estado);
        if (error) throw errorDeValidacion(error, { estado: error });
        
        nueva.estado = cambios.estado;
        // Agregamos el movimiento a la bitácora de auditoría
        nueva.historial.push({ fecha: new Date().toISOString(), estado: cambios.estado, por: usuario.nombre });
        
        // Si se entrega el postre en ventanilla, se asume pagado en su totalidad
        if (cambios.estado === 'entregada') nueva.pagado = true;
    }

    // 2. Registro de pago (solo admin)
    if ('pagado' in cambios) {
        if (!esAdmin) throw new ErrorAutorizacion('Solo la administración puede registrar pagos.');
        nueva.pagado = Boolean(cambios.pagado) || nueva.estado === 'entregada';
    }

    // 3. Modificación de entrega (fecha, dirección o sucursal)
    if (cambios.entrega) {
        const entrega = { ...actual.entrega, ...cambios.entrega };
        // Al admin se le permite reprogramar de emergencia sin exigir la anticipación de 48h
        const errores = validarEntrega(entrega, { exigirAnticipacion: !esAdmin });
        if (Object.keys(errores).length) throw errorDeValidacion('Revisa los datos de entrega.', errores);
        nueva.entrega = { ...entrega, direccion: entrega.tipo === 'domicilio' ? entrega.direccion.trim() : '' };
    }

    // 4. Modificación de notas especiales
    if ('notas' in cambios) {
        const notas = String(cambios.notas ?? '').trim();
        if (notas.length > 250) throw errorDeValidacion('Las notas no pueden pasar de 250 caracteres.');
        nueva.notas = notas;
    }

    // 5. Modificación de cantidades de postres
    if (cambios.items) {
        // Solo se permite cambiar productos si el pedido no ha salido de la cocina
        if (!['pendiente', 'en_preparacion'].includes(actual.estado)) {
            throw errorDeValidacion('Los productos solo se pueden modificar antes de que el pedido esté listo.');
        }
        
        const postres = await obtenerPostres();
        const originales = new Map(actual.items.map((l) => [claveLinea(l), l]));
        
        // Revalidamos las nuevas cantidades
        const items = cambios.items
            .filter((i) => Number(i.cantidad) > 0)
            .map((i) => {
                const original = originales.get(claveLinea(i));
                if (!original) throw errorDeValidacion('Solo puedes modificar productos que ya están en el pedido.');
                const postre = postres.find((p) => p.id === i.postreId) || { nombre: original.nombre, minimo: 1 };
                const errorCantidad = validarCantidad(postre, i.cantidad);
                if (errorCantidad) throw errorDeValidacion(errorCantidad);
                const cantidad = Number(i.cantidad);
                return { ...original, cantidad, subtotal: redondear(original.precioUnitario * cantidad) };
            });
            
        if (items.length === 0) throw errorDeValidacion('El pedido debe tener al menos un producto.');
        nueva.items = items;
    }

    // Recalculamos los totales financieros de la orden con las nuevas cantidades
    Object.assign(nueva, calcularTotales(nueva.items, nueva.entrega.tipo));
    nueva.actualizadaEn = new Date().toISOString();

    // Guardamos en Firestore eliminando el id del cuerpo del documento
    const { id: _, ...datosParaGuardar } = nueva;
    await updateDoc(doc(db, 'transacciones', id), datosParaGuardar);
    return nueva;
}

/* ----------------------------------------------------------
   cancelarTransaccion(id)
   ¿Para qué sirve?
   Pasa un pedido al estado "Cancelada".
   - Si es un cliente: solo puede cancelar si el pedido sigue "Pendiente".
     Si ya dice "En preparación", el sistema le pide llamar a la pastelería.
   - Si es admin: puede cancelar en cualquier momento antes de que se entregue.
   ---------------------------------------------------------- */
export async function cancelarTransaccion(id) {
    const usuario = requerirSesion();
    const actual = await obtenerTransaccion(id);

    // Protección para la cocina: si ya gastaron ingredientes, el cliente no puede cancelar por la web
    if (usuario.rol !== ROLES.ADMIN && actual.estado !== 'pendiente') {
        throw new ErrorAutorizacion('Tu pedido ya se está preparando. Contáctanos para cancelarlo.');
    }
    
    // Verificamos si la máquina de estados permite cancelar desde el estado actual
    const error = validarCambioEstado(actual.estado, 'cancelada');
    if (error) throw errorDeValidacion(error);

    const ahora = new Date().toISOString();
    // Registramos quién canceló en el historial
    const historial = [...actual.historial, { fecha: ahora, estado: 'cancelada', por: usuario.nombre }];

    // Actualizamos en Firestore
    await updateDoc(doc(db, 'transacciones', id), {
        estado: 'cancelada',
        historial,
        actualizadaEn: ahora
    });

    return { ...actual, estado: 'cancelada', historial, actualizadaEn: ahora };
}

/* ----------------------------------------------------------
   eliminarTransaccion(id)
   ¿Para qué sirve?
   Borra definitivamente una transacción de la base de datos.
   Esta operación está estrictamente reservada para administradores
   (por ejemplo, para limpiar órdenes de prueba o registros corruptos).
   ---------------------------------------------------------- */
export async function eliminarTransaccion(id) {
    // Solo el administrador supremo tiene permiso de borrar registros
    requerirRol(ROLES.ADMIN);
    await deleteDoc(doc(db, 'transacciones', id));
    return true;
}