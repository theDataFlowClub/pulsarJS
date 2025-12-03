/**
 * @file pulsar.js
 * @description Un sistema de gestión de estado reactivo, modular y atómico.
 * Basado en el patrón Observador, diseñado para simplicidad y rendimiento.
 * A Radiant Store
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
export function createStatePulsar(initialState) {
  return new Pulsar(initialState);
}
