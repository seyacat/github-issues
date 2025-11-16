<template>
  <div class="container">
    <h1 class="app-title">Issues en Repositorios de {{ currentUser || 'GitHub' }}</h1>
    
    <div v-if="!isAuthenticated" class="auth-section">
      <h2>Conectar con GitHub</h2>
      <p>Ingresa tu token de acceso personal de GitHub:</p>
      <input
        v-model="tokenInput"
        type="password"
        placeholder="ghp_..."
        class="token-input"
        @keyup.enter="saveToken"
      />
      <button @click="saveToken" class="btn">Conectar</button>
      <button @click="createToken" class="btn btn-secondary">Crear Token</button>
      <p style="font-size: 0.9rem; color: #8b949e; margin-top: 1rem;">
        Necesitas un token con permisos: <code>repo</code> y <code>read:org</code>
      </p>
    </div>

    <div v-else>
      <div v-if="repositories.length > 0" class="filters-section">
        <div class="filter-header">
          <h3>Filtrar por repositorios:</h3>
          <div class="dropdown">
            <button @click="toggleDropdown" class="btn btn-secondary">
              Agregar repositorio ▼
            </button>
            <div v-if="showDropdown" class="dropdown-content">
              <div v-for="repo in repositories" :key="repo.id" class="dropdown-item">
                <label>
                  <input
                    type="checkbox"
                    :value="repo.full_name"
                    v-model="selectedRepos"
                    @change="saveSelectedRepos"
                  />
                  {{ repo.full_name }}
                </label>
              </div>
            </div>
          </div>
        </div>
        
        <div v-if="selectedRepos.length > 0" class="selected-repos">
          <div v-for="repo in selectedRepos" :key="repo" class="repo-pill">
            {{ repo }}
            <button @click="removeRepo(repo)" class="pill-remove">×</button>
          </div>
          <button @click="clearAllRepos" class="btn btn-secondary btn-small">
            Limpiar todos
          </button>
        </div>
      </div>

      <div style="margin-bottom: 2rem; display: flex; gap: 1rem; justify-content: center;">
        <button @click="loadIssues" class="btn" :disabled="loading">
          {{ loading ? 'Cargando...' : 'Cargar Issues' }}
        </button>
        <button @click="logout" class="btn btn-secondary">Cerrar Sesión</button>
      </div>

      <div v-if="error" class="error">
        {{ error }}
      </div>

      <div v-if="loading" class="loading">
        Cargando issues...
      </div>

      <div v-else-if="filteredIssues.length > 0" class="issues-list">
        <h2>Issues Abiertos ({{ filteredIssues.length }})</h2>
        
        <div v-for="repo in groupedIssues" :key="repo.name" class="repo-section">
          <div class="repo-header">
            <h3>{{ repo.name }}</h3>
            <button @click="createIssue(repo.name)" class="btn btn-small">
              Crear Issue
            </button>
          </div>
          <div v-for="issue in repo.issues" :key="issue.id" class="issue-item">
            <div class="issue-header" @click="toggleIssue(issue.id)">
              <div class="issue-title">
                <a :href="issue.html_url" target="_blank" class="issue-link" @click.stop>
                  {{ issue.title }}
                </a>
              </div>
              <div class="issue-meta">
                #{{ issue.number }} •
                Creado: {{ formatDate(issue.created_at) }} •
                Por: <a :href="issue.user.html_url" target="_blank" @click.stop>{{ issue.user.login }}</a>
                <span v-if="issue.labels.length > 0" class="issue-labels">
                  •
                  <span v-for="label in issue.labels" :key="label.name" class="label"
                        :style="{ backgroundColor: '#' + label.color, color: getLabelTextColor(label.color) }">
                    {{ label.name }}
                  </span>
                </span>
              </div>
              <div class="expand-icon">
                {{ expandedIssues[issue.id] ? '▼' : '▶' }}
              </div>
            </div>
            <div v-if="expandedIssues[issue.id]" class="issue-content">
              <div class="issue-body" v-html="renderMarkdown(issue.body)"></div>
            </div>
          </div>
        </div>
      </div>

      <div v-else-if="!loading && filteredIssues.length === 0 && selectedRepos.length > 0">
        <p>No se encontraron issues abiertos en los repositorios seleccionados.</p>
      </div>
      <div v-else-if="!loading && selectedRepos.length === 0">
        <p>Selecciona repositorios para ver los issues.</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { githubService } from './services/githubService'

interface Repository {
  id: number
  name: string
  full_name: string
  private: boolean
}

interface Issue {
  id: number
  title: string
  html_url: string
  number: number
  created_at: string
  repository: string
  body: string
  user: {
    login: string
    html_url: string
  }
  state: string
  labels: Array<{
    name: string
    color: string
  }>
}

