-- Essais de connexion ratés à l'administration, pour bloquer les tentatives en série.
CREATE TABLE IF NOT EXISTS admin_login_attempts (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  ip VARCHAR(45) NOT NULL,
  failed_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  KEY admin_login_attempts_time (failed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
