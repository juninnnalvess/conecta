import { useEffect, useMemo, useState } from "react";
import { supabase, isSupabaseConfigured } from "./supabase";
import {
  Heart, MessageCircle, Send, LogOut, UserRound, Home, Search,
  Image as ImageIcon, LoaderCircle, Users, RefreshCw
} from "lucide-react";

function AuthScreen() {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setMessage("");
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email, password, options: { data: { display_name: name.trim() || "Novo usuário" } }
        });
        if (error) throw error;
        setMessage(data.session
          ? "Conta criada! Você já pode entrar."
          : "Conta criada. Confira seu e-mail para confirmar o cadastro antes de entrar.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) { setMessage(err.message || "Não foi possível concluir."); }
    finally { setBusy(false); }
  }

  return <main className="auth-wrap">
    <section className="auth-card">
      <div className="brand-mark">C</div>
      <h1>Conecta</h1>
      <p className="muted">Pessoas, ideias e momentos.</p>
      <div className="tabs">
        <button className={mode === "login" ? "active" : ""} onClick={() => {setMode("login");setMessage("");}}>Entrar</button>
        <button className={mode === "signup" ? "active" : ""} onClick={() => {setMode("signup");setMessage("");}}>Criar conta</button>
      </div>
      <form onSubmit={submit}>
        {mode === "signup" && <label>Como podemos te chamar?<input value={name} onChange={e=>setName(e.target.value)} placeholder="Seu nome" maxLength={60}/></label>}
        <label>E-mail<input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="voce@email.com" required autoComplete="email"/></label>
        <label>Senha<input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Mínimo de 6 caracteres" minLength={6} required autoComplete={mode==="login"?"current-password":"new-password"}/></label>
        <button className="primary full" disabled={busy}>{busy ? <LoaderCircle className="spin" size={18}/> : mode==="login" ? "Entrar no Conecta" : "Criar minha conta"}</button>
      </form>
      {message && <p className="notice">{message}</p>}
      <p className="tiny">Ao continuar, você concorda em usar o Conecta de forma respeitosa.</p>
    </section>
  </main>;
}

