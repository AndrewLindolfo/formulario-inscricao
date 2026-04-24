import { firebaseProjectId, setupAnalytics } from "../../firebase/config";
import {
  MASTER_ADMIN_EMAIL,
  logoutAdmin,
  signInAdminWithGoogle,
  watchAdminAuth,
} from "../../firebase/auth";
import { requireAdminAccess } from "../../firebase/guards";

const appElement = document.querySelector("#app");

function renderBase() {
  appElement.innerHTML = `
    <main class="app-shell">
      <section class="hero-card">
        <img
          src="/src/assets/img/logos/logo-formulario.png"
          alt="Logo Formulário de Inscrição"
          class="hero-logo"
        />

        <span class="badge">Firebase conectado</span>
        <h1>Formulário de Inscrição</h1>
        <p>
          Sistema de inscrição para Clube de Desbravadores e Clube de Aventureiros.
        </p>

        <div class="club-selection">
          <button class="club-card" type="button" data-clube="desbravadores">
            <span class="club-title">Clube de Desbravadores</span>
            <span class="club-description">Mesmas perguntas para os dois clubes, com seleção logo na entrada.</span>
          </button>

          <button class="club-card" type="button" data-clube="aventureiros">
            <span class="club-title">Clube de Aventureiros</span>
            <span class="club-description">Fluxo público sem login; login Google somente nas páginas do ADM.</span>
          </button>
        </div>

        <section class="status-panel">
          <h2>Status atual da base</h2>
          <div class="status-grid">
            <article class="status-item">
              <strong>Projeto Firebase</strong>
              <span>${firebaseProjectId || "Não configurado"}</span>
            </article>
            <article class="status-item">
              <strong>ADM master</strong>
              <span>${MASTER_ADMIN_EMAIL}</span>
            </article>
            <article class="status-item">
              <strong>Login</strong>
              <span>Google somente no ADM</span>
            </article>
            <article class="status-item">
              <strong>Exportação individual</strong>
              <span>Excel, PDF e Word por inscrito</span>
            </article>
          </div>
        </section>

        <section class="admin-panel">
          <div>
            <h2>Teste rápido do login administrativo</h2>
            <p class="admin-copy">
              Use este botão apenas para validar o Firebase Auth e já preparar a sua conta master.
            </p>
          </div>
          <div class="admin-actions">
            <button class="primary-button" id="admin-login-button" type="button">Entrar com Google</button>
            <button class="secondary-button" id="admin-logout-button" type="button">Sair</button>
          </div>
          <p class="admin-result" id="admin-result">Aguardando autenticação.</p>
        </section>
      </section>
    </main>
  `;

  appElement.querySelectorAll("[data-clube]").forEach((button) => {
    button.addEventListener("click", () => {
      const clube = button.dataset.clube;
      window.localStorage.setItem("tipoClubeSelecionado", clube);
      alert(`Clube selecionado: ${clube}. Na próxima etapa vamos abrir o formulário por etapas.`);
    });
  });

  appElement.querySelector("#admin-login-button")?.addEventListener("click", handleAdminLogin);
  appElement.querySelector("#admin-logout-button")?.addEventListener("click", handleAdminLogout);
}

async function handleAdminLogin() {
  const resultNode = document.querySelector("#admin-result");

  try {
    resultNode.textContent = "Abrindo login Google...";
    const credential = await signInAdminWithGoogle();
    const access = await requireAdminAccess(credential.user);

    if (!access.allowed) {
      resultNode.textContent = "Login efetuado, mas sem permissão de administrador.";
      return;
    }

    resultNode.textContent = `Login realizado com ${credential.user.email}. Perfil: ${access.profile.role}.`;
  } catch (error) {
    resultNode.textContent = `Erro no login Google: ${error.message}`;
  }
}

async function handleAdminLogout() {
  const resultNode = document.querySelector("#admin-result");

  try {
    await logoutAdmin();
    resultNode.textContent = "Sessão encerrada com sucesso.";
  } catch (error) {
    resultNode.textContent = `Erro ao sair: ${error.message}`;
  }
}

function startAuthWatcher() {
  watchAdminAuth(async (user) => {
    const resultNode = document.querySelector("#admin-result");

    if (!resultNode) {
      return;
    }

    if (!user) {
      resultNode.textContent = "Aguardando autenticação.";
      return;
    }

    const access = await requireAdminAccess(user);
    resultNode.textContent = access.allowed
      ? `Sessão ativa: ${user.email} (${access.profile.role}).`
      : `Sessão ativa: ${user.email}, mas ainda sem permissão.`;
  });
}

async function bootstrap() {
  renderBase();
  startAuthWatcher();
  await setupAnalytics();
}

bootstrap();
