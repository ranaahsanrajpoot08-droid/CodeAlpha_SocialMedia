import { useState } from 'react';
import { followUser, unfollowUser, getErrorMessage } from '../services/api.js';
import { useToast } from '../context/ToastContext.jsx';

// Follow / Unfollow button used on profiles, search results and suggestions.
// onChange(isFollowing, data) lets the parent update its counts.
const FollowButton = ({ userId, isFollowing, onChange, className = '' }) => {
  const [busy, setBusy] = useState(false);
  const { showToast } = useToast();

  const handleClick = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    setBusy(true);
    try {
      const data = isFollowing ? await unfollowUser(userId) : await followUser(userId);
      onChange?.(data.is_following, data);
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      className={`btn ${isFollowing ? 'btn-outline' : 'btn-primary'} ${className}`}
      onClick={handleClick}
      disabled={busy}
    >
      {isFollowing ? 'Unfollow' : 'Follow'}
    </button>
  );
};

export default FollowButton;
