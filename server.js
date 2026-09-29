const express = require('express');
const session = require('express-session');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const PORTA = process.env.PORT || 3000;

// 🔑 A SENHA. Troque aqui ou use variável de ambiente.
const SENHA = process.env.GALERIA_SENHA || 'claudio123';

const PASTA_UPLOADS = path.join(__dirname, 'uploads');
if (!fs.existsSync(PASTA_UPLOADS)) fs.mkdirSync(PASTA_UPLOADS, { recursive: true });

// ---------- Configuração do upload (multer) ----------
const armazenamento = multer.diskStorage({
  destination: (req, file, cb) => cb(null, PASTA_UPLOADS),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const nome = Date.now() + '-' + crypto.randomBytes(4).toString('hex') + ext;
    cb(null, nome);
  }
});

const upload = multer({
  storage: armazenamento,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB por foto
  fileFilter: (req, file, cb) => {
    if (/^image\//.test(file.mimetype)) cb(null, true);
    else cb(new Error('Só aceito imagens!'));
  }
});

// ---------- Middlewares ----------
app.use(express.json());
app.use(session({
  secret: crypto.randomBytes(16).toString('hex'),
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', maxAge: 1000 * 60 * 60 * 8 } // 8 horas
}));

// Arquivos públicos (HTML, CSS, JS)
app.use(express.static(path.join(__dirname, 'public')));

// Porteiro: só passa quem está logado
function exigirLogin(req, res, next) {
  if (req.session.logado) return next();
  res.status(401).json({ erro: 'Não autorizado' });
}

// ---------- Rotas de sessão ----------
app.post('/api/login', (req, res) => {
  const { senha } = req.body || {};
  if (senha === SENHA) {
    req.session.logado = true;
    return res.json({ ok: true });
  }
  res.status(401).json({ erro: 'Senha incorreta' });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get('/api/sessao', (req, res) => {
  res.json({ logado: !!req.session.logado });
});

// ---------- Rotas das fotos ----------
// Listar
app.get('/api/fotos', exigirLogin, (req, res) => {
  fs.readdir(PASTA_UPLOADS, (err, arquivos) => {
    if (err) return res.status(500).json({ erro: 'Erro ao ler a pasta' });

    const fotos = arquivos
      .filter(a => /\.(jpe?g|png|gif|webp|avif|bmp|svg)$/i.test(a))
      .map(a => {
        const info = fs.statSync(path.join(PASTA_UPLOADS, a));
        return { nome: a, tamanho: info.size, data: info.mtimeMs };
      })
      .sort((a, b) => b.data - a.data); // mais recentes primeiro

    res.json(fotos);
  });
});

// Enviar
app.post('/api/upload', exigirLogin, upload.array('fotos', 30), (req, res) => {
  res.json({ ok: true, quantidade: req.files.length });
});

// Servir a imagem (protegida!)
app.get('/fotos/:nome', exigirLogin, (req, res) => {
  const nome = path.basename(req.params.nome); // evita sair da pasta
  const caminho = path.join(PASTA_UPLOADS, nome);
  if (!fs.existsSync(caminho)) return res.status(404).end();
  res.sendFile(caminho);
});

// Apagar
app.delete('/api/fotos/:nome', exigirLogin, (req, res) => {
  const nome = path.basename(req.params.nome);
  const caminho = path.join(PASTA_UPLOADS, nome);
  fs.unlink(caminho, (err) => {
    if (err) return res.status(404).json({ erro: 'Foto não encontrada' });
    res.json({ ok: true });
  });
});

// ---------- Tratamento de erros ----------
app.use((err, req, res, next) => {
  console.error(err.message);
  res.status(400).json({ erro: err.message });
});

app.listen(PORTA, () => {
  console.log('🖼️  Galeria de Claudio rodando em http://localhost:' + PORTA);
  console.log('🔑 Senha atual: ' + SENHA);
});