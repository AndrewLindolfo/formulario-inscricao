import { loginWithGoogle, logoutGoogle, watchAuth, isMasterEmail } from './firebase-auth.js';

const app = document.getElementById('app');
const body = document.body;
const page = body.dataset.page || 'home';
const base = body.dataset.base || '.';
const selectedClubKey = 'formularioInscricao.clube';
const clubSettingsKey = 'formularioInscricao.clubes.nomes';
const adminSessionKey = 'formularioInscricao.adminSession';
const inscritosKey = 'formularioInscricao.inscritos';

function getClubSettings() {
  const raw = localStorage.getItem(clubSettingsKey);
  const defaults = {
    desbravadoresNome: 'Nome do clube definido no ADM',
    aventureirosNome: 'Nome do clube definido no ADM',
  };

  if (!raw) return defaults;

  try {
    const parsed = JSON.parse(raw);
    return {
      desbravadoresNome: parsed.desbravadoresNome || defaults.desbravadoresNome,
      aventureirosNome: parsed.aventureirosNome || defaults.aventureirosNome,
    };
  } catch (error) {
    return defaults;
  }
}

function saveClubSettings(settings) {
  localStorage.setItem(clubSettingsKey, JSON.stringify(settings));
}

function getClubCustomName(clube) {
  const settings = getClubSettings();
  return clube === 'desbravadores' ? settings.desbravadoresNome : settings.aventureirosNome;
}

function getClubSelection() {
  return localStorage.getItem(selectedClubKey) || '';
}

function setClubSelection(clube) {
  localStorage.setItem(selectedClubKey, clube);
}

function clubLabel(value) {
  return value === 'desbravadores'
    ? 'Clube de Desbravadores'
    : value === 'aventureiros'
      ? 'Clube de Aventureiros'
      : 'Não selecionado';
}

function getAdminSession() {
  const raw = sessionStorage.getItem(adminSessionKey);
  const defaults = {
    name: 'Administrador',
    email: 'adm@exemplo.com',
    photoURL: `${base}/assets/img/logos/logo-formulario.png`,
  };

  if (!raw) return defaults;

  try {
    const parsed = JSON.parse(raw);
    return {
      name: parsed.name || defaults.name,
      email: parsed.email || defaults.email,
      photoURL: parsed.photoURL || defaults.photoURL,
    };
  } catch (error) {
    return defaults;
  }
}

function saveAdminSession(user) {
  const payload = {
    name: user?.displayName || 'Administrador',
    email: user?.email || '',
    photoURL: user?.photoURL || `${base}/assets/img/logos/logo-formulario.png`,
  };
  sessionStorage.setItem(adminSessionKey, JSON.stringify(payload));
}

function ensureSeedInscritos() {
  if (localStorage.getItem(inscritosKey)) return;

  const seed = [
    { id: 'dbv-001', nome: 'Exemplo Desbravador', clube: 'desbravadores', data: '23/04/2026' },
    { id: 'av-001', nome: 'Exemplo Aventureiro', clube: 'aventureiros', data: '23/04/2026' },
  ];

  localStorage.setItem(inscritosKey, JSON.stringify(seed));
}

function getInscritos() {
  ensureSeedInscritos();
  const raw = localStorage.getItem(inscritosKey);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch (error) {
    return [];
  }
}

function getInscritosByClub(clube) {
  return getInscritos().filter((item) => item.clube === clube);
}

function getClubCount(clube) {
  return getInscritosByClub(clube).length;
}

