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

  async getAllOpenIssues(selectedRepos?: string[]): Promise<ProcessedIssue[]> {
    if (!this.token) {
      throw new Error('Token de GitHub no configurado')
    }

    try {
      const repos = await this.getUserRepositories()
      const allIssues: ProcessedIssue[] = []
      const reposToProcess = selectedRepos && selectedRepos.length > 0
        ? repos.filter(repo => selectedRepos.includes(repo.full_name))
        : repos

      for (const repo of reposToProcess) {
        try {
          const issues = await this.getRepositoryIssues(repo.full_name)
          
          issues.forEach((issue: GitHubIssue) => {
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
              labels: issue.labels
            })
          })
        } catch (error) {
          console.error(`Error al obtener issues de ${repo.full_name}:`, error)
        }
      }

      return allIssues.sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
    } catch (error) {
      console.error('Error al obtener issues:', error)
      throw error
    }
  }
}

export const githubService = new GitHubService()