import { useState } from 'react';
import { Link } from 'react-router-dom';
import Avatar from './Avatar.jsx';
import FollowButton from './FollowButton.jsx';
import { useAuth } from '../context/AuthContext.jsx';

// A row showing a user: avatar, name, @username and a follow button.
const UserCard = ({ user, onNavigate }) => {
  const { user: me } = useAuth();
  const [isFollowing, setIsFollowing] = useState(Boolean(user.is_following));

  return (
    <div className="user-card">
      <Link to={`/profile/${user.id}`} className="user-card-info" onClick={onNavigate}>
        <Avatar user={user} size={46} />
        <div className="user-card-text">
          <strong>{user.name}</strong>
          <span className="muted">@{user.username}</span>
        </div>
      </Link>
      {me?.id !== user.id && (
        <FollowButton userId={user.id} isFollowing={isFollowing} onChange={(value) => setIsFollowing(value)} />
      )}
    </div>
  );
};

export default UserCard;