function buildAdminLayout({ activePage, badge, title, subtitle, contentHtml }) {
  const admin = getAdminSession();
  const photo = admin.photoURL || `${base}/assets/img/logos/logo-formulario.png`;

  return `
    <main class="admin-shell">
      <div class="admin-grid">
        <aside class="sidebar">
          <div class="admin-profile-card">
            <img class="admin-avatar" src="${photo}" alt="Foto do administrador logado">
            <div class="admin-profile-text">
              <strong>${admin.name}</strong>
              <div class="small">${admin.email}</div>
            </div>
          </div>

          <nav class="menu admin-menu-full">
            <a class="${activePage === 'dashboard' ? 'active' : ''}" href="dashboard.html">Dashboard</a>
            <a class="${activePage === 'inscritos-dbv' ? 'active' : ''}" href="inscritosdbv.html">Inscritos Desbravadores</a>
            <a class="${activePage === 'inscritos-av' ? 'active' : ''}" href="inscritosav.html">Inscritos Aventureiros</a>
            <a class="${activePage === 'admins' ? 'active' : ''}" href="admins.html">Administradores</a>
            <a class="${activePage === 'admin-editor' ? 'active' : ''}" href="admin-editor.html">Novo ADM</a>
            <a href="../index.html">Voltar ao site</a>
            <button class="btn btn-secondary btn-full" id="btn-admin-logout" type="button">Sair</button>
          </nav>
        </aside>

        <section class="content-card">
          <span class="badge">${badge}</span>
          <h2 class="content-title">${title}</h2>
          <p class="subtitle">${subtitle}</p>
          ${contentHtml}
        </section>
      </div>
    </main>
  `;
}

function attachAdminLayoutEvents() {
  const btnLogout = document.getElementById('btn-admin-logout');
  if (!btnLogout) return;

  btnLogout.addEventListener('click', async () => {
    await logoutGoogle();
    sessionStorage.removeItem(adminSessionKey);
    window.location.href = 'login.html';
  });
}

function renderHome() {
  app.innerHTML = `
    <main class="shell shell-home">
      <section class="card landing-card">
        <div class="landing-header">
          <div class="brand brand-main">
            <img src="${base}/assets/img/logos/logo-formulario.png" alt="Logo Formulário de Inscrição">
            <div>
              <h1>Formulário de Inscrição</h1>
              <p class="small brand-subtitle">Cadastro para Desbravadores e Aventureiros</p>
            </div>
          </div>
          <button class="btn btn-secondary btn-login-top" id="btn-login-top" type="button">Entrar com Google</button>
        </div>

        <div class="hero-banner hero-banner-simple">
          <div>
            <span class="hero-badge">Etapa inicial</span>
            <h2>Escolha o clube antes de começar</h2>
            <p>Venha fazer parte desta aventura. Preencha sua inscrição agora e prepare-se para viver momentos especiais no clube.</p>
          </div>
        </div>

        <div class="club-grid improved-club-grid">
          <button class="club-card improved" data-club="desbravadores" type="button">
            <div class="club-card-top">
              <span class="pill">Seleção de clube</span>
              <span class="club-check" aria-hidden="true">✓</span>
            </div>
            <div class="club-logo-wrap">
              <img src="${base}/assets/img/clubes/desbravadores.svg" alt="Logo Desbravadores">
            </div>
            <strong>Clube de Desbravadores</strong>
            <span class="club-custom-name" id="club-name-desbravadores"></span>
            <span class="small">Usar esta opção para inscrições do clube de Desbravadores.</span>
          </button>

          <button class="club-card improved" data-club="aventureiros" type="button">
            <div class="club-card-top">
              <span class="pill">Seleção de clube</span>
              <span class="club-check" aria-hidden="true">✓</span>
            </div>
            <div class="club-logo-wrap">
              <img src="${base}/assets/img/clubes/aventureiros.png" alt="Logo Aventureiros">
            </div>
            <strong>Clube de Aventureiros</strong>
            <span class="club-custom-name" id="club-name-aventureiros"></span>
            <span class="small">Usar esta opção para inscrições do clube de Aventureiros.</span>
          </button>
        </div>

        <div class="selection-status" id="club-note">
          <div>
            <span class="selection-label">Status da seleção</span>
            <strong id="club-note-text">Nenhum clube selecionado ainda.</strong>
          </div>
        </div>

        <div class="actions actions-home">
          <a class="btn btn-primary btn-large" href="${base}/formulario.html" id="btn-continuar">Continuar inscrição</a>
        </div>
      </section>
    </main>
  `;

  const note = document.getElementById('club-note');
  const noteText = document.getElementById('club-note-text');
  const btnLoginTop = document.getElementById('btn-login-top');
  const desbravadoresName = document.getElementById('club-name-desbravadores');
  const aventureirosName = document.getElementById('club-name-aventureiros');
  const selected = getClubSelection();
  desbravadoresName.textContent = getClubCustomName('desbravadores');
  aventureirosName.textContent = getClubCustomName('aventureiros');

  noteText.textContent = selected ? `Clube selecionado: ${clubLabel(selected)}` : 'Nenhum clube selecionado ainda.';
  if (selected) {
    const active = app.querySelector(`[data-club="${selected}"]`);
    active?.classList.add('active');
    note.classList.add('selected');
  }

  btnLoginTop.addEventListener('click', async () => {
    try {
      await loginWithGoogle();
    } catch (error) {
      noteText.textContent = `Não foi possível entrar com Google: ${error.message}`;
      note.classList.add('error-state');
    }
  });

  const unsubscribe = watchAuth((user) => {
    if (user?.email) {
      btnLoginTop.textContent = 'Google conectado';
      btnLoginTop.disabled = true;
    } else {
      btnLoginTop.textContent = 'Entrar com Google';
      btnLoginTop.disabled = false;
    }
  });
  window.addEventListener('beforeunload', unsubscribe, { once: true });

  app.querySelectorAll('[data-club]').forEach((button) => {
    button.addEventListener('click', () => {
      app.querySelectorAll('[data-club]').forEach((b) => b.classList.remove('active'));
      button.classList.add('active');
      const club = button.dataset.club;
      setClubSelection(club);
      noteText.textContent = `Clube selecionado: ${clubLabel(club)}`;
      note.classList.add('selected');
      note.classList.remove('error-state');
    });
  });

  document.getElementById('btn-continuar').addEventListener('click', (event) => {
    if (!getClubSelection()) {
      event.preventDefault();
      noteText.textContent = 'Selecione um clube antes de continuar.';
      note.classList.add('error-state');
      note.classList.remove('selected');
    }
  });
}