function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [posts, setPosts] = useState([]);
  const [profile, setProfile] = useState(null);
  const [content, setContent] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [commentDrafts, setCommentDrafts] = useState({});
  const [commentsByPost, setCommentsByPost] = useState({});
  const [busyPost, setBusyPost] = useState(false);
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!isSupabaseConfigured) { setLoading(false); return; }
    supabase.auth.getSession().then(({data}) => { setSession(data.session); setLoading(false); });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session?.user) { loadProfile(); loadPosts(); }
    else { setPosts([]); setProfile(null); }
  }, [session?.user?.id]);

  async function loadProfile() {
    const { data, error } = await supabase.from("profiles").select("*").eq("id", session.user.id).maybeSingle();
    if (error) setNotice(error.message);
    setProfile(data);
  }

  async function loadPosts() {
    const { data, error } = await supabase.from("posts")
      .select("id,user_id,content,image_url,created_at,profiles(id,display_name,username,avatar_url),likes(user_id),comments(id,user_id,content,created_at,profiles(display_name,username))")
      .order("created_at", { ascending: false }).limit(50);
    if (error) { setNotice(error.message); return; }
    setPosts(data || []);
  }

  async function createPost(e) {
    e.preventDefault();
    if (!content.trim() && !imageUrl.trim()) return;
    setBusyPost(true); setNotice("");
    const { error } = await supabase.from("posts").insert({
      user_id: session.user.id, content: content.trim(), image_url: imageUrl.trim() || null
    });
    if (error) setNotice(error.message);
    else { setContent(""); setImageUrl(""); await loadPosts(); }
    setBusyPost(false);
  }

  async function toggleLike(post) {
    const liked = post.likes?.some(x => x.user_id === session.user.id);
    const result = liked
      ? await supabase.from("likes").delete().eq("post_id", post.id).eq("user_id", session.user.id)
      : await supabase.from("likes").insert({ post_id: post.id, user_id: session.user.id });
    if (result.error) setNotice(result.error.message);
    else await loadPosts();
  }

  async function addComment(postId) {
    const text = (commentDrafts[postId] || "").trim();
    if (!text) return;
    const { error } = await supabase.from("comments").insert({
      post_id: postId, user_id: session.user.id, content: text
    });
    if (error) setNotice(error.message);
    else { setCommentDrafts(v => ({...v, [postId]: ""})); await loadPosts(); }
  }

  async function saveProfile(e) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const updates = {
      display_name: String(form.get("display_name") || "").trim(),
      username: String(form.get("username") || "").trim().replace(/^@/, ""),
      bio: String(form.get("bio") || "").trim()
    };
    const { error } = await supabase.from("profiles").update(updates).eq("id", session.user.id);
    if (error) setNotice(error.message);
    else { setNotice("Perfil atualizado!"); loadProfile(); }
  }

  const visiblePosts = useMemo(() => posts.filter(p => {
    const q = search.toLowerCase();
    return !q || (p.content || "").toLowerCase().includes(q) ||
      (p.profiles?.display_name || "").toLowerCase().includes(q);
  }), [posts, search]);

  if (!isSupabaseConfigured) return <main className="setup-wrap"><section className="setup-card">
    <div className="brand-mark">C</div><h1>Vamos conectar o Conecta</h1>
    <p>O projeto está pronto para receber as credenciais do Supabase.</p>
    <ol>
      <li>Na pasta do projeto, crie um arquivo chamado <code>.env</code>.</li>
      <li>Copie o conteúdo de <code>.env.example</code> para ele.</li>
      <li>Substitua <code>COLE_AQUI_SUA_CHAVE_PUBLICA</code> pela Publishable Key do Supabase.</li>
      <li>Reinicie o servidor de desenvolvimento.</li>
    </ol>
    <p className="notice">Use somente a chave pública anon/publishable. Nunca coloque service_role no navegador.</p>
  </section></main>;

  if (loading) return <div className="center"><LoaderCircle className="spin"/> Carregando Conecta…</div>;
  if (!session) return <AuthScreen />;

  return <div className="app-shell">
    <header className="topbar">
      <a className="wordmark" href="#"><span className="brand-mark small">C</span> Conecta</a>
      <div className="searchbox"><Search size={17}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Pesquisar no Conecta"/></div>
      <button className="icon-button" title="Sair" onClick={()=>supabase.auth.signOut()}><LogOut size={19}/></button>
    </header>
    <div className="layout">
      <aside className="left-nav">
        <div className="nav-item selected"><Home size={19}/> Feed</div>
        <div className="nav-item"><UserRound size={19}/> Meu perfil</div>
        <div className="nav-item"><Users size={19}/> Comunidade</div>
        <div className="profile-mini"><div className="avatar">{(profile?.display_name || "C").slice(0,1).toUpperCase()}</div><div><b>{profile?.display_name || "Meu perfil"}</b><small>@{profile?.username || "usuario"}</small></div></div>
      </aside>
      <main className="feed">
        <div className="welcome"><div><span className="eyebrow">SUA COMUNIDADE</span><h2>O que está acontecendo?</h2><p>Compartilhe uma ideia com sua rede.</p></div><button className="icon-button" onClick={loadPosts} title="Atualizar feed"><RefreshCw size={18}/></button></div>
        <form className="composer card" onSubmit={createPost}>
          <div className="composer-top"><div className="avatar">{(profile?.display_name || "C").slice(0,1).toUpperCase()}</div><textarea value={content} onChange={e=>setContent(e.target.value)} placeholder={`No que você está pensando, ${profile?.display_name || "amigo"}?`} rows={3}/></div>
          <div className="composer-bottom"><label className="image-input"><ImageIcon size={18}/> <input value={imageUrl} onChange={e=>setImageUrl(e.target.value)} placeholder="Cole o link de uma imagem (opcional)"/></label><button className="primary" disabled={busyPost}>{busyPost ? "Publicando…" : <><Send size={16}/> Publicar</>}</button></div>
        </form>
        {notice && <div className="notice">{notice}<button onClick={()=>setNotice("")}>×</button></div>}
        {visiblePosts.length === 0 ? <div className="empty card"><div className="empty-icon">✦</div><h3>Seu feed começa aqui</h3><p>Quando alguém publicar, as novidades vão aparecer nesta área.</p></div> :
          visiblePosts.map(post => {
            const liked = post.likes?.some(x=>x.user_id===session.user.id);
            return <article className="post card" key={post.id}>
              <div className="post-head"><div className="avatar">{(post.profiles?.display_name || "?").slice(0,1).toUpperCase()}</div><div className="post-author"><b>{post.profiles?.display_name || "Usuário Conecta"}</b><small>@{post.profiles?.username || "usuario"} · {new Date(post.created_at).toLocaleString("pt-BR")}</small></div></div>
              {post.content && <p className="post-content">{post.content}</p>}
              {post.image_url && <img className="post-image" src={post.image_url} alt="Imagem da publicação" onError={e=>{e.currentTarget.style.display="none"}}/>}
              <div className="post-stats"><span>{post.likes?.length || 0} curtidas</span><span>{post.comments?.length || 0} comentários</span></div>
              <div className="post-actions"><button className={liked?"liked":""} onClick={()=>toggleLike(post)}><Heart size={18} fill={liked?"currentColor":"none"}/> Curtir</button><button onClick={()=>document.getElementById(`comment-${post.id}`)?.focus()}><MessageCircle size={18}/> Comentar</button></div>
              {post.comments?.slice(-3).map(c=><div className="comment" key={c.id}><b>{c.profiles?.display_name || "Usuário"} </b>{c.content}</div>)}
              <div className="comment-entry"><input id={`comment-${post.id}`} value={commentDrafts[post.id] || ""} onChange={e=>setCommentDrafts(v=>({...v,[post.id]:e.target.value}))} placeholder="Escreva um comentário…"/><button onClick={()=>addComment(post.id)} aria-label="Enviar comentário"><Send size={17}/></button></div>
            </article>;
          })}
        <footer>Conecta · Feito para aproximar pessoas.</footer>
      </main>
      <aside className="right-panel"><section className="side-card"><h3>Seu espaço</h3><p>Complete seu perfil para que as pessoas conheçam você.</p><form onSubmit={saveProfile} className="profile-form">
        <label>Nome<input name="display_name" defaultValue={profile?.display_name || ""} placeholder="Seu nome"/></label>
        <label>Usuário<input name="username" defaultValue={profile?.username || ""} placeholder="seu_usuario"/></label>
        <label>Biografia<textarea name="bio" defaultValue={profile?.bio || ""} placeholder="Conte um pouco sobre você" rows={3}/></label>
        <button className="secondary full">Salvar perfil</button>
      </form></section><section className="side-card tips"><h3>Bem-vindo ao Conecta</h3><p>Publique, curta e converse. Sua comunidade começa com uma conexão.</p></section></aside>
    </div>
  </div>;
}

export default App;
