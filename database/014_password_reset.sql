-- Réglages modifiables depuis l'appli (nom, valeur) : le mot de passe d'administration choisi après un oubli y est gardé.
CREATE TABLE IF NOT EXISTS settings (
  name VARCHAR(60) NOT NULL,
  value TEXT NOT NULL,
  updated_at DATETIME NOT NULL,
  PRIMARY KEY (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Liens de réinitialisation du mot de passe d'administration (seule l'empreinte du jeton est gardée).
CREATE TABLE IF NOT EXISTS admin_password_resets (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  token_hash CHAR(64) NOT NULL,
  ip VARCHAR(45) NOT NULL,
  created_at DATETIME NOT NULL,
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY admin_password_resets_token (token_hash),
  KEY admin_password_resets_time (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