function renderFormulario() {
  const club = getClubSelection();
  app.innerHTML = `
    <main class="form-shell">
      <div class="topbar">
        <div class="topbar-brand">
          <img src="assets/img/logos/logo-formulario.png" alt="Logo Formulário">
          <div>
            <h2>Formulário de Inscrição</h2>
            <div class="small">${club ? `${clubLabel(club)} • ${getClubCustomName(club)}` : 'Clube ainda não selecionado'}</div>
          </div>
        </div>
        <a class="btn btn-secondary" href="index.html">Voltar</a>
      </div>

      <div class="card form-card-padding">
        <span class="badge">Estrutura inicial do formulário</span>
        <h3 class="form-title">Cadastro e ficha médica</h3>
        <p class="subtitle form-subtitle">Se o login com Google estiver ativo, o e-mail poderá ser preenchido automaticamente. Se não estiver, o participante preencherá o e-mail manualmente.</p>
        <div class="email-preview-card" id="email-preview-card">
          <div>
            <span class="selection-label">E-mail do participante</span>
            <strong id="email-preview-title">Carregando status do login...</strong>
            <p class="small" id="email-preview-subtitle">O campo real será implementado nos blocos do formulário.</p>
          </div>
        </div>
        <div class="progress" aria-label="Progresso do formulário"><span></span></div>

        <div class="section-grid">
          ${[
            '1. Identificação pessoal', '2. Documentos', '3. Contato', '4. Endereço', '5. Escolaridade', '6. Profissional de saúde', '7. Pais e contato de emergência', '8. Dados médicos básicos', '9. Doenças que já teve', '10. Condições de saúde com remédios', '11. Informações médicas complementares', '12. Deficiência ou condição específica', '13. Termo de responsabilidade'
          ].map((item) => `<article class="section-card"><h3>${item}</h3><p>Bloco reservado para implementação. Campos numéricos, respostas Sim/Não e lógica condicional serão aplicados aqui.</p></article>`).join('')}
        </div>
      </div>
    </main>
  `;

  const emailTitle = document.getElementById('email-preview-title');
  const emailSubtitle = document.getElementById('email-preview-subtitle');
  const unsubscribe = watchAuth((user) => {
    if (user?.email) {
      emailTitle.textContent = `E-mail automático disponível: ${user.email}`;
      emailSubtitle.textContent = 'Como o Google está conectado, o formulário poderá aproveitar esse e-mail automaticamente.';
    } else {
      emailTitle.textContent = 'Sem login: o e-mail será preenchido manualmente';
      emailSubtitle.textContent = 'O participante poderá seguir normalmente mesmo sem entrar com Google.';
    }
  });
  window.addEventListener('beforeunload', unsubscribe, { once: true });
}

