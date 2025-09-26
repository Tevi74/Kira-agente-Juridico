// ===== CONFIG GERAL =====
const STRIPE_PAYMENT_LINK = "https://buy.stripe.com/bJebJ1cv88A5aKM7ZKaAw03";
const SUPPORT_WHATS = "55119945993726";
const ADMIN_EMAILS = ["visualcode24@gmail.com"];

// Avatar: tenta avatar-kiara depois avatar-kira
(function(){
  const img = document.getElementById('kira-avatar');
  const tryPaths = ['public/avatar-kiara.png','public/avatar-kira.png'];
  let i = 0;
  const tryLoad = () => { if(i>=tryPaths.length){ return; } img.src = tryPaths[i++]; img.onerror = tryLoad; };
  tryLoad();
})();

// Links principais
const year = document.getElementById('year'); if(year) year.textContent = new Date().getFullYear();
const whats = document.getElementById('ctaWhats'); if(whats) whats.href = `https://wa.me/${SUPPORT_WHATS}`;
['ctaAssinar','ctaAssinarHeader'].forEach(id=>{
  const el = document.getElementById(id);
  if(!el) return;
  el.addEventListener('click', ()=>{
    if(STRIPE_PAYMENT_LINK){ window.location.href = STRIPE_PAYMENT_LINK; }
    else { window.open(`https://wa.me/${SUPPORT_WHATS}`,'_blank'); }
  });
});

// ===== FIREBASE (Auth + Firestore + Storage no client) =====
const firebaseConfig = {
  apiKey: "AIzaSyCAeHDhO1aS_bs58rEqquIM40vtcNQK4m0",
  authDomain: "kira--assistentente-juridico.firebaseapp.com",
  projectId: "kira--assistentente-juridico",
  storageBucket: "kira--assistentente-juridico.appspot.com",
  messagingSenderId: "702180001579",
  appId: "1:702180001579:web:e43258b294ad61c462a76e",
  measurementId: "G-96TTWYFD98"
};
if (firebaseConfig.apiKey) { firebase.initializeApp(firebaseConfig); }
const auth = firebase.apps?.length ? firebase.auth() : null;
const db = firebase.apps?.length ? firebase.firestore() : null;
const storage = firebase.apps?.length ? firebase.storage() : null;

function updateStatusBadge(status){
  const el = document.getElementById('statusAssinatura');
  if(!el) return;
  el.textContent = status || 'offline';
  el.style.borderColor = status==='active' ? '#12B886' : status==='past_due' ? '#F59F00' : '#C0C7D2';
}

if(auth){
  auth.onAuthStateChanged(async (user)=>{
    if(!user){ updateStatusBadge('offline'); return; }
    const ref = db.collection('users').doc(user.uid);
    const snap = await ref.get();
    if(!snap.exists){
      await ref.set({
        email: user.email,
        role: ADMIN_EMAILS.includes(user.email) ? 'admin' : 'user',
        subscriptionStatus: 'active',
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
    }
    const data = (await ref.get()).data() || {};
    updateStatusBadge(data.subscriptionStatus || 'active');
    const blocked = data.subscriptionStatus && data.subscriptionStatus !== 'active';
    const fi = document.getElementById('fileInput');
    const bu = document.getElementById('btnUpload');
    if(fi) fi.disabled = !!blocked;
    if(bu) bu.disabled = !!blocked;
  });
}

// ===== Login simplificado (prompts) – manteremos por ora
const loginBtn = document.getElementById('btnAbrirLogin') || document.getElementById('btnLoginHeader');
if(loginBtn){
  loginBtn.addEventListener('click', async ()=>{
    if(!auth){ alert('Configure o Firebase Auth antes de usar login.'); return; }
    const email = prompt('Seu e-mail:'); if(!email) return;
    const showPass = confirm('Mostrar senha enquanto digita? (OK = sim)');
    let password = showPass ? (prompt('Senha (visível):')||'') : (prompt('Senha:')||'');
    try{
      await auth.signInWithEmailAndPassword(email,password);
      alert('Login realizado');
    }catch(e){
      if(e.code === 'auth/user-not-found'){
        if(confirm('Usuário não encontrado. Criar conta?')){
          await auth.createUserWithEmailAndPassword(email,password);
          alert('Conta criada');
        }
      } else { alert('Erro: '+e.message); }
    }
  });
}

// ===== Upload (Firebase Storage) + Ingestão (/api/ingest) =====
const btnUpload = document.getElementById('btnUpload');
btnUpload && btnUpload.addEventListener('click', async ()=>{
  if(!auth || !storage || !db){ alert('Configure o Firebase para usar upload.'); return; }
  const user = auth.currentUser; if(!user){ alert('Faça login'); return; }
  const files = document.getElementById('fileInput').files; if(!files || !files.length){ alert('Selecione arquivos'); return; }

  for(const f of files){
    if(f.size > 10*1024*1024){ alert(`${f.name}: maior que 10MB`); continue; }
    const path = `uploads/${user.uid}/${Date.now()}-${f.name}`;
    const task = storage.ref().child(path).put(f, {contentType: f.type});
    await task;
    await db.collection('uploads').add({
      uid: user.uid, filename: f.name, storagePath: path, size: f.size,
      mime: f.type, status: 'received', createdAt: Date.now()
    });
    addUploadItem({filename:f.name, status:'received'});

    // Chama backend para extrair texto e indexar
    try{
      await fetch('/api/ingest', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ uid: user.uid, storagePath: path, filename: f.name, mime: f.type })
      });
    } catch(err){
      console.error('Falha na ingestão', err);
    }
  }
  alert('Upload concluído (ingestão iniciada).');
});

function addUploadItem(item){
  const list = document.getElementById('uploadsList');
  if(!list) return;
  const div = document.createElement('div');
  div.className = 'item';
  div.textContent = `${item.filename} — ${item.status}`;
  list.prepend(div);
}

// ===== Chat real (via /api/chat) =====
const chatBox = document.getElementById('chatBox');
const chatMsg = document.getElementById('chatMsg');
const btnSend = document.getElementById('btnSend');

function pushChat(sender, text){
  if(!chatBox) return;
  const row = document.createElement('div');
  row.className = 'chat-msg';
  row.textContent = `${sender}: ${text}`;
  chatBox.appendChild(row); chatBox.scrollTop = chatBox.scrollHeight;
}

btnSend && btnSend.addEventListener('click', async ()=>{
  const v = (chatMsg.value||'').trim(); if(!v) return;
  pushChat('Você', v); chatMsg.value='';
  const user = auth?.currentUser;
  if(!user){ pushChat('Kira', 'Faça login para continuar.'); return; }
  try{
    const r = await fetch('/api/chat', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ uid: user.uid, message: v })
    });
    const j = await r.json();
    pushChat('Kira', j.answer || 'Sem resposta.');
  }catch(e){
    console.error(e);
    pushChat('Kira', 'Erro ao obter resposta.');
  }
});
