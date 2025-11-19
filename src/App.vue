<template>
  <div class="container">
    <div class="header-section">
      <h1 class="app-title">Issues in Repositories of {{ currentUser ? currentUser.charAt(0).toUpperCase() + currentUser.slice(1) : 'GitHub' }}</h1>
      <button v-if="showInstallButton" @click="installApp" class="install-btn" title="Install App">
        📱 Install
      </button>
    </div>
    
    <div v-if="!isAuthenticated" class="auth-section">
      <h2>Connect with GitHub</h2>
      <p>Enter your GitHub personal access token:</p>
      <input
        v-model="tokenInput"
        type="password"
        placeholder="ghp_..."
        class="token-input"
        @keyup.enter="saveToken"
      />
      <button @click="saveToken" class="btn">Connect</button>
      <button @click="createToken" class="btn btn-secondary">Create Token</button>
      <p style="font-size: 0.9rem; color: #8b949e; margin-top: 1rem;">
        You need a token with permissions: <code>repo</code> and <code>read:org</code>
      </p>
    </div>

    <div v-else>
      <div v-if="repositories.length > 0" class="filters-section">
        <div class="filter-header">
          <div class="selected-repos-container">
            <div class="selected-repos">
              <div v-for="repo in selectedRepos" :key="repo" class="repo-pill">
                {{ repo }}
                <button @click="removeRepo(repo)" class="pill-remove">×</button>
              </div>
              <button v-if="selectedRepos.length > 0" @click="clearAllRepos" class="btn btn-secondary btn-small">
                Clear all
              </button>
            </div>
          </div>
          <div class="dropdown-container">
            <div class="dropdown">
              <button @click="toggleDropdown" class="btn btn-secondary">
                Add repository ▼
              </button>
              <div v-if="showDropdown" class="dropdown-content" @blur="showDropdown = false" tabindex="0">
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
        </div>
        
      </div>

      <div style="margin-bottom: 1.5rem; display: flex; gap: 1rem; justify-content: center;">
        <button @click="loadIssues" class="btn" :disabled="loading">
          {{ loading ? 'Loading...' : 'Load Issues' }}
        </button>
        <button @click="logout" class="btn btn-secondary">Logout</button>
      </div>

      <div v-if="error" class="error">
        {{ error }}
      </div>

      <div v-if="loading" class="loading">
        Loading issues...
      </div>

      <div v-else-if="filteredIssues.length > 0 || pullRequestsWithoutIssues.length > 0" class="issues-list">
        <div v-for="repoName in selectedRepos" :key="repoName" class="repo-section">
          <div class="repo-header">
            <h3>
              <a :href="`https://github.com/${repoName}`" target="_blank" class="repo-link">
                {{ repoName }}
              </a>
            </h3>
            <button @click="createIssue(repoName)" class="btn btn-small">
              Create Issue
            </button>
          </div>
          
          <!-- Issues Cerradas con PRs Abiertos -->
          <div v-if="getClosedIssuesWithPRsForRepo(repoName).length > 0" class="repo-section-category">
            <h4>Closed Issues with Open PRs ({{ getClosedIssuesWithPRsForRepo(repoName).length }})</h4>
            <div v-for="issue in getClosedIssuesWithPRsForRepo(repoName)" :key="issue.id" class="issue-item">
              <div class="issue-header">
                <div class="issue-main">
                  <div class="issue-title">
                    <a :href="issue.html_url" target="_blank" class="issue-link" @click.stop>
                      {{ issue.title }}
                    </a>
                  </div>
                  <div class="issue-meta">
                    #{{ issue.number }} •
                    Created: {{ formatDate(issue.created_at) }} •
                    By: <a :href="issue.user.html_url" target="_blank" @click.stop>{{ issue.user.login }}</a>
                    <span v-if="issue.assignees.length > 0" class="assignees">
                      • Assigned to:
                      <span v-for="assignee in issue.assignees" :key="assignee.login" class="assignee">
                        <a :href="assignee.html_url" target="_blank" @click.stop>{{ assignee.login }}</a>
                      </span>
                    </span>
                    <span v-if="issue.labels.length > 0" class="issue-labels">
                      •
                      <span v-for="label in issue.labels" :key="label.name" class="label"
                            :style="{ backgroundColor: '#' + label.color, color: getLabelTextColor(label.color) }"
                            :title="label.name">
                        {{ label.name }}
                      </span>
                    </span>
                  </div>
                </div>
                <button @click="toggleIssue(issue.id)" class="expand-btn" :title="expandedIssues[issue.id] ? 'Collapse' : 'Expand'">
                  {{ expandedIssues[issue.id] ? '▼' : '▶' }}
                </button>
              </div>
              <div v-if="(issue.linked_branches && issue.linked_branches.length > 0) || (issue.linked_pull_requests && issue.linked_pull_requests.length > 0)" class="issue-links">
                <div v-if="issue.linked_branches && issue.linked_branches.length > 0" class="issue-branches">
                  <span class="branches-label">Branches:</span>
                  <span v-for="branch in issue.linked_branches" :key="branch.name" class="branch">
                    <a :href="branch.url" target="_blank" @click.stop>{{ branch.name }}</a>
                  </span>
                </div>
                <div v-if="issue.linked_pull_requests && issue.linked_pull_requests.length > 0" class="issue-pulls">
                  <span class="pulls-label">Pull Requests:</span>
                  <span v-for="pr in issue.linked_pull_requests" :key="pr.number" class="pull-request">
                    <a :href="pr.html_url" target="_blank" @click.stop>#{{ pr.number }} ({{ pr.state }})</a>
                  </span>
                </div>
              </div>
              <div v-if="expandedIssues[issue.id]" class="issue-content">
                <div class="issue-body" v-html="renderMarkdown(issue.body)"></div>
                
                <!-- Comments Section -->
                <div v-if="issue.comments && issue.comments.length > 0" class="comments-section">
                  <h5 class="comments-title">Comments ({{ issue.comments.length }})</h5>
                  <div v-for="comment in issue.comments" :key="comment.id" class="comment">
                    <div class="comment-header">
                      <a :href="comment.user.html_url" target="_blank" class="comment-user">
                        {{ comment.user.login }}
                      </a>
                      <span class="comment-date">{{ formatDate(comment.created_at) }}</span>
                    </div>
                    <div class="comment-body" v-html="renderMarkdown(comment.body)"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Issues Abiertas -->
          <div v-if="getOpenIssuesForRepo(repoName).length > 0" class="repo-section-category">
            <h4>Open Issues ({{ getOpenIssuesForRepo(repoName).length }})</h4>
            <div v-for="issue in getOpenIssuesForRepo(repoName)" :key="issue.id" class="issue-item">
              <div class="issue-header">
                <div class="issue-main">
                  <div class="issue-title">
                    <a :href="issue.html_url" target="_blank" class="issue-link" @click.stop>
                      {{ issue.title }}
                    </a>
                  </div>
                  <div class="issue-meta">
                    #{{ issue.number }} •
                    Created: {{ formatDate(issue.created_at) }} •
                    By: <a :href="issue.user.html_url" target="_blank" @click.stop>{{ issue.user.login }}</a>
                    <span v-if="issue.assignees.length > 0" class="assignees">
                      • Assigned to:
                      <span v-for="assignee in issue.assignees" :key="assignee.login" class="assignee">
                        <a :href="assignee.html_url" target="_blank" @click.stop>{{ assignee.login }}</a>
                      </span>
                    </span>
                    <span v-if="issue.labels.length > 0" class="issue-labels">
                      •
                      <span v-for="label in issue.labels" :key="label.name" class="label"
                            :style="{ backgroundColor: '#' + label.color, color: getLabelTextColor(label.color) }"
                            :title="label.name">
                        {{ label.name }}
                      </span>
                    </span>
                  </div>
                </div>
                <button @click="toggleIssue(issue.id)" class="expand-btn" :title="expandedIssues[issue.id] ? 'Collapse' : 'Expand'">
                  {{ expandedIssues[issue.id] ? '▼' : '▶' }}
                </button>
              </div>
              <div v-if="(issue.linked_branches && issue.linked_branches.length > 0) || (issue.linked_pull_requests && issue.linked_pull_requests.length > 0)" class="issue-links">
                <div v-if="issue.linked_branches && issue.linked_branches.length > 0" class="issue-branches">
                  <span class="branches-label">Branches:</span>
                  <span v-for="branch in issue.linked_branches" :key="branch.name" class="branch">
                    <a :href="branch.url" target="_blank" @click.stop>{{ branch.name }}</a>
                  </span>
                </div>
                <div v-if="issue.linked_pull_requests && issue.linked_pull_requests.length > 0" class="issue-pulls">
                  <span class="pulls-label">Pull Requests:</span>
                  <span v-for="pr in issue.linked_pull_requests" :key="pr.number" class="pull-request">
                    <a :href="pr.html_url" target="_blank" @click.stop>#{{ pr.number }} ({{ pr.state }})</a>
                  </span>
                </div>
              </div>
              <div v-if="expandedIssues[issue.id]" class="issue-content">
                <div class="issue-body" v-html="renderMarkdown(issue.body)"></div>
                
                <!-- Comments Section -->
                <div v-if="issue.comments && issue.comments.length > 0" class="comments-section">
                  <h5 class="comments-title">Comments ({{ issue.comments.length }})</h5>
                  <div v-for="comment in issue.comments" :key="comment.id" class="comment">
                    <div class="comment-header">
                      <a :href="comment.user.html_url" target="_blank" class="comment-user">
                        {{ comment.user.login }}
                      </a>
                      <span class="comment-date">{{ formatDate(comment.created_at) }}</span>
                    </div>
                    <div class="comment-body" v-html="renderMarkdown(comment.body)"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- PRs sin Issues -->
          <div v-if="getPRsWithoutIssuesForRepo(repoName).length > 0" class="repo-section-category">
            <h4>PRs without Linked Issues ({{ getPRsWithoutIssuesForRepo(repoName).length }})</h4>
            <div v-for="pr in getPRsWithoutIssuesForRepo(repoName)" :key="pr.id" class="issue-item">
              <div class="issue-header">
                <div class="issue-main">
                  <div class="issue-title">
                    <a :href="pr.html_url" target="_blank" class="issue-link">
                      {{ pr.title }}
                    </a>
                  </div>
                  <div class="issue-meta">
                    PR #{{ pr.number }} •
                    Created: {{ formatDate(pr.created_at) }} •
                    By: <a :href="pr.user.html_url" target="_blank">{{ pr.user.login }}</a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-else-if="!loading && filteredIssues.length === 0 && selectedRepos.length > 0">
        <p>No open issues found in the selected repositories.</p>
      </div>
      <div v-else-if="!loading && selectedRepos.length === 0">
        <p>Select repositories to view issues.</p>
      </div>
    </div>

    <!-- Footer with version info -->
    <footer class="app-footer">
      <p>GitHub Issues PWA v{{ appVersion }}</p>
    </footer>

  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, onUnmounted } from 'vue'
