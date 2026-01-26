// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title PenguinRush
 * @notice On-chain penguin jumping game on RISE Chain
 * @dev Every jump is a transaction! Optimized for RISE's 3ms shreds.
 */
contract PenguinRush {
    // ============ Structs ============
    struct GameSession {
        address player;
        uint256 startTime;
        uint256 jumpCount;
        uint256 distanceTraveled;
        uint256 score;
        bool isActive;
        bool reachedMountain;
    }

    struct PlayerStats {
        uint256 totalGames;
        uint256 totalJumps;
        uint256 highScore;
        uint256 bestDistance;
        uint256 mountainReaches;
    }

    struct JumpEvent {
        uint256 timestamp;
        uint256 jumpNumber;
        uint256 newScore;
        uint256 distanceAtJump;
    }

    // ============ State ============
    mapping(address => GameSession) public activeSessions;
    mapping(address => PlayerStats) public playerStats;
    mapping(address => JumpEvent[]) public playerJumpHistory;
    
    address[] public allPlayers;
    mapping(address => bool) public hasPlayed;
    
    uint256 public totalGamesPlayed;
    uint256 public totalJumpsRecorded;
    
    // ============ Constants ============
    uint256 public constant POINTS_PER_JUMP = 5;
    uint256 public constant POINTS_PER_LANDING = 10;
    uint256 public constant DISTANCE_PER_JUMP = 10;
    uint256 public constant MOUNTAIN_DISTANCE = 500;
    uint256 public constant MOUNTAIN_BONUS = 500;

    // ============ Events ============
    event GameStarted(address indexed player, uint256 timestamp, uint256 gameNumber);
    event Jump(address indexed player, uint256 jumpNumber, uint256 score, uint256 distance, uint256 timestamp);
    event IcebergLanded(address indexed player, uint256 jumpNumber, uint256 bonusPoints);
    event GameOver(address indexed player, uint256 finalScore, uint256 totalJumps, uint256 distance, bool reachedMountain);
    event NewHighScore(address indexed player, uint256 newHighScore, uint256 previousHighScore);
    event MountainReached(address indexed player, uint256 finalScore, uint256 totalJumps);

    // ============ Modifiers ============
    modifier hasActiveGame() {
        require(activeSessions[msg.sender].isActive, "No active game session");
        _;
    }

    modifier noActiveGame() {
        require(!activeSessions[msg.sender].isActive, "Game already in progress");
        _;
    }

    // ============ Game Functions ============
    
    /**
     * @notice Start a new game session
     */
    function startGame() external noActiveGame {
        if (!hasPlayed[msg.sender]) {
            hasPlayed[msg.sender] = true;
            allPlayers.push(msg.sender);
        }

        activeSessions[msg.sender] = GameSession({
            player: msg.sender,
            startTime: block.timestamp,
            jumpCount: 0,
            distanceTraveled: 0,
            score: 0,
            isActive: true,
            reachedMountain: false
        });

        playerStats[msg.sender].totalGames++;
        totalGamesPlayed++;

        emit GameStarted(msg.sender, block.timestamp, playerStats[msg.sender].totalGames);
    }

    /**
     * @notice Record a jump action - THE CORE GAME TX!
     * @param landedOnIceberg Whether the penguin landed successfully on an iceberg
     */
    function jump(bool landedOnIceberg) external hasActiveGame {
        GameSession storage session = activeSessions[msg.sender];
        
        session.jumpCount++;
        session.score += POINTS_PER_JUMP;
        session.distanceTraveled += DISTANCE_PER_JUMP;
        
        totalJumpsRecorded++;
        playerStats[msg.sender].totalJumps++;

        if (landedOnIceberg) {
            session.score += POINTS_PER_LANDING;
            emit IcebergLanded(msg.sender, session.jumpCount, POINTS_PER_LANDING);
        }

        // Record jump in history
        playerJumpHistory[msg.sender].push(JumpEvent({
            timestamp: block.timestamp,
            jumpNumber: session.jumpCount,
            newScore: session.score,
            distanceAtJump: session.distanceTraveled
        }));

        emit Jump(
            msg.sender,
            session.jumpCount,
            session.score,
            session.distanceTraveled,
            block.timestamp
        );

        // Check if reached mountain
        if (session.distanceTraveled >= MOUNTAIN_DISTANCE && !session.reachedMountain) {
            session.reachedMountain = true;
            session.score += MOUNTAIN_BONUS;
            playerStats[msg.sender].mountainReaches++;
            emit MountainReached(msg.sender, session.score, session.jumpCount);
        }
    }

    /**
     * @notice End the game (fell in water or voluntary end)
     */
    function endGame() external hasActiveGame {
        GameSession storage session = activeSessions[msg.sender];
        PlayerStats storage stats = playerStats[msg.sender];
        
        session.isActive = false;

        // Update high score
        if (session.score > stats.highScore) {
            uint256 previousHigh = stats.highScore;
            stats.highScore = session.score;
            emit NewHighScore(msg.sender, session.score, previousHigh);
        }

        // Update best distance
        if (session.distanceTraveled > stats.bestDistance) {
            stats.bestDistance = session.distanceTraveled;
        }

        emit GameOver(
            msg.sender,
            session.score,
            session.jumpCount,
            session.distanceTraveled,
            session.reachedMountain
        );
    }

    /**
     * @notice Quick jump + end game if fell (atomic fail transaction)
     */
    function jumpAndFall() external hasActiveGame {
        GameSession storage session = activeSessions[msg.sender];
        
        // Record the failed jump
        session.jumpCount++;
        totalJumpsRecorded++;
        playerStats[msg.sender].totalJumps++;

        emit Jump(
            msg.sender,
            session.jumpCount,
            session.score,
            session.distanceTraveled,
            block.timestamp
        );

        // End the game
        _endGameInternal(msg.sender);
    }

    // ============ View Functions ============

    function getActiveSession(address player) external view returns (GameSession memory) {
        return activeSessions[player];
    }

    function getPlayerStats(address player) external view returns (PlayerStats memory) {
        return playerStats[player];
    }

    function getJumpHistory(address player) external view returns (JumpEvent[] memory) {
        return playerJumpHistory[player];
    }

    function getRecentJumps(address player, uint256 count) external view returns (JumpEvent[] memory) {
        JumpEvent[] storage history = playerJumpHistory[player];
        uint256 len = history.length;
        if (count > len) count = len;
        
        JumpEvent[] memory recent = new JumpEvent[](count);
        for (uint256 i = 0; i < count; i++) {
            recent[i] = history[len - count + i];
        }
        return recent;
    }

    function getTotalPlayers() external view returns (uint256) {
        return allPlayers.length;
    }

    function getLeaderboard(uint256 count) external view returns (address[] memory players, uint256[] memory scores) {
        uint256 len = allPlayers.length;
        if (count > len) count = len;
        
        // Simple implementation - copy and sort
        address[] memory sorted = new address[](len);
        for (uint256 i = 0; i < len; i++) {
            sorted[i] = allPlayers[i];
        }
        
        // Bubble sort (fine for small lists)
        for (uint256 i = 0; i < len - 1; i++) {
            for (uint256 j = 0; j < len - i - 1; j++) {
                if (playerStats[sorted[j]].highScore < playerStats[sorted[j + 1]].highScore) {
                    address temp = sorted[j];
                    sorted[j] = sorted[j + 1];
                    sorted[j + 1] = temp;
                }
            }
        }
        
        players = new address[](count);
        scores = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            players[i] = sorted[i];
            scores[i] = playerStats[sorted[i]].highScore;
        }
    }

    function getGlobalStats() external view returns (
        uint256 _totalGames,
        uint256 _totalJumps,
        uint256 _totalPlayers
    ) {
        return (totalGamesPlayed, totalJumpsRecorded, allPlayers.length);
    }

    // ============ Internal ============

    function _endGameInternal(address player) internal {
        GameSession storage session = activeSessions[player];
        PlayerStats storage stats = playerStats[player];
        
        session.isActive = false;

        if (session.score > stats.highScore) {
            uint256 previousHigh = stats.highScore;
            stats.highScore = session.score;
            emit NewHighScore(player, session.score, previousHigh);
        }

        if (session.distanceTraveled > stats.bestDistance) {
            stats.bestDistance = session.distanceTraveled;
        }

        emit GameOver(
            player,
            session.score,
            session.jumpCount,
            session.distanceTraveled,
            session.reachedMountain
        );
    }
}
