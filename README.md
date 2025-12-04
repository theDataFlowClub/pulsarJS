<img src="https://raw.githubusercontent.com/theDataFlowClub/pulsarJS/refs/heads/null_hyp/img/iconName-2.png" width="200px">

*Gestión de Estado Reactiva, Modular y Atómica.*

<br>

**Pulsar** es un sistema de gestión de estado para JavaScript diseñado bajo una premisa simple: el estado de tu aplicación debe ser el **corazón rítmico** que emite señales de cambio, no un laberinto de complejidad.

Inspirado en el patrón **Observador**, Pulsar actúa como una fuente de verdad centralizada que emite "pulsos" de actualización a tus componentes solo cuando es necesario, manteniendo tu lógica de negocio desacoplada y tu UI sincronizada.

## ¿Por qué Pulsar?

>
> *Sin reducers. Sin boilerplate. Solo señales puras.*
>

A diferencia de las grandes librerías monolíticas, Pulsar se enfoca en la **modularidad a través de Factory Functions**.

  * **📡 Emisión de Señales:** Tu estado no es estático; es un emisor activo. Los componentes se "sintonizan" (suscriben) y reaccionan al instante.
  * **💎 Cero Boilerplate:** Olvida los *dispatchers*, *actions* y *switch-cases* infinitos. Si sabes usar `setState`, sabes usar Pulsar.
  * **🛡️ Resiliente:** Arquitectura robusta donde un error en un oyente no detiene la propagación de la señal al resto del sistema.
  * **🧹 Cleanup Elegante:** Suscribirse retorna directamente una función de limpieza, previniendo fugas de memoria con un patrón funcional y moderno.
  * **🧩 Arquitectura Atómica:** No existe un "Gran Store" gigante. Crea múltiples *stores* especializados (`authStore`, `uiStore`, `navStore`) que viven y operan independientemente.

## Instalación rápida

```javascript
// 1. Crea tu Pulsar (Store)
import { createStateStore } from './pulsar';

export const userStore = createStateStore({ 
  name: 'Invitado', 
  active: false 
});

// 2. Conecta la señal (Suscribe)
// El componente escucha y reacciona.
const stopListening = userStore.subscribe(() => {
  const { name } = userStore.getState();
  console.log(`Usuario actual: ${name}`);
});

// 3. Emite el pulso (Actualiza)
userStore.setState({ name: 'Alex', active: true });

// 4. Corta la señal cuando termines (Cleanup)
stopListening();
```

## 🧠 Filosofía de Diseño

Pulsar no es solo código; es una respuesta a la complejidad innecesaria. Este sistema fue construido siguiendo las ventajas de la gestión de estado sin frameworks.

### 1. Ventajas Arquitectónicas
Pulsar capitaliza los beneficios de trabajar con JavaScript puro:

* **🚀 Rendimiento Nativo:** Al eliminar el *overhead* de los frameworks grandes, Pulsar ofrece una velocidad de ejecución pura. Sin *middlewares* pesados, tus aplicaciones vuelan.
* **📦 Cero Dependencias:** Menos dependencias significan menos conflictos de versiones y un *bundle size* minúsculo. Pulsar es ligero por definición.
* **🧘 Simplicidad Radical:** La complejidad cognitiva se reduce drásticamente. El código es fácil de leer, entender y auditar, ideal para proyectos que buscan mantenibilidad a largo plazo.

### 2. Cumplimiento de Buenas Prácticas

* **💋 KISS - Keep It Simple, Stupid:**
    * *El Estándar:* Evitar sobre-complicar la gestión del estado.
    * *En Pulsar:* Lo logramos con una implementación de ~50 líneas de código que evita abstracciones innecesarias.
* **🎯 Single Source of Truth:**
    * *El Estándar:* Mantener el estado centralizado para evitar inconsistencias.
    * *En Pulsar:* Cada instancia de `Store` actúa como la autoridad central y definitiva para su dominio específico.
* **🛡️ Inmutabilidad por Diseño:**
    * *El Estándar:* Reducir bugs y facilitar la gestión de transiciones de estado.
    * *En Pulsar:* `getState()` retorna copias defensivas y `setState()` fusiona objetos en lugar de mutar referencias, protegiendo la integridad de tus datos.
* **🎭 Separación de Responsabilidades:**
    * *El Estándar:* Desacoplar la lógica de estado de la UI.
    * *En Pulsar:* Los componentes de UI son meros suscriptores; no conocen la lógica interna del estado, solo reaccionan a sus señales.
