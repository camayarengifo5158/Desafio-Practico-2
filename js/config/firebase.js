/* ==============================================================================
   ARCHIVO: js/config/firebase.js
   CAPA: Configuración de Plataforma (Conexión a la Nube)
   ==============================================================================
   ¿Para qué sirve este archivo en la vida real de la aplicación?
   Imagínate este archivo como la "antena" o el "cable de red" de Fragola Postres.
   Es el único punto donde configuramos cómo nuestro navegador va a comunicarse
   con los servidores de Google (Firebase). 

   Aquí se hace la conexión inicial para dos servicios indispensables:
   1. Firebase Authentication: Para que los clientes y admins puedan registrarse e iniciar sesión.
   2. Cloud Firestore: Nuestra base de datos en tiempo real donde guardamos los postres y pedidos.

   ¿Por qué lo importamos desde gstatic.com?
   Porque usamos JavaScript nativo puro con módulos ES. En vez de instalar paquetes
   pesados con npm y tener que compilar con herramientas como Webpack o Vite,
   el navegador descarga directamente las librerías oficiales y optimizadas de Google.
   ============================================================================== */

// 1. Herramienta principal para inicializar la conexión con Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";

// 2. Herramientas de Autenticación de Firebase:
// - getAuth: Crea o recupera el administrador central de sesiones de usuario.
// - signInWithEmailAndPassword: Valida correo y contraseña para abrir sesión.
// - createUserWithEmailAndPassword: Crea una nueva cuenta segura en los servidores de Google.
// - signOut: Cierra la sesión activa en el navegador y en la nube.
// - onAuthStateChanged: Un "vigilante" en tiempo real que nos avisa si el usuario inició o cerró sesión.
import { 
    getAuth, 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// 3. Herramientas de Base de Datos (Cloud Firestore):
// - getFirestore: Inicializa la base de datos no relacional (NoSQL).
// - collection: Apunta a una "tabla" o colección de datos (ej. "postres", "transacciones").
// - doc: Apunta a un documento específico con su ID único (ej. "postres/pst_01").
// - getDoc: Lee un solo documento específico por su ID.
// - getDocs: Lee varios documentos a la vez a partir de una colección o consulta.
// - setDoc: Crea o sobreescribe un documento asignándole un ID que nosotros definimos.
// - addDoc: Crea un documento dejándole a Firebase que autogenere un ID aleatorio.
// - updateDoc: Modifica solo los campos que le digamos sin borrar el resto del documento.
// - deleteDoc: Elimina físicamente un documento de la base de datos.
// - query: Arma una búsqueda personalizada con condiciones.
// - where: Filtra documentos que cumplan una condición (ej. 'clienteId' == 'mi_id').
// - orderBy: Ordena los resultados por algún campo (ej. por fecha o precio).
import { 
    getFirestore, 
    collection, 
    doc, 
    getDoc, 
    getDocs, 
    setDoc, 
    addDoc, 
    updateDoc, 
    deleteDoc, 
    query, 
    where, 
    orderBy 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// Objeto de configuración con las "credenciales públicas" de nuestro proyecto en Google Cloud.
// NOTA PEDAGÓGICA IMPORTANTE PARA LA DEFENSA TÉCNICA:
// El docente podría preguntar: "¿Por qué la apiKey está visible aquí? ¿No es un riesgo de seguridad?"
// La respuesta es: En Firebase Web, la apiKey NO es una contraseña secreta; es únicamente un
// identificador público para que Google sepa a qué proyecto cobrarle la cuota de red.
// La seguridad real NO depende de ocultar esta clave, sino de las reglas en la nube (firestore.rules),
// que validan quién tiene permiso de leer o escribir cada documento.
const firebaseConfig = {
    apiKey: "AIzaSyCID1eRfzLSHQuKutAhz7Fki4SRRU_ce4g",
    authDomain: "fragola-postres.firebaseapp.com",
    projectId: "fragola-postres",
    storageBucket: "fragola-postres.firebasestorage.app",
    messagingSenderId: "697091581764",
    appId: "1:697091581764:web:0964fedb423b6689229911",
    measurementId: "G-Y98FE4HZML"
};

// Encendemos la conexión con Firebase usando la configuración anterior
export const app = initializeApp(firebaseConfig);

// Instancia única (Singleton) del servicio de autenticación para toda nuestra app
export const auth = getAuth(app);

// Instancia única (Singleton) de la base de datos Firestore para toda nuestra app
export const db = getFirestore(app);

// Re-exportamos todas las funciones del SDK oficial para que los repositorios
// en la carpeta `js/data/` las puedan importar limpiamente desde este único archivo,
// sin tener que acordarse de las URLs largas de Google en cada módulo.
export {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    collection,
    doc,
    getDoc,
    getDocs,
    setDoc,
    addDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy
};