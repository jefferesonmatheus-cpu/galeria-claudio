const $ = (id) => document.getElementById(id);

const telaLogin    = $('tela-login');
const telaGaleria  = $('tela-galeria');
const formLogin    = $('form-login');
const inputSenha   = $('senha');
const erroLogin    = $('erro-login');
const grade        = $('grade');
const vazio        = $('vazio');
const inputArquivos= $('input-arquivos');
const btnSair      = $('btn-sair');
const progresso    = $('progresso');
const progressoBarra = $('progresso-barra');
const toastEl      = $('toast');

const lightbox = $('lightbox');
const lbImg    = $('lb-img');
const lbInfo   = $('lb-info');

let fotos = [];
let indiceAtual = -1;

function aviso(msg, erro = false) {
  toastEl.textContent = msg;
  toastEl.classList.remove('escondido');
  toastEl.classList.toggle('erro-toast', erro);
  clearTimeout(aviso._t);
  aviso._t = setTimeout(() => toastEl.classList.add('escondido'), 2600);
}

function formatarTamanho(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1024 / 1024).toFixed(1) + ' MB';
}

function urlFoto(nome) {
  return '/fotos/' + encodeURIComponent(nome);
}

async function api(url, opcoes = {}) {
  const r = await fetch(url, opcoes);
  if (r.status === 401) {
    mostrarLogin();
    throw new Error('Sessão expirada');
  }
  return r;
}

function mostrarLogin() {
  telaGaleria.classList.add('escondido');
  telaLogin.classList.remove('escondido');
  inputSenha.value = '';
  setTimeout(() => inputSenha.focus(), 100);
}

async function mostrarGaleria() {
  telaLogin.classList.add('escondido');
  telaGaleria.classList.remove('escondido');
  await carregarFotos();
}

formLogin.addEventListener('submit', async (e) => {
  e.preventDefault();
  erroLogin.textContent = '';
  const botao = formLogin.querySelector('button');
  botao.disabled = true;
  botao.textContent = 'Entrando...';

  try {
    const r = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ senha: inputSenha.value })
    });
    const dados = await r.json();
    if (!r.ok) throw new Error(dados.erro || 'Erro ao entrar');
    inputSenha.value = '';
    mostrarGaleria();
  } catch (err) {
    erroLogin.textContent = err.message;
    inputSenha.value = '';
    inputSenha.focus();
  } finally {
    botao.disabled = false;
    botao.textContent = 'Entrar';
  }
});

btnSair.addEventListener('click', async () => {
  await fetch('/api/logout', { method: 'POST' });
  fotos = [];
  mostrarLogin();
});

async function carregarFotos() {
  try {
    const r = await api('/api/fotos');
    fotos = await r.json();
    desenhar();
  } catch (err) {
    if (err.message !== 'Sessão expirada') aviso('Erro ao carregar fotos', true);
  }
}

function desenhar() {
  grade.innerHTML = '';
  vazio.classList.toggle('escondido', fotos.length > 0);

  fotos.forEach((foto, i) => {
    const card = document.createElement('div');
    card.className = 'card';

    const img = document.createElement('img');
    img.src = urlFoto(foto.nome);
    img.alt = foto.nome;
    img.loading = 'lazy';

    const btnDel = document.createElement('button');
    btnDel.className = 'card-del';
    btnDel.textContent = '✕';
    btnDel.title = 'Excluir';
    btnDel.addEventListener('click', (e) => {
      e.stopPropagation();
      excluir(foto.nome);
    });

    card.append(img, btnDel);
    card.addEventListener('click', () => abrirLightbox(i));
    grade.appendChild(card);
  });
}

inputArquivos.addEventListener('change', () => {
  if (inputArquivos.files.length) enviarArquivos(inputArquivos.files);
  inputArquivos.value = '';
});

