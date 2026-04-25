import { loginWithGoogle, logoutGoogle, watchAuth, isMasterEmail } from './firebase-auth.js';
import { db } from './firebase-config.js';
import { addDoc, collection, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";

const app = document.getElementById('app');
const body = document.body;
const page = body.dataset.page || 'home';
const base = body.dataset.base || '.';
const selectedClubKey = 'formularioInscricao.clube';
const clubSettingsKey = 'formularioInscricao.clubes.nomes';
const adminSessionKey = 'formularioInscricao.adminSession';
const inscritosKey = 'formularioInscricao.inscritos';

const ESTADOS_BR = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];
const TAMANHOS_CAMISETA = ['Adulto PP','Adulto P','Adulto M','Adulto G','Adulto GG','Adulto XG','Adulto XGG','Adulto XXGG','Adulto EXG','Baby-look PP','Baby-look P','Baby-look M','Baby-look G','Baby-look GG','Baby-look XG','Baby-look XGG','Baby-look XXGG','Infantil 2','Infantil 4','Infantil 6','Infantil 8','Infantil 10','Infantil 12','Infantil 14','Infantil 16','Outra'];
const DOENCAS = ['Catapora','Meningite','Hepatite','Dengue','Pneumonia','Malária','Febre Amarela','H1N1','Covid-19','Varíola','Cólera','Rubéola','Sarampo','Tétano','Bronquite','Coqueluche','Difteria','Caxumba','Rinite','Transfusão de sangue','Alergia na pele','Alergia alimentar','Alergia a medicamento'];
const DEFICIENCIAS = ['Física','Visual','Auditiva','Fala','Intelectual','Psíquica','Autismo'];
const AREAS_CONHECIMENTO = ['Ciências Agrárias','Ciências Biológicas','Ciências da Saúde','Ciências Exatas','Ciências Humanas','Ciências Sociais','Curso Técnico','Engenharia','Linguística, Letras e Artes','Nível Escolar','Tecnologia'];
const PROFISSOES_SAUDE = ['Dentista','Enfermeiro','Fisioterapeuta','Médico','Psicólogo','Socorrista','Técnico de Enfermagem','Outra'];

