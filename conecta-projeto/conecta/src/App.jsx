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
    setBusy(true);
    setMessage("");
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { display_name: name.trim() || "Novo usuário" } }
        });
        if (error) throw error;
        setMessage(data.session
          ? "Conta criada! Você já pode entrar."
          : "Conta criada. Confira seu e-mail para confirmar o cadastro antes de entrar.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      setMessage(err.message || "Não foi possível concluir.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="auth-wrap">
    <section className="auth-card">
      <div className="brand-mark">C</div>
      <h1>Conecta</h1>
      <p className="muted">Pessoas, ideias e momentos.</p>
      <div className="tabs">
        <button className={mode === "login" ? "active" : ""} onClick={() => { setMode("login"); setMessage(""); }}>Entrar</button>
        <button className={mode === "signup" ? "active" : ""} onClick={() => { setMode("signup"); setMessage(""); }}>Criar conta</button>
      </div>
      <form onSubmit={submit}>
        {mode === "signup" && <label>Como podemos te chamar?<input value={name} onChange={e => setName(e.target.value)} placeholder="Seu nome" maxLength={60} /></label>}
        <label>E-mail<input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="voce@email.com" required autoComplete="email" /></label>
        <label>Senha<input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Mínimo de 6 caracteres" minLength={6} required autoComplete={mode === "login" ? "current-password" : "new-password"} /></label>
        <button className="primary full" disabled={busy}>{busy ? <LoaderCircle className="spin" size={18} /> : mode === "login" ? "Entrar no Conecta" : "Criar minha conta"}</button>
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
  const [busyPost, setBusyPost] = useState(false);
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [peopleSearch, setPeopleSearch] = useState("");
  const [people, setPeople] = useState([]);
  const [friendships, setFriendships] = useState([]);
  const [friendProfilesById, setFriendProfilesById] = useState({});
  const [friendBusy, setFriendBusy] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session?.user) {
      loadProfile();
      loadPosts();
      loadFriendships();
    } else {
      setPosts([]);
      setProfile(null);
    }
  }, [session?.user?.id]);

  async function loadProfile() {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", session.user.id)
      .maybeSingle();
    if (error) setNotice(error.message);
    setProfile(data);
  }

  // Busca cada tabela separadamente para evitar relações ambíguas no Supabase.
  async function loadPosts() {
    const { data: postRows, error: postsError } = await supabase
      .from("posts")
      .select("id,user_id,content,image_url,created_at")
      .order("created_at", { ascending: false })
      .limit(50);

    if (postsError) {
      setNotice(postsError.message);
      return;
    }

    const rows = postRows || [];
    if (rows.length === 0) {
      setPosts([]);
      return;
    }

    const postIds = rows.map(post => post.id);
    const userIds = [...new Set(rows.map(post => post.user_id))];

    const [
      { data: profileRows, error: profilesError },
      { data: likeRows, error: likesError },
      { data: commentRows, error: commentsError }
    ] = await Promise.all([
      supabase.from("profiles").select("id,display_name,username,avatar_url").in("id", userIds),
      supabase.from("likes").select("post_id,user_id").in("post_id", postIds),
      supabase.from("comments").select("id,post_id,user_id,content,created_at").in("post_id", postIds).order("created_at", { ascending: true })
    ]);

    if (profilesError || likesError || commentsError) {
      setNotice((profilesError || likesError || commentsError).message);
      return;
    }

    const commentsUserIds = [...new Set((commentRows || []).map(comment => comment.user_id))];
    let commentProfiles = [];
    if (commentsUserIds.length) {
      const { data, error } = await supabase
        .from("profiles")
        .select("id,display_name,username")
        .in("id", commentsUserIds);
      if (error) {
        setNotice(error.message);
        return;
      }
      commentProfiles = data || [];
    }

    const profileById = Object.fromEntries((profileRows || []).map(item => [item.id, item]));
    const commentProfileById = Object.fromEntries(commentProfiles.map(item => [item.id, item]));
    const likesByPost = {};
    const commentsByPost = {};

    (likeRows || []).forEach(like => {
      if (!likesByPost[like.post_id]) likesByPost[like.post_id] = [];
      likesByPost[like.post_id].push(like);
    });

    (commentRows || []).forEach(comment => {
      if (!commentsByPost[comment.post_id]) commentsByPost[comment.post_id] = [];
      commentsByPost[comment.post_id].push({
        ...comment,
        profiles: commentProfileById[comment.user_id] || null
      });
    });

    setPosts(rows.map(post => ({
      ...post,
      profiles: profileById[post.user_id] || null,
      likes: likesByPost[post.id] || [],
      comments: commentsByPost[post.id] || []
    })));
  }

  async function loadFriendships() {
    const userId = session?.user?.id;
    if (!userId) return;

    const { data, error } = await supabase
      .from("friendships")
      .select("id,requester_id,receiver_id,status,created_at")
      .or(`requester_id.eq.${userId},receiver_id.eq.${userId}`)
      .order("created_at", { ascending: false });

    if (error) {
      setNotice(error.message);
      return;
    }

    const rows = data || [];
    setFriendships(rows);

    const otherIds = [...new Set(rows.map(row =>
      row.requester_id === userId ? row.receiver_id : row.requester_id
    ).filter(Boolean))];

    if (!otherIds.length) {
      setFriendProfilesById({});
      return;
    }

    const { data: profileRows, error: profileError } = await supabase
      .from("profiles")
      .select("id,display_name,username,avatar_url")
      .in("id", otherIds);

    if (profileError) {
      setNotice(profileError.message);
      return;
    }

    setFriendProfilesById(Object.fromEntries((profileRows || []).map(row => [row.id, row])));
  }

  async function searchPeople(e) {
    e.preventDefault();
    const term = peopleSearch.trim();
    if (!term) {
      setPeople([]);
      setNotice("Digite um nome ou usuário para pesquisar.");
      return;
    }

    setFriendBusy(true);
    setNotice("");
    const pattern = `%${term}%`;
    const [byName, byUsername] = await Promise.all([
      supabase.from("profiles")
        .select("id,display_name,username,avatar_url")
        .neq("id", session.user.id)
        .ilike("display_name", pattern)
        .limit(20),
      supabase.from("profiles")
        .select("id,display_name,username,avatar_url")
        .neq("id", session.user.id)
        .ilike("username", pattern)
        .limit(20)
    ]);

    const error = byName.error || byUsername.error;
    if (error) {
      setNotice(error.message);
      setPeople([]);
    } else {
      const unique = new Map();
      [...(byName.data || []), ...(byUsername.data || [])].forEach(person => unique.set(person.id, person));
      setPeople([...unique.values()]);
      if (unique.size === 0) setNotice("Nenhuma pessoa encontrada. Tente outro nome ou usuário.");
    }
    setFriendBusy(false);
  }

  async function sendFriendRequest(receiverId) {
    setFriendBusy(true);
    setNotice("");
    const { error } = await supabase.from("friendships").insert({
      requester_id: session.user.id,
      receiver_id: receiverId,
      status: "pending"
    });
    if (error) {
      setNotice(error.message);
    } else {
      setNotice("Solicitação de amizade enviada!");
      await loadFriendships();
    }
    setFriendBusy(false);
  }

  async function respondToFriendRequest(friendshipId, status) {
    setFriendBusy(true);
    setNotice("");
    const { error } = await supabase.from("friendships")
      .update({ status })
      .eq("id", friendshipId)
      .eq("receiver_id", session.user.id)
      .eq("status", "pending");

    if (error) {
      setNotice(error.message);
    } else {
      setNotice(status === "accepted" ? "Pedido de amizade aceito!" : "Pedido de amizade recusado.");
      await loadFriendships();
    }
    setFriendBusy(false);
  }

  async function createPost(e) {
    e.preventDefault();
    if (!content.trim() && !imageUrl.trim()) return;
    setBusyPost(true);
    setNotice("");
    const { error } = await supabase.from("posts").insert({
      user_id: session.user.id,
      content: content.trim(),
      image_url: imageUrl.trim() || null
    });
    if (error) {
      setNotice(error.message);
    } else {
      setContent("");
      setImageUrl("");
      await loadPosts();
    }
    setBusyPost(false);
  }

  async function toggleLike(post) {
    const liked = post.likes?.some(item => item.user_id === session.user.id);
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
      post_id: postId,
      user_id: session.user.id,
      content: text
    });
    if (error) {
      setNotice(error.message);
    } else {
      setCommentDrafts(value => ({ ...value, [postId]: "" }));
      await loadPosts();
    }
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
    if (error) {
      setNotice(error.message);
    } else {
      setNotice("Perfil atualizado!");
      loadProfile();
    }
  }

  const visiblePosts = useMemo(() => posts.filter(post => {
    const query = search.toLowerCase();
    return !query ||
      (post.content || "").toLowerCase().includes(query) ||
      (post.profiles?.display_name || "").toLowerCase().includes(query);
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

  if (loading) return <div className="center"><LoaderCircle className="spin" /> Carregando Conecta…</div>;
  if (!session) return <AuthScreen />;

  return <div className="app-shell">
    <header className="topbar">
      <a className="wordmark" href="#"><span className="brand-mark small">C</span> Conecta</a>
      <div className="searchbox"><Search size={17} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Pesquisar no Conecta" /></div>
      <button className="icon-button" title="Sair" onClick={() => supabase.auth.signOut()}><LogOut size={19} /></button>
    </header>
    <div className="layout">
      <aside className="left-nav">
        <div className="nav-item selected"><Home size={19} /> Feed</div>
        <div className="nav-item"><UserRound size={19} /> Meu perfil</div>
        <div className="nav-item"><Users size={19} /> Comunidade</div>
        <div className="profile-mini"><div className="avatar">{(profile?.display_name || "C").slice(0, 1).toUpperCase()}</div><div><b>{profile?.display_name || "Meu perfil"}</b><small>@{profile?.username || "usuario"}</small></div></div>
      </aside>
      <main className="feed">
        <div className="welcome"><div><span className="eyebrow">SUA COMUNIDADE</span><h2>O que está acontecendo?</h2><p>Compartilhe uma ideia com sua rede.</p></div><button className="icon-button" onClick={loadPosts} title="Atualizar feed"><RefreshCw size={18} /></button></div>

        <section className="card" style={{ padding: "18px", marginBottom: "18px" }}>
          <h3 style={{ marginTop: 0 }}>Encontrar pessoas</h3>
          <p className="muted">Pesquise pelo nome ou pelo nome de usuário para adicionar amigos.</p>
          <form onSubmit={searchPeople} style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <input
              value={peopleSearch}
              onChange={event => setPeopleSearch(event.target.value)}
              placeholder="Nome ou @usuário"
              aria-label="Pesquisar pessoas"
              style={{ flex: "1 1 220px", minWidth: 0 }}
            />
            <button className="secondary" disabled={friendBusy}>{friendBusy ? "Aguarde…" : "Buscar pessoas"}</button>
          </form>

          {friendships.some(item => item.status === "pending" && item.receiver_id === session.user.id) && <div style={{ marginTop: "18px" }}>
            <h4>Pedidos recebidos</h4>
            {friendships.filter(item => item.status === "pending" && item.receiver_id === session.user.id).map(item => {
              const person = friendProfilesById[item.requester_id];
              return <div key={item.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", padding: "10px 0", borderTop: "1px solid #e5e7eb", flexWrap: "wrap" }}>
                <div><b>{person?.display_name || "Usuário Conecta"}</b><div className="muted">@{person?.username || "usuario"}</div></div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button type="button" className="primary" disabled={friendBusy} onClick={() => respondToFriendRequest(item.id, "accepted")}>Aceitar</button>
                  <button type="button" className="secondary" disabled={friendBusy} onClick={() => respondToFriendRequest(item.id, "rejected")}>Recusar</button>
                </div>
              </div>;
            })}
          </div>}

          {people.length > 0 && <div style={{ marginTop: "18px" }}>
            <h4>Resultados da busca</h4>
            {people.map(person => {
              const relation = friendships.find(item =>
                (item.requester_id === session.user.id && item.receiver_id === person.id) ||
                (item.receiver_id === session.user.id && item.requester_id === person.id)
              );
              let action;
              if (!relation) {
                action = <button type="button" className="primary" disabled={friendBusy} onClick={() => sendFriendRequest(person.id)}>Adicionar amigo</button>;
              } else if (relation.status === "accepted") {
                action = <span className="muted">Vocês são amigos</span>;
              } else if (relation.status === "pending" && relation.requester_id === session.user.id) {
                action = <span className="muted">Solicitação enviada</span>;
              } else if (relation.status === "pending") {
                action = <span className="muted">Enviou um pedido para você</span>;
              } else {
                action = <span className="muted">Pedido encerrado</span>;
              }
              return <div key={person.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", padding: "10px 0", borderTop: "1px solid #e5e7eb", flexWrap: "wrap" }}>
                <div><b>{person.display_name || "Usuário Conecta"}</b><div className="muted">@{person.username || "usuario"}</div></div>
                {action}
              </div>;
            })}
          </div>}

          <div style={{ marginTop: "14px", fontSize: "13px" }} className="muted">
            {friendships.filter(item => item.status === "accepted").length} amizade(s) aceita(s)
          </div>
        </section>

        <form className="composer card" onSubmit={createPost}>
          <div className="composer-top"><div className="avatar">{(profile?.display_name || "C").slice(0, 1).toUpperCase()}</div><textarea value={content} onChange={e => setContent(e.target.value)} placeholder={`No que você está pensando, ${profile?.display_name || "amigo"}?`} rows={3} /></div>
          <div className="composer-bottom"><label className="image-input"><ImageIcon size={18} /> <input value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="Cole o link de uma imagem (opcional)" /></label><button className="primary" disabled={busyPost}>{busyPost ? "Publicando…" : <><Send size={16} /> Publicar</>}</button></div>
        </form>
        {notice && <div className="notice">{notice}<button onClick={() => setNotice("")}>×</button></div>}
        {visiblePosts.length === 0 ? <div className="empty card"><div className="empty-icon">✦</div><h3>Seu feed começa aqui</h3><p>Quando alguém publicar, as novidades vão aparecer nesta área.</p></div> :
          visiblePosts.map(post => {
            const liked = post.likes?.some(item => item.user_id === session.user.id);
            return <article className="post card" key={post.id}>
              <div className="post-head"><div className="avatar">{(post.profiles?.display_name || "?").slice(0, 1).toUpperCase()}</div><div className="post-author"><b>{post.profiles?.display_name || "Usuário Conecta"}</b><small>@{post.profiles?.username || "usuario"} · {new Date(post.created_at).toLocaleString("pt-BR")}</small></div></div>
              {post.content && <p className="post-content">{post.content}</p>}
              {post.image_url && <img className="post-image" src={post.image_url} alt="Imagem da publicação" onError={e => { e.currentTarget.style.display = "none"; }} />}
              <div className="post-stats"><span>{post.likes?.length || 0} curtidas</span><span>{post.comments?.length || 0} comentários</span></div>
              <div className="post-actions"><button className={liked ? "liked" : ""} onClick={() => toggleLike(post)}><Heart size={18} fill={liked ? "currentColor" : "none"} /> Curtir</button><button onClick={() => document.getElementById(`comment-${post.id}`)?.focus()}><MessageCircle size={18} /> Comentar</button></div>
              {post.comments?.slice(-3).map(comment => <div className="comment" key={comment.id}><b>{comment.profiles?.display_name || "Usuário"} </b>{comment.content}</div>)}
              <div className="comment-entry"><input id={`comment-${post.id}`} value={commentDrafts[post.id] || ""} onChange={e => setCommentDrafts(value => ({ ...value, [post.id]: e.target.value }))} placeholder="Escreva um comentário…" /><button onClick={() => addComment(post.id)} aria-label="Enviar comentário"><Send size={17} /></button></div>
            </article>;
          })}
        <footer>Conecta · Feito para aproximar pessoas.</footer>
      </main>
      <aside className="right-panel">
        <section className="side-card"><h3>Seu espaço</h3><p>Complete seu perfil para que as pessoas conheçam você.</p><form onSubmit={saveProfile} className="profile-form">
          <label>Nome<input name="display_name" defaultValue={profile?.display_name || ""} placeholder="Seu nome" /></label>
          <label>Usuário<input name="username" defaultValue={profile?.username || ""} placeholder="seu_usuario" /></label>
          <label>Biografia<textarea name="bio" defaultValue={profile?.bio || ""} placeholder="Conte um pouco sobre você" rows={3} /></label>
          <button className="secondary full">Salvar perfil</button>
        </form></section>
        <section className="side-card tips"><h3>Bem-vindo ao Conecta</h3><p>Publique, curta e converse. Sua comunidade começa com uma conexão.</p></section>
      </aside>
    </div>
  </div>;
}

export default App;
