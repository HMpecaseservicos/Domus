// DOMUS Utilities - Security & Helpers
// Sanitization and XSS protection

const DomusUtils = {
  // Simple HTML sanitizer (fallback if DOMPurify not loaded)
  sanitizeHTML(str) {
    if (typeof DOMPurify !== 'undefined') {
      return DOMPurify.sanitize(str, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
    }
    // Fallback: escape HTML entities
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },

  // Sanitize for display (allows some formatting)
  sanitizeDisplay(str) {
    if (typeof DOMPurify !== 'undefined') {
      return DOMPurify.sanitize(str, { 
        ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'br'],
        ALLOWED_ATTR: []
      });
    }
    return this.sanitizeHTML(str);
  },

  // Escape HTML completely
  escapeHTML(str) {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return str.replace(/[&<>"']/g, m => map[m]);
  },

  // Format date to Brazilian format
  formatDate(date) {
    return new Date(date).toLocaleDateString('pt-BR');
  },

  // Format datetime
  formatDateTime(date) {
    return new Date(date).toLocaleString('pt-BR');
  },

  // Format currency
  formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  },

  // Debounce function
  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  },

  // Generate unique ID
  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  },

  // Check if online
  isOnline() {
    return navigator.onLine;
  },

  // Safe JSON parse
  safeJSONParse(str, fallback = null) {
    try {
      return JSON.parse(str);
    } catch (e) {
      return fallback;
    }
  }
};

// Export for global use
window.DomusUtils = DomusUtils;
