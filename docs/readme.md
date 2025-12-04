<img src="https://raw.githubusercontent.com/theDataFlowClub/pulsarJS/refs/heads/null_hyp/img/iconName-2.png" width="200px">

<h1>Guia Tecnica</h1>

## 1. Introducción

Este documento especifica la arquitectura e implementación de Pulsar - un sistema de gestión de estado reactivo y modular para aplicaciones JavaScript sin framework. El sistema combina el patrón Observador para reactividad con inmutabilidad estructural mediante Immer, proporcionando una solución completa para la gestión de estado en aplicaciones de cualquier escala.

### 1.1. Objetivos del Sistema

- Implementar reactividad mediante el patrón Observador (Publish/Subscribe)
- Garantizar inmutabilidad del estado sin complejidad sintáctica
- Proporcionar modularidad mediante stores independientes por dominio
- Mantener una API simple y predecible
- Optimizar el rendimiento mediante structural sharing
- Facilitar el debugging y mantenimiento del código

### 1.2. Arquitectura General

El sistema está compuesto por tres elementos principales:

1. **Store**: Clase base que implementa el patrón Observador y gestiona el estado
2. **Factory Function**: Mecanismo para crear instancias de Store por dominio
3. **Immer Integration**: Capa de inmutabilidad que permite mutaciones aparentes sobre proxies

La comunicación entre componentes es unidireccional: los componentes se suscriben a stores específicos y reaccionan a cambios de estado mediante callbacks, mientras que las actualizaciones de estado se realizan exclusivamente a través del método `setState`.

---

## 2. Fundamentos Teóricos

### 2.1. Patrón Observador

El sistema implementa el patrón Observador donde:

- **Subject (Store)**: Mantiene el estado y una lista de observadores, notificando cambios automáticamente
- **Observer (Listener)**: Funciones que se ejecutan cuando el estado cambia
- **Desacoplamiento**: Los observadores no se conocen entre sí, solo dependen del Store

Este patrón permite que múltiples componentes reaccionen a cambios de estado sin acoplamiento directo, facilitando la escalabilidad y el mantenimiento.

### 2.2. Inmutabilidad Estructural

La inmutabilidad garantiza que cada cambio de estado produce un nuevo objeto, preservando el estado anterior. Esto es fundamental para:

- **Detección de cambios**: Comparación por referencia (===) en lugar de comparación profunda
- **Time-travel debugging**: Mantener historial de estados
- **Prevención de side effects**: El estado anterior permanece intacto
- **Concurrencia**: Estados independientes no interfieren entre sí

Immer implementa structural sharing, donde solo las partes modificadas del árbol de estado se copian, mientras que las ramas no modificadas mantienen sus referencias originales. Esto optimiza tanto memoria como rendimiento.

### 2.3. Proxies y Draft State

Immer utiliza Proxies de JavaScript para interceptar operaciones sobre el estado. Cuando se ejecuta una función de actualización:

1. Se crea un proxy (draft) del estado actual
2. Las mutaciones al draft son interceptadas y registradas
3. Se construye un nuevo árbol de estado aplicando solo los cambios registrados
4. Se retorna el nuevo estado inmutable

Este mecanismo permite escribir código que aparenta ser mutable pero produce resultados inmutables.

---

## 3. Implementación de la Clase Store

### 3.1. Estructura de la Clase

```javascript
import { produce } from 'immer';

class Store {
  constructor(initialState) {
    this.state = initialState;
    this.listeners = new Set();
  }

  subscribe(listener, immediate = false) {
    this.listeners.add(listener);
    
    if (immediate) {
      try {
        listener();
      } catch (error) {
        console.error('Error en listener inicial:', error);
      }
    }
    
    return () => this.listeners.delete(listener);
  }

  getState() {
    return this.state;
  }

  _notify() {
    this.listeners.forEach(listener => {
      try {
        listener();
      } catch (error) {
        console.error('Error en listener:', error);
      }
    });
  }

  setState(updater) {
    if (typeof updater === 'function') {
      this.state = produce(this.state, updater);
    } else {
      this.state = { ...this.state, ...updater };
    }
    this._notify();
  }
}
```

### 3.2. Análisis de Métodos

#### constructor(initialState)

Inicializa la instancia del Store con el estado base. Se utiliza `Set` en lugar de `Array` para la lista de listeners por las siguientes razones:

- Garantiza unicidad automática de listeners
- Operaciones de inserción y eliminación en O(1)
- Previene suscripciones duplicadas sin validación adicional

**Parámetros:**
- `initialState` (Object): Estado inicial del store

#### subscribe(listener, immediate)

Registra una función callback que será ejecutada cada vez que el estado cambie.

**Parámetros:**
- `listener` (Function): Función a ejecutar en cada cambio de estado
- `immediate` (Boolean, default: false): Si es true, ejecuta el listener inmediatamente

**Retorno:**
- Function: Función de limpieza para cancelar la suscripción

**Características:**

El parámetro `immediate` permite sincronización inicial del componente con el estado actual sin esperar al primer cambio. Esto es útil para:

- Renderizado inicial de componentes
- Sincronización de UI con estado existente
- Evitar estados intermedios inconsistentes

El patrón de retorno de función de limpieza facilita la gestión de ciclo de vida en componentes, permitiendo código como:

```javascript
function initComponent() {
  const unsubscribe = store.subscribe(updateUI);
  return unsubscribe; // Retornar para cleanup posterior
}
```

El manejo de errores en el listener inicial previene que excepciones en la inicialización interrumpan el flujo de suscripción.

#### getState()

Retorna el estado actual del Store. A diferencia de implementaciones sin Immer que requieren copias defensivas, este método puede retornar la referencia directa ya que Immer garantiza la inmutabilidad del estado.

**Retorno:**
- Object: Estado actual

**Nota sobre inmutabilidad:** El estado retornado es inmutable por diseño. Cualquier intento de mutación directa no afectará el estado interno del Store, ya que las actualizaciones deben pasar por `setState`.

#### _notify()

Método interno que itera sobre todos los listeners registrados y los ejecuta. El prefijo underscore indica que es un método privado por convención.

**Características de manejo de errores:**

Cada listener se ejecuta dentro de un bloque try-catch individual. Esto garantiza que:

