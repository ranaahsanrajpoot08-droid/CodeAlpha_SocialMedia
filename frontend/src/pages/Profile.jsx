import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { fetchUser, fetchPosts, fetchFollowers, fetchFollowing, getErrorMessage } from '../services/api.js';
import Avatar from '../components/Avatar.jsx';
import FollowButton from '../components/FollowButton.jsx';
import PostCard from '../components/PostCard.jsx';
import UserCard from '../components/UserCard.jsx';
import Loading from '../components/Loading.jsx';

const Profile = () => {
  const { id } = useParams();
  const { user: me } = useAuth();
  const isOwn = Number(id) === me.id;

  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [tab, setTab] = useState('posts'); // 'posts' | 'followers' | 'following'
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tabLoading, setTabLoading] = useState(false);
  const [error, setError] = useState('');

  // Load profile + posts whenever the profile id in the URL changes.
  useEffect(() => {
    setLoading(true);
    setError('');
    setTab('posts');
    Promise.all([fetchUser(id), fetchPosts({ userId: id, limit: 50 })])
      .then(([userData, postData]) => {
        setProfile(userData.user);
        setPosts(postData.posts);
      })
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [id]);

  const loadPeople = useCallback(
    async (which) => {
      setTabLoading(true);
      try {
        const data = which === 'followers' ? await fetchFollowers(id) : await fetchFollowing(id);
        setPeople(data.users);
      } catch (err) {
        setError(getErrorMessage(err));
      } finally {
        setTabLoading(false);
      }
    },
    [id]
  );

  const openTab = (which) => {
    setTab(which);
    if (which !== 'posts') loadPeople(which);
  };

  const handleFollowChange = (isFollowing, data) => {
    setProfile((p) => ({
      ...p,
      is_following: isFollowing,
      followers_count: data.followers_count,
    }));
    if (tab === 'followers') loadPeople('followers');
  };

  const handleDeleted = (postId) => {
    setPosts((prev) => prev.filter((p) => p.id !== postId));
    setProfile((p) => ({ ...p, posts_count: p.posts_count - 1 }));
  };
  const handleUpdated = (post) => setPosts((prev) => prev.map((p) => (p.id === post.id ? post : p)));

  if (loading) return <Loading text="Loading profile..." />;
  if (error && !profile) return <div className="alert alert-error">{error}</div>;

  return (
    <div className="narrow">
      <section className="card profile-header">
        <Avatar user={profile} size={110} />
        <div className="profile-info">
          <div className="profile-top">
            <div>
              <h2>{profile.name}</h2>
              <p className="muted">@{profile.username}</p>
            </div>
            {isOwn ? (
              <Link to="/edit-profile" className="btn btn-outline">Edit Profile</Link>
            ) : (
              <div className="profile-actions">
                <Link to={`/messages/${profile.id}`} className="btn btn-outline">💬 Message</Link>
                <FollowButton userId={profile.id} isFollowing={profile.is_following} onChange={handleFollowChange} />
              </div>
            )}
          </div>

          <p className="bio">{profile.bio || (isOwn ? 'You have not added a bio yet.' : 'No bio yet.')}</p>

          <div className="stats">
            <button className={tab === 'posts' ? 'active' : ''} onClick={() => openTab('posts')}>
              <strong>{profile.posts_count}</strong> Posts
            </button>
            <button className={tab === 'followers' ? 'active' : ''} onClick={() => openTab('followers')}>
              <strong>{profile.followers_count}</strong> Followers
            </button>
            <button className={tab === 'following' ? 'active' : ''} onClick={() => openTab('following')}>
              <strong>{profile.following_count}</strong> Following
            </button>
          </div>
        </div>
      </section>

      {tab === 'posts' && (
        <>
          {posts.length === 0 && (
            <div className="card empty">
              <h3>No posts yet</h3>
              <p className="muted">{isOwn ? 'Share your first post from the Home page.' : `${profile.name} has not posted anything yet.`}</p>
            </div>
          )}
          {posts.map((post) => (
            <PostCard key={post.id} post={post} onDeleted={handleDeleted} onUpdated={handleUpdated} />
          ))}
        </>
      )}

      {tab !== 'posts' && (
        <div className="card">
          <h3>{tab === 'followers' ? 'Followers' : 'Following'}</h3>
          {tabLoading && <Loading />}
          {!tabLoading && people.length === 0 && (
            <p className="muted">{tab === 'followers' ? 'No followers yet.' : 'Not following anyone yet.'}</p>
          )}
          {!tabLoading && people.map((u) => <UserCard key={`${tab}-${u.id}`} user={u} />)}
        </div>
      )}
    </div>
  );
};

export default Profile;