function getClubSettings() {
  const raw = localStorage.getItem(clubSettingsKey);
  const defaults = { desbravadoresNome: 'Nome do clube definido no ADM', aventureirosNome: 'Nome do clube definido no ADM' };
  if (!raw) return defaults;
  try {
    const parsed = JSON.parse(raw);
    return { desbravadoresNome: parsed.desbravadoresNome || defaults.desbravadoresNome, aventureirosNome: parsed.aventureirosNome || defaults.aventureirosNome };
  } catch { return defaults; }
}
function saveClubSettings(settings) { localStorage.setItem(clubSettingsKey, JSON.stringify(settings)); }
function getClubCustomName(clube) { const settings = getClubSettings(); return clube === 'desbravadores' ? settings.desbravadoresNome : settings.aventureirosNome; }
function getClubSelection() { return localStorage.getItem(selectedClubKey) || ''; }
function setClubSelection(clube) { localStorage.setItem(selectedClubKey, clube); }
function clubLabel(value) { return value === 'desbravadores' ? 'Clube de Desbravadores' : value === 'aventureiros' ? 'Clube de Aventureiros' : 'Não selecionado'; }
function todayISO() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function esc(v) { return String(v ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;'); }

function getAdminSession() {
  const raw = sessionStorage.getItem(adminSessionKey);
  const defaults = { name: 'Administrador', email: 'adm@exemplo.com', photoURL: `${base}/assets/img/logos/logo-formulario.png` };
  if (!raw) return defaults;
  try { const p = JSON.parse(raw); return { name: p.name || defaults.name, email: p.email || defaults.email, photoURL: p.photoURL || defaults.photoURL }; } catch { return defaults; }
}
function saveAdminSession(user) {
  sessionStorage.setItem(adminSessionKey, JSON.stringify({ name: user?.displayName || 'Administrador', email: user?.email || '', photoURL: user?.photoURL || `${base}/assets/img/logos/logo-formulario.png` }));
}
function ensureSeedInscritos() {
  if (localStorage.getItem(inscritosKey)) return;
  localStorage.setItem(inscritosKey, JSON.stringify([]));
}
function getInscritos() { ensureSeedInscritos(); try { return JSON.parse(localStorage.getItem(inscritosKey)) || []; } catch { return []; } }
function getInscritosByClub(clube) { return getInscritos().filter((item) => item.clube === clube); }
function getClubCount(clube) { return getInscritosByClub(clube).length; }

function inputField({ id, label, type='text', required=false, numeric=false, placeholder='', extra='', hint='' }) {
  const attrs = numeric ? `inputmode="numeric" pattern="[0-9]*" data-numeric="true" ${extra}` : extra;
  return `<label class="form-field" for="${id}"><span>${label}${required?' <b>*</b>':''}</span><input id="${id}" name="${id}" type="${type}" placeholder="${placeholder}" ${required?'required':''} ${attrs}>${hint ? `<small class="field-hint">${hint}</small>` : ''}</label>`;
}
function textareaField({ id, label, required=false, placeholder='', conditional='' }) {
  return `<label class="form-field ${conditional?'conditional-field is-hidden':''}" ${conditional} for="${id}"><span>${label}${required?' <b>*</b>':''}</span><textarea id="${id}" name="${id}" rows="3" placeholder="${placeholder}" ${required?'required':''}></textarea></label>`;
}
function selectField({ id, label, options, required=false, extra='' }) {
  return `<label class="form-field" for="${id}"><span>${label}${required?' <b>*</b>':''}</span><select id="${id}" name="${id}" ${required?'required':''} ${extra}><option value="">Selecione</option>${options.map(o=>`<option value="${esc(o)}">${esc(o)}</option>`).join('')}</select></label>`;
}
function radioField({ id, label, options, required=false }) {
  return `<div class="form-field radio-group"><span>${label}${required?' <b>*</b>':''}</span><div class="radio-options">${options.map(o=>`<label><input type="radio" name="${id}" value="${esc(o)}" ${required?'required':''}> ${esc(o)}</label>`).join('')}</div></div>`;
}
function simNaoField(id, label, required=true) { return radioField({ id, label, options:['Sim','Não'], required }); }
function checkboxGrid({ name, label, options }) { return `<div class="form-field checkbox-group"><span>${label}</span><div class="checkbox-grid">${options.map(o=>`<label><input type="checkbox" name="${name}" value="${esc(o)}"> ${esc(o)}</label>`).join('')}</div></div>`; }
function diseaseRows() { return `<div class="disease-list">${DOENCAS.map((d,i)=>`<div class="disease-row"><span>${d}</span><label><input type="radio" name="doenca_${i}" value="Sim" required> Sim</label><label><input type="radio" name="doenca_${i}" value="Não" required> Não</label></div>`).join('')}</div>`; }
function medicalConditionBlock({ id, label, remedyLabel }) { return `<div class="condition-card">${simNaoField(id,label,true)}${textareaField({ id:`${id}_remedios`, label:remedyLabel, placeholder:'Informe os remédios utilizados', conditional:`data-show-if="${id}:Sim"` })}</div>`; }
function yesNoWithDetails({ id, label, detailLabel }) { return `<div class="condition-card">${simNaoField(id,label,true)}${textareaField({ id:`${id}_detalhes`, label:detailLabel, placeholder:'Descreva aqui', conditional:`data-show-if="${id}:Sim"` })}</div>`; }

function getFormSteps() {
  return [
    { title:'1. Identificação pessoal', desc:'Dados principais do inscrito.', html:`<div class="form-grid">${inputField({id:'nomeCompleto',label:'Nome completo sem abreviações',required:true})}${inputField({id:'funcao',label:'Função'})}${radioField({id:'sexo',label:'Sexo',options:['Feminino','Masculino'],required:true})}${inputField({id:'dataNascimento',label:'Data de nascimento',type:'date',required:true})}${selectField({id:'estadoCivil',label:'Estado civil',options:['Solteiro(a)','Casado(a)','Divorciado(a)','Viúvo(a)','Outro'],required:true})}${simNaoField('batizadoIASD','Batizado na IASD?',true)}</div>` },
    { title:'2. Documentos', desc:'Documentos pessoais e camiseta.', html:`<div class="form-grid">${inputField({id:'rg',label:'RG',numeric:true,placeholder:'Somente números'})}${inputField({id:'orgaoExpedidor',label:'Órgão expedidor'})}${inputField({id:'cpf',label:'CPF',required:true,numeric:true,placeholder:'000.000.000-00',hint:'Digite apenas números. O sistema formata automaticamente.'})}${inputField({id:'certidaoNascimento',label:'Certidão de nascimento'})}${inputField({id:'cpfResponsavelSemCpf',label:'Se não tiver CPF próprio, CPF de um responsável',numeric:true,placeholder:'000.000.000-00',hint:'Digite apenas números. O sistema formata automaticamente.'})}${selectField({id:'tamanhoCamiseta',label:'Tamanho da camiseta',options:TAMANHOS_CAMISETA,required:true})}${inputField({id:'tamanhoCamisetaOutra',label:'Informe outro tamanho de camiseta',extra:'data-show-if="tamanhoCamiseta:Outra"'})}</div>` },
    { title:'3. Contato', desc:'Dados de contato.', html:`<div class="form-grid">${inputField({id:'telefone',label:'Telefone',numeric:true,placeholder:'(00) 0000-0000',hint:'Digite apenas números.'})}${inputField({id:'celular',label:'Celular / WhatsApp',required:true,numeric:true,placeholder:'(00) 00000-0000',hint:'Digite apenas números.'})}${inputField({id:'email',label:'E-mail',type:'email',required:true,placeholder:'email@exemplo.com'})}</div>` },
    { title:'4. Endereço', desc:'Endereço completo.', html:`<div class="form-grid">${inputField({id:'cep',label:'CEP',required:true,numeric:true,placeholder:'00000-000',hint:'Digite o CEP e clique na lupa para buscar o endereço.'})}<button class="btn btn-secondary cep-search-btn" type="button" id="btn-buscar-cep" title="Pesquisar CEP">🔎 Pesquisar CEP</button>${inputField({id:'endereco',label:'Endereço / Rua',required:true})}${inputField({id:'numeroEndereco',label:'Número',required:true,numeric:true,placeholder:'Somente números'})}${inputField({id:'bairro',label:'Bairro',required:true})}${inputField({id:'complemento',label:'Complemento'})}${inputField({id:'cidade',label:'Cidade',required:true})}${selectField({id:'estado',label:'Estado',options:ESTADOS_BR,required:true})}</div><div class="note cep-note" id="cep-message">Os campos de endereço continuam editáveis caso precise corrigir alguma informação.</div>` },
    { title:'5. Escolaridade', desc:'Formação e área de conhecimento.', html:`<div class="form-grid">${selectField({id:'nivelEscolaridade',label:'Nível de escolaridade',options:['Educação Infantil','Ensino Fundamental','Ensino Médio','Ensino Técnico','Ensino Superior','Pós-Graduação','Mestrado','MBA','Doutorado']})}${selectField({id:'statusEscolaridade',label:'Status de escolaridade',options:['Completo','Cursando','Incompleto']})}${selectField({id:'areaConhecimento',label:'Área de conhecimento',options:AREAS_CONHECIMENTO})}${inputField({id:'nomeCurso',label:'Nome do curso'})}${inputField({id:'instituicaoEnsino',label:'Instituição de ensino'})}</div>` },
    { title:'6. Profissional de saúde', desc:'Informações de apoio de saúde.', html:`<div class="form-grid professional-health-grid">${simNaoField('profissionalSaude','É profissional de saúde?',true)}<div class="conditional-field is-hidden professional-extra-fields" data-show-if="profissionalSaude:Sim">${selectField({id:'tipoProfissionalSaude',label:'Área/profissão de saúde',options:PROFISSOES_SAUDE})}${inputField({id:'documentoProfissional',label:'Número do documento profissional',numeric:true})}${inputField({id:'orgaoProfissional',label:'Órgão expedidor / Conselho'})}</div></div>` },
    { title:'7. Pais e contato de emergência', desc:'Responsáveis e contato emergencial.', html:`<div class="form-grid">${inputField({id:'nomePai',label:'Nome do pai'})}${inputField({id:'emailPai',label:'E-mail do pai',type:'email'})}${inputField({id:'telefonePai',label:'Telefone/celular do pai',numeric:true,placeholder:'(00) 00000-0000',hint:'Digite apenas números.'})}${inputField({id:'nomeMae',label:'Nome da mãe'})}${inputField({id:'emailMae',label:'E-mail da mãe',type:'email'})}${inputField({id:'telefoneMae',label:'Telefone/celular da mãe',numeric:true,placeholder:'(00) 00000-0000',hint:'Digite apenas números.'})}${inputField({id:'nomeContatoEmergencia',label:'Nome do contato de emergência / responsável legal',required:true})}${inputField({id:'parentescoContatoEmergencia',label:'Grau de parentesco',required:true})}${inputField({id:'telefoneContatoEmergencia',label:'Telefone/celular do contato',required:true,numeric:true,placeholder:'(00) 00000-0000',hint:'Digite apenas números.'})}${inputField({id:'emailContatoEmergencia',label:'E-mail do contato',type:'email'})}</div>` },
    { title:'8. Dados médicos básicos', desc:'SUS, plano de saúde e tipo sanguíneo.', html:`<div class="form-grid">${inputField({id:'cartaoSUS',label:'Número do cartão SUS',required:true,numeric:true,placeholder:'Somente números'})}${inputField({id:'dataFichaMedica',label:'Data de hoje',type:'date',required:true,extra:`value="${todayISO()}"`})}${simNaoField('planoSaude','Possui plano de saúde?',true)}${inputField({id:'nomePlanoSaude',label:'Nome do plano de saúde',extra:'data-show-if="planoSaude:Sim"'})}${selectField({id:'tipoSanguineo',label:'Tipo sanguíneo',options:['A+','A-','B+','B-','AB+','AB-','O+','O-','Não sabe'],required:true})}</div>` },
    { title:'9. Doenças que já teve', desc:'Marque Sim ou Não para cada doença/condição.', html:diseaseRows() },
    { title:'10. Condições de saúde com remédios', desc:'Quando marcar Sim, informe os remédios.', html:`<div class="conditions-grid">${medicalConditionBlock({id:'problemasCardiacos',label:'Problemas cardíacos?',remedyLabel:'Remédios para problemas cardíacos'})}${medicalConditionBlock({id:'diabetico',label:'Diabético?',remedyLabel:'Remédios para diabetes'})}${medicalConditionBlock({id:'problemasRenais',label:'Problemas renais?',remedyLabel:'Remédios para problemas renais'})}${medicalConditionBlock({id:'problemasPsicologicos',label:'Problemas psicológicos?',remedyLabel:'Remédios para problemas psicológicos'})}</div>` },
    { title:'11. Informações médicas complementares', desc:'Histórico recente, alergias, ferimentos, fraturas, cirurgias e internações.', html:`<div class="form-grid">${textareaField({id:'outrosProblemas',label:'Outros problemas de saúde'})}${textareaField({id:'outrosMedicamentos',label:'Outros medicamentos'})}</div><div class="conditions-grid mt-18">${yesNoWithDetails({id:'problemasRecentes',label:'Teve problemas de saúde recentes?',detailLabel:'Qual(is)?'})}${yesNoWithDetails({id:'medicamentosRecentes',label:'Utilizou medicamentos recentemente?',detailLabel:'Qual(is)?'})}${yesNoWithDetails({id:'alergias',label:'Possui alergias?',detailLabel:'Qual(is)?'})}${yesNoWithDetails({id:'remediosAlergias',label:'Usa remédios para alergias?',detailLabel:'Qual(is)?'})}${yesNoWithDetails({id:'ferimentoRecente',label:'Algum ferimento grave recente?',detailLabel:'Qual?'})}${yesNoWithDetails({id:'fraturaRecente',label:'Alguma fratura recente?',detailLabel:'Qual?'})}${yesNoWithDetails({id:'tempoImobilizado',label:'Houve imobilização?',detailLabel:'Por quanto tempo?'})}${yesNoWithDetails({id:'cirurgias',label:'Passou por cirurgia?',detailLabel:'Qual(is)?'})}${yesNoWithDetails({id:'internacao5Anos',label:'Teve internação nos últimos 5 anos?',detailLabel:'Qual motivo?'})}</div>` },
    { title:'12. Deficiência ou condição específica', desc:'Deficiência/condição, quando houver.', html:`${simNaoField('possuiDeficiencia','Possui algum tipo de deficiência ou condição específica?',true)}<div class="conditional-field is-hidden" data-show-if="possuiDeficiencia:Sim">${checkboxGrid({name:'deficiencias',label:'Tipos de deficiência/condição',options:DEFICIENCIAS})}${textareaField({id:'observacaoDeficiencia',label:'Observação sobre a deficiência ou condição específica'})}</div>` },
    { title:'13. Termo de responsabilidade', desc:'Confirmação final.', html:`<div class="form-grid">${inputField({id:'localAssinatura',label:'Local',required:true})}${inputField({id:'dataAssinatura',label:'Data de hoje',type:'date',required:true,extra:`value="${todayISO()}"`})}${inputField({id:'nomeResponsavelAssinatura',label:'Nome completo do responsável',required:true})}${inputField({id:'cpfResponsavelAssinatura',label:'CPF do responsável',required:true,numeric:true,placeholder:'000.000.000-00',hint:'Digite apenas números. O sistema formata automaticamente.'})}</div><label class="terms-box"><input type="checkbox" name="confirmacaoResponsabilidade" value="Confirmo" required><span>Confirmo que todos os dados informados neste cadastro e na ficha médica são verdadeiros.</span></label><div class="review-box"><h3>Revisão antes do envio</h3><p>Confira os principais dados antes de enviar.</p><button class="btn btn-secondary" type="button" id="btn-review">Revisar dados</button><div id="review-content" class="review-content is-hidden"></div></div>` }
  ];
}

function getFormDataObject(form) {
  const data = new FormData(form); const obj = {};
  for (const [k,v] of data.entries()) obj[k] ? obj[k] = Array.isArray(obj[k]) ? [...obj[k], v] : [obj[k], v] : obj[k] = v;
  DOENCAS.forEach((d,i)=> obj[`doenca_${i}_nome`] = d);
  return obj;
}
function validateCurrentStep(form, stepIndex) {
  const panel = form.querySelector(`[data-step-panel="${stepIndex}"]`);
  const required = [...panel.querySelectorAll('input[required], select[required], textarea[required]')].filter(el=>!el.closest('.is-hidden'));
  for (const field of required) {
    if (field.type === 'radio') { if (!panel.querySelector(`input[name="${field.name}"]:checked`)) { field.focus(); return false; } }
    else if (field.type === 'checkbox') { if (!field.checked) { field.focus(); return false; } }
    else if (!field.value.trim()) { field.focus(); return false; }
  }
  return true;
}
function onlyDigits(value, maxLength) {
  const digits = String(value || '').replace(/\D+/g, '');
  return maxLength ? digits.slice(0, maxLength) : digits;
}
function maskCPF(value) {
  const d = onlyDigits(value, 11);
  return d.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}
function maskCEP(value) {
  const d = onlyDigits(value, 8);
  return d.replace(/(\d{5})(\d{1,3})$/, '$1-$2');
}
function maskTelefone(value) {
  const d = onlyDigits(value, 10);
  return d.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d{1,4})$/, '$1-$2');
}
function maskCelular(value) {
  const d = onlyDigits(value, 11);
  return d.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d{1,4})$/, '$1-$2');
}
function setupNumericOnly(scope) {
  const cpfFields = ['cpf','cpfResponsavelSemCpf','cpfResponsavelAssinatura'];
  const cepFields = ['cep'];
  const phoneFields = ['telefone'];
  const mobileFields = ['celular','telefonePai','telefoneMae','telefoneContatoEmergencia'];
  scope.querySelectorAll('[data-numeric="true"]').forEach(input => {
    input.addEventListener('input', () => {
      if (cpfFields.includes(input.id)) input.value = maskCPF(input.value);
      else if (cepFields.includes(input.id)) input.value = maskCEP(input.value);
      else if (phoneFields.includes(input.id)) input.value = maskTelefone(input.value);
      else if (mobileFields.includes(input.id)) input.value = maskCelular(input.value);
      else input.value = onlyDigits(input.value);
    });
  });
}
function setupConditionalFields(scope) {
  function apply() {
    scope.querySelectorAll('[data-show-if]').forEach(field=>{
      const [target, expected] = field.dataset.showIf.split(':');
      const checked = scope.querySelector(`[name="${target}"]:checked`);
      const normal = scope.querySelector(`[name="${target}"]`);
      const current = checked ? checked.value : normal?.value;
      const visible = current === expected;
      field.classList.toggle('is-hidden', !visible);
      if (!visible) field.querySelectorAll('input, textarea, select').forEach(child=>{ if(child.type==='radio'||child.type==='checkbox') child.checked=false; else child.value=''; });
    });
  }
  scope.addEventListener('change', apply); scope.addEventListener('input', apply); apply();
}

