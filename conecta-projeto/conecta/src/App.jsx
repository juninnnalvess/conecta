import { useEffect, useMemo, useState } from "react";
import { supabase, isSupabaseConfigured } from "./supabase";
import {
  Heart, MessageCircle, Send, LogOut, UserRound, Home, Search,
  Image as ImageIcon, LoaderCircle, Users, RefreshCw, MessageSquare, Code2, Trash2, X, ChevronLeft, ChevronRight
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
  const [activePage, setActivePage] = useState("feed");
  const [loading, setLoading] = useState(true);
  const [posts, setPosts] = useState([]);
  const [profile, setProfile] = useState(null);
  const [profileName, setProfileName] = useState("");
  const [profileUsername, setProfileUsername] = useState("");
  const [profileBio, setProfileBio] = useState("");
  const [profileAvatarUrl, setProfileAvatarUrl] = useState("");
  const [viewedProfile, setViewedProfile] = useState(null);
  const [viewedProfilePosts, setViewedProfilePosts] = useState([]);
  const [viewedProfileLoading, setViewedProfileLoading] = useState(false);
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
  const [selectedChatFriend, setSelectedChatFriend] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [messageDraft, setMessageDraft] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [stories, setStories] = useState([]);
  const [storyContent, setStoryContent] = useState("");
  const [storyImageUrl, setStoryImageUrl] = useState("");
  const [storyBusy, setStoryBusy] = useState(false);
  const [activeStoryUserId, setActiveStoryUserId] = useState(null);
  const [activeStoryIndex, setActiveStoryIndex] = useState(0);
  const [adminTab, setAdminTab] = useState("dashboard");
  const [adminUsers, setAdminUsers] = useState([]);
  const [adminPosts, setAdminPosts] = useState([]);
  const [adminStories, setAdminStories] = useState([]);
  const [adminCounts, setAdminCounts] = useState({ users: 0, posts: 0, stories: 0 });
  const isAdmin = session?.user?.id === "7be4cd5a-f4fc-4157-864a-448a6d21bfb0";

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
      loadStories();
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
    setProfileName(data?.display_name || "");
    setProfileUsername(data?.username || "");
    setProfileBio(data?.bio || "");
    setProfileAvatarUrl(data?.avatar_url || "");
  }

  async function loadStories() {
    const { data: storyRows, error } = await supabase
      .from("stories")
      .select("id,user_id,content,image_url,created_at,expires_at")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: true })
      .limit(200);

    if (error) {
      setNotice(`Não foi possível carregar os Stories: ${error.message}`);
      return;
    }

    const rows = storyRows || [];
    if (!rows.length) {
      setStories([]);
      return;
    }

    const userIds = [...new Set(rows.map(story => story.user_id).filter(Boolean))];
    const { data: profileRows, error: profileError } = await supabase
      .from("profiles")
      .select("id,display_name,username,avatar_url")
      .in("id", userIds);

    if (profileError) {
      setNotice(profileError.message);
      return;
    }

    const profileById = Object.fromEntries((profileRows || []).map(person => [person.id, person]));
    setStories(rows.map(story => ({ ...story, profiles: profileById[story.user_id] || null })));
  }

  async function createStory(event) {
    event.preventDefault();
    const text = storyContent.trim();
    const image = storyImageUrl.trim();
    if (!text && !image) {
      setNotice("Escreva algo ou adicione o link de uma imagem para publicar seu Story.");
      return;
    }

    setStoryBusy(true);
    setNotice("");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const { error } = await supabase.from("stories").insert({
      user_id: session.user.id,
      content: text || null,
      image_url: image || null,
      expires_at: expiresAt
    });

    if (error) {
      setNotice(error.message);
    } else {
      setStoryContent("");
      setStoryImageUrl("");
      setNotice("Story publicado! Ele ficará disponível por 24 horas.");
      await loadStories();
    }
    setStoryBusy(false);
  }

  async function deleteStory(storyId) {
    const confirmed = window.confirm("Apagar este Story?");
    if (!confirmed) return;

    const { error } = await supabase.from("stories")
      .delete()
      .eq("id", storyId)
      .eq("user_id", session.user.id);

    if (error) {
      setNotice(error.message);
      return;
    }

    setStories(current => current.filter(story => story.id !== storyId));
    setNotice("Story apagado.");
    const stillHasStories = stories.some(story => story.user_id === session.user.id && story.id !== storyId);
    if (!stillHasStories) setActiveStoryUserId(null);
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

  async function loadChatMessages(friendId) {
    const userId = session?.user?.id;
    if (!userId || !friendId) return;

    setChatLoading(true);
    const [sent, received] = await Promise.all([
      supabase.from("messages")
        .select("id,sender_id,receiver_id,content,created_at")
        .eq("sender_id", userId)
        .eq("receiver_id", friendId)
        .order("created_at", { ascending: true }),
      supabase.from("messages")
        .select("id,sender_id,receiver_id,content,created_at")
        .eq("sender_id", friendId)
        .eq("receiver_id", userId)
        .order("created_at", { ascending: true })
    ]);

    const error = sent.error || received.error;
    if (error) {
      setNotice(error.message);
      setChatLoading(false);
      return;
    }

    const combined = [...(sent.data || []), ...(received.data || [])]
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    setChatMessages(combined);
    setChatLoading(false);
  }

  async function openChat(friendId) {
    const friend = friendProfilesById[friendId];
    if (!friend) return;
    setSelectedChatFriend(friend);
    setChatMessages([]);
    await loadChatMessages(friendId);
  }

  async function sendChatMessage(e) {
    e.preventDefault();
    const text = messageDraft.trim();
    if (!text || !selectedChatFriend || sendingMessage) return;

    setSendingMessage(true);
    setNotice("");
    const { error } = await supabase.from("messages").insert({
      sender_id: session.user.id,
      receiver_id: selectedChatFriend.id,
      content: text
    });

    if (error) {
      setNotice(error.message);
    } else {
      setMessageDraft("");
      await loadChatMessages(selectedChatFriend.id);
    }
    setSendingMessage(false);
  }

  async function openUserProfile(userId) {
    if (!userId) return;
    if (userId === session.user.id) {
      setActivePage("profile");
      return;
    }

    setActivePage("userProfile");
    setViewedProfile(null);
    setViewedProfilePosts([]);
    setViewedProfileLoading(true);
    setNotice("");

    const { data: person, error: profileError } = await supabase
      .from("profiles")
      .select("id,display_name,username,bio,avatar_url")
      .eq("id", userId)
      .maybeSingle();

    if (profileError || !person) {
      setNotice(profileError?.message || "Não foi possível encontrar esse perfil.");
      setViewedProfileLoading(false);
      return;
    }

    setViewedProfile(person);

    const { data: personPosts, error: postsError } = await supabase
      .from("posts")
      .select("id,user_id,content,image_url,created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (postsError) {
      setNotice(postsError.message);
      setViewedProfileLoading(false);
      return;
    }

    const rows = personPosts || [];
    if (!rows.length) {
      setViewedProfilePosts([]);
      setViewedProfileLoading(false);
      return;
    }

    const postIds = rows.map(post => post.id);
    const [{ data: likes, error: likesError }, { data: comments, error: commentsError }] = await Promise.all([
      supabase.from("likes").select("post_id").in("post_id", postIds),
      supabase.from("comments").select("post_id").in("post_id", postIds)
    ]);

    if (likesError || commentsError) {
      setNotice((likesError || commentsError).message);
      setViewedProfileLoading(false);
      return;
    }

    const likeCounts = {};
    const commentCounts = {};
    (likes || []).forEach(item => { likeCounts[item.post_id] = (likeCounts[item.post_id] || 0) + 1; });
    (comments || []).forEach(item => { commentCounts[item.post_id] = (commentCounts[item.post_id] || 0) + 1; });

    setViewedProfilePosts(rows.map(post => ({
      ...post,
      likesCount: likeCounts[post.id] || 0,
      commentsCount: commentCounts[post.id] || 0
    })));
    setViewedProfileLoading(false);
  }

  async function loadAdminData() {
    if (!isAdmin) return;
    const [usersResult, postsResult, storiesResult, usersCount, postsCount, storiesCount] = await Promise.all([
      supabase.from("profiles").select("id,display_name,username,avatar_url").order("display_name").limit(200),
      supabase.from("posts").select("id,user_id,content,image_url,created_at").order("created_at", { ascending: false }).limit(100),
      supabase.from("stories").select("id,user_id,content,image_url,created_at,expires_at").order("created_at", { ascending: false }).limit(100),
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase.from("posts").select("id", { count: "exact", head: true }),
      supabase.from("stories").select("id", { count: "exact", head: true })
    ]);
    const failed = [usersResult, postsResult, storiesResult, usersCount, postsCount, storiesCount].find(result => result.error);
    if (failed) { setNotice(`Erro ao carregar o Painel ADM: ${failed.error.message}`); return; }
    setAdminUsers(usersResult.data || []);
    setAdminPosts(postsResult.data || []);
    setAdminStories(storiesResult.data || []);
    setAdminCounts({ users: usersCount.count || 0, posts: postsCount.count || 0, stories: storiesCount.count || 0 });
  }

  async function adminDeletePost(id) {
    if (!isAdmin || !window.confirm("Apagar esta publicação de forma permanente?")) return;
    const { data, error } = await supabase.from("posts").delete().eq("id", id).select("id").maybeSingle();
    if (error) { setNotice(`Não foi possível apagar: ${error.message}`); return; }
    if (!data) { setNotice("A publicação não foi apagada. Verifique as políticas de administrador no Supabase."); return; }
    setNotice("Publicação apagada.");
    await Promise.all([loadAdminData(), loadPosts()]);
  }

  async function adminDeleteStory(id) {
    if (!isAdmin || !window.confirm("Apagar este Story de forma permanente?")) return;
    const { data, error } = await supabase.from("stories").delete().eq("id", id).select("id").maybeSingle();
    if (error) { setNotice(`Não foi possível apagar: ${error.message}`); return; }
    if (!data) { setNotice("O Story não foi apagado. Verifique as políticas de administrador no Supabase."); return; }
    setNotice("Story apagado.");
    await Promise.all([loadAdminData(), loadStories()]);
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

  async function deletePost(postId) {
    const confirmed = window.confirm("Tem certeza de que deseja apagar esta publicação? Esta ação não pode ser desfeita.");
    if (!confirmed) return;

    setNotice("");
    const { data, error } = await supabase
      .from("posts")
      .delete()
      .eq("id", postId)
      .eq("user_id", session.user.id)
      .select("id")
      .maybeSingle();

    if (error) {
      setNotice(error.message);
      return;
    }
    if (!data) {
      setNotice("A publicação não foi apagada. Confira se a política de exclusão está configurada no Supabase.");
      return;
    }

    setPosts(current => current.filter(post => post.id !== postId));
    setViewedProfilePosts(current => current.filter(post => post.id !== postId));
    setNotice("Publicação apagada com sucesso.");
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
    setNotice("");
    const updates = {
      display_name: profileName.trim(),
      username: profileUsername.trim().replace(/^@/, ""),
      bio: profileBio.trim(),
      avatar_url: profileAvatarUrl.trim() || null
    };
    if (!updates.display_name) {
      setNotice("Informe seu nome para salvar o perfil.");
      return;
    }
    const { error } = await supabase.from("profiles").update(updates).eq("id", session.user.id);
    if (error) {
      setNotice(error.message);
    } else {
      setNotice("Perfil atualizado com sucesso!");
      await loadProfile();
    }
  }

  const visiblePosts = useMemo(() => posts.filter(post => {
    const query = search.toLowerCase();
    return !query ||
      (post.content || "").toLowerCase().includes(query) ||
      (post.profiles?.display_name || "").toLowerCase().includes(query);
  }), [posts, search]);

  const storyGroups = useMemo(() => {
    const groups = new Map();
    stories.forEach(story => {
      if (!groups.has(story.user_id)) {
        groups.set(story.user_id, {
          userId: story.user_id,
          profile: story.profiles,
          items: []
        });
      }
      groups.get(story.user_id).items.push(story);
    });
    return [...groups.values()].sort((a, b) => {
      const aLast = a.items[a.items.length - 1]?.created_at || "";
      const bLast = b.items[b.items.length - 1]?.created_at || "";
      return new Date(bLast) - new Date(aLast);
    });
  }, [stories]);

  const activeStoryGroup = storyGroups.find(group => group.userId === activeStoryUserId) || null;
  const activeStory = activeStoryGroup?.items?.[activeStoryIndex] || null;

  function openStoryGroup(userId) {
    const group = storyGroups.find(item => item.userId === userId);
    if (!group) return;
    setActiveStoryUserId(userId);
    setActiveStoryIndex(0);
  }

  function closeStoryViewer() {
    setActiveStoryUserId(null);
    setActiveStoryIndex(0);
  }

  function nextStory() {
    if (!activeStoryGroup) return;
    if (activeStoryIndex < activeStoryGroup.items.length - 1) {
      setActiveStoryIndex(index => index + 1);
      return;
    }
    const groupIndex = storyGroups.findIndex(group => group.userId === activeStoryUserId);
    const nextGroup = storyGroups[groupIndex + 1];
    if (nextGroup) {
      setActiveStoryUserId(nextGroup.userId);
      setActiveStoryIndex(0);
    } else {
      closeStoryViewer();
    }
  }

  function previousStory() {
    if (!activeStoryGroup) return;
    if (activeStoryIndex > 0) {
      setActiveStoryIndex(index => index - 1);
      return;
    }
    const groupIndex = storyGroups.findIndex(group => group.userId === activeStoryUserId);
    const previousGroup = storyGroups[groupIndex - 1];
    if (previousGroup) {
      setActiveStoryUserId(previousGroup.userId);
      setActiveStoryIndex(previousGroup.items.length - 1);
    }
  }

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

  const myPosts = posts.filter(post => post.user_id === session.user.id);
  const acceptedFriendships = friendships.filter(item => item.status === "accepted");
  const incomingRequests = friendships.filter(item => item.status === "pending" && item.receiver_id === session.user.id);

  const storiesPanel = (
          <section className="card" style={{ padding: "16px", marginBottom: "18px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", flexWrap: "wrap", marginBottom: "12px" }}>
              <div><h3 style={{ margin: 0 }}>Stories</h3><small className="muted">Fotos e momentos que desaparecem em 24 horas.</small></div>
              <button type="button" className="secondary" onClick={loadStories}><RefreshCw size={15} /> Atualizar</button>
            </div>
            <form onSubmit={createStory} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr) auto", gap: "8px", alignItems: "center", marginBottom: "14px" }}>
              <input value={storyContent} onChange={event => setStoryContent(event.target.value)} placeholder="Escreva um momento..." maxLength={240} aria-label="Texto do Story" />
              <input value={storyImageUrl} onChange={event => setStoryImageUrl(event.target.value)} placeholder="Link de imagem (opcional)" aria-label="Link de imagem do Story" />
              <button className="primary" type="submit" disabled={storyBusy}>{storyBusy ? "Publicando..." : "Publicar Story"}</button>
            </form>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "14px", overflowX: "auto", padding: "4px 2px 8px" }}>
              {(() => {
                const ownGroup = storyGroups.find(group => group.userId === session.user.id);
                return <button type="button" onClick={() => ownGroup ? openStoryGroup(session.user.id) : document.querySelector('[aria-label="Texto do Story"]')?.focus()} style={{ flex: "0 0 76px", width: "76px", border: 0, padding: 0, background: "transparent", cursor: "pointer", color: "inherit", textAlign: "center" }}>
                  <span style={{ display: "grid", placeItems: "center", width: "64px", height: "64px", margin: "0 auto 6px", borderRadius: "50%", border: "3px solid #2563eb", padding: "3px", background: "#fff" }}>
                    <span style={{ display: "grid", placeItems: "center", width: "100%", height: "100%", borderRadius: "50%", overflow: "hidden", background: "#e8efff", color: "#2457a7", fontSize: "22px", fontWeight: 700 }}>{profile?.avatar_url ? <img src={profile.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : (profile?.display_name || "C").slice(0, 1).toUpperCase()}</span>
                  </span>
                  <small style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Seu Story</small>
                  <small className="muted">{ownGroup ? "Ver" : "Criar"}</small>
                </button>;
              })()}
              {storyGroups.filter(group => group.userId !== session.user.id).map(group => <button key={group.userId} type="button" onClick={() => openStoryGroup(group.userId)} style={{ flex: "0 0 76px", width: "76px", border: 0, padding: 0, background: "transparent", cursor: "pointer", color: "inherit", textAlign: "center" }}>
                <span style={{ display: "grid", placeItems: "center", width: "64px", height: "64px", margin: "0 auto 6px", borderRadius: "50%", border: "3px solid #2563eb", padding: "3px", background: "#fff" }}>
                  <span style={{ display: "grid", placeItems: "center", width: "100%", height: "100%", borderRadius: "50%", overflow: "hidden", background: "#e8efff", color: "#2457a7", fontSize: "22px", fontWeight: 700 }}>{group.profile?.avatar_url ? <img src={group.profile.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : (group.profile?.display_name || "C").slice(0, 1).toUpperCase()}</span>
                </span>
                <small style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{group.profile?.display_name || "Usuário"}</small>
              </button>)}
              {storyGroups.length === 0 && <p className="muted" style={{ margin: "12px 0" }}>Ainda não há Stories de outras pessoas. Publique o primeiro!</p>}
            </div>
          </section>
  );

  return <div className="app-shell">
    <header className="topbar">
      <a className="wordmark" href="#" onClick={event => { event.preventDefault(); setActivePage("feed"); }}><span className="brand-mark small">C</span> Conecta</a>
      <div className="searchbox"><Search size={17} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Pesquisar no Conecta" /></div>
      <button className="icon-button" title="Sair" onClick={() => supabase.auth.signOut()}><LogOut size={19} /></button>
    </header>
    <div className="layout">
      <aside className="left-nav">
        <button type="button" className={`nav-item ${activePage === "feed" ? "selected" : ""}`} onClick={() => setActivePage("feed")} style={{ border: 0, width: "100%", cursor: "pointer", textAlign: "left" }}><Home size={19} /> Feed</button>
        <button type="button" className={`nav-item ${activePage === "profile" ? "selected" : ""}`} onClick={() => setActivePage("profile")} style={{ border: 0, width: "100%", cursor: "pointer", textAlign: "left" }}><UserRound size={19} /> Meu perfil</button>
        <button type="button" className={`nav-item ${activePage === "community" ? "selected" : ""}`} onClick={() => setActivePage("community")} style={{ border: 0, width: "100%", cursor: "pointer", textAlign: "left" }}><Users size={19} /> Comunidade</button>
        {isAdmin && <button type="button" className={`nav-item ${activePage === "admin" ? "selected" : ""}`} onClick={() => { setActivePage("admin"); setAdminTab("dashboard"); loadAdminData(); }} style={{ border: 0, width: "100%", cursor: "pointer", textAlign: "left" }}><Code2 size={19} /> Painel ADM</button>}
        <button type="button" className={`nav-item ${activePage === "stories" ? "selected" : ""}`} onClick={() => { setActivePage("stories"); loadStories(); }} style={{ border: 0, width: "100%", cursor: "pointer", textAlign: "left" }}><ImageIcon size={19} /> Story</button>
        <button type="button" className={`nav-item ${activePage === "messages" ? "selected" : ""}`} onClick={() => setActivePage("messages")} style={{ border: 0, width: "100%", cursor: "pointer", textAlign: "left" }}><MessageSquare size={19} /> Mensagem</button>
        <button type="button" className="profile-mini" onClick={() => setActivePage("profile")} style={{ border: 0, width: "100%", cursor: "pointer", textAlign: "left" }}>
          <div className="avatar">{profile?.avatar_url ? <img src={profile.avatar_url} alt="Sua foto" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} /> : (profile?.display_name || "C").slice(0, 1).toUpperCase()}</div>
          <div><b>{profile?.display_name || "Meu perfil"}</b><small>@{profile?.username || "usuario"}</small></div>
        </button>
      </aside>

      <main className="feed">
        {notice && <div className="notice">{notice}<button onClick={() => setNotice("")}>×</button></div>}

        {activePage === "feed" && <>
          {storiesPanel}
          <div className="welcome"><div><span className="eyebrow">SUA COMUNIDADE</span><h2>O que está acontecendo?</h2><p>Compartilhe uma ideia com sua rede.</p></div><button className="icon-button" onClick={() => { loadPosts(); loadStories(); }} title="Atualizar feed"><RefreshCw size={18} /></button></div>
          <form className="composer card" onSubmit={createPost}>
            <div className="composer-top"><div className="avatar">{(profile?.display_name || "C").slice(0, 1).toUpperCase()}</div><textarea value={content} onChange={e => setContent(e.target.value)} placeholder={`No que você está pensando, ${profile?.display_name || "amigo"}?`} rows={3} /></div>
            <div className="composer-bottom"><label className="image-input"><ImageIcon size={18} /> <input value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="Cole o link de uma imagem (opcional)" /></label><button className="primary" disabled={busyPost}>{busyPost ? "Publicando…" : <><Send size={16} /> Publicar</>}</button></div>
          </form>
          {visiblePosts.length === 0 ? <div className="empty card"><div className="empty-icon">✦</div><h3>Seu feed começa aqui</h3><p>Quando alguém publicar, as novidades vão aparecer nesta área.</p></div> :
            visiblePosts.map(post => {
              const liked = post.likes?.some(item => item.user_id === session.user.id);
              return <article className="post card" key={post.id}>
                <div className="post-head" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
                  <button type="button" onClick={() => openUserProfile(post.user_id)} style={{ display: "flex", alignItems: "center", gap: "10px", border: 0, padding: 0, background: "transparent", color: "inherit", textAlign: "left", cursor: "pointer" }}><div className="avatar">{post.profiles?.avatar_url ? <img src={post.profiles.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} /> : (post.profiles?.display_name || "?").slice(0, 1).toUpperCase()}</div><div className="post-author"><b>{post.profiles?.display_name || "Usuário Conecta"}</b><small>@{post.profiles?.username || "usuario"} · {new Date(post.created_at).toLocaleString("pt-BR")}</small></div></button>
                  {post.user_id === session.user.id && <button type="button" className="icon-button" title="Apagar publicação" aria-label="Apagar publicação" onClick={() => deletePost(post.id)} style={{ color: "#b42318", border: "1px solid #f1c7c4" }}><Trash2 size={17} /></button>}
                </div>
                {post.content && <p className="post-content">{post.content}</p>}
                {post.image_url && <img className="post-image" src={post.image_url} alt="Imagem da publicação" onError={e => { e.currentTarget.style.display = "none"; }} />}
                <div className="post-stats"><span>{post.likes?.length || 0} curtidas</span><span>{post.comments?.length || 0} comentários</span></div>
                <div className="post-actions"><button className={liked ? "liked" : ""} onClick={() => toggleLike(post)}><Heart size={18} fill={liked ? "currentColor" : "none"} /> Curtir</button><button onClick={() => document.getElementById(`comment-${post.id}`)?.focus()}><MessageCircle size={18} /> Comentar</button></div>
                {post.comments?.slice(-3).map(comment => <div className="comment" key={comment.id}>{comment.profiles?.id ? <button type="button" onClick={() => openUserProfile(comment.user_id)} style={{ border: 0, padding: 0, background: "transparent", color: "inherit", fontWeight: 700, cursor: "pointer" }}>{comment.profiles?.display_name || "Usuário"}</button> : <b>{comment.profiles?.display_name || "Usuário"}</b>} {comment.content}</div>)}
                <div className="comment-entry"><input id={`comment-${post.id}`} value={commentDrafts[post.id] || ""} onChange={e => setCommentDrafts(value => ({ ...value, [post.id]: e.target.value }))} placeholder="Escreva um comentário…" /><button onClick={() => addComment(post.id)} aria-label="Enviar comentário"><Send size={17} /></button></div>
              </article>;
            })}
        </>}

        {activePage === "stories" && <>
          <div className="welcome">
            <div><span className="eyebrow">MOMENTOS</span><h2>Story</h2><p>Compartilhe fotos e momentos que ficam disponíveis por 24 horas.</p></div>
            <button className="icon-button" type="button" onClick={loadStories} title="Atualizar Stories"><RefreshCw size={18} /></button>
          </div>
          {storiesPanel}
        </>}

        {activePage === "profile" && <>
          <div className="welcome"><div><span className="eyebrow">SUA CONTA</span><h2>Meu perfil</h2><p>Veja suas informações, atualize seus dados e acompanhe suas publicações.</p></div><button className="icon-button" onClick={loadProfile} title="Atualizar perfil"><RefreshCw size={18} /></button></div>
          <section className="card" style={{ padding: "22px", marginBottom: "18px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "18px", flexWrap: "wrap" }}>
              <div className="avatar" style={{ width: "84px", height: "84px", fontSize: "30px", flexShrink: 0 }}>
                {profile?.avatar_url ? <img src={profile.avatar_url} alt="Foto do perfil" onError={event => { event.currentTarget.style.display = "none"; }} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} /> : (profile?.display_name || "C").slice(0, 1).toUpperCase()}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "9px", flexWrap: "wrap", marginBottom: "4px" }}>
                  <h2 style={{ margin: 0 }}>{profile?.display_name || "Seu nome"}</h2>
                  {profile?.username?.toLowerCase() === "usuario_7be4cd5a" && (
                    <span title="Identificação de desenvolvedor" style={{ display: "inline-flex", alignItems: "center", gap: "5px", padding: "5px 10px", borderRadius: "999px", background: "#eaf2ff", color: "#2457a7", border: "1px solid #c9dcff", fontSize: "12px", fontWeight: 700, lineHeight: 1 }}>
                      <Code2 size={14} /> Desenvolvedor
                    </span>
                  )}
                </div>
                <p className="muted" style={{ margin: "0 0 8px" }}>@{profile?.username || "usuario"}</p>
                <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{profile?.bio || "Você ainda não adicionou uma biografia."}</p>
              </div>
            </div>
            <div style={{ display: "flex", gap: "22px", flexWrap: "wrap", borderTop: "1px solid #e5e7eb", marginTop: "18px", paddingTop: "14px" }}>
              <span><b>{myPosts.length}</b> publicação(ões)</span>
              <span><b>{acceptedFriendships.length}</b> amizade(s)</span>
            </div>
          </section>

          <section className="card" style={{ padding: "22px", marginBottom: "18px" }}>
            <h3 style={{ marginTop: 0 }}>Editar perfil</h3>
            <form onSubmit={saveProfile} className="profile-form">
              <label>Nome<input name="display_name" value={profileName} onChange={event => setProfileName(event.target.value)} placeholder="Seu nome" maxLength={60} required /></label>
              <label>Nome de usuário<input name="username" value={profileUsername} onChange={event => setProfileUsername(event.target.value)} placeholder="seu_usuario" maxLength={30} /></label>
              <label>Biografia<textarea name="bio" value={profileBio} onChange={event => setProfileBio(event.target.value)} placeholder="Conte um pouco sobre você" rows={4} maxLength={300} /></label>
              <label>Link da foto de perfil<input name="avatar_url" type="url" value={profileAvatarUrl} onChange={event => setProfileAvatarUrl(event.target.value)} placeholder="https://exemplo.com/minha-foto.jpg" /></label>
              <p className="muted" style={{ fontSize: "12px", marginTop: 0 }}>Para a foto, use um link público de uma imagem. O envio direto de fotos do computador ainda será adicionado.</p>
              <button className="primary full">Salvar alterações</button>
            </form>
          </section>

          <div className="welcome"><div><span className="eyebrow">SUAS ATIVIDADES</span><h2>Minhas publicações</h2><p>Publicações que você compartilhou no Conecta.</p></div><button className="icon-button" onClick={loadPosts} title="Atualizar publicações"><RefreshCw size={18} /></button></div>
          {myPosts.length === 0 ? <div className="empty card"><h3>Você ainda não publicou</h3><p>Volte ao Feed para compartilhar sua primeira ideia.</p><button className="secondary" onClick={() => setActivePage("feed")}>Ir para o Feed</button></div> : myPosts.map(post => <article className="post card" key={post.id}>
            <div className="post-head" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" }}><div style={{ display: "flex", alignItems: "center", gap: "10px" }}><div className="avatar">{profile?.avatar_url ? <img src={profile.avatar_url} alt="Sua foto" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} /> : (profile?.display_name || "?").slice(0, 1).toUpperCase()}</div><div className="post-author"><b>{profile?.display_name || "Você"}</b><small>@{profile?.username || "usuario"} · {new Date(post.created_at).toLocaleString("pt-BR")}</small></div></div><button type="button" className="icon-button" title="Apagar publicação" aria-label="Apagar publicação" onClick={() => deletePost(post.id)} style={{ color: "#b42318", border: "1px solid #f1c7c4" }}><Trash2 size={17} /></button></div>
            {post.content && <p className="post-content">{post.content}</p>}
            {post.image_url && <img className="post-image" src={post.image_url} alt="Imagem da publicação" />}
            <div className="post-stats"><span>{post.likes?.length || 0} curtidas</span><span>{post.comments?.length || 0} comentários</span></div>
          </article>)}
        </>}

        {activePage === "userProfile" && <>
          <div className="welcome">
            <div><span className="eyebrow">PERFIL PÚBLICO</span><h2>Perfil de {viewedProfile?.display_name || "usuário"}</h2><p>Veja as informações e publicações desta pessoa.</p></div>
            <button className="secondary" type="button" onClick={() => setActivePage("community")}>Voltar à comunidade</button>
          </div>
          {viewedProfileLoading ? <div className="empty card"><LoaderCircle className="spin" /> Carregando perfil…</div> : !viewedProfile ? <div className="empty card"><h3>Perfil indisponível</h3><p>Não foi possível carregar este perfil.</p><button className="secondary" onClick={() => setActivePage("community")}>Voltar</button></div> : <>
            <section className="card" style={{ padding: "22px", marginBottom: "18px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "18px", flexWrap: "wrap" }}>
                <div className="avatar" style={{ width: "84px", height: "84px", fontSize: "30px", flexShrink: 0 }}>
                  {viewedProfile.avatar_url ? <img src={viewedProfile.avatar_url} alt={`Foto de ${viewedProfile.display_name || "usuário"}`} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} /> : (viewedProfile.display_name || "C").slice(0, 1).toUpperCase()}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "9px", flexWrap: "wrap", marginBottom: "4px" }}>
                    <h2 style={{ margin: 0 }}>{viewedProfile.display_name || "Usuário Conecta"}</h2>
                    {viewedProfile.username?.toLowerCase() === "usuario_7be4cd5a" && <span title="Identificação de desenvolvedor" style={{ display: "inline-flex", alignItems: "center", gap: "5px", padding: "5px 10px", borderRadius: "999px", background: "#eaf2ff", color: "#2457a7", border: "1px solid #c9dcff", fontSize: "12px", fontWeight: 700, lineHeight: 1 }}><Code2 size={14} /> Desenvolvedor</span>}
                  </div>
                  <p className="muted" style={{ margin: "0 0 8px" }}>@{viewedProfile.username || "usuario"}</p>
                  <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{viewedProfile.bio || "Esta pessoa ainda não adicionou uma biografia."}</p>
                </div>
              </div>
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "18px" }}>
                {(() => {
                  const relation = friendships.find(item => (item.requester_id === session.user.id && item.receiver_id === viewedProfile.id) || (item.receiver_id === session.user.id && item.requester_id === viewedProfile.id));
                  if (!relation) return <button className="primary" type="button" disabled={friendBusy} onClick={() => sendFriendRequest(viewedProfile.id)}>Adicionar amigo</button>;
                  if (relation.status === "accepted") return <button className="secondary" type="button" onClick={async () => { setActivePage("messages"); await openChat(viewedProfile.id); }}>Enviar mensagem</button>;
                  if (relation.status === "pending" && relation.requester_id === session.user.id) return <span className="muted">Solicitação enviada</span>;
                  if (relation.status === "pending") return <span className="muted">Esta pessoa enviou uma solicitação para você. Veja em Comunidade.</span>;
                  return <button className="primary" type="button" disabled={friendBusy} onClick={() => sendFriendRequest(viewedProfile.id)}>Adicionar amigo</button>;
                })()}
              </div>
            </section>
            <div className="welcome"><div><span className="eyebrow">ATIVIDADES</span><h2>Publicações de {viewedProfile.display_name || "usuário"}</h2><p>Conteúdos compartilhados neste perfil.</p></div></div>
            {viewedProfilePosts.length === 0 ? <div className="empty card"><h3>Nenhuma publicação ainda</h3><p>Quando esta pessoa publicar, o conteúdo aparecerá aqui.</p></div> : viewedProfilePosts.map(post => <article className="post card" key={post.id}>
              <div className="post-head"><div className="avatar">{viewedProfile.avatar_url ? <img src={viewedProfile.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} /> : (viewedProfile.display_name || "?").slice(0, 1).toUpperCase()}</div><div className="post-author"><b>{viewedProfile.display_name || "Usuário Conecta"}</b><small>@{viewedProfile.username || "usuario"} · {new Date(post.created_at).toLocaleString("pt-BR")}</small></div></div>
              {post.content && <p className="post-content">{post.content}</p>}
              {post.image_url && <img className="post-image" src={post.image_url} alt="Imagem da publicação" />}
              <div className="post-stats"><span>{post.likesCount} curtidas</span><span>{post.commentsCount} comentários</span></div>
            </article>)}
          </>}
        </>}

        {activePage === "community" && <>
          <div className="welcome"><div><span className="eyebrow">CONECTE-SE</span><h2>Comunidade</h2><p>Encontre pessoas, envie solicitações e gerencie suas amizades.</p></div><button className="icon-button" onClick={() => { loadFriendships(); }} title="Atualizar comunidade"><RefreshCw size={18} /></button></div>
          <section className="card" style={{ padding: "18px", marginBottom: "18px" }}>
            <h3 style={{ marginTop: 0 }}>Encontrar pessoas</h3>
            <p className="muted">Pesquise pelo nome ou pelo nome de usuário para adicionar amigos.</p>
            <form onSubmit={searchPeople} style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <input value={peopleSearch} onChange={event => setPeopleSearch(event.target.value)} placeholder="Nome ou @usuário" aria-label="Pesquisar pessoas" style={{ flex: "1 1 220px", minWidth: 0 }} />
              <button className="secondary" disabled={friendBusy}>{friendBusy ? "Aguarde…" : "Buscar pessoas"}</button>
            </form>
            {incomingRequests.length > 0 && <div style={{ marginTop: "18px" }}>
              <h4>Pedidos recebidos ({incomingRequests.length})</h4>
              {incomingRequests.map(item => {
                const person = friendProfilesById[item.requester_id];
                return <div key={item.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", padding: "10px 0", borderTop: "1px solid #e5e7eb", flexWrap: "wrap" }}>
                  <div><b>{person?.display_name || "Usuário Conecta"}</b><div className="muted">@{person?.username || "usuario"}</div></div>
                  <div style={{ display: "flex", gap: "8px" }}><button type="button" className="primary" disabled={friendBusy} onClick={() => respondToFriendRequest(item.id, "accepted")}>Aceitar</button><button type="button" className="secondary" disabled={friendBusy} onClick={() => respondToFriendRequest(item.id, "rejected")}>Recusar</button></div>
                </div>;
              })}
            </div>}
            {people.length > 0 && <div style={{ marginTop: "18px" }}>
              <h4>Resultados da busca</h4>
              {people.map(person => {
                const relation = friendships.find(item => (item.requester_id === session.user.id && item.receiver_id === person.id) || (item.receiver_id === session.user.id && item.requester_id === person.id));
                let action;
                if (!relation) action = <button type="button" className="primary" disabled={friendBusy} onClick={() => sendFriendRequest(person.id)}>Adicionar amigo</button>;
                else if (relation.status === "accepted") action = <span className="muted">Vocês são amigos</span>;
                else if (relation.status === "pending" && relation.requester_id === session.user.id) action = <span className="muted">Solicitação enviada</span>;
                else if (relation.status === "pending") action = <span className="muted">Enviou um pedido para você</span>;
                else action = <span className="muted">Pedido encerrado</span>;
                return <div key={person.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", padding: "10px 0", borderTop: "1px solid #e5e7eb", flexWrap: "wrap" }}><div><button type="button" onClick={() => openUserProfile(person.id)} style={{ border: 0, padding: 0, background: "transparent", color: "inherit", textAlign: "left", cursor: "pointer" }}><b>{person.display_name || "Usuário Conecta"}</b><div className="muted">@{person.username || "usuario"}</div></button><div><button type="button" className="secondary" style={{ marginTop: "6px", padding: "5px 9px", fontSize: "12px" }} onClick={() => openUserProfile(person.id)}>Ver perfil</button></div></div>{action}</div>;
              })}
            </div>}
          </section>

          <section className="card" style={{ padding: "18px", marginBottom: "18px" }}>
            <h3 style={{ marginTop: 0 }}>Meus amigos ({acceptedFriendships.length})</h3>
            {acceptedFriendships.length === 0 ? <p className="muted">Suas amizades aceitas aparecerão aqui.</p> : acceptedFriendships.map(item => {
              const friendId = item.requester_id === session.user.id ? item.receiver_id : item.requester_id;
              const friend = friendProfilesById[friendId];
              if (!friend) return null;
              return <div key={item.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", padding: "10px 0", borderTop: "1px solid #e5e7eb", flexWrap: "wrap" }}><div><button type="button" onClick={() => openUserProfile(friendId)} style={{ border: 0, padding: 0, background: "transparent", color: "inherit", textAlign: "left", cursor: "pointer" }}><b>{friend.display_name || "Usuário Conecta"}</b><div className="muted">@{friend.username || "usuario"}</div></button><div><button type="button" className="secondary" style={{ marginTop: "6px", padding: "5px 9px", fontSize: "12px" }} onClick={() => openUserProfile(friendId)}>Ver perfil</button></div></div><button className="secondary" type="button" onClick={() => { setActivePage("messages"); openChat(friendId); }}>Conversar</button></div>;
            })}
          </section>


        </>}

        {activePage === "messages" && <>
          <div className="welcome"><div><span className="eyebrow">CONVERSAS</span><h2>Mensagem</h2><p>Converse em particular com pessoas que já aceitaram sua amizade.</p></div><button className="icon-button" onClick={() => { loadFriendships(); if (selectedChatFriend) loadChatMessages(selectedChatFriend.id); }} title="Atualizar mensagens"><RefreshCw size={18} /></button></div>
          <section className="card" style={{ padding: "18px", marginBottom: "18px" }}>
            <h3 style={{ marginTop: 0 }}>Mensagem</h3>
            <p className="muted">Converse em particular com pessoas que já aceitaram sua amizade.</p>
            {acceptedFriendships.length === 0 ? <p className="muted">Quando você tiver amigos, poderá conversar com eles aqui.</p> : (
              <div style={{ display: "grid", gridTemplateColumns: "minmax(150px, 0.8fr) minmax(0, 1.7fr)", gap: "14px" }}>
                <div><h4 style={{ marginTop: 0 }}>Seus amigos</h4>
                  {acceptedFriendships.map(item => {
                    const friendId = item.requester_id === session.user.id ? item.receiver_id : item.requester_id;
                    const friend = friendProfilesById[friendId];
                    if (!friend) return null;
                    const active = selectedChatFriend?.id === friendId;
                    return <button key={item.id} type="button" className={active ? "primary" : "secondary"} onClick={() => openChat(friendId)} style={{ display: "block", width: "100%", textAlign: "left", marginBottom: "8px" }}>{friend.display_name || "Usuário Conecta"}<span style={{ display: "block", fontSize: "12px", opacity: 0.8 }}>@{friend.username || "usuario"}</span></button>;
                  })}
                </div>
                <div style={{ minWidth: 0 }}>
                  {selectedChatFriend ? <>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}><h4 style={{ marginTop: 0 }}>Conversa com {selectedChatFriend.display_name || "amigo"}</h4><button type="button" className="secondary" onClick={() => loadChatMessages(selectedChatFriend.id)}>Atualizar</button></div>
                    <div style={{ border: "1px solid #e5e7eb", borderRadius: "10px", padding: "12px", minHeight: "180px", maxHeight: "320px", overflowY: "auto", marginBottom: "10px" }}>
                      {chatLoading ? <p className="muted">Carregando mensagens…</p> : chatMessages.length === 0 ? <p className="muted">Esta conversa ainda não tem mensagens. Escreva a primeira!</p> : chatMessages.map(message => {
                        const mine = message.sender_id === session.user.id;
                        return <div key={message.id} style={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start", marginBottom: "8px" }}><div style={{ maxWidth: "85%", padding: "9px 12px", borderRadius: "12px", background: mine ? "#dbeafe" : "#f3f4f6", overflowWrap: "anywhere" }}><div>{message.content}</div><small style={{ display: "block", marginTop: "4px", opacity: 0.65, textAlign: "right" }}>{new Date(message.created_at).toLocaleString("pt-BR")}</small></div></div>;
                      })}
                    </div>
                    <form onSubmit={sendChatMessage} style={{ display: "flex", gap: "8px" }}><input value={messageDraft} onChange={event => setMessageDraft(event.target.value)} placeholder="Escreva uma mensagem…" aria-label="Escreva uma mensagem" disabled={sendingMessage} style={{ flex: 1, minWidth: 0 }} /><button className="primary" disabled={sendingMessage || !messageDraft.trim()}>{sendingMessage ? "Enviando…" : "Enviar"}</button></form>
                  </> : <div style={{ minHeight: "180px", display: "grid", placeItems: "center", border: "1px dashed #d1d5db", borderRadius: "10px", padding: "16px", textAlign: "center" }}><p className="muted">Escolha um amigo à esquerda para abrir a conversa.</p></div>}
                </div>
              </div>
            )}
          </section>
        </>}
        {activePage === "admin" && isAdmin && <>
          <div className="welcome"><div><span className="eyebrow">ÁREA RESTRITA</span><h2>Painel ADM</h2><p>Gerencie os conteúdos e acompanhe o Conecta.</p></div><button className="secondary" type="button" onClick={loadAdminData}><RefreshCw size={16} /> Atualizar</button></div>
          <section className="card" style={{ padding: "16px", marginBottom: "16px" }}>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              {[ ["dashboard", "Dashboard"], ["users", "Usuários"], ["posts", "Publicações"], ["stories", "Stories"], ["moderation", "Moderação"] ].map(([key, label]) => <button key={key} type="button" className={adminTab === key ? "primary" : "secondary"} onClick={() => setAdminTab(key)}>{label}</button>)}
            </div>
          </section>
          {adminTab === "dashboard" && <div className="grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: "12px" }}>
            {[["Usuários", adminCounts.users], ["Publicações", adminCounts.posts], ["Stories", adminCounts.stories]].map(([label, value]) => <section className="card" key={label} style={{ padding: "20px" }}><p className="muted" style={{ margin: 0 }}>{label}</p><h2 style={{ fontSize: "30px", margin: "8px 0 0" }}>{value}</h2></section>)}
          </div>}
          {adminTab === "users" && <section className="card" style={{ padding: "18px" }}><h3>Usuários cadastrados</h3>{adminUsers.length === 0 ? <p className="muted">Nenhum usuário encontrado ou acesso bloqueado.</p> : adminUsers.map(person => <div key={person.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", padding: "10px 0", borderBottom: "1px solid #eee" }}><div><b>{person.display_name || "Usuário"}</b><div className="muted">@{person.username || "usuario"}</div></div><button className="secondary" type="button" onClick={() => openUserProfile(person.id)}>Ver perfil</button></div>)}</section>}
          {adminTab === "posts" && <section className="card" style={{ padding: "18px" }}><h3>Publicações</h3>{adminPosts.length === 0 ? <p className="muted">Nenhuma publicação encontrada.</p> : adminPosts.map(post => { const author = adminUsers.find(person => person.id === post.user_id); return <article key={post.id} style={{ padding: "12px 0", borderBottom: "1px solid #eee" }}><b>{author?.display_name || "Usuário"} @{author?.username || ""}</b><p style={{ whiteSpace: "pre-wrap" }}>{post.content || "(Publicação com imagem)"}</p>{post.image_url && <a href={post.image_url} target="_blank" rel="noreferrer">Ver imagem</a>}<div><button className="secondary" type="button" style={{ color: "#b42318" }} onClick={() => adminDeletePost(post.id)}>Excluir publicação</button></div></article>; })}</section>}
          {adminTab === "stories" && <section className="card" style={{ padding: "18px" }}><h3>Stories</h3>{adminStories.length === 0 ? <p className="muted">Nenhum Story encontrado.</p> : adminStories.map(story => { const author = adminUsers.find(person => person.id === story.user_id); return <article key={story.id} style={{ padding: "12px 0", borderBottom: "1px solid #eee" }}><b>{author?.display_name || "Usuário"} @{author?.username || ""}</b><p>{story.content || "(Story com imagem)"}</p>{story.image_url && <a href={story.image_url} target="_blank" rel="noreferrer">Ver imagem</a>}<div><button className="secondary" type="button" style={{ color: "#b42318" }} onClick={() => adminDeleteStory(story.id)}>Excluir Story</button></div></article>; })}</section>}
          {adminTab === "moderation" && <section className="card" style={{ padding: "18px" }}><h3>Moderação</h3><p className="muted">O sistema de denúncias ainda não foi configurado. Por enquanto, você pode revisar e remover publicações e Stories nas abas correspondentes.</p></section>}
        </>}
        <footer>Conecta · Feito para aproximar pessoas.</footer>
      </main>

      <aside className="right-panel">
        <section className="side-card">
          <h3>Seu espaço</h3>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
            <div className="avatar">{profile?.avatar_url ? <img src={profile.avatar_url} alt="Sua foto" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} /> : (profile?.display_name || "C").slice(0, 1).toUpperCase()}</div>
            <div><b>{profile?.display_name || "Meu perfil"}</b><small style={{ display: "block" }}>@{profile?.username || "usuario"}</small></div>
          </div>
          <button type="button" className="secondary full" onClick={() => setActivePage("profile")}>Abrir meu perfil</button>
          <p className="muted" style={{ marginBottom: 0 }}>Mantenha suas informações atualizadas para que seus amigos conheçam você.</p>
        </section>
        <section className="side-card tips"><h3>Bem-vindo ao Conecta</h3><p>Publique, curta e converse. Sua comunidade começa com uma conexão.</p></section>
      </aside>
    </div>
    {activeStory && <div role="dialog" aria-modal="true" aria-label="Visualizador de Stories" onClick={closeStoryViewer} style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(10, 15, 25, 0.88)", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
      <div onClick={event => event.stopPropagation()} style={{ position: "relative", width: "min(420px, 100%)", height: "min(760px, 88vh)", minHeight: "420px", borderRadius: "18px", overflow: "hidden", background: activeStory.image_url ? "#111827" : "linear-gradient(145deg, #1d4ed8, #7c3aed, #be185d)", color: "white", display: "flex", flexDirection: "column", boxShadow: "0 24px 80px rgba(0,0,0,.4)" }}>
        <div style={{ display: "flex", gap: "4px", padding: "12px 12px 8px" }}>{activeStoryGroup.items.map((item, index) => <span key={item.id} style={{ height: "3px", flex: 1, borderRadius: "4px", background: index <= activeStoryIndex ? "#fff" : "rgba(255,255,255,.35)" }} />)}</div>
        <div style={{ display: "flex", alignItems: "center", gap: "9px", padding: "4px 14px 12px" }}>
          <div style={{ width: "34px", height: "34px", borderRadius: "50%", overflow: "hidden", background: "rgba(255,255,255,.2)", display: "grid", placeItems: "center", fontWeight: 700 }}>{activeStoryGroup.profile?.avatar_url ? <img src={activeStoryGroup.profile.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : (activeStoryGroup.profile?.display_name || "C").slice(0, 1).toUpperCase()}</div>
          <div style={{ flex: 1, minWidth: 0 }}><b>{activeStoryGroup.profile?.display_name || "Usuário Conecta"}</b><small style={{ display: "block", opacity: .75 }}>{new Date(activeStory.created_at).toLocaleString("pt-BR")}</small></div>
          {activeStory.user_id === session.user.id && <button type="button" onClick={() => deleteStory(activeStory.id)} aria-label="Apagar Story" title="Apagar Story" style={{ border: 0, background: "rgba(255,255,255,.16)", color: "white", borderRadius: "8px", padding: "7px", cursor: "pointer" }}>Apagar</button>}
          <button type="button" onClick={closeStoryViewer} aria-label="Fechar Story" style={{ border: 0, background: "rgba(255,255,255,.16)", color: "white", borderRadius: "8px", padding: "7px", cursor: "pointer" }}><X size={18} /></button>
        </div>
        <div style={{ flex: 1, minHeight: 0, display: "grid", placeItems: "center", position: "relative" }}>
          {activeStory.image_url ? <img src={activeStory.image_url} alt="Story" style={{ width: "100%", height: "100%", objectFit: "contain" }} /> : <div style={{ padding: "34px", textAlign: "center", fontSize: "clamp(24px, 5vw, 34px)", fontWeight: 700, overflowWrap: "anywhere" }}>{activeStory.content}</div>}
          {activeStory.image_url && activeStory.content && <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "22px 16px", background: "linear-gradient(transparent, rgba(0,0,0,.72))", textAlign: "center", fontSize: "20px", fontWeight: 600 }}>{activeStory.content}</div>}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", padding: "12px" }}>
          <button type="button" onClick={previousStory} style={{ border: 0, background: "rgba(255,255,255,.16)", color: "white", borderRadius: "9px", padding: "9px 13px", cursor: "pointer" }}><ChevronLeft size={18} /> Anterior</button>
          <button type="button" onClick={nextStory} style={{ border: 0, background: "rgba(255,255,255,.16)", color: "white", borderRadius: "9px", padding: "9px 13px", cursor: "pointer" }}>Próximo <ChevronRight size={18} /></button>
        </div>
      </div>
    </div>}
  </div>;
}

export default App;
