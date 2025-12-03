# 📚 Guía Técnica: Pulsar

Este documento describe la arquitectura e implementación de PulsarJS, basado en el patrón **Observador (Publish/Subscribe)**.

## 1. Fundamentos y Arquitectura

### 1.1. Propósito

Implementar un mecanismo de reactividad sencillo que actúe como un **emisor de señales** o una **fuente de verdad centralizada** para diferentes dominios de la aplicación, evitando el *over-engineering* de librerías complejas.

### 1.2. Patrón Central: El Observador

La arquitectura se basa en el patrón **Observador**.

* **Sujeto (Subject) / Publicador:** Es la clase `Pulsar`. Contiene el estado y gestiona la lista de oyentes.
* **Observador (Observer) / Suscriptor:** Son las funciones (*listeners*) que se registran para ser notificadas cuando el estado del `Pulsar` cambia.

## 2. Implementación de la Clase Base: `Pulsar`

La clase `Pulsar` es la unidad fundamental de reactividad. Es responsable de contener el estado, gestionar las suscripciones y notificar los cambios.

### 2.1. Definición de `Pulsar`

```javascript
class Pulsar {
  /**
   * Crea una nueva instancia de almacenamiento (Pulsar).
   * @param {Object} initialState - El estado inicial de la tienda.
   */
  constructor(initialState) {
    // Estado interno: La fuente de verdad.
    this.state = initialState;
    
    // Colección de suscriptores. Usamos un Set para:
    // 1. Evitar duplicados automáticamente.
    // 2. Optimizar la adición y eliminación de oyentes (O(1)).
    this.listeners = new Set();
  }

  /**
   * Suscribe una función (listener) a los cambios de estado.
   * 
   * @param {Function} listener - Función que se ejecutará cuando el estado cambie.
   * @param {boolean} [immediate=false] - Si es true, ejecuta el listener inmediatamente tras suscribirse.
   * @returns {Function} Función de limpieza (cleanup) para cancelar la suscripción.
   */
  subscribe(listener, immediate = false) {
    this.listeners.add(listener);
    
    // Ejecución inmediata opcional: Útil para sincronizar la UI con el estado actual
    // al momento de montar un componente, sin esperar al primer cambio.
    if (immediate) {
      try {
        listener();
      } catch (error) {
        console.error('[Pulsar] Error en ejecución inmediata del listener:', error);
      }
    }
    
    // Retornamos una función de cleanup.
    // Patrón funcional: const unsubscribe = Pulsar.subscribe(...)
    return () => this.listeners.delete(listener); 
  }

  /**
   * Obtiene una instantánea del estado actual.
   * 
   * @returns {Object} Una copia superficial (shallow copy) del estado.
   * @note Se retorna una copia para promover la inmutabilidad y evitar 
   * que referencias externas modifiquen el estado interno sin usar setState.
   */
  getState() {
    return { ...this.state }; 
  }

  /**
   * Método interno para notificar a todos los suscriptores.
   * Itera sobre el Set de listeners y ejecuta cada uno.
   * @private
   */
  _notify() {
    this.listeners.forEach(listener => {
      try {
        listener();
      } catch (error) {
        // Robustez: Un error en un listener no debe detener la propagación 
        // a los demás ni romper el flujo de la aplicación.
        console.error('[Pulsar] Error notificado en listener:', error);
      }
    });
  }

  /**
   * Actualiza el estado y emite una señal de cambio a los suscriptores.
   * Realiza una fusión superficial (shallow merge) del estado nuevo con el anterior.
   * 
   * @param {Object} newState - Objeto con las propiedades a actualizar.
   */
  setState(newState) {
    // Inmutabilidad: Creamos un nuevo objeto en lugar de mutar 'this.state'.
    this.state = { ...this.state, ...newState }; 
    this._notify();
  }
}

```

### 2.2. Mejoras Implementadas

#### ✅ Mejora #1: Patrón de Retorno para Cleanup
El método `subscribe` retorna una función de limpieza en lugar de requerir un método `unsubscribe` separado. Este patrón es más funcional y elegante:

```javascript
// ✅ Patrón funcional (implementado)
const unsubscribe = Pulsar.subscribe(listener);
unsubscribe(); // Limpio y directo

// ❌ Patrón tradicional (evitado)
Pulsar.subscribe(listener);
Pulsar.unsubscribe(listener); // Requiere mantener referencia
```

**Ventajas:**
- Más fácil de usar en sistemas de componentes
- Reduce errores al olvidar des-suscribirse
- Compatible con patrones modernos (hooks de React, etc.)

#### ✅ Mejora #2: Copia Defensiva en `getState()`
El método retorna una copia superficial del estado, protegiendo contra mutaciones accidentales:

```javascript
getState() {
  return { ...this.state }; // Copia, no referencia directa
}
```

