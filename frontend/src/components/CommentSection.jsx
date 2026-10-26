import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  fetchComments,
  addComment,
  deleteComment,
  likeComment,
  unlikeComment,
  getErrorMessage,
} from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { timeAgo, fullDate } from '../utils/helpers.js';
import Avatar from './Avatar.jsx';

// Shows the comments of one post (with replies under each comment) and a box to write a new one.
// onCountChange(newCount) keeps the comment number on the post card correct.
const CommentSection = ({ postId, onCountChange }) => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState(null); // the comment I am replying to
  const inputRef = useRef(null);

  useEffect(() => {
    fetchComments(postId)
      .then((data) => setComments(data.comments))
      .catch((error) => showToast(getErrorMessage(error), 'error'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId]);

  const startReply = (comment) => {
    setReplyTo(comment);
    // Replying to a reply: start the text with @name so it is clear who you are answering.
    if (comment.parent_id) setText(`@${comment.user.username} `);
    inputRef.current?.focus();
  };

  const cancelReply = () => {
    setReplyTo(null);
    setText('');
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    setSending(true);
    try {
      const data = await addComment(postId, text, replyTo ? replyTo.id : undefined);
      const updated = [...comments, data.comment];
      setComments(updated);
      onCountChange(updated.length);
      setText('');
      setReplyTo(null);
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (comment) => {
    const hasReplies = comments.some((c) => c.parent_id === comment.id);
    const question = hasReplies ? 'Delete this comment and all its replies?' : 'Delete this comment?';
    if (!window.confirm(question)) return;
    try {
      await deleteComment(comment.id);
      const updated = comments.filter((c) => c.id !== comment.id && c.parent_id !== comment.id);
      setComments(updated);
      onCountChange(updated.length);
      if (replyTo && (replyTo.id === comment.id || replyTo.parent_id === comment.id)) cancelReply();
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    }
  };

  const handleLike = async (comment) => {
    try {
      const data = comment.liked_by_me ? await unlikeComment(comment.id) : await likeComment(comment.id);
      setComments((prev) =>
        prev.map((c) => (c.id === comment.id ? { ...c, liked_by_me: data.liked, like_count: data.like_count } : c))
      );
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    }
  };

  const renderComment = (c, isReply) => (
    <div className={`comment ${isReply ? 'is-reply' : ''}`} key={c.id}>
      <Link to={`/profile/${c.user.id}`}>
        <Avatar user={c.user} size={isReply ? 26 : 32} />
      </Link>
      <div className="comment-main">
        <div className="comment-body">
          <div className="comment-head">
            <Link to={`/profile/${c.user.id}`} className="comment-user">@{c.user.username}</Link>
            <span className="muted small" title={fullDate(c.created_at)}>{timeAgo(c.created_at)}</span>
          </div>
          <p>{c.comment}</p>
        </div>
        <div className="comment-actions">
          <button className={`link-btn ${c.liked_by_me ? 'liked' : ''}`} onClick={() => handleLike(c)}>
            {c.liked_by_me ? '❤️' : '🤍'} {c.like_count > 0 ? c.like_count : 'Like'}
          </button>
          <button className="link-btn" onClick={() => startReply(c)}>Reply</button>
          {c.user_id === user.id && (
            <button className="link-btn danger" onClick={() => handleDelete(c)}>Delete</button>
          )}
        </div>
      </div>
    </div>
  );

  const topLevel = comments.filter((c) => !c.parent_id);

  return (
    <div className="comments">
      {loading && <p className="muted small">Loading comments...</p>}
      {!loading && comments.length === 0 && <p className="muted small">No comments yet. Be the first!</p>}

      {topLevel.map((c) => {
        const replies = comments.filter((r) => r.parent_id === c.id);
        return (
          <div className="comment-thread" key={c.id}>
            {renderComment(c, false)}
            {replies.length > 0 && <div className="comment-replies">{replies.map((r) => renderComment(r, true))}</div>}
          </div>
        );
      })}

      {replyTo && (
        <div className="reply-note">
          Replying to <strong>@{replyTo.user.username}</strong>
          <button className="link-btn" onClick={cancelReply}>Cancel</button>
        </div>
      )}

      <form className="comment-form" onSubmit={handleAdd}>
        <input
          ref={inputRef}
          type="text"
          placeholder={replyTo ? `Reply to @${replyTo.user.username}...` : 'Write a comment...'}
          value={text}
          maxLength={500}
          onChange={(e) => setText(e.target.value)}
        />
        <button className="btn btn-primary" disabled={sending || !text.trim()}>
          {replyTo ? 'Reply' : 'Send'}
        </button>
      </form>
    </div>
  );
};

export default CommentSection;