import { githubService } from './services/githubService'
import packageJson from '../package.json'

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
  assignees: Array<{
    login: string
    html_url: string
    avatar_url: string
  }>
  linked_branches?: Array<{
    name: string
    url: string
  }>
  linked_pull_requests?: Array<{
    number: number
    title: string
    html_url: string
    state: string
  }>
  comments?: Array<{
    id: number
    user: {
      login: string
      html_url: string
      avatar_url: string
    }
    body: string
    created_at: string
    html_url: string
  }>
}

interface PullRequest {
  id: number
  number: number
  title: string
  html_url: string
  state: string
  created_at: string
  repository: string
  user: {
    login: string
    html_url: string
  }
  body: string
  head: {
    ref: string
  }
}

const isAuthenticated = ref(false)
const tokenInput = ref('')
const issues = ref<Issue[]>([])
const pullRequestsWithoutIssues = ref<PullRequest[]>([])
const loading = ref(false)
const error = ref('')
const expandedIssues = ref<Record<number, boolean>>({})
const currentUser = ref('')
const repositories = ref<Repository[]>([])
const selectedRepos = ref<string[]>([])
const showDropdown = ref(false)
const filteredIssues = ref<Issue[]>([])
const appVersion = ref(packageJson.version)
const showInstallButton = ref(false)
const deferredPrompt = ref<any>(null)

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
      console.error('Error getting user or repositories:', err)
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
    error.value = 'You must select at least one repository to load issues'
    return
  }

  loading.value = true
  error.value = ''
  issues.value = []
  filteredIssues.value = []
  pullRequestsWithoutIssues.value = []

  try {
    const data = await githubService.getAllOpenIssues(selectedRepos.value)
    console.log('Loaded data:', data)
    issues.value = data.issues
    filteredIssues.value = data.issues
    pullRequestsWithoutIssues.value = data.pullRequestsWithoutIssues
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Error loading issues'
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
  if (showDropdown.value) {
    // Agregar event listener para cerrar el dropdown al hacer click fuera
    setTimeout(() => {
      document.addEventListener('click', closeDropdownOnOutsideClick)
    }, 0)
  } else {
    document.removeEventListener('click', closeDropdownOnOutsideClick)
  }
}