const isAuthenticated = ref(false)
const tokenInput = ref('')
const issues = ref<Issue[]>([])
const loading = ref(false)
const error = ref('')
const expandedIssues = ref<Record<number, boolean>>({})
const currentUser = ref('')
const repositories = ref<Repository[]>([])
const selectedRepos = ref<string[]>([])
const showDropdown = ref(false)
const filteredIssues = ref<Issue[]>([])

const saveToken = async () => {
  if (tokenInput.value.trim()) {
    githubService.setToken(tokenInput.value.trim())
    try {
      const user = await githubService.getCurrentUser()
      currentUser.value = user.login
      // Cargar repositorios automáticamente al autenticarse
      const userRepos = await githubService.getUserRepositories()
      repositories.value = userRepos
      loadSelectedRepos()
    } catch (err) {
      console.error('Error al obtener usuario o repositorios:', err)
      currentUser.value = ''
    }
    isAuthenticated.value = true
    tokenInput.value = ''
  }
}

const logout = () => {
  githubService.clearToken()
  isAuthenticated.value = false
  issues.value = []
  currentUser.value = ''
  repositories.value = []
  selectedRepos.value = []
  filteredIssues.value = []
}

const loadIssues = async () => {
  if (selectedRepos.value.length === 0) {
    error.value = 'Debes seleccionar al menos un repositorio para cargar issues'
    return
  }

  loading.value = true
  error.value = ''
  issues.value = []
  filteredIssues.value = []

  try {
    const allIssues = await githubService.getAllOpenIssues(selectedRepos.value)
    issues.value = allIssues
    filteredIssues.value = allIssues
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Error al cargar issues'
    console.error('Error loading issues:', err)
  } finally {
    loading.value = false
  }
}

const createToken = () => {
  window.open('https://github.com/settings/tokens/new?scopes=repo,read:org&description=GitHub+Issues+PWA', '_blank')
}

const toggleDropdown = () => {
  showDropdown.value = !showDropdown.value
}

const toggleIssue = (issueId: number) => {
  expandedIssues.value[issueId] = !expandedIssues.value[issueId]
}

const loadSelectedRepos = () => {
  const saved = localStorage.getItem('selected_repos')
  if (saved) {
    selectedRepos.value = JSON.parse(saved)
  }
}

const saveSelectedRepos = () => {
  localStorage.setItem('selected_repos', JSON.stringify(selectedRepos.value))
}

const removeRepo = (repo: string) => {
  selectedRepos.value = selectedRepos.value.filter(r => r !== repo)
  saveSelectedRepos()
}

const clearAllRepos = () => {
  selectedRepos.value = []
  saveSelectedRepos()
}

const groupedIssues = computed(() => {
  const groups: { [key: string]: { name: string; issues: Issue[] } } = {}
  
  // Primero agregar todos los repositorios seleccionados
  selectedRepos.value.forEach(repoName => {
    if (!groups[repoName]) {
      groups[repoName] = {
        name: repoName,
        issues: []
      }
    }
  })
  
  // Luego agregar los issues a sus repositorios correspondientes
  filteredIssues.value.forEach(issue => {
    if (!groups[issue.repository]) {
      groups[issue.repository] = {
        name: issue.repository,
        issues: []
      }
    }
    groups[issue.repository].issues.push(issue)
  })
  
  return Object.values(groups).sort((a, b) => a.name.localeCompare(b.name))
})

const createIssue = (repoName: string) => {
  window.open(`https://github.com/${repoName}/issues/new`, '_blank')
}

const getLabelTextColor = (backgroundColor: string) => {
  const hex = backgroundColor.replace('#', '')
  const r = parseInt(hex.substr(0, 2), 16)
  const g = parseInt(hex.substr(2, 2), 16)
  const b = parseInt(hex.substr(4, 2), 16)
  const brightness = (r * 299 + g * 587 + b * 114) / 1000
  return brightness > 128 ? '#000000' : '#ffffff'
}

const renderMarkdown = (text: string) => {
  if (!text) return '<p>No hay descripción disponible</p>'
  
  return text
    .replace(/\n/g, '<br>')
    .replace(/#{1,6}\s+(.*?)(?=\n|$)/g, '<strong>$1</strong>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code>$1</code>')
    .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank">$1</a>')
}

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('es-ES')
}

onMounted(async () => {
  if (githubService.hasToken()) {
    isAuthenticated.value = true
    try {
      const user = await githubService.getCurrentUser()
      currentUser.value = user.login
      // Cargar repositorios automáticamente si ya hay token
      const userRepos = await githubService.getUserRepositories()
      repositories.value = userRepos
      loadSelectedRepos()
      
      // Si ya hay repositorios seleccionados, cargar issues automáticamente
      if (selectedRepos.value.length > 0) {
        await loadIssues()
      }
    } catch (err) {
      console.error('Error al obtener usuario o repositorios:', err)
    }
  }
})
</script>