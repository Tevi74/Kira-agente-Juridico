// ===== CONFIG =====
const STRIPE_PAYMENT_LINK = "https://buy.stripe.com/bJebJ1cv88A5aKM7ZKaAw03"; // ajuste se quiser


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


// ===== FIREBASE (preencher quando criar o projeto) =====
const firebaseConfig = {
apiKey: "",
authDomain: "",
projectId: "",
storageBucket: "",
messagingSenderId: "",
appId: ""
};
if(firebaseConfig.apiKey){
firebase.initializeApp(firebaseConfig);
}
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
// Busca/Cria doc do usuário
const ref = db.collection('users').doc(user.uid);
const snap = await ref.get();
if(!snap.exists){ await ref.set({ email: user.email, role: 'user', subscriptionStatus: 'active', createdAt: Date.now(), updatedAt: Date.now() }); }
const data = (await ref.get()).data() || {};
updateStatusBadge(data.subscriptionStatus || 'active');
const blocked = data.subscriptionStatus && data.subscriptionStatus !== 'active';
const fi = document.getElementById('fileInput');
const bu = document.getElementById('btnUpload');
if(fi) fi.disabled = !!blocked;
if(bu) bu.disabled = !!blocked;
});
}


// Login simplificado (prompts — trocamos por telas depois)
});