#### ✅ Mejora #3: Ejecución Inmediata Opcional
El parámetro `immediate` permite ejecutar el listener al momento de suscribirse:

```javascript
// Útil para sincronización inicial
Pulsar.subscribe(() => {
  renderUI(Pulsar.getState());
}, true); // Se ejecuta inmediatamente con el estado actual
```

#### ✅ Mejora #4: Manejo de Errores Robusto
Los errores en listeners individuales no bloquean la notificación a otros listeners:

```javascript
Pulsar.subscribe(() => {
  throw new Error('Listener roto');
});

Pulsar.subscribe(() => {
  console.log('Este listener SÍ se ejecuta'); // ✅ Se ejecuta
});

Pulsar.setState({ data: 'nuevo' });
// Output: Error en listener: Error: Listener roto
// Output: Este listener SÍ se ejecuta
```

## 3. Implementación Modular: `Factory Function`

Para evitar un estado monolítico y promover la modularidad, se utiliza una **Factory Function** para crear instancias de `Pulsar` según el dominio de la aplicación (e.g., Auth, Home, Settings).

### 3.1. La Función Creadora (`createState`)

```javascript

/**
 * Factory Function para crear Pulsars independientes.
 * Promueve la modularidad creando instancias aisladas para diferentes dominios (Auth, UI, Data).
 * 
 * @param {Object} initialState - Estado inicial para esta instancia.
 * @returns {Pulsar} Nueva instancia de Pulsar.
 */
export function createState(initialState) {
  return new Pulsar(initialState);
}
```

### 3.2. Instanciación y Uso Modular

Se recomienda agrupar la inicialización en un archivo central para una fácil gestión (ej. `Pulsars/index.js`).

| Dominio | Propósito | Ejemplo de Uso |
|:--------|:----------|:---------------|
| `authPulsar` | Gestión del estado de usuario (login, token). | `authPulsar.setState({ isLoggedIn: true, user: { id: 42 } });` |
| `uiPulsar` | Variables de interfaz de usuario (tema, estado de *loading*). | `uiPulsar.setState({ theme: 'dark' });` |
| `navPulsar` | Gestión de la navegación actual (pestaña activa, ruta). | `navPulsar.setState({ currentTab: 'settings' });` |

**Ejemplo de Inicialización:**

```javascript
// Pulsars/index.js
export const authPulsar = createState({ 
  isLoggedIn: false, 
  token: null,
  user: null
});

export const uiPulsar = createState({ 
  theme: 'light',
  isLoading: false, 
  sidebarOpen: true 
});

export const navPulsar = createState({
  currentTab: 'home'
});
```

---

## 4. Flujo de Trabajo y Reactividad

El ciclo de reactividad en este sistema es **simple y desacoplado**:

### 4.1. Suscripción

Un componente o módulo de lógica **se suscribe** al `Pulsar` que le interesa.

```javascript
// Lógica que reacciona a los cambios de autenticación
const authListener = () => {
  const { isLoggedIn, user } = authPulsar.getState();
  //
  console.log(`Estado de sesión: ${isLoggedIn ? 'ACTIVO' : 'INACTIVO'}`);
  if (user) {
    console.log(`Usuario: ${user.name}`);
  }
};

// Conectar el listener y guardar la función de limpieza
const unsubscribe = authPulsar.subscribe(authListener); 
```

### 4.2. Emisión de Señal (Mutación)

Una acción en la aplicación (ej. clic en el botón de login) llama a `setState` en el `Pulsar` adecuado.

```javascript
// Simulación de inicio de sesión exitoso
authPulsar.setState({ 
  isLoggedIn: true, 
  token: 'xyz123',
  user: { id: 1, name: 'Alice' }
}); 

// Resultado: La función 'authListener' se ejecuta inmediatamente.
```

### 4.3. Limpieza (Cleanup)

Para prevenir fugas de memoria, es crucial llamar a la función de limpieza cuando el componente que se suscribió ya no existe.

```javascript
// Cuando el componente se "desmonta" o ya no necesita escuchar
unsubscribe();
```

## 5. Ejemplo

### 5.1. Estructura

```text
project/
├── Pulsars/
│   └── index.js          # Definición de Pulsars
├── components/
│   ├── Navbar.js         # Componente de navegación
│   └── ThemeToggle.js    # Componente de cambio de tema
├── Pulsar.js             # Clase Pulsar y factory
└── app.js                # Punto de entrada
```

### 5.2. Implementación

**`pulsar.js` - Sistema de Estado**