- Un error en un listener no impide la notificación a otros listeners
- Los errores se registran en consola para debugging
- El sistema mantiene su estabilidad ante excepciones

Este comportamiento es crítico en sistemas con múltiples componentes independientes suscritos al mismo Store.

#### setState(updater)

Método principal para actualizar el estado. Acepta dos tipos de parámetros:

**1. Función (recipe function):**

Cuando se pasa una función, se utiliza Immer para producir el nuevo estado de forma inmutable:

```javascript
store.setState(draft => {
  draft.user.name = 'Alice';
  draft.user.age += 1;
});
```

La función recibe un draft (proxy) del estado actual donde se pueden realizar mutaciones aparentes. Immer intercepta estas operaciones y produce un nuevo estado inmutable.

Ventajas de este enfoque:

- Sintaxis natural para actualizaciones complejas
- Structural sharing automático
- Seguridad ante mutaciones accidentales
- Código más legible para estado anidado

**2. Objeto (merge object):**

Cuando se pasa un objeto, se realiza un merge superficial usando spread operator:

```javascript
store.setState({ isLoading: false, error: null });
```

Este modo es óptimo para:

- Actualizaciones simples de propiedades de primer nivel
- Casos donde no se necesita structural sharing de Immer
- Performance en actualizaciones frecuentes y simples

**Flujo de ejecución:**

1. Determina el tipo de updater (función u objeto)
2. Produce el nuevo estado según el tipo
3. Asigna el nuevo estado a `this.state`
4. Invoca `_notify()` para actualizar todos los observers

---

## 4. Factory Function y Modularidad

### 4.1. Implementación de createStateStore

```javascript
function createStateStore(initialState) {
  return new Store(initialState);
}
```

Esta función factory proporciona un punto de entrada consistente para la creación de stores, facilitando:

- Posible instrumentación futura (logging, devtools)
- Modificación centralizada de la lógica de creación
- Abstracción de la implementación interna de Store

### 4.2. Patrón de Stores Modulares

La arquitectura modular se implementa creando múltiples instancias de Store, cada una responsable de un dominio específico de la aplicación:

```javascript
// stores/index.js
export const authStore = createStateStore({
  isLoggedIn: false,
  token: null,
  user: null,
  permissions: []
});

export const uiStore = createStateStore({
  theme: 'light',
  sidebarOpen: true,
  notifications: [],
  activeModal: null
});

export const dataStore = createStateStore({
  users: [],
  posts: [],
  comments: [],
  isLoading: false,
  error: null
});
```

### 4.3. Ventajas de la Modularidad

**Separación de responsabilidades:**
Cada store gestiona un dominio específico, facilitando el razonamiento sobre el estado y reduciendo la complejidad cognitiva.

**Suscripciones granulares:**
Los componentes se suscriben solo a los stores relevantes, evitando re-renders innecesarios cuando cambian partes no relacionadas del estado.

**Testing independiente:**
Cada store puede probarse de forma aislada sin dependencias de otros dominios.

**Escalabilidad:**
Agregar nuevos dominios no afecta stores existentes, permitiendo crecimiento orgánico de la aplicación.

**Performance:**
Las notificaciones se propagan solo a los listeners del store modificado, no a toda la aplicación.

---

## 5. Operaciones con Estado

### 5.1. Actualizaciones Simples

Para propiedades de primer nivel, el objeto merge es suficiente:

```javascript
authStore.setState({ isLoggedIn: true });
uiStore.setState({ theme: 'dark', sidebarOpen: false });
```

### 5.2. Actualizaciones Anidadas

Para estructuras profundamente anidadas, las funciones de actualización proporcionan sintaxis clara:

```javascript
const state = {
  user: {
    profile: {
      name: 'Bob',
      contact: {
        email: 'bob@example.com',
        phones: ['555-1234']
      }
    }
  }
};

// Actualización profunda
store.setState(draft => {
  draft.user.profile.contact.phones.push('555-5678');
  draft.user.profile.name = 'Robert';
});
```

Sin Immer, esta operación requeriría múltiples niveles de spread:

```javascript
// Equivalente sin Immer (verbose)
store.setState({
  user: {
    ...state.user,
    profile: {
      ...state.user.profile,
      name: 'Robert',
      contact: {
        ...state.user.profile.contact,
        phones: [...state.user.profile.contact.phones, '555-5678']
      }
    }
  }
});
```

### 5.3. Operaciones con Arrays

#### Agregar elementos

```javascript
store.setState(draft => {
  draft.items.push({ id: 4, name: 'New Item' });
  // o
  draft.items.unshift({ id: 0, name: 'First Item' });
});
```

#### Eliminar elementos

```javascript
// Por índice
store.setState(draft => {
  draft.items.splice(index, 1);
});

// Por filtrado
store.setState(draft => {
  draft.items = draft.items.filter(item => item.id !== targetId);
});
```

#### Actualizar elementos

```javascript
// Búsqueda y modificación directa
store.setState(draft => {
  const item = draft.items.find(item => item.id === targetId);
  if (item) {
    item.name = 'Updated Name';
    item.quantity += 1;
  }
});

// Transformación de múltiples elementos
store.setState(draft => {
  draft.items.forEach(item => {
    if (item.category === 'electronics') {
      item.discount = 0.10;
    }
  });
});
```

#### Reordenar elementos

```javascript
store.setState(draft => {
  const [removed] = draft.items.splice(oldIndex, 1);
  draft.items.splice(newIndex, 0, removed);
});
```

### 5.4. Operaciones Condicionales

Las funciones de actualización permiten lógica compleja:

```javascript
store.setState(draft => {
  if (draft.cart.items.length === 0) {
    draft.cart.discount = 0;
  } else if (draft.cart.total > 1000) {
    draft.cart.discount = 0.15;
  } else {
    draft.cart.discount = 0.05;
  }
  
  draft.cart.finalTotal = draft.cart.total * (1 - draft.cart.discount);
});
```

### 5.5. Actualizaciones Múltiples Coordinadas

