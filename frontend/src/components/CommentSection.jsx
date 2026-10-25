import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchComments, addComment, deleteComment, getErrorMessage } from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { timeAgo, fullDate } from '../utils/helpers.js';
import Avatar from './Avatar.jsx';

// Shows the comments of one post and a box to write a new one.
// onCountChange(newCount) keeps the comment number on the post card correct.
const CommentSection = ({ postId, onCountChange }) => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    fetchComments(postId)
      .then((data) => setComments(data.comments))
      .catch((error) => showToast(getErrorMessage(error), 'error'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId]);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    setSending(true);
    try {
      const data = await addComment(postId, text);
      const updated = [...comments, data.comment];
      setComments(updated);
      onCountChange(updated.length);
      setText('');
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this comment?')) return;
    try {
      await deleteComment(id);
      const updated = comments.filter((c) => c.id !== id);
      setComments(updated);
      onCountChange(updated.length);
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    }
  };

  return (
    <div className="comments">
      {loading && <p className="muted small">Loading comments...</p>}
      {!loading && comments.length === 0 && <p className="muted small">No comments yet. Be the first!</p>}

      {comments.map((c) => (
        <div className="comment" key={c.id}>
          <Link to={`/profile/${c.user.id}`}>
            <Avatar user={c.user} size={32} />
          </Link>
          <div className="comment-body">
            <div className="comment-head">
              <Link to={`/profile/${c.user.id}`} className="comment-user">@{c.user.username}</Link>
              <span className="muted small" title={fullDate(c.created_at)}>{timeAgo(c.created_at)}</span>
              {c.user_id === user.id && (
                <button className="link-btn danger" onClick={() => handleDelete(c.id)}>Delete</button>
              )}
            </div>
            <p>{c.comment}</p>
          </div>
        </div>
      ))}

      <form className="comment-form" onSubmit={handleAdd}>
        <input
          type="text"
          placeholder="Write a comment..."
          value={text}
          maxLength={500}
          onChange={(e) => setText(e.target.value)}
        />
        <button className="btn btn-primary" disabled={sending || !text.trim()}>Send</button>
      </form>
    </div>
  );
};

export default CommentSection;