function renderAdminLogin() {
  app.innerHTML = `
    <main class="shell">
      <section class="card admin-login-card">
        <div class="brand admin-login-brand">
          <img src="${base}/assets/img/logos/logo-formulario.png" alt="Logo">
          <div>
            <h1 class="admin-login-title">Área Administrativa</h1>
            <p class="small">Login Google disponível somente no ADM</p>
          </div>
        </div>
        <p class="subtitle">Seu e-mail master configurado é <strong>lindolfoandrew0@gmail.com</strong>. Depois vamos adicionar o cadastro e permissões de outros administradores.</p>
        <div class="actions">
          <button class="btn btn-primary" id="btn-google" type="button">Entrar com Google</button>
          <a class="btn btn-secondary" href="../index.html">Voltar ao site</a>
        </div>
        <div class="note" id="auth-message">Aguardando login.</div>
      </section>
    </main>
  `;

  const msg = document.getElementById('auth-message');
  document.getElementById('btn-google').addEventListener('click', async () => {
    try {
      const user = await loginWithGoogle();
      if (!isMasterEmail(user)) {
        msg.innerHTML = `<span class="error">Login realizado com ${user.email}, mas este e-mail ainda não está liberado como administrador nesta versão inicial.</span>`;
        await logoutGoogle();
        return;
      }
      saveAdminSession(user);
      window.location.href = 'dashboard.html';
    } catch (error) {
      msg.innerHTML = `<span class="error">Falha no login Google: ${error.message}</span>`;
    }
  });
}

function dashboardGraphCard({ title, count, colorClass, clube }) {
  const percent = Math.min(100, count * 10);
  return `
    <article class="dashboard-graph-card ${colorClass}">
      <div class="dashboard-graph-top">
        <span class="pill">${clube}</span>
        <strong>${count}</strong>
      </div>
      <h3>${title}</h3>
      <div class="graph-bar"><span style="width:${percent}%"></span></div>
      <p class="small">Total de inscritos registrados atualmente para este clube.</p>
    </article>
  `;
}

function renderAdminDashboard() {
  const settings = getClubSettings();
  const countDbv = getClubCount('desbravadores');
  const countAv = getClubCount('aventureiros');

  app.innerHTML = buildAdminLayout({
    activePage: 'dashboard',
    badge: 'Painel inicial',
    title: 'Dashboard do administrador',
    subtitle: 'Nesta tela ficam os gráficos principais e a configuração dos nomes dos clubes.',
    contentHtml: `
      <div class="dashboard-graphs-grid">
        ${dashboardGraphCard({ title: settings.desbravadoresNome, count: countDbv, colorClass: 'graph-desbravadores', clube: 'Desbravadores' })}
        ${dashboardGraphCard({ title: settings.aventureirosNome, count: countAv, colorClass: 'graph-aventureiros', clube: 'Aventureiros' })}
      </div>

      <article class="section-card dashboard-settings-card">
        <h3>Configuração dos nomes dos clubes</h3>
        <p>Defina como o nome de cada clube aparecerá abaixo do título principal na página inicial.</p>
        <form id="club-settings-form" class="club-settings-form">
          <label class="field-block">
            <span>Nome do clube dos Desbravadores</span>
            <input type="text" id="input-desbravadores-nome" placeholder="Ex.: Clube Águias do Norte">
          </label>
          <label class="field-block">
            <span>Nome do clube dos Aventureiros</span>
            <input type="text" id="input-aventureiros-nome" placeholder="Ex.: Clube Pequenos Heróis">
          </label>
          <div class="actions">
            <button class="btn btn-primary" type="submit">Salvar nomes</button>
          </div>
          <div class="note success-note" id="club-settings-message">Os nomes salvos aqui aparecerão na home do site.</div>
        </form>
      </article>
    `,
  });

  attachAdminLayoutEvents();

  const form = document.getElementById('club-settings-form');
  const inputDesbravadores = document.getElementById('input-desbravadores-nome');
  const inputAventureiros = document.getElementById('input-aventureiros-nome');
  const message = document.getElementById('club-settings-message');

  inputDesbravadores.value = settings.desbravadoresNome;
  inputAventureiros.value = settings.aventureirosNome;

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    saveClubSettings({
      desbravadoresNome: inputDesbravadores.value.trim() || 'Nome do clube definido no ADM',
      aventureirosNome: inputAventureiros.value.trim() || 'Nome do clube definido no ADM',
    });
    message.textContent = 'Nomes dos clubes salvos com sucesso. Volte à home para conferir.';
  });
}

