import './style.css'
import './app/app.css'
import {
  AppController,
  type AppDebugState,
} from './app/AppController'
import { createAppRuntime } from './bootstrap/createAppRuntime'
import { preloadMenuVisuals } from './data/menuVisuals'

interface DebugAppWindow extends Window {
  __NHN_APP__?: {
    getDebugState: () => AppDebugState
  }
}

const appRoot = document.querySelector<HTMLElement>('#app')

if (!appRoot) {
  throw new Error('앱 루트 요소를 찾을 수 없습니다.')
}

void bootstrap(appRoot)

async function bootstrap(root: HTMLElement): Promise<void> {
  try {
    const [runtime] = await Promise.all([
      createAppRuntime(),
      preloadMenuVisuals(),
    ])
    const app = new AppController(root, runtime.gateway, {
      backend: runtime.backend,
      ...(runtime.playerId
        ? { playerId: runtime.playerId }
        : {}),
    })
    app.start()

    if (import.meta.env.DEV) {
      const debugWindow = window as DebugAppWindow
      debugWindow.__NHN_APP__ = app
    }

    if (import.meta.hot) {
      import.meta.hot.dispose(() => {
        app.destroy()
        delete (window as DebugAppWindow).__NHN_APP__
      })
    }
  } catch (error) {
    renderBootstrapError(root, error)
  }
}

function renderBootstrapError(
  root: HTMLElement,
  error: unknown,
): void {
  const gameRoot = root.querySelector<HTMLElement>('#game-root')
  if (gameRoot) {
    gameRoot.hidden = true
  }

  const screen = document.createElement('section')
  screen.className = 'app-screen bootstrap-error-screen'
  screen.setAttribute('role', 'alert')

  const title = document.createElement('h1')
  title.textContent = '게임을 시작하지 못했어요'
  const message = document.createElement('p')
  message.textContent =
    error instanceof Error
      ? error.message
      : '초기 설정을 확인한 뒤 다시 시도해 주세요.'

  screen.append(title, message)
  root.prepend(screen)
}