```javascript
/**
 * @file pulsar.js
 * @description Un sistema de gestión de estado reactivo, modular y atómico.
 * Basado en el patrón Observador, diseñado para simplicidad y rendimiento.
 */

class Pulsar {
  /**
   * Crea una nueva instancia de almacenamiento (Pulsar).
   * @param {Object} initialState - El estado inicial de la tienda.
   */
  constructor(initialState) {
    // Estado interno: La fuente de verdad.
    this.state = initialState;
    
    // Colección de suscriptores. Usamos un Set para:
    // 1. Evitar duplicados automáticamente.
    // 2. Optimizar la adición y eliminación de oyentes (O(1)).
    this.listeners = new Set();
  }

  /**
   * Suscribe una función (listener) a los cambios de estado.
   * 
   * @param {Function} listener - Función que se ejecutará cuando el estado cambie.
   * @param {boolean} [immediate=false] - Si es true, ejecuta el listener inmediatamente tras suscribirse.
   * @returns {Function} Función de limpieza (cleanup) para cancelar la suscripción.
   */
  subscribe(listener, immediate = false) {
    this.listeners.add(listener);
    
    // Ejecución inmediata opcional: Útil para sincronizar la UI con el estado actual
    // al momento de montar un componente, sin esperar al primer cambio.
    if (immediate) {
      try {
        listener();
      } catch (error) {
        console.error('[Pulsar] Error en ejecución inmediata del listener:', error);
      }
    }
    
    // Retornamos una función de cleanup.
    // Patrón funcional: const unsubscribe = Pulsar.subscribe(...)
    return () => this.listeners.delete(listener); 
  }

  /**
   * Obtiene una instantánea del estado actual.
   * 
   * @returns {Object} Una copia superficial (shallow copy) del estado.
   * @note Se retorna una copia para promover la inmutabilidad y evitar 
   * que referencias externas modifiquen el estado interno sin usar setState.
   */
  getState() {
    return { ...this.state }; 
  }

  /**
   * Método interno para notificar a todos los suscriptores.
   * Itera sobre el Set de listeners y ejecuta cada uno.
   * @private
   */
  _notify() {
    this.listeners.forEach(listener => {
      try {
        listener();
      } catch (error) {
        // Robustez: Un error en un listener no debe detener la propagación 
        // a los demás ni romper el flujo de la aplicación.
        console.error('[Pulsar] Error notificado en listener:', error);
      }
    });
  }

  /**
   * Actualiza el estado y emite una señal de cambio a los suscriptores.
   * Realiza una fusión superficial (shallow merge) del estado nuevo con el anterior.
   * 
   * @param {Object} newState - Objeto con las propiedades a actualizar.
   */
  setState(newState) {
    // Inmutabilidad: Creamos un nuevo objeto en lugar de mutar 'this.state'.
    this.state = { ...this.state, ...newState }; 
    this._notify();
  }
}

/**
 * Factory Function para crear Pulsars independientes.
 * Promueve la modularidad creando instancias aisladas para diferentes dominios (Auth, UI, Data).
 * 
 * @param {Object} initialState - Estado inicial para esta instancia.
 * @returns {Pulsar} Nueva instancia de Pulsar.
 */
export function createState(initialState) {
  return new Pulsar(initialState);
}
```

**`Pulsars/index.js` - Pulsars de la Aplicación**

```javascript
// Inicialización de Pulsars modulares
const authPulsar = createState({
  isLoggedIn: false,
  user: null
});

const uiPulsar = createState({
  theme: 'light',
  sidebarOpen: true
});

const navPulsar = createState({
  currentTab: 'home'
});
```

**`components/Navbar.js` - Componente Reactivo**
```javascript
function initNavbar() {
  const navbarElement = document.getElementById('navbar');
  
  // Listener que reacciona a cambios de autenticación
  const updateNavbar = () => {
    const { isLoggedIn, user } = authPulsar.getState();
    const { currentTab } = navPulsar.getState();
    
    navbarElement.innerHTML = `
      <nav>
        <span>Tab actual: ${currentTab}</span>
        ${isLoggedIn 
          ? `<span>Bienvenido, ${user.name}</span>
             <button id="logout-btn">Logout</button>`
          : `<button id="login-btn">Login</button>`
        }
      </nav>
    `;
    
    // Re-attachear event listeners después de actualizar el DOM
    attachNavbarEvents();
  };
  
  // Suscribirse a ambos Pulsars
  const unsubAuth = authPulsar.subscribe(updateNavbar, true);
  const unsubNav = navPulsar.subscribe(updateNavbar);
  
  // Retornar función de cleanup
  return () => {
    unsubAuth();
    unsubNav();
  };
}

function attachNavbarEvents() {
  const loginBtn = document.getElementById('login-btn');
  const logoutBtn = document.getElementById('logout-btn');
  
  if (loginBtn) {
    loginBtn.onclick = () => {
      authPulsar.setState({
        isLoggedIn: true,
        user: { id: 1, name: 'Alice' }
      });
    };
  }
  
  if (logoutBtn) {
    logoutBtn.onclick = () => {
      authPulsar.setState({
        isLoggedIn: false,
        user: null
      });
    };
  }
}
```