function setupCepLookup(form) {
  const cepInput = form.querySelector('#cep');
  const btn = form.querySelector('#btn-buscar-cep');
  const msg = form.querySelector('#cep-message');
  if (!cepInput || !btn) return;
  async function buscarCep() {
    const cep = onlyDigits(cepInput.value, 8);
    if (cep.length !== 8) {
      if (msg) { msg.textContent = 'Informe um CEP com 8 números antes de pesquisar.'; msg.className = 'note cep-note error'; }
      cepInput.focus();
      return;
    }
    if (msg) { msg.textContent = 'Pesquisando CEP...'; msg.className = 'note cep-note'; }
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await response.json();
      if (data.erro) throw new Error('CEP não encontrado');
      const endereco = form.querySelector('#endereco');
      const bairro = form.querySelector('#bairro');
      const cidade = form.querySelector('#cidade');
      const estado = form.querySelector('#estado');
      if (endereco) endereco.value = data.logradouro || endereco.value;
      if (bairro) bairro.value = data.bairro || bairro.value;
      if (cidade) cidade.value = data.localidade || cidade.value;
      if (estado) estado.value = data.uf || estado.value;
      if (msg) { msg.textContent = 'Endereço preenchido automaticamente. Confira e edite se necessário.'; msg.className = 'note cep-note success'; }
      form.querySelector('#numeroEndereco')?.focus();
    } catch (error) {
      if (msg) { msg.textContent = 'Não foi possível encontrar o endereço por este CEP. Preencha ou corrija os campos manualmente.'; msg.className = 'note cep-note error'; }
    }
  }
  btn.addEventListener('click', buscarCep);
  cepInput.addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); buscarCep(); } });
}

