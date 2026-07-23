CREATE TABLE IF NOT EXISTS users (
    userId INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    nickname VARCHAR(50) NOT NULL,
    profileImage VARCHAR(500) NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    lastLoginAt TIMESTAMP NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
);

CREATE TABLE IF NOT EXISTS userState (
    userId INT PRIMARY KEY,

    totalGames INT NOT NULL DEFAULT 0,
    winCount INT NOT NULL DEFAULT 0,
    loseCount INT NOT NULL DEFAULT 0,
    drawCount INT NOT NULL DEFAULT 0,

    rating INT NOT NULL DEFAULT 1200,

    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_userstate_user
    FOREIGN KEY (userId)
    REFERENCES users(userId)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS gameRecord (
    gameId BIGINT AUTO_INCREMENT PRIMARY KEY,
    roomTitle VARCHAR(100) NOT NULL,
    
    blackUserId INT NOT NULL,
    whiteUserId INT NOT NULL,
    winnerUserId INT NULL,

    boardState JSON NOT NULL,

    endReason VARCHAR(20) NOT NULL,

    totalTurn BIGINT NOT NULL,

    selectedAugment JSON NULL,

    startedAt DATETIME NOT NULL,
    endedAt DATETIME NOT NULL,

    CONSTRAINT fk_game_black
        FOREIGN KEY (blackUserId)
        REFERENCES users(userId)
        ON DELETE CASCADE,

    CONSTRAINT fk_game_white
        FOREIGN KEY (whiteUserId)
        REFERENCES users(userId)
        ON DELETE CASCADE,

    CONSTRAINT fk_game_winner
        FOREIGN KEY (winnerUserId)
        REFERENCES users(userId)
        ON DELETE SET NULL
);