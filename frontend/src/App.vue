<script>
import { RouterLink, RouterView } from 'vue-router'

export default {
  name: 'App',
  components: {
    RouterLink,
    RouterView
  },
  setup() {
    // Lógica del componente principal
    // Por ahora solo retornamos las referencias necesarias
    return {
      // Aquí irán las propiedades reactivas cuando las necesitemos
    }
  }
}
</script>

<template>
  <div id="app" class="d-flex flex-column min-vh-100">
    <!-- Header con navegación moderna -->
    <header class="main-header">
      <nav class="navbar navbar-expand-lg">
        <div class="container">
          <RouterLink to="/" class="navbar-brand d-flex align-items-center">
            <div class="brand-logo">
              <span class="logo-emoji">🐕</span>
              <span class="logo-background"></span>
            </div>
            <div class="brand-text">
              <div class="brand-title">PetAI</div>
              <small class="brand-subtitle">ML • Computer Vision • 2025</small>
            </div>
          </RouterLink>
          
          <button class="navbar-toggler" type="button" data-bs-toggle="collapse" 
                  data-bs-target="#navbarNav" aria-controls="navbarNav" 
                  aria-expanded="false" aria-label="Toggle navigation">
            <span class="toggler-icon"></span>
            <span class="toggler-icon"></span>
            <span class="toggler-icon"></span>
          </button>
          
          <div class="collapse navbar-collapse" id="navbarNav">
            <ul class="navbar-nav ms-auto">
              <li class="nav-item">
                <RouterLink to="/" class="nav-link modern-nav-link">
                  <i class="bi bi-house-door me-2"></i>
                  <span>Inicio</span>
                </RouterLink>
              </li>
              <li class="nav-item">
                <RouterLink to="/mlops" class="nav-link modern-nav-link featured">
                  <i class="bi bi-gear-wide-connected me-2"></i>
                  <span>MLOps</span>
                  <span class="badge">New</span>
                </RouterLink>
              </li>
              <li class="nav-item">
                <a href="https://github.com/alvaroph/petAI" target="_blank" class="nav-link modern-nav-link github-link">
                  <i class="bi bi-github me-2"></i>
                  <span>GitHub</span>
                  <i class="bi bi-box-arrow-up-right ms-1" style="font-size: 0.8rem;"></i>
                </a>
              </li>
            </ul>
          </div>
        </div>
      </nav>
    </header>

    <!-- Contenido principal -->
    <main class="flex-grow-1 py-4">
      <RouterView />
    </main>

    <!-- Footer -->
    <footer class="main-footer bg-light border-top py-4 mt-auto">
      <div class="container text-center">
        <div class="row">
          <div class="col-12">
            <p class="mb-2 text-muted">
              &copy; 2025 PetAI - Proyecto Educativo de Machine Learning
            </p>
            <div class="alert alert-warning alert-sm mb-0" role="alert">
              <i class="bi bi-mortarboard-fill me-2"></i>
              <strong>Proyecto Educativo 2025:</strong> Demostración de MLOps y Computer Vision con TensorFlow.js
            </div>
          </div>
        </div>
      </div>
    </footer>
  </div>
</template>

<style scoped>
/* Header moderno 2025 */
.main-header {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid var(--border);
  box-shadow: var(--shadow-sm);
  position: sticky;
  top: 0;
  z-index: 1000;
}

.navbar {
  padding: 1rem 0;
}

/* Brand moderno */
.navbar-brand {
  text-decoration: none !important;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  transition: all 0.3s ease;
}

.brand-logo {
  position: relative;
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.logo-emoji {
  font-size: 1.75rem;
  z-index: 2;
  position: relative;
}

.logo-background {
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%);
  border-radius: 12px;
  opacity: 0.1;
  transition: all 0.3s ease;
}

.navbar-brand:hover .logo-background {
  opacity: 0.2;
  transform: scale(1.05);
}

.brand-text {
  display: flex;
  flex-direction: column;
}

.brand-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1;
  background: linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.brand-subtitle {
  font-size: 0.75rem;
  color: var(--text-muted);
  font-weight: 500;
  letter-spacing: 0.5px;
  text-transform: uppercase;
}

/* Navegación moderna */
.modern-nav-link {
  display: flex;
  align-items: center;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  font-weight: 500;
  color: var(--text-secondary);
  text-decoration: none;
  transition: all 0.2s ease;
  position: relative;
}

.modern-nav-link:hover {
  color: var(--primary);
  background: var(--primary-light);
  transform: translateY(-1px);
}

.modern-nav-link.router-link-active {
  color: var(--primary);
  background: var(--primary-light);
  font-weight: 600;
}

.modern-nav-link.featured {
  background: linear-gradient(135deg, var(--primary-light) 0%, var(--secondary-light) 100%);
  border: 1px solid var(--primary);
  color: var(--primary);
}

.modern-nav-link.featured:hover {
  background: linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%);
  color: white;
}

.modern-nav-link .badge {
  background: var(--secondary);
  color: white;
  font-size: 0.6rem;
  padding: 0.2rem 0.4rem;
  border-radius: 4px;
  margin-left: 0.5rem;
  font-weight: 600;
}

.github-link {
  border: 1px solid var(--border);
}

.github-link:hover {
  background: var(--gray-900);
  color: white;
  border-color: var(--gray-900);
}

/* Toggler moderno */
.navbar-toggler {
  border: none;
  padding: 0.5rem;
  background: none;
  display: flex;
  flex-direction: column;
  gap: 3px;
  width: 32px;
  height: 32px;
  justify-content: center;
  align-items: center;
}

.toggler-icon {
  width: 20px;
  height: 2px;
  background: var(--text-primary);
  border-radius: 1px;
  transition: all 0.3s ease;
}

.navbar-toggler:hover .toggler-icon {
  background: var(--primary);
}

.navbar-toggler:focus {
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.25);
  outline: none;
}

/* Footer moderno */
.main-footer {
  background: var(--bg-secondary);
  border-top: 1px solid var(--border);
}

.alert-sm {
  padding: 0.75rem 1rem;
  font-size: 0.875rem;
  border-radius: 8px;
}

.alert-warning {
  background: var(--yellow-50);
  border: 1px solid var(--yellow-200);
  color: var(--yellow-800);
}

/* Responsivo */
@media (max-width: 991.98px) {
  .navbar-nav {
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid var(--border);
    gap: 0.5rem;
  }
  
  .modern-nav-link {
    justify-content: flex-start;
  }
  
  .brand-title {
    font-size: 1.25rem;
  }
  
  .brand-subtitle {
    font-size: 0.7rem;
  }
}

@media (max-width: 575.98px) {
  .navbar {
    padding: 0.75rem 0;
  }
  
  .brand-logo {
    width: 40px;
    height: 40px;
  }
  
  .logo-emoji {
    font-size: 1.5rem;
  }
  
  .brand-title {
    font-size: 1.1rem;
  }
}

/* Animaciones y efectos */
@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.navbar-nav {
  animation: slideIn 0.3s ease;
}

/* Mejoras de accesibilidad */
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
</style>

