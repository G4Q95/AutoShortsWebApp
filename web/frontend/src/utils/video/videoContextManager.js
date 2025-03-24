/**
 * VideoContextManager.js
 * 
 * This utility class manages the VideoContext instance and provides methods
 * for adding media sources, effects, and transitions to the video composition.
 */

// Only import VideoContext on the client side
let VideoContext;
if (typeof window !== 'undefined') {
  // Client-side only
  VideoContext = require('videocontext');
  // Handle both default and named exports
  VideoContext = VideoContext.default || VideoContext;
}

class VideoContextManager {
  /**
   * Create a new VideoContextManager
   * @param {HTMLCanvasElement} canvas - The canvas element for rendering
   */
  constructor(canvas) {
    if (!VideoContext) {
      throw new Error('VideoContext can only be used in browser environment');
    }
    this.videoContext = new VideoContext(canvas);
    this.sources = new Map();
    this.effects = new Map();
    this.transitions = new Map();
    this.duration = 0;
  }

  /**
   * Add a media source to the VideoContext
   * @param {string} id - Unique identifier for the source
   * @param {string} url - URL of the media file
   * @param {string} mediaType - Type of media ('video' or 'image')
   * @returns {Object} The created source node
   */
  addSource(id, url, mediaType) {
    let source;
    
    try {
      if (mediaType === 'video') {
        source = this.videoContext.video(url);
      } else if (mediaType === 'image') {
        source = this.videoContext.image(url);
      } else {
        throw new Error(`Unsupported media type: ${mediaType}`);
      }
      
      this.sources.set(id, source);
      return source;
    } catch (error) {
      console.error('Error adding source:', error);
      throw error;
    }
  }

  /**
   * Remove a source from the VideoContext
   * @param {string} id - Identifier of the source to remove
   */
  removeSource(id) {
    const source = this.sources.get(id);
    if (source) {
      // Disconnect source from any connections
      source.disconnect();
      this.sources.delete(id);
    }
  }

  /**
   * Set the start and stop times for a source
   * @param {string} id - Source identifier
   * @param {number} startTime - Start time in seconds
   * @param {number} endTime - End time in seconds
   */
  setSourceTiming(id, startTime, endTime) {
    const source = this.sources.get(id);
    if (!source) return;
    
    source.start(startTime);
    source.stop(endTime);
    
    // Update the overall duration if needed
    if (endTime > this.duration) {
      this.duration = endTime;
    }
  }

  /**
   * Start playback
   */
  play() {
    this.videoContext.play();
  }

  /**
   * Pause playback
   */
  pause() {
    this.videoContext.pause();
  }

  /**
   * Seek to a specific time
   * @param {number} time - Time in seconds
   */
  seek(time) {
    this.videoContext.currentTime = time;
  }

  /**
   * Get the current playback time
   * @returns {number} Current time in seconds
   */
  getCurrentTime() {
    return this.videoContext.currentTime;
  }

  /**
   * Get the total duration of the composition
   * @returns {number} Duration in seconds
   */
  getDuration() {
    return this.duration;
  }

  /**
   * Add an effect to a source
   * @param {string} sourceId - Source identifier
   * @param {string|Object} effectType - Effect type or definition
   * @param {Object} options - Effect parameters
   * @returns {Object|null} The created effect node or null if source not found
   */
  addEffect(sourceId, effectType, options = {}) {
    const source = this.sources.get(sourceId);
    if (!source) return null;
    
    try {
      // Create effect from definition or built-in effect type
      const effectDefinition = typeof effectType === 'string' ? 
        VideoContext.DEFINITIONS[effectType] || effectType : effectType;
      
      const effect = this.videoContext.effect(effectDefinition);
      
      // Apply options to effect inputs
      Object.entries(options).forEach(([key, value]) => {
        if (effect.inputs && effect.inputs[key] !== undefined) {
          effect.inputs[key].value = value;
        }
      });
      
      // Connect the effect
      source.connect(effect);
      effect.connect(this.videoContext.destination);
      
      // Store the effect
      const effectId = `${sourceId}-${Date.now()}`;
      this.effects.set(effectId, effect);
      return { effectId, effect };
    } catch (error) {
      console.error('Error adding effect:', error);
      return null;
    }
  }

  /**
   * Remove an effect
   * @param {string} effectId - Effect identifier
   */
  removeEffect(effectId) {
    const effect = this.effects.get(effectId);
    if (effect) {
      effect.disconnect();
      this.effects.delete(effectId);
    }
  }

  /**
   * Add a transition between two sources
   * @param {string} sourceAId - First source identifier
   * @param {string} sourceBId - Second source identifier
   * @param {string|Object} type - Transition type or definition
   * @param {number} startTime - Start time of transition
   * @param {number} endTime - End time of transition
   * @param {number} mix - Mix amount (0 to 1)
   * @returns {Object|null} The created transition node or null if sources not found
   */
  addTransition(sourceAId, sourceBId, type, startTime, endTime, mix = 1.0) {
    const sourceA = this.sources.get(sourceAId);
    const sourceB = this.sources.get(sourceBId);
    
    if (!sourceA || !sourceB) return null;
    
    try {
      // Create transition from definition or built-in type
      const transitionDefinition = typeof type === 'string' ? 
        VideoContext.DEFINITIONS[type] || type : type;
      
      const transition = this.videoContext.transition(transitionDefinition);
      
      // Connect sources to transition
      sourceA.connect(transition);
      sourceB.connect(transition);
      transition.connect(this.videoContext.destination);
      
      // Set up transition timing
      transition.transition(startTime, endTime, 0.0, mix);
      
      // Store the transition
      const transitionId = `${sourceAId}-${sourceBId}-${Date.now()}`;
      this.transitions.set(transitionId, transition);
      return { transitionId, transition };
    } catch (error) {
      console.error('Error adding transition:', error);
      return null;
    }
  }

  /**
   * Remove a transition
   * @param {string} transitionId - Transition identifier
   */
  removeTransition(transitionId) {
    const transition = this.transitions.get(transitionId);
    if (transition) {
      transition.disconnect();
      this.transitions.delete(transitionId);
    }
  }

  /**
   * Register event handlers for VideoContext events
   * @param {string} eventName - Name of the event
   * @param {Function} handler - Event handler function
   */
  registerEvent(eventName, handler) {
    this.videoContext.registerCallback(eventName, handler);
  }

  /**
   * Clean up and release resources
   */
  destroy() {
    try {
      // Reset VideoContext and clear all nodes
      this.videoContext.reset();
      
      // Clear all collections
      this.sources.clear();
      this.effects.clear();
      this.transitions.clear();
    } catch (error) {
      console.error('Error destroying VideoContextManager:', error);
    }
  }
}

export default VideoContextManager; 