```javascript
store.setState(draft => {
  // Agregar producto al carrito
  draft.cart.items.push(newProduct);
  
  // Actualizar inventario
  const inventoryItem = draft.inventory.find(i => i.id === newProduct.id);
  if (inventoryItem) {
    inventoryItem.stock -= 1;
  }
  
  // Recalcular total
  draft.cart.total = draft.cart.items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );
});
```

### 5.6. Reemplazo Completo de Estado

En casos donde se necesita reemplazar completamente el estado, se puede retornar un nuevo objeto:

```javascript
store.setState(draft => {
  return { 
    newStructure: 'completely different',
    data: []
  };
});
```

Cuando se retorna un valor, los cambios al draft se ignoran y el valor retornado se convierte en el nuevo estado.

---

## 6. Gestión de Suscripciones

### 6.1. Patrón Básico de Suscripción

```javascript
function initComponent() {
  const updateUI = () => {
    const state = store.getState();
    // Actualizar interfaz basándose en el estado
  };
  
  const unsubscribe = store.subscribe(updateUI);
  
  // Retornar función de limpieza
  return unsubscribe;
}
```

### 6.2. Suscripción con Inicialización Inmediata

Para componentes que necesitan renderizarse con el estado actual:

```javascript
function initComponent() {
  const render = () => {
    const { items, isLoading } = store.getState();
    
    if (isLoading) {
      showLoadingSpinner();
    } else {
      renderItems(items);
    }
  };
  
  // Renderiza inmediatamente con estado actual
  const unsubscribe = store.subscribe(render, true);
  
  return unsubscribe;
}
```

### 6.3. Múltiples Suscripciones

Un componente puede suscribirse a múltiples stores:

```javascript
function initDashboard() {
  const unsubscribers = [];
  
  unsubscribers.push(
    authStore.subscribe(() => {
      updateUserInfo(authStore.getState());
    })
  );
  
  unsubscribers.push(
    dataStore.subscribe(() => {
      updateCharts(dataStore.getState());
    })
  );
  
  unsubscribers.push(
    uiStore.subscribe(() => {
      applyTheme(uiStore.getState().theme);
    })
  );
  
  // Función de limpieza que cancela todas las suscripciones
  return () => {
    unsubscribers.forEach(unsub => unsub());
  };
}
```

### 6.4. Suscripciones Condicionales

En algunos casos, puede ser necesario suscribirse condicionalmente:

```javascript
function initFeature() {
  const { hasPermission } = authStore.getState();
  
  if (!hasPermission) {
    return () => {}; // No-op cleanup
  }
  
  const unsubscribe = dataStore.subscribe(() => {
    // Lógica que requiere permisos
  });
  
  return unsubscribe;
}
```

### 6.5. Gestión de Ciclo de Vida

#### En aplicaciones vanilla JavaScript

```javascript
class Component {
  constructor(element) {
    this.element = element;
    this.unsubscribers = [];
  }
  
  mount() {
    this.unsubscribers.push(
      store.subscribe(this.render.bind(this), true)
    );
  }
  
  unmount() {
    this.unsubscribers.forEach(unsub => unsub());
    this.unsubscribers = [];
  }
  
  render() {
    const state = store.getState();
    this.element.innerHTML = this.template(state);
  }
}
```

#### En Single Page Applications

```javascript
class Router {
  navigate(route) {
    // Limpiar componente anterior
    if (this.currentCleanup) {
      this.currentCleanup();
    }
    
    // Montar nuevo componente
    this.currentCleanup = this.components[route].init();
  }
}
```

---

## 7. Patrones Avanzados

### 7.1. Acciones como Funciones

Encapsular lógica de actualización en funciones reutilizables:

```javascript
// actions/auth.js
export function login(store, credentials) {
  store.setState(draft => {
    draft.isLoading = true;
    draft.error = null;
  });
  
  return api.login(credentials)
    .then(response => {
      store.setState(draft => {
        draft.isLoggedIn = true;
        draft.user = response.user;
        draft.token = response.token;
        draft.isLoading = false;
      });
    })
    .catch(error => {
      store.setState(draft => {
        draft.error = error.message;
        draft.isLoading = false;
      });
    });
}

export function logout(store) {
  store.setState(draft => {
    draft.isLoggedIn = false;
    draft.user = null;
    draft.token = null;
  });
}

// Uso
import { login, logout } from './actions/auth';

loginButton.onclick = () => {
  login(authStore, { username, password });
};
```

### 7.2. Selectores

Funciones que extraen y transforman datos del estado:

```javascript
// selectors/cart.js
export function selectCartTotal(state) {
  return state.items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );
}

export function selectCartItemCount(state) {
  return state.items.reduce(
    (sum, item) => sum + item.quantity,
    0
  );
}

export function selectActivePromotions(state) {
  return state.promotions.filter(p => {
    const now = Date.now();
    return p.startDate <= now && p.endDate >= now;
  });
}

// Uso
cartStore.subscribe(() => {
  const state = cartStore.getState();
  const total = selectCartTotal(state);
  const itemCount = selectCartItemCount(state);
  
  updateCartBadge(itemCount);
  updateTotalDisplay(total);
});
```

### 7.3. Middleware Pattern

Interceptar actualizaciones de estado para logging, validación o side effects:

```javascript
class Store {
  constructor(initialState, middleware = []) {
    this.state = initialState;
    this.listeners = new Set();
    this.middleware = middleware;
  }
  
  setState(updater) {
    const prevState = this.state;
    
    if (typeof updater === 'function') {
      this.state = produce(this.state, updater);
    } else {
      this.state = { ...this.state, ...updater };
    }
    
    // Ejecutar middleware
    this.middleware.forEach(mw => {
      mw(prevState, this.state, updater);
    });
    
    this._notify();
  }
}

// Middleware de logging
const loggingMiddleware = (prevState, nextState, updater) => {
  console.group('State Update');
  console.log('Previous:', prevState);
  console.log('Next:', nextState);
  console.log('Updater:', updater);
  console.groupEnd();
};

// Middleware de validación
const validationMiddleware = (prevState, nextState, updater) => {
  if (nextState.user && !nextState.user.id) {
    console.warn('User object missing required id property');
  }
};

// Uso
const store = new Store(
  { user: null },
  [loggingMiddleware, validationMiddleware]
);
```

### 7.4. Computed Values

