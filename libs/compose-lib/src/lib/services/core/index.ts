/**
 * Core Services for Component Injection System
 * 
 * Clean, well-separated services following Single Responsibility Principle.
 * Each service has a specific purpose and clear boundaries.
 * 
 * @module CoreServices
 */

// Event Bus - Foundation service for event coordination
export * from './component-event-bus.service';

// Registry - Component type registration and lookup
export * from './component-registry.service';

// State - Component instance state management with Signals
export * from './component-state.service';

// Renderer - CDK Portal-based component rendering
export * from './component-renderer.service';