function updateFormularioStep(form, nextIndex) {
  const panels = [...form.querySelectorAll('[data-step-panel]')], tabs = [...form.querySelectorAll('[data-step-tab]')];
  panels.forEach((p,i)=>p.classList.toggle('is-hidden', i!==nextIndex));
  tabs.forEach((t,i)=>{t.classList.toggle('active', i===nextIndex); t.classList.toggle('done', i<nextIndex);});
  form.querySelector('#form-progress-bar').style.width = `${((nextIndex+1)/panels.length)*100}%`;
  form.querySelector('#form-step-counter').textContent = `Etapa ${nextIndex+1} de ${panels.length}`;
  form.querySelector('#btn-prev-step').disabled = nextIndex === 0;
  form.querySelector('#btn-next-step').classList.toggle('is-hidden', nextIndex === panels.length-1);
  form.querySelector('#btn-submit-form').classList.toggle('is-hidden', nextIndex !== panels.length-1);
  form.dataset.currentStep = String(nextIndex);
}
function buildReviewSection(title, fields) {
  const rows = fields.map(([label, value]) => `<div><dt>${esc(label)}</dt><dd>${esc(value || '-')}</dd></div>`).join('');
  return `<section class="review-section"><h4>${esc(title)}</h4><dl class="review-list">${rows}</dl></section>`;
}
function buildReviewHtml(p) {
  const doencasRows = DOENCAS.map((d, i) => [d, p[`doenca_${i}`] || '-']);
  const deficiencias = Array.isArray(p.deficiencias) ? p.deficiencias.join(', ') : (p.deficiencias || '-');
  const clubName = p.clubeNomePersonalizado || getClubCustomName(p.clube) || p.clubeLabel || clubLabel(p.clube);
  const sections = [
    ['1. Identificação pessoal', [['Clube', clubName], ['Nome completo', p.nomeCompleto], ['Função', p.funcao], ['Sexo', p.sexo], ['Data de nascimento', p.dataNascimento], ['Estado civil', p.estadoCivil], ['Batizado na IASD', p.batizadoIASD]]],
    ['2. Documentos', [['RG', p.rg], ['Órgão expedidor', p.orgaoExpedidor], ['CPF', p.cpf], ['Certidão de nascimento', p.certidaoNascimento], ['CPF do responsável se não tiver CPF próprio', p.cpfResponsavelSemCpf], ['Tamanho da camiseta', p.tamanhoCamiseta === 'Outra' ? p.tamanhoCamisetaOutra : p.tamanhoCamiseta]]],
    ['3. Contato', [['Telefone', p.telefone], ['Celular / WhatsApp', p.celular], ['E-mail', p.email]]],
    ['4. Endereço', [['CEP', p.cep], ['Endereço / Rua', p.endereco], ['Número', p.numeroEndereco], ['Bairro', p.bairro], ['Complemento', p.complemento], ['Cidade', p.cidade], ['Estado', p.estado]]],
    ['5. Escolaridade', [['Nível de escolaridade', p.nivelEscolaridade], ['Status da escolaridade', p.statusEscolaridade], ['Área de conhecimento', p.areaConhecimento], ['Nome do curso', p.nomeCurso], ['Instituição de ensino', p.instituicaoEnsino]]],
    ['6. Profissional de saúde', [['É profissional de saúde?', p.profissionalSaude], ['Área/profissão de saúde', p.tipoProfissionalSaude], ['Número do documento profissional', p.documentoProfissional], ['Órgão expedidor / Conselho', p.orgaoProfissional]]],
    ['7. Pais e contato de emergência', [['Nome do pai', p.nomePai], ['E-mail do pai', p.emailPai], ['Telefone/celular do pai', p.telefonePai], ['Nome da mãe', p.nomeMae], ['E-mail da mãe', p.emailMae], ['Telefone/celular da mãe', p.telefoneMae], ['Nome do contato de emergência', p.nomeContatoEmergencia], ['Grau de parentesco', p.parentescoContatoEmergencia], ['Telefone/celular do contato', p.telefoneContatoEmergencia], ['E-mail do contato', p.emailContatoEmergencia]]],
    ['8. Dados médicos básicos', [['Cartão SUS', p.cartaoSUS], ['Data da ficha médica', p.dataFichaMedica], ['Plano de saúde', p.planoSaude], ['Nome do plano', p.nomePlanoSaude], ['Tipo sanguíneo', p.tipoSanguineo]]],
    ['9. Doenças que já teve', doencasRows],
    ['10. Condições de saúde com remédios', [['Problemas cardíacos', p.problemasCardiacos], ['Remédios', p.problemasCardiacos_remedios], ['Diabético', p.diabetico], ['Remédios', p.diabetico_remedios], ['Problemas renais', p.problemasRenais], ['Remédios', p.problemasRenais_remedios], ['Problemas psicológicos', p.problemasPsicologicos], ['Remédios', p.problemasPsicologicos_remedios]]],
    ['11. Informações médicas complementares', [['Outros problemas', p.outrosProblemas], ['Outros medicamentos', p.outrosMedicamentos], ['Problemas recentes', p.problemasRecentes], ['Quais?', p.problemasRecentes_detalhes], ['Medicamentos recentes', p.medicamentosRecentes], ['Quais?', p.medicamentosRecentes_detalhes], ['Alergias', p.alergias], ['Quais?', p.alergias_detalhes], ['Remédios para alergias', p.remediosAlergias], ['Quais?', p.remediosAlergias_detalhes], ['Ferimento recente', p.ferimentoRecente], ['Qual?', p.ferimentoRecente_detalhes], ['Fratura recente', p.fraturaRecente], ['Qual?', p.fraturaRecente_detalhes], ['Houve imobilização?', p.tempoImobilizado], ['Por quanto tempo?', p.tempoImobilizado_detalhes], ['Cirurgias', p.cirurgias], ['Quais?', p.cirurgias_detalhes], ['Internação nos últimos 5 anos', p.internacao5Anos], ['Motivo', p.internacao5Anos_detalhes]]],
    ['12. Deficiência ou condição específica', [['Possui deficiência/condição específica?', p.possuiDeficiencia], ['Tipos', deficiencias], ['Observação', p.observacaoDeficiencia]]],
    ['13. Termo de responsabilidade', [['Local', p.localAssinatura], ['Data', p.dataAssinatura], ['Nome do responsável', p.nomeResponsavelAssinatura], ['CPF do responsável', p.cpfResponsavelAssinatura], ['Confirmação', p.confirmacaoResponsabilidade]]]
  ];
  return sections.map(([title, fields]) => buildReviewSection(title, fields)).join('');
}

