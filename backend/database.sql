-- ============================================================
-- SocialConnect database  (MySQL / MariaDB - works with XAMPP)
-- Import this file in phpMyAdmin:  Import tab -> Choose file -> Go
-- WARNING: it DROPS and re-creates the tables (all old data is lost).
-- ============================================================

SET NAMES utf8mb4;

CREATE DATABASE IF NOT EXISTS social_media_app
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE social_media_app;

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS messages;
DROP TABLE IF EXISTS messages;
DROP TABLE IF EXISTS follows;
DROP TABLE IF EXISTS likes;
DROP TABLE IF EXISTS comments;
DROP TABLE IF EXISTS posts;
DROP TABLE IF EXISTS users;
SET FOREIGN_KEY_CHECKS = 1;

-- ---------- 1. users ----------
CREATE TABLE users (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name          VARCHAR(100)  NOT NULL,
  username      VARCHAR(30)   NOT NULL,
  email         VARCHAR(150)  NOT NULL,
  password      VARCHAR(255)  NOT NULL,            -- bcrypt hash, never plain text
  bio           VARCHAR(300)  DEFAULT NULL,
  profile_image VARCHAR(255)  DEFAULT NULL,        -- e.g. uploads/profiles/abc.jpg
  created_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_username (username),
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB;

-- ---------- 2. posts ----------
CREATE TABLE posts (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id    INT UNSIGNED NOT NULL,
  content    TEXT         NOT NULL,
  image      VARCHAR(255) DEFAULT NULL,
  created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_posts_user (user_id),
  KEY idx_posts_created (created_at),
  CONSTRAINT fk_posts_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------- 3. comments ----------
CREATE TABLE comments (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id    INT UNSIGNED NOT NULL,
  post_id    INT UNSIGNED NOT NULL,
  comment    VARCHAR(500) NOT NULL,
  created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_comments_post (post_id),
  KEY idx_comments_user (user_id),
  CONSTRAINT fk_comments_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_comments_post FOREIGN KEY (post_id) REFERENCES posts (id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------- 4. likes ----------
CREATE TABLE likes (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id    INT UNSIGNED NOT NULL,
  post_id    INT UNSIGNED NOT NULL,
  created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_likes_user_post (user_id, post_id),   -- one like per user per post
  KEY idx_likes_post (post_id),
  CONSTRAINT fk_likes_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_likes_post FOREIGN KEY (post_id) REFERENCES posts (id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------- 5. follows ----------
CREATE TABLE follows (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  follower_id  INT UNSIGNED NOT NULL,                 -- the person who follows
  following_id INT UNSIGNED NOT NULL,                 -- the person being followed
  created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_follows_pair (follower_id, following_id),  -- cannot follow twice
  KEY idx_follows_following (following_id),
  CONSTRAINT fk_follows_follower  FOREIGN KEY (follower_id)  REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_follows_following FOREIGN KEY (following_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT chk_no_self_follow CHECK (follower_id <> following_id)
) ENGINE=InnoDB;

-- ---------- 6. messages (private chat) ----------
CREATE TABLE messages (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  sender_id    INT UNSIGNED NOT NULL,
  receiver_id  INT UNSIGNED NOT NULL,
  message_text VARCHAR(1000) NOT NULL,
  is_read      BOOLEAN      NOT NULL DEFAULT FALSE,
  client_id    VARCHAR(64)  DEFAULT NULL,           -- stops duplicates when a message is re-sent after reconnect
  created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_messages_client (sender_id, client_id),
  KEY idx_messages_conversation (sender_id, receiver_id, id),
  KEY idx_messages_receiver_unread (receiver_id, is_read, sender_id),
  CONSTRAINT fk_messages_sender   FOREIGN KEY (sender_id)   REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_messages_receiver FOREIGN KEY (receiver_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT chk_messages_not_self CHECK (sender_id <> receiver_id)
) ENGINE=InnoDB;

-- ============================================================
-- SAMPLE DATA
-- Every demo user has the password:  password123
-- (stored below as a bcrypt hash, not plain text)
-- ============================================================
INSERT INTO users (id, name, username, email, password, bio) VALUES
  (1, 'Ali Khan',   'ali',   'ali@example.com',   '$2b$10$oZIzezfdzgT3fkIfaxKleORd2S9Cf3U3D5re1OVQ0nNCRBWWEMAs.', 'Coffee lover and web developer from Lahore.'),
  (2, 'Ahmed Raza', 'ahmed', 'ahmed@example.com', '$2b$10$oZIzezfdzgT3fkIfaxKleORd2S9Cf3U3D5re1OVQ0nNCRBWWEMAs.', 'Computer science student. Learning React.'),
  (3, 'Sara Malik', 'sara',  'sara@example.com',  '$2b$10$oZIzezfdzgT3fkIfaxKleORd2S9Cf3U3D5re1OVQ0nNCRBWWEMAs.', 'Designer. I like clean UIs and long walks.');

INSERT INTO posts (id, user_id, content, created_at) VALUES
  (1, 1, 'Hello SocialConnect! This is my first post. 👋',               NOW() - INTERVAL 3 DAY),
  (2, 2, 'Just finished my Programming Fundamentals assignment. Finally!', NOW() - INTERVAL 2 DAY),
  (3, 3, 'Good design is as little design as possible.',                  NOW() - INTERVAL 1 DAY),
  (4, 1, 'Anyone else learning React this semester?',                     NOW() - INTERVAL 5 HOUR),
  (5, 2, 'XAMPP + Node + React = full stack project working locally 🎉',   NOW() - INTERVAL 1 HOUR);

INSERT INTO follows (follower_id, following_id) VALUES
  (1, 2), (2, 1), (3, 1), (3, 2);

INSERT INTO likes (user_id, post_id) VALUES
  (2, 1), (3, 1), (1, 2), (3, 2), (1, 3), (2, 4), (1, 5), (3, 5);

INSERT INTO comments (user_id, post_id, comment) VALUES
  (2, 1, 'Welcome Ali!'),
  (3, 1, 'Nice to see you here.'),
  (1, 2, 'Well done Ahmed!'),
  (2, 4, 'Yes, me! It is fun.'),
  (1, 5, 'Great work, it looks awesome.');

INSERT INTO messages (sender_id, receiver_id, message_text, is_read, created_at) VALUES
  (1, 2, 'Salam Ahmed! How is the React project going?',      TRUE,  NOW() - INTERVAL 2 HOUR),
  (2, 1, 'Wa alaikum assalam Ali! Almost done, just styling.', TRUE,  NOW() - INTERVAL 110 MINUTE),
  (2, 1, 'Can you check my profile page later?',               FALSE, NOW() - INTERVAL 20 MINUTE),
  (3, 1, 'Hi Ali, loved your latest post!',                    FALSE, NOW() - INTERVAL 10 MINUTE);
