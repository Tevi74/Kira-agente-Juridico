Kira — Inteligência Jurídica de Alta Performance

Plano: R$ 59,90/mês
Cores: Azul-marinho (#0A2342) e Prata (#C0C7D2)
Avatar: public/avatar-kira.png (fornecido)
Público: advogados(as), bancas, departamentos jurídicos (conforme OAB)

1) Objetivo do MVP (V1)

Landing page (desktop e mobile) + brand Kira

Assinatura (Stripe Checkout) + botão alternativo de contato: WhatsApp wa.me/55119945993726

Autenticação (Firebase Email/Senha) com lembrar login, mostrar/ocultar senha e recuperar senha

Dashboard do usuário com:

Chat Kira (placeholder pronto p/ futura IA)

Upload de documentos (PDF/DOC/IMG) p/ análise

Status de assinatura (ativo/inadimplente)

Painel admin (primeiro rascunho): leitura/alteração de status do usuário (liberar/bloquear)

Versão 2 (posterior): webhooks Stripe, logs de auditoria, fila de processamento, histórico detalhado, relatórios.

2) Stack sugerida

Next.js 14 (App Router) + TypeScript (SSR/SEO, rápido no Vercel)

TailwindCSS (responsivo e ágil)

Firebase (Auth, Firestore, Storage)

Stripe (Checkout/Portal de cliente)

Se preferir React puro/Vanilla, mantemos a estrutura, mas Next.js acelera entrega/responsividade/SEO.

3) Estrutura de pastas
kira/
├─ public/
│  ├─ avatar-kira.png         # subir aqui
│  └─ favicon.ico
├─ src/
│  ├─ app/
│  │  ├─ (public)
│  │  │  ├─ page.tsx          # Landing
│  │  │  └─ pricing.tsx       # Plano/Checkout
│  │  ├─ auth/
│  │  │  ├─ login/page.tsx
│  │  │  ├─ register/page.tsx
│  │  │  └─ reset/page.tsx
│  │  ├─ dashboard/
│  │  │  ├─ page.tsx          # Upload + Chat + Status
│  │  │  └─ uploads/          # listagem
│  │  ├─ admin/
│  │  │  └─ page.tsx          # bloqueio/liberação
│  │  └─ api/
│  │     ├─ stripe/webhook/route.ts   # V2
│  │     └─ upload/route.ts           # upload server action (V1)
│  ├─ components/
│  │  ├─ Header.tsx Footer.tsx
│  │  ├─ AuthForm.tsx PasswordField.tsx
│  │  ├─ FileUploader.tsx
│  │  ├─ ChatBox.tsx
│  │  └─ StatusBadge.tsx
│  └─ lib/
│     ├─ firebase.ts
│     ├─ stripe.ts
│     └─ auth-guard.ts
├─ .env.local                  # chaves Stripe/Firebase
├─ package.json
└─ README.md
