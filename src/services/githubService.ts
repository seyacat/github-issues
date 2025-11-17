interface GitHubIssue {
  id: number
  title: string
  html_url: string
  number: number
  created_at: string
  repository_url: string
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
}

interface GitHubUser {
  login: string
  name: string
  avatar_url: string
  html_url: string
}

interface Repository {
  id: number
  name: string
  full_name: string
  private: boolean
}

interface ProcessedIssue {
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
}

interface ProcessedPullRequest {
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

interface GitHubData {
  issues: ProcessedIssue[]
  pullRequestsWithoutIssues: ProcessedPullRequest[]
}

class GitHubService {
  private token: string | null = null
  private readonly tokenKey = 'github_token'
  private readonly baseUrl = 'https://api.github.com'

  constructor() {
    this.loadToken()
  }

  private loadToken() {
    this.token = localStorage.getItem(this.tokenKey)
  }

  setToken(token: string) {
    this.token = token
    localStorage.setItem(this.tokenKey, token)
  }

  clearToken() {
    this.token = null
    localStorage.removeItem(this.tokenKey)
  }

  hasToken(): boolean {
    return this.token !== null && this.token !== ''
  }

  private async makeRequest(url: string): Promise<any> {
    if (!this.token) {
      throw new Error('Token de GitHub no configurado')
    }

    const response = await fetch(url, {
      headers: {
        'Authorization': `token ${this.token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'GitHub-Issues-PWA'
      }
    })

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Token inválido o expirado')
      }
      if (response.status === 403) {
        throw new Error('Límite de API excedido')
      }
      throw new Error(`Error de GitHub API: ${response.status}`)
    }

    return response.json()
  }

  async getCurrentUser(): Promise<GitHubUser> {
    const url = `${this.baseUrl}/user`
    return this.makeRequest(url)
  }

  async getUserRepositories(): Promise<Repository[]> {
    const url = `${this.baseUrl}/user/repos?per_page=100&sort=updated`
    return this.makeRequest(url)
  }

  async getRepositoryIssues(repoFullName: string): Promise<GitHubIssue[]> {
    const url = `${this.baseUrl}/repos/${repoFullName}/issues?state=open&per_page=100`
    const issues = await this.makeRequest(url)
    
    return issues.filter((issue: any) => !issue.pull_request)
  }

  async getAllOpenIssues(selectedRepos?: string[]): Promise<GitHubData> {
    if (!this.token) {
      throw new Error('Token de GitHub no configurado')
    }

    try {
      const repos = await this.getUserRepositories()
      const allIssues: ProcessedIssue[] = []
      const pullRequestsWithoutIssues: ProcessedPullRequest[] = []
      const reposToProcess = selectedRepos && selectedRepos.length > 0
        ? repos.filter(repo => selectedRepos.includes(repo.full_name))
        : repos

      // Primero, obtener todos los PRs abiertos y mapearlos a issues
      const prToIssueMap = new Map<string, Array<{ number: number; title: string; html_url: string; state: string }>>()
      const allOpenPRs: ProcessedPullRequest[] = []
      
      for (const repo of reposToProcess) {
        try {
          // Obtener PRs abiertos
          const pullsResponse = await fetch(`https://api.github.com/repos/${repo.full_name}/pulls?state=open&per_page=100`, {
            headers: {
              'Authorization': `token ${this.token}`,
              'Accept': 'application/vnd.github.v3+json'
            }
          })
          
          if (pullsResponse.ok) {
            const pulls = await pullsResponse.json()
            console.log(`Found ${pulls.length} open PRs in ${repo.full_name}`)
            
            for (const pull of pulls) {
              // Verificar que sea un PR real (no un branch)
              if (pull.html_url && pull.html_url.includes('/pull/')) {
                const processedPR: ProcessedPullRequest = {
                  id: pull.id,
                  number: pull.number,
                  title: pull.title,
                  html_url: pull.html_url,
                  state: pull.state,
                  created_at: pull.created_at,
                  repository: repo.full_name,
                  user: pull.user,
                  body: pull.body || '',
                  head: {
                    ref: pull.head.ref
                  }
                }
                allOpenPRs.push(processedPR)
                
                // Extraer número de issue del PR
                const issueNumber = this.extractIssueNumberFromPR(pull, repo.full_name)
                if (issueNumber) {
                  const issueKey = `${repo.full_name}#${issueNumber}`
                  if (!prToIssueMap.has(issueKey)) {
                    prToIssueMap.set(issueKey, [])
                  }
                  prToIssueMap.get(issueKey)!.push({
                    number: pull.number,
                    title: pull.title,
                    html_url: pull.html_url,
                    state: pull.state
                  })
                  console.log(`Linked PR #${pull.number} to issue #${issueNumber} in ${repo.full_name}`)
                } else {
                  // PR sin issue vinculado
                  pullRequestsWithoutIssues.push(processedPR)
                  console.log(`PR #${pull.number} has no linked issue:`, pull.title)
                }
              } else {
                console.log(`Skipping non-PR item:`, pull)
              }
            }
          }
        } catch (pullError) {
          console.error(`Error al obtener PRs de ${repo.full_name}:`, pullError)
        }
      }