Para valores derivados que deben actualizarse automáticamente:

```javascript
class ComputedStore extends Store {
  constructor(initialState, computations = {}) {
    super(initialState);
    this.computations = computations;
    this._computeValues();
  }
  
  _computeValues() {
    Object.entries(this.computations).forEach(([key, fn]) => {
      this.state[key] = fn(this.state);
    });
  }
  
  setState(updater) {
    super.setState(updater);
    this._computeValues();
  }
}

// Uso
const cartStore = new ComputedStore(
  { items: [], discount: 0 },
  {
    subtotal: state => state.items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    ),
    total: state => state.subtotal * (1 - state.discount)
  }
);

// Ahora state.subtotal y state.total se calculan automáticamente
```

### 7.5. Persistencia

Sincronización automática con localStorage:

```javascript
class PersistentStore extends Store {
  constructor(initialState, storageKey) {
    const persisted = localStorage.getItem(storageKey);
    const state = persisted ? JSON.parse(persisted) : initialState;
    
    super(state);
    this.storageKey = storageKey;
  }
  
  setState(updater) {
    super.setState(updater);
    localStorage.setItem(this.storageKey, JSON.stringify(this.state));
  }
}

// Uso
const settingsStore = new PersistentStore(
  { theme: 'light', language: 'en' },
  'app-settings'
);
```

### 7.6. Optimistic Updates

Para interfaces más responsivas:

```javascript
function updateUserProfile(store, userId, updates) {
  const prevState = store.getState();
  
  // Actualización optimista
  store.setState(draft => {
    const user = draft.users.find(u => u.id === userId);
    if (user) {
      Object.assign(user, updates);
    }
  });
  
  // Llamada a API
  return api.updateUser(userId, updates)
    .catch(error => {
      // Revertir en caso de error
      store.setState(prevState);
      throw error;
    });
}
```

---

## 8. Casos de Uso Complejos

### 8.1. Sistema de Formularios Multi-Step

```javascript
const formStore = createStateStore({
  currentStep: 1,
  steps: {
    1: {
      fields: {
        firstName: { value: '', error: null, touched: false },
        lastName: { value: '', error: null, touched: false },
        email: { value: '', error: null, touched: false }
      },
      isValid: false
    },
    2: {
      fields: {
        address: { value: '', error: null, touched: false },
        city: { value: '', error: null, touched: false },
        postalCode: { value: '', error: null, touched: false }
      },
      isValid: false
    },
    3: {
      fields: {
        cardNumber: { value: '', error: null, touched: false },
        expiry: { value: '', error: null, touched: false },
        cvv: { value: '', error: null, touched: false }
      },
      isValid: false
    }
  },
  isSubmitting: false,
  submitError: null
});

// Actualizar campo
function updateField(step, fieldName, value) {
  formStore.setState(draft => {
    const field = draft.steps[step].fields[fieldName];
    field.value = value;
    field.touched = true;
    
    // Validación inline
    if (fieldName === 'email' && !value.includes('@')) {
      field.error = 'Email inválido';
    } else {
      field.error = null;
    }
  });
}

// Validar paso completo
function validateStep(step) {
  formStore.setState(draft => {
    const stepData = draft.steps[step];
    const fields = Object.values(stepData.fields);
    
    stepData.isValid = fields.every(f => f.value && !f.error);
  });
}

// Navegar entre pasos
function nextStep() {
  const { currentStep, steps } = formStore.getState();
  
  if (steps[currentStep].isValid) {
    formStore.setState(draft => {
      draft.currentStep += 1;
    });
  }
}
```

### 8.2. Sistema de Notificaciones

```javascript
const notificationStore = createStateStore({
  notifications: [],
  maxNotifications: 5
});

function addNotification(message, type = 'info', duration = 5000) {
  const id = Date.now() + Math.random();
  
  notificationStore.setState(draft => {
    draft.notifications.unshift({
      id,
      message,
      type,
      timestamp: Date.now()
    });
    
    // Mantener solo las últimas N notificaciones
    if (draft.notifications.length > draft.maxNotifications) {
      draft.notifications = draft.notifications.slice(0, draft.maxNotifications);
    }
  });
  
  // Auto-dismiss
  if (duration > 0) {
    setTimeout(() => {
      dismissNotification(id);
    }, duration);
  }
  
  return id;
}

function dismissNotification(id) {
  notificationStore.setState(draft => {
    draft.notifications = draft.notifications.filter(n => n.id !== id);
  });
}

function clearAllNotifications() {
  notificationStore.setState(draft => {
    draft.notifications = [];
  });
}
```

### 8.3. Sistema de Navegación con Historial

```javascript
const navigationStore = createStateStore({
  current: '/',
  history: ['/'],
  forward: [],
  params: {},
  query: {}
});

function navigate(path, params = {}, query = {}) {
  navigationStore.setState(draft => {
    draft.history.push(draft.current);
    draft.current = path;
    draft.params = params;
    draft.query = query;
    draft.forward = []; // Clear forward history on new navigation
  });
}

function goBack() {
  navigationStore.setState(draft => {
    if (draft.history.length > 0) {
      draft.forward.unshift(draft.current);
      draft.current = draft.history.pop();
    }
  });
}

function goForward() {
  navigationStore.setState(draft => {
    if (draft.forward.length > 0) {
      draft.history.push(draft.current);
      draft.current = draft.forward.shift();
    }
  });
}
```

### 8.4. Sistema de Caché con TTL

```javascript
const cacheStore = createStateStore({
  entries: {},
  metadata: {}
});

function setCache(key, value, ttl = 60000) {
  cacheStore.setState(draft => {
    draft.entries[key] = value;
    draft.metadata[key] = {
      timestamp: Date.now(),
      ttl
    };
  });
  
  // Auto-invalidación
  setTimeout(() => {
    invalidateCache(key);
  }, ttl);
}

function getCache(key) {
  const { entries, metadata } = cacheStore.getState();
  
  if (!entries[key]) {
    return null;
  }
  
  const meta = metadata[key];
  const age = Date.now() - meta.timestamp;
  
  if (age > meta.ttl) {
    invalidateCache(key);
    return null;
  }
  
  return entries[key];
}

function invalidateCache(key) {
  cacheStore.setState(draft => {
    delete draft.entries[key];
    delete draft.metadata[key];
  });
}
```