const closeDropdownOnOutsideClick = (event: MouseEvent) => {
  const dropdown = document.querySelector('.dropdown')
  if (dropdown && !dropdown.contains(event.target as Node)) {
    showDropdown.value = false
    document.removeEventListener('click', closeDropdownOnOutsideClick)
  }
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

const closedIssuesWithOpenPRs = computed(() => {
  return filteredIssues.value.filter(issue =>
    issue.state === 'closed' &&
    issue.linked_pull_requests &&
    issue.linked_pull_requests.length > 0
  )
})

const openIssues = computed(() => {
  return filteredIssues.value.filter(issue => issue.state === 'open')
})

const groupedClosedIssuesWithPRs = computed(() => {
  const groups: { [key: string]: { name: string; issues: Issue[] } } = {}
  
  // Solo agregar repositorios que realmente tengan issues cerradas con PRs
  closedIssuesWithOpenPRs.value.forEach(issue => {
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

const groupedOpenIssues = computed(() => {
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
  
  // Luego agregar los issues abiertos a sus repositorios correspondientes
  openIssues.value.forEach(issue => {
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

const groupedPRsWithoutIssues = computed(() => {
  const groups: { [key: string]: { name: string; prs: PullRequest[] } } = {}
  
  // Solo agregar repositorios que realmente tengan PRs sin issues
  pullRequestsWithoutIssues.value.forEach(pr => {
    if (!groups[pr.repository]) {
      groups[pr.repository] = {
        name: pr.repository,
        prs: []
      }
    }
    groups[pr.repository].prs.push(pr)
  })
  
  return Object.values(groups).sort((a, b) => a.name.localeCompare(b.name))
})

const getClosedIssuesWithPRsForRepo = (repoName: string) => {
  return closedIssuesWithOpenPRs.value.filter(issue => issue.repository === repoName)
}

const getOpenIssuesForRepo = (repoName: string) => {
  return openIssues.value.filter(issue => issue.repository === repoName)
}

const getPRsWithoutIssuesForRepo = (repoName: string) => {
  return pullRequestsWithoutIssues.value.filter(pr => pr.repository === repoName)
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
  if (!text) return '<p>No description available</p>'
  
  return text
    .replace(/\n/g, '<br>')
    .replace(/#{1,6}\s+(.*?)(?=\n|$)/g, '<strong>$1</strong>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code>$1</code>')
    .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank">$1</a>')
}

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('en-US')
}


// PWA Install functionality
const installApp = async () => {
  if (deferredPrompt.value) {
    deferredPrompt.value.prompt()
    const { outcome } = await deferredPrompt.value.userChoice
    if (outcome === 'accepted') {
      console.log('PWA installed successfully')
      showInstallButton.value = false
    }
    deferredPrompt.value = null
  }
}

// Listen for beforeinstallprompt event
const handleBeforeInstallPrompt = (e: Event) => {
  e.preventDefault()
  deferredPrompt.value = e
  showInstallButton.value = true
}

onMounted(async () => {
  // Add PWA install event listener
  window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
  
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
      console.error('Error getting user or repositories:', err)
    }
  }
})

// Cleanup event listeners cuando el componente se desmonte
onUnmounted(() => {
  document.removeEventListener('click', closeDropdownOnOutsideClick)
  window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
})
</script>