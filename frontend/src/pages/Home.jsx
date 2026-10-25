import { useCallback, useEffect, useState } from 'react';
import CreatePost from '../components/CreatePost.jsx';
import PostCard from '../components/PostCard.jsx';
import UserCard from '../components/UserCard.jsx';
import Loading from '../components/Loading.jsx';
import { fetchPosts, fetchSuggestions, getErrorMessage } from '../services/api.js';
import { useToast } from '../context/ToastContext.jsx';

const Home = () => {
  const { showToast } = useToast();
  const [posts, setPosts] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [filter, setFilter] = useState('all'); // 'all' | 'following'
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [suggestions, setSuggestions] = useState([]);

  const loadPosts = useCallback(
    async (pageToLoad, replace) => {
      try {
        const params = { page: pageToLoad, limit: 10 };
        if (filter === 'following') params.filter = 'following';
        const data = await fetchPosts(params);
        setPosts((prev) => (replace ? data.posts : [...prev, ...data.posts]));
        setHasMore(data.hasMore);
        setPage(pageToLoad);
        setError('');
      } catch (err) {
        setError(getErrorMessage(err));
      }
    },
    [filter]
  );

  useEffect(() => {
    setLoading(true);
    loadPosts(1, true).finally(() => setLoading(false));
  }, [loadPosts]);

  useEffect(() => {
    fetchSuggestions()
      .then((data) => setSuggestions(data.users))
      .catch(() => {});
  }, []);

  const handleLoadMore = async () => {
    setLoadingMore(true);
    await loadPosts(page + 1, false);
    setLoadingMore(false);
  };

  const handleCreated = (post) => setPosts((prev) => [post, ...prev]);
  const handleDeleted = (id) => setPosts((prev) => prev.filter((p) => p.id !== id));
  const handleUpdated = (post) => setPosts((prev) => prev.map((p) => (p.id === post.id ? post : p)));

  return (
    <div className="home-layout">
      <section className="feed">
        <CreatePost onCreated={handleCreated} />

        <div className="tabs">
          <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>Everyone</button>
          <button className={filter === 'following' ? 'active' : ''} onClick={() => setFilter('following')}>Following</button>
        </div>

        {loading && <Loading text="Loading posts..." />}

        {!loading && error && (
          <div className="alert alert-error">
            {error} <button className="link-btn" onClick={() => loadPosts(1, true)}>Try again</button>
          </div>
        )}

        {!loading && !error && posts.length === 0 && (
          <div className="card empty">
            <h3>No posts yet</h3>
            <p className="muted">
              {filter === 'following'
                ? 'Follow some people to see their posts here.'
                : 'Be the first one to share something!'}
            </p>
          </div>
        )}

        {!loading &&
          posts.map((post) => (
            <PostCard key={post.id} post={post} onDeleted={handleDeleted} onUpdated={handleUpdated} />
          ))}

        {!loading && hasMore && (
          <button className="btn btn-outline btn-block" onClick={handleLoadMore} disabled={loadingMore}>
            {loadingMore ? 'Loading...' : 'Load more'}
          </button>
        )}
      </section>

      <aside className="sidebar">
        <div className="card">
          <h3>People to follow</h3>
          {suggestions.length === 0 && <p className="muted small">No suggestions right now.</p>}
          {suggestions.map((u) => (
            <UserCard key={u.id} user={u} />
          ))}
        </div>
      </aside>
    </div>
  );
};

export default Home;