function buildAdminLayout({ activePage, badge, title, subtitle, contentHtml }) {
  const admin = getAdminSession(); const photo = admin.photoURL || `${base}/assets/img/logos/logo-formulario.png`;
  return `<main class="admin-shell"><div class="admin-grid"><aside class="sidebar"><div class="admin-profile-card"><img class="admin-avatar" src="${photo}" alt="Foto do administrador logado"><div class="admin-profile-text"><strong>${admin.name}</strong><div class="small">${admin.email}</div></div></div><nav class="menu admin-menu-full"><a class="${activePage==='dashboard'?'active':''}" href="dashboard.html">Dashboard</a><a class="${activePage==='inscritos-dbv'?'active':''}" href="inscritosdbv.html">Inscritos Desbravadores</a><a class="${activePage==='inscritos-av'?'active':''}" href="inscritosav.html">Inscritos Aventureiros</a><a class="${activePage==='admins'?'active':''}" href="admins.html">Administradores</a><a class="${activePage==='admin-editor'?'active':''}" href="admin-editor.html">Novo ADM</a><a href="../index.html">Voltar ao site</a><button class="btn btn-secondary btn-full" id="btn-admin-logout" type="button">Sair</button></nav></aside><section class="content-card"><span class="badge">${badge}</span><h2 class="content-title">${title}</h2><p class="subtitle">${subtitle}</p>${contentHtml}</section></div></main>`;
}
function attachAdminLayoutEvents() { const btn = document.getElementById('btn-admin-logout'); if(btn) btn.addEventListener('click', async()=>{ await logoutGoogle(); sessionStorage.removeItem(adminSessionKey); window.location.href='login.html'; }); }