      // Luego, obtener todos los issues (abiertos y cerrados) que tengan PRs vinculados
      for (const repo of reposToProcess) {
        try {
          // Obtener todos los issues (abiertos y cerrados)
          const issuesResponse = await fetch(`https://api.github.com/repos/${repo.full_name}/issues?state=all&per_page=100`, {
            headers: {
              'Authorization': `token ${this.token}`,
              'Accept': 'application/vnd.github.v3+json'
            }
          })
          
          if (issuesResponse.ok) {
            const issues = await issuesResponse.json()
            const regularIssues = issues.filter((issue: any) => !issue.pull_request)
            
            for (const issue of regularIssues) {
              const issueKey = `${repo.full_name}#${issue.number}`
              const linkedPullRequests = prToIssueMap.get(issueKey) || []
              
              // Obtener las ramas vinculadas al issue
              let linkedBranches: Array<{ name: string; url: string }> = []
              
              try {
                // Buscar ramas que sigan el naming convention de GitHub
                const branchesResponse = await fetch(`https://api.github.com/repos/${repo.full_name}/branches`, {
                  headers: {
                    'Authorization': `token ${this.token}`,
                    'Accept': 'application/vnd.github.v3+json'
                  }
                })
                
                if (branchesResponse.ok) {
                  const branches = await branchesResponse.json()
                  // Filtrar ramas que sigan el patrón issue-{number}
                  const issueBranches = branches.filter((branch: any) =>
                    branch.name.startsWith(`issue-${issue.number}-`) ||
                    branch.name.startsWith(`${issue.number}-`)
                  )
                  
                  linkedBranches = issueBranches.map((branch: any) => ({
                    name: branch.name,
                    url: `https://github.com/${repo.full_name}/tree/${branch.name}`
                  }))
                }
              } catch (branchError) {
                console.error(`Error al obtener ramas para issue ${issue.number}:`, branchError)
              }
              
              // Incluir todas las issues abiertas, y las cerradas solo si tienen PRs o ramas
              if (issue.state === 'open' || linkedPullRequests.length > 0 || linkedBranches.length > 0) {
                allIssues.push({
                  id: issue.id,
                  title: issue.title,
                  html_url: issue.html_url,
                  number: issue.number,
                  created_at: issue.created_at,
                  repository: repo.full_name,
                  body: issue.body || '',
                  user: issue.user,
                  state: issue.state,
                  labels: issue.labels,
                  assignees: issue.assignees || [],
                  linked_branches: linkedBranches.length > 0 ? linkedBranches : undefined,
                  linked_pull_requests: linkedPullRequests.length > 0 ? linkedPullRequests : undefined
                })
              }
            }
          }
        } catch (error) {
          console.error(`Error al obtener issues de ${repo.full_name}:`, error)
        }
      }

      const sortedIssues = allIssues.sort((a, b) => {
        // Primero por estado: cerrados primero, luego abiertos
        if (a.state !== b.state) {
          return a.state === 'closed' ? -1 : 1
        }
        // Luego por fecha: más recientes primero
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      })

      return {
        issues: sortedIssues,
        pullRequestsWithoutIssues: pullRequestsWithoutIssues.sort((a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )
      }
    } catch (error) {
      console.error('Error al obtener issues:', error)
      throw error
    }
  }

  private extractIssueNumberFromPR(pull: any, repoFullName: string): number | null {
    // Buscar en el título
    const titleMatch = pull.title.match(/#(\d+)/)
    if (titleMatch) return parseInt(titleMatch[1])
    
    // Buscar en el cuerpo
    if (pull.body) {
      const bodyMatch = pull.body.match(/#(\d+)/)
      if (bodyMatch) return parseInt(bodyMatch[1])
      
      // Buscar URLs de issues
      const urlMatch = pull.body.match(new RegExp(`github\\.com/${repoFullName}/issues/(\\d+)`, 'i'))
      if (urlMatch) return parseInt(urlMatch[1])
    }
    
    // Buscar en el nombre de la rama
    if (pull.head?.ref) {
      const branchMatch = pull.head.ref.match(/(\d+)/)
      if (branchMatch) return parseInt(branchMatch[1])
    }
    
    return null
  }
}

export const githubService = new GitHubService()