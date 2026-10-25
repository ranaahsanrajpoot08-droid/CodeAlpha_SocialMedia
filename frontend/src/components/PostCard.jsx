import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { likePost, unlikePost, updatePost, deletePost, getErrorMessage } from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { imageUrl, timeAgo, fullDate } from '../utils/helpers.js';
import Avatar from './Avatar.jsx';
import CommentSection from './CommentSection.jsx';

// One post in the feed.  onDeleted(id) / onUpdated(post) tell the parent page what changed.
const PostCard = ({ post, onDeleted, onUpdated }) => {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [liked, setLiked] = useState(post.liked_by_me);
  const [likeCount, setLikeCount] = useState(post.like_count);
  const [commentCount, setCommentCount] = useState(post.comment_count);
  const [showComments, setShowComments] = useState(false);
  const [likeBusy, setLikeBusy] = useState(false);
  const [pop, setPop] = useState(false); // like animation

  // edit mode
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(post.content);
  const [removeImg, setRemoveImg] = useState(false);
  const [newImage, setNewImage] = useState(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef(null);

  const isOwner = post.user_id === user.id;

  const toggleLike = async () => {
    if (likeBusy) return;
    setLikeBusy(true);
    try {
      const data = liked ? await unlikePost(post.id) : await likePost(post.id);
      setLiked(data.liked);
      setLikeCount(data.like_count);
      if (data.liked) {
        setPop(true);
        setTimeout(() => setPop(false), 400);
      }
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    } finally {
      setLikeBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this post? This cannot be undone.')) return;
    try {
      await deletePost(post.id);
      showToast('Post deleted');
      onDeleted?.(post.id);
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    }
  };

  const cancelEdit = () => {
    setEditing(false);
    setEditText(post.content);
    setRemoveImg(false);
    setNewImage(null);
  };

  const handleSave = async () => {
    const formData = new FormData();
    formData.append('content', editText);
    if (newImage) formData.append('image', newImage);
    if (removeImg) formData.append('remove_image', 'true');

    setSaving(true);
    try {
      const data = await updatePost(post.id, formData);
      onUpdated?.(data.post);
      setEditing(false);
      setRemoveImg(false);
      setNewImage(null);
      showToast('Post updated');
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    } finally {
      setSaving(false);
    }
  };

  const currentImage = removeImg ? null : imageUrl(post.image);

  return (
    <article className="card post">
      <header className="post-header">
        <Link to={`/profile/${post.user.id}`} className="post-author">
          <Avatar user={post.user} size={44} />
          <div>
            <strong>{post.user.name}</strong>
            <div className="muted small">
              @{post.user.username} · <span title={fullDate(post.created_at)}>{timeAgo(post.created_at)}</span>
              {post.updated_at !== post.created_at && ' · edited'}
            </div>
          </div>
        </Link>

        {isOwner && !editing && (
          <div className="post-owner-actions">
            <button className="link-btn" onClick={() => setEditing(true)}>Edit</button>
            <button className="link-btn danger" onClick={handleDelete}>Delete</button>
          </div>
        )}
      </header>

      {editing ? (
        <div className="post-edit">
          <textarea rows={3} value={editText} maxLength={1000} onChange={(e) => setEditText(e.target.value)} />
          {currentImage && !newImage && <img className="post-image" src={currentImage} alt="Post" />}
          {newImage && <p className="muted small">New image selected: {newImage.name}</p>}
          <div className="post-edit-actions">
            <label className="btn btn-ghost">
              📷 Change image
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/gif,image/webp"
                hidden
                onChange={(e) => {
                  setNewImage(e.target.files[0] || null);
                  setRemoveImg(false);
                }}
              />
            </label>
            {post.image && !removeImg && !newImage && (
              <button className="btn btn-ghost" onClick={() => setRemoveImg(true)}>Remove image</button>
            )}
            <span className="spacer" />
            <button className="btn btn-outline" onClick={cancelEdit}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      ) : (
        <>
          {post.content && <p className="post-content">{post.content}</p>}
          {post.image && <img className="post-image" src={imageUrl(post.image)} alt="Post" loading="lazy" />}
        </>
      )}

      <footer className="post-footer">
        <button className={`action-btn ${liked ? 'liked' : ''} ${pop ? 'pop' : ''}`} onClick={toggleLike} disabled={likeBusy}>
          <span className="heart">{liked ? '❤️' : '🤍'}</span> {likeCount} {likeCount === 1 ? 'Like' : 'Likes'}
        </button>
        <button className="action-btn" onClick={() => setShowComments(!showComments)}>
          💬 {commentCount} {commentCount === 1 ? 'Comment' : 'Comments'}
        </button>
      </footer>

      {showComments && <CommentSection postId={post.id} onCountChange={setCommentCount} />}
    </article>
  );
};

export default PostCard;
