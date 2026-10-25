-- ============================================================
-- Migration 001: add private messaging
-- Run this in phpMyAdmin (SQL tab) if you ALREADY have the database.
-- It only ADDS the "messages" table. Your users, posts, comments,
-- likes and follows are NOT touched or deleted.
-- Safe to run more than once.
-- ============================================================

USE social_media_app;

CREATE TABLE IF NOT EXISTS messages (
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