### 8.5. Sistema de Búsqueda y Filtrado

```javascript
const searchStore = createStateStore({
  query: '',
  filters: {
    category: 'all',
    priceRange: [0, 1000],
    inStock: false,
    rating: 0
  },
  sort: {
    field: 'name',
    direction: 'asc'
  },
  results: [],
  isSearching: false
});

function updateQuery(query) {
  searchStore.setState(draft => {
    draft.query = query;
  });
  performSearch();
}

function updateFilter(filterName, value) {
  searchStore.setState(draft => {
    draft.filters[filterName] = value;
  });
  performSearch();
}

function updateSort(field, direction) {
  searchStore.setState(draft => {
    draft.sort.field = field;
    draft.sort.direction = direction;
  });
  sortResults();
}

function performSearch() {
  const { query, filters } = searchStore.getState();
  
  searchStore.setState(draft => {
    draft.isSearching = true;
  });
  
  api.search(query, filters)
    .then(results => {
      searchStore.setState(draft => {
        draft.results = results;
        draft.isSearching = false;
      });
    });
}
```

---

## 9. Optimización y Performance

### 9.1. Structural Sharing

Immer implementa structural sharing, lo que significa que solo las partes del estado que realmente cambian se copian. Las partes no modificadas mantienen sus referencias originales:

```javascript
const state = {
  user: { name: 'Alice', age: 25 },
  posts: [{ id: 1, title: 'Post 1' }],
  settings: { theme: 'dark' }
};

const newState = produce(state, draft => {
  draft.user.age = 26;
});

// Verificación de structural sharing
console.log(state.user === newState.user);        // false (modificado)
console.log(state.posts === newState.posts);      // true (compartido)
console.log(state.settings === newState.settings); // true (compartido)
```

Este comportamiento optimiza:

- **Memoria**: No se duplican objetos no modificados
- **Comparaciones**: Detección rápida de cambios por referencia
- **Re-renders**: En frameworks UI, solo re-renderiza componentes con referencias diferentes

### 9.2. Minimización de Notificaciones

Para evitar notificaciones innecesarias, agrupa múltiples cambios en una única llamada a `setState`:

```javascript
// Subóptimo: Múltiples notificaciones
store.setState({ isLoading: true });
store.setState({ data: null });
store.setState({ error: null });

// Óptimo: Una sola notificación
store.setState(draft => {
  draft.isLoading = true;
  draft.data = null;
  draft.error = null;
});
```

### 9.3. Suscripciones Selectivas

Divide el estado en stores modulares para que los componentes se suscriban solo a los datos relevantes:

```javascript
// Subóptimo: Store monolítico
const appStore = createStateStore({
  auth: { /* ... */ },
  ui: { /* ... */ },
  data: { /* ... */ }
});

// Todos los componentes reciben notificación en cualquier cambio

// Óptimo: Stores modulares
const authStore = createStateStore({ /* ... */ });
const uiStore = createStateStore({ /* ... */ });
const dataStore = createStateStore({ /* ... */ });

// Los componentes solo escuchan lo que necesitan
```

### 9.4. Debouncing de Actualizaciones

Para cambios frecuentes como entrada de texto, implementa debouncing:

```javascript
let debounceTimer;

function updateSearchQuery(query) {
  clearTimeout(debounceTimer);
  
  debounceTimer = setTimeout(() => {
    searchStore.setState({ query });
  }, 300);
}
```

### 9.5. Memoización en Selectores

Para selectores computacionalmente costosos, implementa memoización:

```javascript
class MemoizedSelector {
  constructor(selector) {
    this.selector = selector;
    this.lastState = null;
    this.lastResult = null;
  }
  
  compute(state) {
    if (state === this.lastState) {
      return this.lastResult;
    }
    
    this.lastState = state;
    this.lastResult = this.selector(state);
    return this.lastResult;
  }
}

const expensiveSelector = new MemoizedSelector(state => {
  // Cálculo costoso
  return state.items.map(item => ({
    ...item,
    computed: complexCalculation(item)
  }));
});

store.subscribe(() => {
  const result = expensiveSelector.compute(store.getState());
  updateUI(result);
});
```

### 9.6. Lazy Loading de Estado

Para aplicaciones grandes, carga partes del estado bajo demanda:

```javascript
const featureStore = createStateStore({
  core: { /* datos esenciales */ },
  features: {}
});

function loadFeature(featureName) {
  if (featureStore.getState().features[featureName]) {
    return Promise.resolve();
  }
  
  return api.loadFeatureData(featureName).then(data => {
    featureStore.setState(draft => {
      draft.features[featureName] = data;
    });
  });
}
```

---

## 10. Testing

### 10.1. Testing de Stores

Los stores son fáciles de probar debido a su naturaleza determinista:

```javascript
// store.test.js
import { createStateStore } from './store';

describe('Store', () => {
  let store;
  
  beforeEach(() => {
    store = createStateStore({ count: 0 });
  });
  
  test('initializes with correct state', () => {
    expect(store.getState()).toEqual({ count: 0 });
  });
  
  test('updates state with object merge', () => {
    store.setState({ count: 5 });
    expect(store.getState()).toEqual({ count: 5 });
  });
  
  test('updates state with function', () => {
    store.setState(draft => {
      draft.count += 1;
    });
    expect(store.getState()).toEqual({ count: 1 });
  });
  
  test('notifies listeners on state change', () => {
    const listener = jest.fn();
    store.subscribe(listener);
    
    store.setState({ count: 10 });
    
    expect(listener).toHaveBeenCalledTimes(1);
  });
  
  test('allows unsubscription', () => {
    const listener = jest.fn();
    const unsubscribe = store.subscribe(listener);
    
    unsubscribe();
    store.setState({ count: 5 });
    
    expect(listener).not.toHaveBeenCalled();
  });
  
  test('calls listener immediately when immediate flag is true', () => {
    const listener = jest.fn();
    store.subscribe(listener, true);
    
    expect(listener).toHaveBeenCalledTimes(1);
  });
  
  test('maintains immutability', () => {
    const originalState = store.getState();
    
    store.setState(draft => {
      draft.count = 100;
    });
    
    expect(originalState.count).toBe(0);
    expect(store.getState().count).toBe(100);
  });
});
```

