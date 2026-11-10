# Conecta — aplicação web

Aplicação inicial em React + Vite + Supabase.

## Requisitos
- Node.js 20 ou superior
- Projeto Supabase com as tabelas do Conecta já criadas

## Configuração local
1. Instale o Node.js: https://nodejs.org/
2. Extraia este ZIP.
3. Na pasta do projeto, copie `.env.example` para `.env`.
4. Preencha `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` com a URL e a chave pública do projeto.
5. No terminal, execute:

```bash
npm install
npm run dev
```

6. Abra o endereço local indicado pelo Vite.

## Publicar na Vercel
1. Envie os arquivos deste projeto para um repositório GitHub.
2. Na Vercel, importe esse repositório.
3. Em Project Settings → Environment Variables, cadastre:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Faça o deploy.

## Observações
- Nunca coloque a chave `service_role` no frontend.
- A aplicação usa as tabelas `profiles`, `posts`, `comments` e `likes` criadas no SQL inicial.
- O app permite cadastro/login, feed, criação de post por texto ou URL de imagem, curtidas, comentários e edição básica do perfil.
- Para produção, revise as políticas RLS, implemente upload privado de imagens, recuperação de senha, moderação, paginação e regras mais restritas para amizades/mensagens.
- O trigger do perfil pressupõe que o script SQL inicial foi executado.
