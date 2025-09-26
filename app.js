/*****************************************
 * Kira · app.js (FINAL)
 * - Paleta e UI estão no styles.css / index.html
 * - Este arquivo cuida de: Auth, Status, Upload e Chat
 *****************************************/

/* ====== CONFIG GERAL ====== */
const ADMIN_EMAILS = ["visualcode24@gmail.com"]; // e-mails que viram admin automaticamente

/* ====== FIREBASE (seu projeto) ====== */
const firebaseConfig = {
  apiKey: "AIzaSyCAeHDhO1aS_bs58rEqquIM40vtcNQK4m0",
  authDomain: "kira--assistentente-juridico.firebaseapp.com",
  projectId: "kira--assistentente-juridico",
  storageBucket: "kira--assistentente-juridico.appspot.com",
  messagingSenderId: "702180001579",
  appId: "1:702180001579:web:e43258b294ad61c462a76e",
  measurementId: "G-96TTWYFD98"
};

// Inicializa
firebase.initializeApp(firebaseConfig);
const auth    = firebase.auth();
const db      = firebase.firestore();
const storage = firebase.storage();

/* ====== UTILS DE UI ====== */
function qs(sel){ return document.querySelector(sel); }
function qsa(sel){ return Array.from(document.querySelectorAll(sel)); }

function setYear(){
  const el = qs('#year');
  if(el) el.textContent = new Date().getFullYear();
}
setYear();

function scrollToLogin(){
  const card = document.querySelector('.hero-card');
  if(card) card.scrollIntoView({behavior:'smooth', block:'center'});
}

function setStatusBadge(status){
  const el = qs('#statusAssinatura');
  if(!el) return;
  const mapColor = {
    active:   '#12B886',
    past_due: '#F59F00',
    blocked:  '#E03131',
    offline:  '#C0C7D2'
  };
  el.textContent = (status || 'offline').replaceAll('_',' ');
  el.style.borderColor = mapColor[status] || '#C0C7D2';
}

/* ====== AUTH STATE ====== */
auth.onAuthStateChanged(async (user)=>{
  if(!user){
    setStatusBadge('offline');
    lockApp(true);
    return;
  }

  // cria/atualiza doc do usuário
  const uref = db.collection('users').doc(user.uid);
  const snap = await uref.get();
  if(!snap.exists){
    await uref.set({
      email: user.email || '',
      role: ADMIN_EMAILS.includes(user.email || '') ? 'admin' : 'user',
      subscriptionStatus: 'active',      // por padrão ativo; se quiser, ajuste depois via painel/admin
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
  }else{
    await uref.set({ updatedAt: Date.now() }, { merge:true });
  }

  const data = (await uref.get()).data() || {};
  const status = data.subscriptionStatus || 'active';
  setStatusBadge(status);
  const blocked = status !== 'active';
  lockApp(blocked);
});

/* Bloqueia/Desbloqueia upload por status */
function lockApp(block){
  const fi = qs('#fileInput');
  const bu = qs('#btnUpload');
  if(fi) fi.disabled = !!block;
  if(bu) bu.disabled = !!block;
}

/* ====== LOGIN (form) ====== */
// ver/ocultar senha
qs('#togglePass')?.addEventListener('click', ()=>{
  const p = qs('#password'); if(!p) return;
  p.type = p.type === 'password' ? 'text' : 'password';
});

// rolar até cartão de login
qs('#btnAbrirLogin')?.addEventListener('click', scrollToLogin);
qs('#btnAbrirLogin2')?.addEventListener('click', scrollToLogin);

// submit login
qs('#loginForm')?.addEventListener('submit', async (e)=>{
  e.preventDefault();
  try{
    const email = qs('#email').value.trim();
    const pass  = qs('#password').value;

    await auth.setPersistence(
      qs('#remember').checked
        ? firebase.auth.Auth.Persistence.LOCAL
        : firebase.auth.Auth.Persistence.SESSION
    );
    await auth.signInWithEmailAndPassword(email, pass);
    alert('Login realizado');
  }catch(err){
    alert('Erro no login: ' + (err?.message || err));
  }
});

// criar conta
qs('#btnCriarConta')?.addEventListener('click', async ()=>{
  try{
    const email = qs('#email').value.trim();
    const pass  = qs('#password').value;
    await auth.createUserWithEmailAndPassword(email, pass);
    alert('Conta criada');
  }catch(err){
    alert('Erro ao criar conta: ' + (err?.message || err));
  }
});

// reset de senha
qs('#btnReset')?.addEventListener('click', async ()=>{
  try{
    const email = qs('#email').value.trim();
    if(!email) return alert('Informe seu e-mail no campo para enviar o link de recuperação.');
    await auth.sendPasswordResetEmail(email);
    alert('Link de redefinição enviado para ' + email);
  }catch(err){
    alert('Erro ao enviar link: ' + (err?.message || err));
  }
});

/* ====== UPLOAD (Storage + Firestore) ====== */
qs('#btnUpload')?.addEventListener('click', async ()=>{
  const user = auth.currentUser;
  if(!user){ alert('Faça login para enviar documentos.'); return; }

  const input = qs('#fileInput');
  const files = input?.files;
  if(!files || !files.length){ alert('Selecione arquivos.'); return; }

  for(const f of files){
    if(f.size > 10*1024*1024){ alert(`${f.name}: maior que 10MB`); continue; }

    const path = `uploads/${user.uid}/${Date.now()}-${f.name}`;
    try{
      const task = storage.ref().child(path).put(f, { contentType: f.type });
      await task;

      await db.collection('uploads').add({
        uid: user.uid,
        filename: f.name,
        storagePath: path,
        size: f.size,
        mime: f.type || '',
        status: 'uploaded',     // se você ligar ingestão/IA, mude para received/ready conforme fluxo
        createdAt: Date.now(),
        updatedAt: Date.now()
      });

      addUploadItem({ filename: f.name, status: 'uploaded' });
    }catch(err){
      console.error(err);
      alert(`Erro ao enviar ${f.name}`);
    }
  }

  input.value = ''; // limpa input
  alert('Upload concluído.');
});

function addUploadItem(item){
  const list = qs('#uploadsList');
  if(!list) return;
  const div = document.createElement('div');
  div.className = 'item';
  div.textContent = `${item.filename} — ${item.status}`;
  list.prepend(div);
}

/* ====== CHAT (placeholder local) ====== */
const chatBox = qs('#chatBox');
const chatMsg = qs('#chatMsg');
qs('#btnSend')?.addEventListener('click', async ()=>{
  const v = (chatMsg.value || '').trim();
  if(!v) return;
  pushChat('Você', v);
  chatMsg.value = '';

  // Se quiser IA real, aqui chamaria /api/chat
  // Por agora, resposta simulada clara p/ advogados:
  const reply = 
    "Kira é uma inteligência artificial jurídica de alta performance. " +
    "Para análise aprofundada, envie seus documentos (PDF/DOC/IMG) na área de upload. " +
    "Se desejar, detalhe o contexto (foro, classe processual, tema) para uma orientação mais precisa.";
  setTimeout(()=> pushChat('Kira', reply), 300);
});

function pushChat(sender, text){
  if(!chatBox) return;
  const row = document.createElement('div');
  row.className = 'chat-msg';
  row.textContent = `${sender}: ${text}`;
  chatBox.appendChild(row);
  chatBox.scrollTop = chatBox.scrollHeight;
}

/* ====== AVATAR FALLBACK (opcional) ====== */
(function ensureAvatar(){
  const img = document.querySelector('.avatar');
  if(!img) return;
  img.onerror = () => { img.src = 'public/avatar-kira.png'; };
})();