function buildInscritosTable(clube) {
  const rows = getInscritosByClub(clube);
  if (!rows.length) {
    return '<div class="empty-box">Nenhum inscrito encontrado para este clube.</div>';
  }

  return `
    <table class="table">
      <thead><tr><th>Nome</th><th>Clube</th><th>Data</th><th>Ações</th></tr></thead>
      <tbody>
        ${rows.map((item) => `
          <tr>
            <td>${item.nome}</td>
            <td>${clubLabel(item.clube)}</td>
            <td>${item.data}</td>
            <td>Ver • Editar • Excel • PDF • Word</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function renderAdminInscritosDesbravadores() {
  app.innerHTML = buildAdminLayout({
    activePage: 'inscritos-dbv',
    badge: 'Inscritos separados por clube',
    title: 'Inscritos dos Desbravadores',
    subtitle: 'Nesta página ficam apenas os cadastros vinculados ao Clube de Desbravadores, sem misturar com os Aventureiros.',
    contentHtml: buildInscritosTable('desbravadores'),
  });
  attachAdminLayoutEvents();
}

function renderAdminInscritosAventureiros() {
  app.innerHTML = buildAdminLayout({
    activePage: 'inscritos-av',
    badge: 'Inscritos separados por clube',
    title: 'Inscritos dos Aventureiros',
    subtitle: 'Nesta página ficam apenas os cadastros vinculados ao Clube de Aventureiros, sem misturar com os Desbravadores.',
    contentHtml: buildInscritosTable('aventureiros'),
  });
  attachAdminLayoutEvents();
}

function renderAdminAdmins() {
  app.innerHTML = buildAdminLayout({
    activePage: 'admins',
    badge: 'Página reservada',
    title: 'Administradores',
    subtitle: 'Aqui ficará a listagem dos ADMs cadastrados, com permissões por módulo e ação.',
    contentHtml: `
      <table class="table">
        <thead><tr><th>Nome</th><th>E-mail</th><th>Perfil</th><th>Ações</th></tr></thead>
        <tbody>
          <tr><td>${getAdminSession().name}</td><td>${getAdminSession().email}</td><td><span class="status">ADM master</span></td><td>Editar • Permissões</td></tr>
        </tbody>
      </table>
    `,
  });
  attachAdminLayoutEvents();
}

function renderAdminEditor() {
  app.innerHTML = buildAdminLayout({
    activePage: 'admin-editor',
    badge: 'Estrutura pronta',
    title: 'Cadastro de novo ADM',
    subtitle: 'Aqui entraremos depois com nome, e-mail e permissões detalhadas do administrador.',
    contentHtml: `
      <div class="section-grid">
        <article class="section-card"><h3>Permissões de visualização</h3><p>Ex.: ver inscritos, ver ficha médica, ver contatos.</p></article>
        <article class="section-card"><h3>Permissões de ação</h3><p>Ex.: editar, excluir, exportar Excel, PDF e Word, criar ADM.</p></article>
      </div>
    `,
  });
  attachAdminLayoutEvents();
}

switch (page) {
  case 'home': renderHome(); break;
  case 'formulario': renderFormulario(); break;
  case 'admin-login': renderAdminLogin(); break;
  case 'admin-dashboard': renderAdminDashboard(); break;
  case 'admin-inscritos-desbravadores': renderAdminInscritosDesbravadores(); break;
  case 'admin-inscritos-aventureiros': renderAdminInscritosAventureiros(); break;
  case 'admin-inscritos': renderAdminInscritosDesbravadores(); break;
  case 'admin-admins': renderAdminAdmins(); break;
  case 'admin-editor': renderAdminEditor(); break;
  default: renderHome();
}

watchAuth((user) => {
  if (user?.email) {
    saveAdminSession(user);
  }

  const message = document.getElementById('auth-message');
  if (!message || !user) return;
  message.innerHTML = `<span class="success">Conectado com ${user.email}</span>`;
});