function googleAccountHtml(user) {
  if (!user?.email) {
    return `<button class="google-login-button" id="btn-google-login-home" type="button" aria-label="Entrar com Google"><span class="google-icon">G</span><span>Entrar com Google</span></button>`;
  }
  const photo = user.photoURL || `${base}/assets/img/logos/logo-formulario.png`;
  const name = user.displayName || 'Conta Google';
  return `<div class="google-profile">
    <button class="google-profile-button" id="btn-google-profile" type="button" aria-label="Abrir menu da conta Google">
      <img src="${esc(photo)}" alt="Foto de perfil da conta Google">
      <span class="profile-chevron">▾</span>
    </button>
    <div class="google-profile-menu is-hidden" id="google-profile-menu">
      <div class="google-profile-info">
        <strong>${esc(name)}</strong>
        <span>${esc(user.email)}</span>
      </div>
      <button type="button" id="btn-google-switch">Trocar conta</button>
      <button type="button" id="btn-google-logout">Sair</button>
    </div>
  </div>`;
}

function bindGoogleAccountBox(container, note, noteText) {
  const loginBtn = container.querySelector('#btn-google-login-home');
  const profileBtn = container.querySelector('#btn-google-profile');
  const profileMenu = container.querySelector('#google-profile-menu');
  const switchBtn = container.querySelector('#btn-google-switch');
  const logoutBtn = container.querySelector('#btn-google-logout');

  loginBtn?.addEventListener('click', async () => {
    try { await loginWithGoogle(); }
    catch (e) {
      noteText.textContent = `Não foi possível entrar com Google: ${e.message}`;
      note.classList.add('error-state');
    }
  });

  profileBtn?.addEventListener('click', (event) => {
    event.stopPropagation();
    profileMenu?.classList.toggle('is-hidden');
  });

  switchBtn?.addEventListener('click', async () => {
    try {
      profileMenu?.classList.add('is-hidden');
      await logoutGoogle();
      await loginWithGoogle();
    } catch (e) {
      noteText.textContent = `Não foi possível trocar a conta: ${e.message}`;
      note.classList.add('error-state');
    }
  });

  logoutBtn?.addEventListener('click', async () => {
    try {
      profileMenu?.classList.add('is-hidden');
      await logoutGoogle();
    } catch (e) {
      noteText.textContent = `Não foi possível sair da conta: ${e.message}`;
      note.classList.add('error-state');
    }
  });

  document.addEventListener('click', () => profileMenu?.classList.add('is-hidden'), { once: true });
}

function renderHome() {
  app.innerHTML = `<main class="shell shell-home"><section class="card landing-card"><div class="landing-header"><div class="brand brand-main"><img src="${base}/assets/img/logos/logo-formulario.png" alt="Logo Formulário de Inscrição"><div><h1>Formulário de Inscrição</h1><p class="small brand-subtitle">Cadastro para Desbravadores e Aventureiros</p></div></div><div class="google-account-box" id="google-account-box"></div></div><div class="hero-banner hero-banner-simple"><div><span class="hero-badge">Etapa inicial</span><h2>Escolha o clube antes de começar</h2><p>Venha fazer parte desta aventura. Preencha sua inscrição agora e prepare-se para viver momentos especiais no clube.</p></div></div><div class="club-grid improved-club-grid"><button class="club-card improved" data-club="desbravadores" type="button"><div class="club-card-top"><span class="pill">Seleção de clube</span><span class="club-check">✓</span></div><div class="club-logo-wrap"><img src="${base}/assets/img/clubes/desbravadores.svg" alt="Logo Desbravadores"></div><strong>Clube de Desbravadores</strong><span class="club-custom-name" id="club-name-desbravadores"></span><span class="small">Usar esta opção para inscrições do clube de Desbravadores.</span></button><button class="club-card improved" data-club="aventureiros" type="button"><div class="club-card-top"><span class="pill">Seleção de clube</span><span class="club-check">✓</span></div><div class="club-logo-wrap"><img src="${base}/assets/img/clubes/aventureiros.png" alt="Logo Aventureiros"></div><strong>Clube de Aventureiros</strong><span class="club-custom-name" id="club-name-aventureiros"></span><span class="small">Usar esta opção para inscrições do clube de Aventureiros.</span></button></div><div class="selection-status" id="club-note"><div><span class="selection-label">Status da seleção</span><strong id="club-note-text">Nenhum clube selecionado ainda.</strong></div></div><div class="actions actions-home"><a class="btn btn-primary btn-large" href="${base}/formulario.html" id="btn-continuar">Continuar inscrição</a></div></section></main>`;
  const note = document.getElementById('club-note');
  const noteText = document.getElementById('club-note-text');
  const googleBox = document.getElementById('google-account-box');
  document.getElementById('club-name-desbravadores').textContent = getClubCustomName('desbravadores');
  document.getElementById('club-name-aventureiros').textContent = getClubCustomName('aventureiros');
  const selected = getClubSelection();
  noteText.textContent = selected ? `Clube selecionado: ${clubLabel(selected)}` : 'Nenhum clube selecionado ainda.';
  if(selected){app.querySelector(`[data-club="${selected}"]`)?.classList.add('active'); note.classList.add('selected');}

  let lastGoogleHtml = '';
  const unsub = watchAuth((user)=>{
    const html = googleAccountHtml(user);
    if (html !== lastGoogleHtml) {
      googleBox.innerHTML = html;
      lastGoogleHtml = html;
      bindGoogleAccountBox(googleBox, note, noteText);
    }
  });
  window.addEventListener('beforeunload', unsub, {once:true});

  app.querySelectorAll('[data-club]').forEach(button=>button.addEventListener('click',()=>{ app.querySelectorAll('[data-club]').forEach(b=>b.classList.remove('active')); button.classList.add('active'); setClubSelection(button.dataset.club); noteText.textContent = `Clube selecionado: ${clubLabel(button.dataset.club)}`; note.classList.add('selected'); note.classList.remove('error-state'); }));
  document.getElementById('btn-continuar').addEventListener('click',(e)=>{ if(!getClubSelection()){e.preventDefault(); noteText.textContent='Selecione um clube antes de continuar.'; note.classList.add('error-state'); note.classList.remove('selected');} });
}