function enviarArquivos(arquivos) {
  const fd = new FormData();
  for (const a of arquivos) fd.append('fotos', a);

  const xhr = new XMLHttpRequest();
  xhr.open('POST', '/api/upload');

  progresso.classList.remove('escondido');
  progressoBarra.style.width = '0%';

  xhr.upload.addEventListener('progress', (e) => {
    if (e.lengthComputable) {
      progressoBarra.style.width = (e.loaded / e.total * 100) + '%';
    }
  });

  xhr.addEventListener('load', () => {
    progresso.classList.add('escondido');
    if (xhr.status === 401) return mostrarLogin();
    if (xhr.status >= 200 && xhr.status < 300) {
      aviso(arquivos.length + ' foto(s) enviada(s)');
      carregarFotos();
    } else {
      aviso('Erro ao enviar', true);
    }
  });

  xhr.addEventListener('error', () => {
    progresso.classList.add('escondido');
    aviso('Erro de rede', true);
  });

  xhr.send(fd);
}

['dragover', 'drop'].forEach(evento => {
  telaGaleria.addEventListener(evento, (e) => e.preventDefault());
});

telaGaleria.addEventListener('dragover', () => {
  telaGaleria.style.outline = '2px dashed var(--primaria)';
  telaGaleria.style.outlineOffset = '-12px';
});

telaGaleria.addEventListener('dragleave', () => {
  telaGaleria.style.outline = '';
});

telaGaleria.addEventListener('drop', (e) => {
  telaGaleria.style.outline = '';
  const arquivos = [...e.dataTransfer.files].filter(f => f.type.startsWith('image/'));
  if (arquivos.length) enviarArquivos(arquivos);
});

function abrirLightbox(i) {
  indiceAtual = i;
  atualizarLightbox();
  lightbox.classList.remove('escondido');
  document.body.style.overflow = 'hidden';
}

function fecharLightbox() {
  lightbox.classList.add('escondido');
  document.body.style.overflow = '';
  lbImg.src = '';
}

function atualizarLightbox() {
  const foto = fotos[indiceAtual];
  if (!foto) return fecharLightbox();
  lbImg.src = urlFoto(foto.nome);
  lbInfo.textContent =
    (indiceAtual + 1) + ' / ' + fotos.length + ' · ' + formatarTamanho(foto.tamanho);
}

function navegar(passo) {
  if (!fotos.length) return;
  indiceAtual = (indiceAtual + passo + fotos.length) % fotos.length;
  atualizarLightbox();
}

$('lb-fechar').addEventListener('click', fecharLightbox);
$('lb-ant').addEventListener('click', () => navegar(-1));
$('lb-prox').addEventListener('click', () => navegar(1));

lightbox.addEventListener('click', (e) => {
  if (e.target === lightbox) fecharLightbox();
});

document.addEventListener('keydown', (e) => {
  if (lightbox.classList.contains('escondido')) return;
  if (e.key === 'Escape')     fecharLightbox();
  if (e.key === 'ArrowLeft')  navegar(-1);
  if (e.key === 'ArrowRight') navegar(1);
});

$('lb-baixar').addEventListener('click', () => {
  const foto = fotos[indiceAtual];
  if (!foto) return;
  const a = document.createElement('a');
  a.href = urlFoto(foto.nome);
  a.download = foto.nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
});

$('lb-excluir').addEventListener('click', () => {
  const foto = fotos[indiceAtual];
  if (foto) excluir(foto.nome);
});

async function excluir(nome) {
  if (!confirm('Apagar esta foto de vez?')) return;
  try {
    const r = await api('/api/fotos/' + encodeURIComponent(nome), { method: 'DELETE' });
    if (!r.ok) throw new Error();
    aviso('Foto apagada');
    fecharLightbox();
    await carregarFotos();
  } catch (err) {
    if (err.message !== 'Sessão expirada') aviso('Erro ao apagar', true);
  }
}

(async function iniciar() {
  try {
    const r = await fetch('/api/sessao');
    const { logado } = await r.json();
    if (logado) mostrarGaleria();
    else mostrarLogin();
  } catch {
    mostrarLogin();
  }
})();