### 10.2. Testing de Acciones

```javascript
// actions.test.js
import { login } from './actions/auth';
import { createStateStore } from './store';

describe('Auth Actions', () => {
  let authStore;
  
  beforeEach(() => {
    authStore = createStateStore({
      isLoggedIn: false,
      user: null,
      isLoading: false,
      error: null
    });
  });
  
  test('login sets loading state', () => {
    login(authStore, { username: 'test', password: 'pass' });
    
    expect(authStore.getState().isLoading).toBe(true);
  });
  
  test('successful login updates state', async () => {
    const mockResponse = { user: { id: 1, name: 'Test' }, token: 'abc' };
    global.fetch = jest.fn(() =>
      Promise.resolve({
        json: () => Promise.resolve(mockResponse)
      })
    );
    
    await login(authStore, { username: 'test', password: 'pass' });
    
    expect(authStore.getState().isLoggedIn).toBe(true);
    expect(authStore.getState().user).toEqual(mockResponse.user);
  });
});
```

### 10.3. Testing de Selectores

```javascript
// selectors.test.js
import { selectCartTotal, selectActiveItems } from './selectors/cart';

describe('Cart Selectors', () => {
  const mockState = {
    items: [
      { id: 1, name: 'Item 1', price: 10, quantity: 2, active: true },
      { id: 2, name: 'Item 2', price: 20, quantity: 1, active: false },
      { id: 3, name: 'Item 3', price: 15, quantity: 3, active: true }
    ]
  };
  
  test('selectCartTotal calculates correct total', () => {
    const total = selectCartTotal(mockState);
    expect(total).toBe(85); // (10*2) + (20*1) + (15*3)
  });
  
  test('selectActiveItems filters correctly', () => {
    const activeItems = selectActiveItems(mockState);
    expect(activeItems).toHaveLength(2);
    expect(activeItems.every(item => item.active)).toBe(true);
  });
});
```

### 10.4. Integration Testing

```javascript
// integration.test.js
import { createStateStore } from './store';
import { addToCart, removeFromCart, applyDiscount } from './actions/cart';
import { selectCartTotal } from './selectors/cart';

describe('Cart Integration', () => {
  let cartStore;
  
  beforeEach(() => {
    cartStore = createStateStore({
      items: [],
      discount: 0
    });
  });
  
  test('complete shopping flow', () => {
    // Add items
    addToCart(cartStore, { id: 1, name: 'Item 1', price: 100 });
    addToCart(cartStore, { id: 2, name: 'Item 2', price: 50 });
    
    expect(cartStore.getState().items).toHaveLength(2);
    expect(selectCartTotal(cartStore.getState())).toBe(150);
    
    // Apply discount
    applyDiscount(cartStore, 0.10);
    expect(selectCartTotal(cartStore.getState())).toBe(135);
    
    // Remove item
    removeFromCart(cartStore, 1);
    expect(cartStore.getState().items).toHaveLength(1);
    expect(selectCartTotal(cartStore.getState())).toBe(45);
  });
});
```

---

## 11. Debugging y Desarrollo

### 11.1. Logging de Estado

Implementa logging para rastrear cambios de estado:

```javascript
class DebugStore extends Store {
  setState(updater) {
    const prevState = this.getState();
    super.setState(updater);
    const nextState = this.getState();
    
    console.group('State Update');
    console.log('Previous:', prevState);
    console.log('Next:', nextState);
    console.log('Updater:', updater);
    console.trace('Stack trace');
    console.groupEnd();
  }
}
```

### 11.2. Time-Travel Debugging

Implementa historial de estados:

```javascript
class HistoryStore extends Store {
  constructor(initialState, maxHistory = 50) {
    super(initialState);
    this.history = [initialState];
    this.currentIndex = 0;
    this.maxHistory = maxHistory;
  }
  
  setState(updater) {
    super.setState(updater);
    
    // Truncar historial futuro al hacer un nuevo cambio
    this.history = this.history.slice(0, this.currentIndex + 1);
    
    // Agregar nuevo estado al historial
    this.history.push(this.state);
    
    // Limitar tamaño del historial
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    } else {
      this.currentIndex++;
    }
  }
  
  undo() {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      this.state = this.history[this.currentIndex];
      this._notify();
    }
  }
  
  redo() {
    if (this.currentIndex < this.history.length - 1) {
      this.currentIndex++;
      this.state = this.history[this.currentIndex];
      this._notify();
    }
  }
  
  canUndo() {
    return this.currentIndex > 0;
  }
  
  canRedo() {
    return this.currentIndex < this.history.length - 1;
  }
}
```

### 11.3. State Snapshots

Captura y restaura estados para debugging:

```javascript
class SnapshotStore extends Store {
  constructor(initialState) {
    super(initialState);
    this.snapshots = new Map();
  }
  
  createSnapshot(name) {
    this.snapshots.set(name, JSON.parse(JSON.stringify(this.state)));
  }
  
  restoreSnapshot(name) {
    const snapshot = this.snapshots.get(name);
    if (snapshot) {
      this.state = snapshot;
      this._notify();
    }
  }
  
  listSnapshots() {
    return Array.from(this.snapshots.keys());
  }
}
```

### 11.4. Performance Monitoring

Mide el tiempo de actualizaciones y notificaciones:

```javascript
class PerformanceStore extends Store {
  setState(updater) {
    const startTime = performance.now();
    super.setState(updater);
    const endTime = performance.now();
    
    const duration = endTime - startTime;
    if (duration > 16) { // Más de un frame (60fps)
      console.warn(`Slow state update: ${duration.toFixed(2)}ms`);
    }
  }
  
  _notify() {
    const startTime = performance.now();
    super._notify();
    const endTime = performance.now();
    
    const duration = endTime - startTime;
    if (duration > 16) {
      console.warn(`Slow notification: ${duration.toFixed(2)}ms for ${this.listeners.size} listeners`);
    }
  }
}
```

---

## 12. Comparación con Alternativas

### 12.1. Redux

**Características de Redux:**