**`components/ThemeToggle.js` - Otro Componente Reactivo**

```javascript
function initThemeToggle() {
  const toggleButton = document.getElementById('theme-toggle');
  
  // Listener para cambios de tema
  const updateTheme = () => {
    const { theme } = uiPulsar.getState();
    document.body.className = theme;
    toggleButton.textContent = theme === 'light' ? '🌙 Dark' : '☀️ Light';
  };
  
  // Suscribirse con ejecución inmediata
  const unsubscribe = uiPulsar.subscribe(updateTheme, true);
  
  // Event listener para el botón
  toggleButton.onclick = () => {
    const { theme } = uiPulsar.getState();
    uiPulsar.setState({ 
      theme: theme === 'light' ? 'dark' : 'light' 
    });
  };
  
  return unsubscribe;
}
```

**`app.js` - Inicialización**

```javascript
// Inicializar la aplicación
const cleanupFunctions = [];

document.addEventListener('DOMContentLoaded', () => {
  // Inicializar componentes y guardar funciones de limpieza
  cleanupFunctions.push(initNavbar());
  cleanupFunctions.push(initThemeToggle());
  
  // Simular navegación entre tabs
  document.querySelectorAll('[data-tab]').forEach(button => {
    button.addEventListener('click', (e) => {
      const tab = e.target.dataset.tab;
      navPulsar.setState({ currentTab: tab });
    });
  });
});

// Cleanup al salir (útil en SPAs)
window.addEventListener('beforeunload', () => {
  cleanupFunctions.forEach(cleanup => cleanup());
});
```

### 5.3. HTML de Ejemplo

```html
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Sistema de Estado Modular</title>
  <style>
    body.light { background: #fff; color: #000; }
    body.dark { background: #222; color: #fff; }
    nav { display: flex; gap: 1rem; padding: 1rem; border-bottom: 1px solid; }
    button { padding: 0.5rem 1rem; cursor: pointer; }
  </style>
</head>
<body>
  <div id="navbar"></div>
  
  <div style="padding: 1rem;">
    <button id="theme-toggle">🌙 Dark</button>
    
    <div style="margin-top: 1rem;">
      <button data-tab="home">Home</button>
      <button data-tab="settings">Settings</button>
      <button data-tab="profile">Profile</button>
    </div>
  </div>
  
  <script src="Pulsar.js"></script>
  <script src="Pulsars/index.js"></script>
  <script src="components/Navbar.js"></script>
  <script src="components/ThemeToggle.js"></script>
  <script src="app.js"></script>
</body>
</html>
```

## 6. Ventajas del Sistema

### ✅ Simplicidad
- **Cero boilerplate**: No hay actions, dispatchers ni reducers
- **Curva de aprendizaje inmediata**: ~50 líneas de código core
- **Transparente**: Es completamente claro qué sucede en cada operación

### ✅ Modularidad
- **Pulsars independientes**: Cada dominio tiene su propia fuente de verdad
- **Sin acoplamiento**: Los componentes solo se suscriben a lo que necesitan
- **Escalable**: Agregar nuevos Pulsars no afecta los existentes

### ✅ Mantenibilidad
- **Manejo de errores**: Los fallos no colapsan toda la aplicación
- **Cleanup automático**: El patrón de retorno facilita la gestión de memoria
- **Debugging simple**: `console.log(Pulsar.getState())` es todo lo que necesitas

## 7. Cuándo Usar Este Sistema vs. Alternativas

| Escenario | Recomendación |
|:----------|:--------------|
| App pequeña/mediana sin framework | ✅ **Pulsar** |
| Prototipo rápido | ✅ **Pulsar** |
| App con pocas Stores (aka Pulsars) | ✅ **Pulsar** |
| Necesitas time-travel debugging | ❌ Redux + DevTools |
| Estado muy anidado y complejo | ❌ MobX o Immer |
| Operaciones asíncronas complejas | ❌ Redux-Saga o RxJS |
| Equipo grande necesita patrones formales | ❌ Redux |

## 8. Conclusión

Este sistema de gestión de estado implementa un patrón **Observador** minimalista pero robusto, ideal para aplicaciones sin framework que necesitan reactividad sin complejidad innecesaria.

**Principios clave:**
- **Señales simples**: El estado actúa como emisor de eventos
- **Modularidad**: Factory functions para Pulsars independientes
- **Reactividad desacoplada**: Los componentes reaccionan sin conocerse entre sí
- **Cleanup consciente**: Prevención de fugas de memoria desde el diseño

Para muchas aplicaciones web, este enfoque es **superior** a librerías pesadas, manteniendo la simplicidad de JavaScript vanilla con los beneficios de la reactividad.
