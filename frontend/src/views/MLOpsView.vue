<template>
  <div class="mlops-view">
    <!-- Navigation Header -->
    <nav class="navbar navbar-expand-lg navbar-light bg-light mb-4">
      <div class="container">
        <router-link class="navbar-brand" to="/">
          <i class="fas fa-paw me-2"></i>
          PetAI
        </router-link>
        
        <div class="navbar-nav ms-auto">
          <router-link class="nav-link" to="/">
            <i class="fas fa-home me-1"></i>
            Inicio
          </router-link>
          <router-link class="nav-link active" to="/mlops">
            <i class="fas fa-cogs me-1"></i>
            MLOps Dashboard
          </router-link>
        </div>
      </div>
    </nav>

    <!-- MLOps Dashboard -->
    <MLOpsDashboard />
  </div>
</template>

<script>
import MLOpsDashboard from '../components/MLOpsDashboard.vue'

export default {
  name: 'MLOpsView',
  components: {
    MLOpsDashboard
  }
}
</script>

<style scoped>
.mlops-view {
  min-height: 100vh;
  background-color: #f8f9fa;
}

.navbar-brand {
  font-weight: bold;
  color: #28a745 !important;
}

.nav-link.active {
  font-weight: bold;
  color: #007bff !important;
}
</style>