- Actions explícitas con tipos definidos
- Reducers puros para transformaciones de estado
- Middleware para side effects
- DevTools con time-travel
- Ecosistema extenso

**Ventajas de este sistema sobre Redux:**

- Cero boilerplate: No requiere actions, action creators, ni reducers
- Curva de aprendizaje inmediata: Conceptos simples y directos
- Menos código: Aproximadamente 50 líneas vs. cientos en Redux
- Flexibilidad: No impone estructura rígida
- Performance: Sin overhead de despacho de actions

**Cuándo usar Redux:**

- Equipos grandes que necesitan convenciones estrictas
- Aplicaciones que requieren debugging avanzado con DevTools
- Sistemas con flujos de acciones complejos y middleware extenso

### 12.2. MobX

**Características de MobX:**

- Reactividad automática mediante observables
- Proxies para detección de cambios
- Computed values automáticos
- Decoradores para sintaxis declarativa

**Ventajas de este sistema sobre MobX:**

- Simplicidad: No requiere entender observables, reactions, ni computed
- Explícito: Los cambios de estado son explícitos, no mágicos
- Control: El desarrollador decide cuándo notificar
- Sin decoradores: No requiere configuración de transpilación

**Cuándo usar MobX:**

- Aplicaciones con muchos valores derivados complejos
- Equipos familiarizados con programación reactiva
- Casos donde la reactividad automática justifica la complejidad

### 12.3. Context API (React)

**Características de Context API:**

- Integrado en React
- Evita prop drilling
- Re-renderiza componentes automáticamente

**Ventajas de este sistema sobre Context API:**

- Framework agnostic: Funciona con vanilla JS, React, Vue, etc.
- Control granular: Suscripciones selectivas sin re-renders innecesarios
- Performance: No causa re-renders de árbol completo
- Portabilidad: El mismo código funciona en cualquier contexto

**Cuándo usar Context API:**

- Aplicación exclusivamente React
- Estado simple y poco frecuente
- Integración profunda con hooks de React

### 12.4. Vuex/Pinia

**Características de Vuex/Pinia:**

- Integrado con Vue
- Mutations y actions separadas
- Computed properties automáticos

**Ventajas de este sistema sobre Vuex/Pinia:**

- Framework agnostic
- Menos conceptos: No hay mutations vs. actions
- Más simple: No requiere módulos específicos de Vue

**Cuándo usar Vuex/Pinia:**

- Aplicación exclusivamente Vue
- Necesitas integración profunda con Vue DevTools
- El equipo está familiarizado con el ecosistema Vue

---

## 13. Mejores Prácticas

### 13.1. Organización de Código

Estructura de directorios recomendada:

```
src/
├── stores/
│   ├── index.js           # Exporta todos los stores
│   ├── auth.js            # authStore
│   ├── ui.js              # uiStore
│   └── data.js            # dataStore
├── actions/
│   ├── auth.js            # Acciones de autenticación
│   ├── cart.js            # Acciones del carrito
│   └── notifications.js   # Acciones de notificaciones
├── selectors/
│   ├── cart.js            # Selectores del carrito
│   ├── user.js            # Selectores de usuario
│   └── products.js        # Selectores de productos
├── utils/
│   └── store.js           # Clase Store y factory
└── app.js                 # Punto de entrada
```

### 13.2. Nomenclatura

**Stores:**

```javascript
// Usar sufijo 'Store'
const authStore = createStateStore({ /* ... */ });
const cartStore = createStateStore({ /* ... */ });
const uiStore = createStateStore({ /* ... */ });
```

**Acciones:**

```javascript
// Verbos que describen la operación
function addToCart(store, product) { /* ... */ }
function removeFromCart(store, productId) { /* ... */ }
function updateQuantity(store, productId, quantity) { /* ... */ }
```

**Selectores:**

```javascript
// Prefijo 'select' seguido del nombre del dato
function selectCartTotal(state) { /* ... */ }
function selectActiveUsers(state) { /* ... */ }
function selectFilteredProducts(state) { /* ... */ }
```

### 13.3. Separación de Responsabilidades

**Store:** Solo contiene estado y lógica de notificación

```javascript
// store.js - Solo mecanismo de estado
class Store {
  // Implementación pura sin lógica de negocio
}
```

**Acciones:** Contienen lógica de negocio

```javascript
// actions/cart.js - Lógica de negocio
export function checkout(cartStore, paymentInfo) {
  cartStore.setState(draft => {
    draft.isProcessing = true;
  });
  
  return processPayment(paymentInfo)
    .then(result => {
      cartStore.setState(draft => {
        draft.items = [];
        draft.isProcessing = false;
        draft.lastOrderId = result.orderId;
      });
    });
}
```

**Selectores:** Transforman y derivan datos

```javascript
// selectors/cart.js - Transformaciones de datos
export function selectCartSummary(state) {
  return {
    itemCount: state.items.length,
    subtotal: calculateSubtotal(state.items),
    tax: calculateTax(state.items),
    total: calculateTotal(state.items)
  };
}
```

### 13.4. Estado Normalizado

Para datos relacionales, normaliza el estado:

```javascript
// Subóptimo: Datos duplicados
const state = {
  posts: [
    { id: 1, title: 'Post 1', author: { id: 1, name: 'Alice' } },
    { id: 2, title: 'Post 2', author: { id: 1, name: 'Alice' } }
  ]
};

// Óptimo: Estado normalizado
const state = {
  posts: {
    byId: {
      1: { id: 1, title: 'Post 1', authorId: 1 },
      2: { id: 2, title: 'Post 2', authorId: 1 }
    },
    allIds: [1, 2]
  },
  authors: {
    byId: {
      1: { id: 1, name: 'Alice' }
    },
    allIds: [1]
  }
};
```

### 13.5. Validación de Estado

Implementa validación para prevenir estados inválidos:

```javascript
function createValidatedStore(initialState, schema) {
  const store = createStateStore(initialState);
  const originalSetState = store.setState.bind(store);
  
  store.setState = function(updater) {
    originalSetState(updater);
    
    const errors = validateState(store.getState(), schema);
    if (errors.length > 0) {
      console.error('Invalid state:', errors);
    }
  };
  
  return store;
}
```

### 13.6. Documentación de Estado

Documenta la estructura del estado:

```javascript
/**
 * Auth Store State Schema
 * 
 * @typedef {Object} AuthState
 * @property {boolean} isLoggedIn - Usuario autenticado
 * @property {Object|null} user - Datos del usuario actual
 * @property {number} user.id - ID único del usuario
 * @property {string} user.name - Nombre del usuario
 * @property {string} user.email - Email del usuario
 * @property {string|null} token - JWT token
 * @property {boolean} isLoading - Estado de carga
 * @property {string|null} error - Mensaje de error
 */

export const authStore = createStateStore({
  isLoggedIn: false,
  user: null,
  token: null,
  isLoading: false,
  error: null
});
```

---

## 14. Migración y Adopción

### 14.1. Migración desde Redux

**Mapeo de conceptos:**

| Redux | Este Sistema |
|-------|-------------|
| Store | Store (similar) |
| Action | Función regular |
| Action Creator | Función regular |
| Reducer | Función de actualización en setState |
| Dispatch | setState |
| Selector | Función selectora (igual) |
| Middleware | Extensión de Store |

**Ejemplo de migración:**

Redux:
```javascript
// Action
const ADD_TODO = 'ADD_TODO';
function addTodo(text) {
  return { type: ADD_TODO, text };
}

// Reducer
function todosReducer(state = [], action) {
  switch (action.type) {
    case ADD_TODO:
      return [...state, { id: Date.now(), text: action.text, done: false }];
    default:
      return state;
  }
}

// Uso
store.dispatch(addTodo('Nueva tarea'));
```

Este sistema:
```javascript
// Action (función simple)
function addTodo(store, text) {
  store.setState(draft => {
    draft.push({ id: Date.now(), text, done: false });
  });
}

// Uso
addTodo(todosStore, 'Nueva tarea');
```

### 14.2. Adopción Incremental

Para adoptar gradualmente en una aplicación existente:

**Fase 1:** Introduce stores para nuevas funcionalidades

```javascript
// Nueva funcionalidad usa el sistema
const newFeatureStore = createStateStore({ /* ... */ });
```

**Fase 2:** Migra módulos independientes

```javascript
// Migra módulos con poco acoplamiento primero
const notificationStore = createStateStore({ /* ... */ });
```

**Fase 3:** Refactoriza módulos centrales

```javascript
// Finalmente migra estado central
const appStore = createStateStore({ /* ... */ });
```

### 14.3. Interoperabilidad

Integra con sistemas existentes mediante adaptadores:

```javascript
// Adaptador para Redux DevTools
class DevToolsStore extends Store {
  constructor(initialState) {
    super(initialState);
    
    this.devTools = window.__REDUX_DEVTOOLS_EXTENSION__?.connect({
      name: 'Custom Store'
    });
    
    this.devTools?.init(initialState);
  }
  
  setState(updater) {
    const prevState = this.state;
    super.setState(updater);
    
    this.devTools?.send(
      { type: 'STATE_UPDATE', updater: updater.toString() },
      this.state
    );
  }
}
```

---

## 15. Limitaciones y Consideraciones

### 15.1. Limitaciones del Sistema

**Comparación superficial en objeto merge:**

Cuando se usa setState con un objeto, solo se realiza un merge superficial. Para actualizaciones profundas, se debe usar una función:

```javascript
// No funciona como esperado para objetos anidados
store.setState({ user: { name: 'Alice' } }); // Reemplaza todo user

// Correcto
store.setState(draft => {
  draft.user.name = 'Alice';
});
```

**Sin reactividad automática:**

A diferencia de MobX, los valores derivados no se actualizan automáticamente. Deben recalcularse en cada cambio o implementarse como computed values manualmente.

**Sin time-travel por defecto:**

El historial de estados debe implementarse manualmente si se requiere debugging con time-travel.

### 15.2. Consideraciones de Escala

**Para aplicaciones pequeñas (< 10 stores):**

El sistema es ideal y proporciona todo lo necesario sin complejidad innecesaria.

**Para aplicaciones medianas (10-30 stores):**

Considera implementar:
- Namespace para stores relacionados
- Middleware para logging y debugging
- Validación de estado en desarrollo

**Para aplicaciones grandes (> 30 stores):**

Evalúa si necesitas:
- DevTools integration
- Plugins de terceros
- Patrones más formalizados (Redux, MobX)

### 15.3. Rendimiento en Escala

**Número de listeners:**

Con menos de 100 listeners por store, el rendimiento es excelente. Para más, considera:
- Dividir en múltiples stores
- Implementar batching de notificaciones
- Usar selectores memoizados

**Tamaño del estado:**

Immer maneja eficientemente estados grandes mediante structural sharing, pero para estados masivos (>10MB), considera:
- Normalización de datos
- Lazy loading de secciones del estado
- Persistencia selectiva

**Frecuencia de actualizaciones:**

Para actualizaciones muy frecuentes (>60/segundo), considera:
- Debouncing de cambios
- Batching de actualizaciones
- Optimistic updates

---

## 16. Conclusión

Este sistema de gestión de estado proporciona una solución completa y práctica para aplicaciones JavaScript sin framework, combinando:

- **Simplicidad conceptual**: Patrón Observador clásico sin abstracciones innecesarias
- **Inmutabilidad práctica**: Sintaxis mutable que produce resultados inmutables
- **Modularidad escalable**: Stores independientes que crecen con la aplicación
- **Performance optimizado**: Structural sharing y notificaciones granulares
- **Testing sencillo**: Funciones puras y comportamiento predecible

El sistema es apropiado para:

- Aplicaciones vanilla JavaScript de cualquier tamaño
- Prototipos y MVPs que requieren rapidez
- Proyectos donde la simplicidad es prioritaria
- Equipos que valoran código explícito sobre magia

La combinación de Store como mecanismo de reactividad con Immer como motor de inmutabilidad crea una solución que es simultáneamente poderosa y accesible, proporcionando las características esenciales de gestión de estado sin la complejidad de frameworks completos.

Para aplicaciones que eventualmente requieran características avanzadas como time-travel debugging, middleware extenso o integración profunda con DevTools, la arquitectura permite migración gradual a soluciones más robustas sin reescribir completamente la lógica de negocio.