function renderFormulario() {
  const club = getClubSelection(), steps = getFormSteps(), clubCustomName = club ? getClubCustomName(club) : '';
  app.innerHTML = `<main class="form-shell"><div class="topbar form-topbar"><div class="topbar-brand"><img src="assets/img/logos/logo-formulario.png" alt="Logo Formulário"><div><h2>Formulário de Inscrição</h2><div class="small">${club ? `${clubLabel(club)}${clubCustomName ? ` • ${clubCustomName}` : ''}` : 'Escolha um clube na página inicial antes de preencher'}</div></div></div><a class="btn btn-secondary" href="index.html">Voltar</a></div><form id="inscricao-form" class="card form-card-padding full-form-card" novalidate data-current-step="0"><div class="form-intro"><div><span class="badge">Cadastro + Ficha Médica</span><h3 class="form-title">Preencha as etapas abaixo</h3><p class="subtitle form-subtitle">As perguntas são iguais para Desbravadores e Aventureiros. Campos de número aceitam somente números e, no celular, abrem teclado numérico.</p></div><div class="form-current-club"><span>Clube escolhido</span><strong>${club ? clubLabel(club) : 'Não selecionado'}</strong>${clubCustomName ? `<small>${clubCustomName}</small>` : ''}</div></div><div class="form-progress-wrap"><div class="form-progress-info"><strong id="form-step-counter">Etapa 1 de ${steps.length}</strong><span>Revise tudo antes de enviar</span></div><div class="progress"><span id="form-progress-bar"></span></div></div><div class="step-tabs">${steps.map((s,i)=>`<button type="button" data-step-tab="${i}" class="step-tab ${i===0?'active':''}" title="${esc(s.title)}">${i+1}</button>`).join('')}</div><input type="hidden" name="clube" value="${esc(club)}"><input type="hidden" name="clubeLabel" value="${esc(clubLabel(club))}"><input type="hidden" name="clubeNomePersonalizado" value="${esc(clubCustomName)}"><section class="form-steps">${steps.map((s,i)=>`<article class="form-step-panel ${i!==0?'is-hidden':''}" data-step-panel="${i}"><header class="step-panel-header"><span class="badge">Etapa ${i+1}</span><h3>${s.title}</h3><p>${s.desc}</p></header>${s.html}</article>`).join('')}</section><div class="form-actions-footer"><button class="btn btn-secondary" type="button" id="btn-prev-step" disabled>Voltar etapa</button><button class="btn btn-primary" type="button" id="btn-next-step">Próxima etapa</button><button class="btn btn-primary is-hidden" type="submit" id="btn-submit-form">Enviar inscrição</button></div><div class="note" id="form-message"></div></form></main>`;
  const form = document.getElementById('inscricao-form'), message = document.getElementById('form-message'), emailInput = form.querySelector('#email'); let currentStep = 0;
  setupNumericOnly(form); setupConditionalFields(form); setupCepLookup(form); updateFormularioStep(form, currentStep);
  const unsub = watchAuth((user)=>{ if(user?.email && emailInput && !emailInput.value){ emailInput.value = user.email; emailInput.dataset.autoEmail='google'; }}); window.addEventListener('beforeunload', unsub, {once:true});
  form.querySelectorAll('[data-step-tab]').forEach(tab=>tab.addEventListener('click',()=>{ const target=Number(tab.dataset.stepTab); if(target>currentStep && !validateCurrentStep(form,currentStep)){ message.textContent='Preencha os campos obrigatórios desta etapa antes de avançar.'; message.className='note error'; return; } currentStep=target; message.textContent=''; message.className='note'; updateFormularioStep(form,currentStep); window.scrollTo({top:0,behavior:'smooth'}); }));
  form.querySelector('#btn-prev-step').addEventListener('click',()=>{ currentStep=Math.max(0,currentStep-1); message.textContent=''; message.className='note'; updateFormularioStep(form,currentStep); window.scrollTo({top:0,behavior:'smooth'}); });
  form.querySelector('#btn-next-step').addEventListener('click',()=>{ if(!validateCurrentStep(form,currentStep)){ message.textContent='Preencha os campos obrigatórios desta etapa antes de avançar.'; message.className='note error'; return; } currentStep=Math.min(steps.length-1,currentStep+1); message.textContent=''; message.className='note'; updateFormularioStep(form,currentStep); window.scrollTo({top:0,behavior:'smooth'}); });
  form.querySelector('#btn-review')?.addEventListener('click',()=>{ const payload=getFormDataObject(form); const c=form.querySelector('#review-content'); c.innerHTML=buildReviewHtml(payload); c.classList.remove('is-hidden'); });
  form.addEventListener('submit', async(e)=>{ e.preventDefault(); if(!club){ message.textContent='Volte e selecione Desbravadores ou Aventureiros antes de enviar.'; message.className='note error'; return; } if(!validateCurrentStep(form,currentStep)){ message.textContent='Preencha os campos obrigatórios antes de enviar.'; message.className='note error'; return; } const payload=getFormDataObject(form); payload.clube=club; payload.clubeLabel=clubLabel(club); payload.clubeNomePersonalizado=clubCustomName; payload.createdAtLocal=new Date().toISOString(); try { const docRef=await addDoc(collection(db,'inscritos'), {...payload, createdAt: serverTimestamp()}); const localItems=getInscritos(); localItems.push({id:docRef.id,nome:payload.nomeCompleto,clube,data:new Date().toLocaleDateString('pt-BR')}); localStorage.setItem(inscritosKey, JSON.stringify(localItems)); message.textContent='Inscrição enviada com sucesso.'; message.className='note success'; form.reset(); currentStep=0; updateFormularioStep(form,currentStep); setupConditionalFields(form); window.scrollTo({top:0,behavior:'smooth'}); } catch(error){ message.textContent=`Não foi possível enviar agora: ${error.message}`; message.className='note error'; } });
}

function renderAdminLogin() {
  app.innerHTML = `<main class="shell"><section class="card admin-login-card"><div class="brand admin-login-brand"><img src="${base}/assets/img/logos/logo-formulario.png" alt="Logo"><div><h1 class="admin-login-title">Área Administrativa</h1><p class="small">Login Google disponível somente no ADM</p></div></div><p class="subtitle">Seu e-mail master configurado é <strong>lindolfoandrew0@gmail.com</strong>. Depois vamos adicionar o cadastro e permissões de outros administradores.</p><div class="actions"><button class="btn btn-primary" id="btn-google" type="button">Entrar com Google</button><a class="btn btn-secondary" href="../index.html">Voltar ao site</a></div><div class="note" id="auth-message">Aguardando login.</div></section></main>`;
  const msg=document.getElementById('auth-message'); document.getElementById('btn-google').addEventListener('click',async()=>{ try{ const user=await loginWithGoogle(); if(!isMasterEmail(user)){ msg.innerHTML=`<span class="error">Login realizado com ${user.email}, mas este e-mail ainda não está liberado como administrador nesta versão inicial.</span>`; await logoutGoogle(); return;} saveAdminSession(user); window.location.href='dashboard.html'; } catch(error){ msg.innerHTML=`<span class="error">Falha no login Google: ${error.message}</span>`; } });
}
function dashboardGraphCard({title,count,colorClass,clube}) { const percent=Math.min(100,count*10); return `<article class="dashboard-graph-card ${colorClass}"><div class="dashboard-graph-top"><span class="pill">${clube}</span><strong>${count}</strong></div><h3>${title}</h3><div class="graph-bar"><span style="width:${percent}%"></span></div><p class="small">Total de inscritos registrados atualmente para este clube.</p></article>`; }
function renderAdminDashboard() {
  const settings=getClubSettings(), countDbv=getClubCount('desbravadores'), countAv=getClubCount('aventureiros');
  app.innerHTML=buildAdminLayout({activePage:'dashboard',badge:'Painel inicial',title:'Dashboard do administrador',subtitle:'Nesta tela ficam os gráficos principais e a configuração dos nomes dos clubes.',contentHtml:`<div class="dashboard-graphs-grid">${dashboardGraphCard({title:settings.desbravadoresNome,count:countDbv,colorClass:'graph-desbravadores',clube:'Desbravadores'})}${dashboardGraphCard({title:settings.aventureirosNome,count:countAv,colorClass:'graph-aventureiros',clube:'Aventureiros'})}</div><article class="section-card dashboard-settings-card"><h3>Configuração dos nomes dos clubes</h3><p>Defina como o nome de cada clube aparecerá abaixo do título principal na página inicial.</p><form id="club-settings-form" class="club-settings-form"><label class="field-block"><span>Nome do clube dos Desbravadores</span><input type="text" id="input-desbravadores-nome" placeholder="Ex.: Clube Águias do Norte"></label><label class="field-block"><span>Nome do clube dos Aventureiros</span><input type="text" id="input-aventureiros-nome" placeholder="Ex.: Clube Pequenos Heróis"></label><div class="actions"><button class="btn btn-primary" type="submit">Salvar nomes</button></div><div class="note success-note" id="club-settings-message">Os nomes salvos aqui aparecerão na home do site.</div></form></article>`});
  attachAdminLayoutEvents(); const form=document.getElementById('club-settings-form'), inputDbv=document.getElementById('input-desbravadores-nome'), inputAv=document.getElementById('input-aventureiros-nome'), msg=document.getElementById('club-settings-message'); inputDbv.value=settings.desbravadoresNome; inputAv.value=settings.aventureirosNome; form.addEventListener('submit',(e)=>{e.preventDefault(); saveClubSettings({desbravadoresNome:inputDbv.value.trim()||'Nome do clube definido no ADM', aventureirosNome:inputAv.value.trim()||'Nome do clube definido no ADM'}); msg.textContent='Nomes dos clubes salvos com sucesso. Volte à home para conferir.';});
}
function buildInscritosTable(clube) { const rows=getInscritosByClub(clube); if(!rows.length) return '<div class="empty-box">Nenhum inscrito encontrado para este clube.</div>'; return `<table class="table"><thead><tr><th>Nome</th><th>Clube</th><th>Data</th><th>Ações</th></tr></thead><tbody>${rows.map(item=>`<tr><td>${esc(item.nome)}</td><td>${clubLabel(item.clube)}</td><td>${item.data}</td><td>Ver • Editar • Excel • PDF • Word</td></tr>`).join('')}</tbody></table>`; }
function renderAdminInscritosDesbravadores(){ app.innerHTML=buildAdminLayout({activePage:'inscritos-dbv',badge:'Inscritos separados por clube',title:'Inscritos dos Desbravadores',subtitle:'Nesta página ficam apenas os cadastros vinculados ao Clube de Desbravadores.',contentHtml:buildInscritosTable('desbravadores')}); attachAdminLayoutEvents(); }
function renderAdminInscritosAventureiros(){ app.innerHTML=buildAdminLayout({activePage:'inscritos-av',badge:'Inscritos separados por clube',title:'Inscritos dos Aventureiros',subtitle:'Nesta página ficam apenas os cadastros vinculados ao Clube de Aventureiros.',contentHtml:buildInscritosTable('aventureiros')}); attachAdminLayoutEvents(); }
function renderAdminAdmins(){ app.innerHTML=buildAdminLayout({activePage:'admins',badge:'Página reservada',title:'Administradores',subtitle:'Aqui ficará a listagem dos ADMs cadastrados, com permissões por módulo e ação.',contentHtml:`<table class="table"><thead><tr><th>Nome</th><th>E-mail</th><th>Perfil</th><th>Ações</th></tr></thead><tbody><tr><td>${getAdminSession().name}</td><td>${getAdminSession().email}</td><td><span class="status">ADM master</span></td><td>Editar • Permissões</td></tr></tbody></table>`}); attachAdminLayoutEvents(); }
function renderAdminEditor(){ app.innerHTML=buildAdminLayout({activePage:'admin-editor',badge:'Estrutura pronta',title:'Cadastro de novo ADM',subtitle:'Aqui entraremos depois com nome, e-mail e permissões detalhadas do administrador.',contentHtml:`<div class="section-grid"><article class="section-card"><h3>Permissões de visualização</h3><p>Ex.: ver inscritos, ver ficha médica, ver contatos.</p></article><article class="section-card"><h3>Permissões de ação</h3><p>Ex.: editar, excluir, exportar Excel, PDF e Word, criar ADM.</p></article></div>`}); attachAdminLayoutEvents(); }

switch(page){case 'home':renderHome();break;case 'formulario':renderFormulario();break;case 'admin-login':renderAdminLogin();break;case 'admin-dashboard':renderAdminDashboard();break;case 'admin-inscritos-desbravadores':renderAdminInscritosDesbravadores();break;case 'admin-inscritos-aventureiros':renderAdminInscritosAventureiros();break;case 'admin-inscritos':renderAdminInscritosDesbravadores();break;case 'admin-admins':renderAdminAdmins();break;case 'admin-editor':renderAdminEditor();break;default:renderHome();}
watchAuth((user)=>{ if(user?.email) saveAdminSession(user); const msg=document.getElementById('auth-message'); if(msg&&user) msg.innerHTML=`<span class="success">Conectado com ${user.email}</span>`; });
